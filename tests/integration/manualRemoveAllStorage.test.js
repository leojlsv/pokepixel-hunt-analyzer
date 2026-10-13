import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { clearAllAnalytics } from "../../data/clear-all.js";
import { openDatabase, DB_NAME, STORE_NAMES, SCHEMA_VERSION } from "../../data/db.js";
import { registerDatabaseWriteGate, WriteLeadershipLostError } from "../../data/write-gate.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { canGenerateCaptureTicket } from "../../domain/captureTicket.js";

function txComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error("IDB transaction aborted"));
  });
}

async function seed(db) {
  const tx = db.transaction(Object.values(STORE_NAMES), "readwrite");
  const done = txComplete(tx);
  tx.objectStore(STORE_NAMES.ENCOUNTERS).put({ encounterId: "one", sessionId: "hunt", startedAtMs: 1 });
  tx.objectStore(STORE_NAMES.SESSIONS).put({ sessionId: "hunt", status: "running" });
  tx.objectStore(STORE_NAMES.CONFIGS).put({ configId: "cfg" });
  tx.objectStore(STORE_NAMES.META).put("hunt", "currentSessionId");
  await done;
}

async function counts(db) {
  const result = {};
  for (const name of Object.values(STORE_NAMES)) {
    const request = db.transaction(name).objectStore(name).count();
    result[name] = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return result;
}

test("manual removal clears four analytics stores atomically and preserves database schema", async () => {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  try {
    await seed(db);
    let active = true;
    registerDatabaseWriteGate(db, () => active);
    assert.deepEqual(await counts(db), { encounters: 1, sessions: 1, configs: 1, meta: 1 });
    active = false;
    await assert.rejects(clearAllAnalytics(db), WriteLeadershipLostError);
    assert.deepEqual(await counts(db), { encounters: 1, sessions: 1, configs: 1, meta: 1 });
    active = true;
    assert.deepEqual((await clearAllAnalytics(db)).clearedStores, ["encounters", "sessions", "configs", "meta"]);
    assert.deepEqual(await counts(db), { encounters: 0, sessions: 0, configs: 0, meta: 0 });
    assert.equal(db.version, SCHEMA_VERSION);
    await clearAllAnalytics(db);
    assert.deepEqual(await counts(db), { encounters: 0, sessions: 0, configs: 0, meta: 0 });
  } finally { db.close(); }
});

test("manual removal retains only valid ticket fields without session linkage and remains idempotent", async () => {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const now = Date.now();
  const ticket = (encounterId, overrides = {}) => ({
    encounterId, sessionId: "current", captureResult: "success",
    speciesName: "Mewtwo", quality: "legendary", qualityMultiplier: 1.83,
    ivTotal: 177, capturedByName: "Trainer", isShiny: false,
    captureAtMs: now - 86_400_000 * 40,
    captureTicketAtMs: now - 86_400_000 * 40,
    startedAtMs: now - 86_400_000 * 40, gold: 500,
    lootItems: [{ itemId: "rare-loot", qty: 5 }], configId: "config1",
    ...overrides
  });
  try {
    const tx = db.transaction(Object.values(STORE_NAMES), "readwrite");
    const done = txComplete(tx);
    const encounters = tx.objectStore(STORE_NAMES.ENCOUNTERS);
    encounters.put(ticket("legendary"));
    encounters.put(ticket("mythical", { quality: "mythical" }));
    encounters.put(ticket("shiny", { quality: "common", isShiny: true }));
    encounters.put(ticket("invalid-fields", { capturedByName: "" }));
    encounters.put(ticket("invalid-index", { captureTicketAtMs: now - 100 }));
    encounters.put(ticket("not-ticket", { quality: "common", isShiny: false, captureTicketAtMs: undefined }));
    for (let i = 0; i < 60; i++) {
      encounters.put(ticket(`legend-${i}`, { captureAtMs: now - i * 1_000, captureTicketAtMs: now - i * 1_000 }));
    }
    tx.objectStore(STORE_NAMES.SESSIONS).put({ sessionId: "current", status: "ended" });
    tx.objectStore(STORE_NAMES.CONFIGS).put({ configId: "config1" });
    tx.objectStore(STORE_NAMES.META).put("current", "currentSessionId");
    await done;

    registerDatabaseWriteGate(db, () => true);
    const result = await clearAllAnalytics(db);
    assert.equal(result.preservedGalleryCount, 63);
    assert.deepEqual(await counts(db), { encounters: 63, sessions: 0, configs: 0, meta: 0 });
    const saved = await createEncountersRepository(db).getRecentCaptureTickets(100);
    assert.equal(saved.length, 63, "all tickets remain discoverable via the original sparse index");
    for (const row of saved) {
      assert.equal(canGenerateCaptureTicket(row), true);
      assert.deepEqual(Object.keys(row).sort(), [
        "encounterId", "captureTicketAtMs", "captureAtMs", "captureResult",
        "speciesName", "quality", "qualityMultiplier", "ivTotal", "capturedByName", "isShiny"
      ].sort());
    }
    assert.equal((await clearAllAnalytics(db)).preservedGalleryCount, 63);
    assert.deepEqual(await counts(db), { encounters: 63, sessions: 0, configs: 0, meta: 0 });
  } finally { db.close(); }
});

test("rollback can reopen a QA-upgraded v4 IndexedDB without downgrade or deletion", async () => {
  const factory = new IDBFactory();
  const previous = await openDatabase({ indexedDBFactory: factory });
  await seed(previous);
  previous.close();
  const upgraded = await new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, 4);
    request.onupgradeneeded = () => {
      request.transaction.objectStore(STORE_NAMES.ENCOUNTERS)
        .createIndex("extraQAIndex", "updatedAtMs");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  upgraded.close();
  await assert.rejects(openDatabase({ indexedDBFactory: factory }), { name: "VersionError" });
  const reopened = await openDatabase({ indexedDBFactory: factory, version: null });
  try {
    assert.equal(reopened.version, 4);
    assert.deepEqual(await counts(reopened), { encounters: 1, sessions: 1, configs: 1, meta: 1 });
    assert.ok(reopened.transaction(STORE_NAMES.ENCOUNTERS).objectStore(STORE_NAMES.ENCOUNTERS).indexNames.contains("extraQAIndex"));
    const repo = createEncountersRepository(reopened);
    await repo.create({
      encounterId: "v4-shiny", sessionId: "hunt", captureResult: "success",
      speciesName: "Umbreon", quality: "common", isShiny: true,
      qualityMultiplier: 1.76, ivTotal: 165, capturedByName: "Trainer",
      captureAtMs: 1_800_000_000_000, captureTicketAtMs: 1_800_000_000_000
    });
    registerDatabaseWriteGate(reopened, () => true);
    assert.equal((await clearAllAnalytics(reopened)).preservedGalleryCount, 1);
    assert.equal(reopened.version, 4);
    assert.deepEqual(await counts(reopened), { encounters: 1, sessions: 0, configs: 0, meta: 0 });
    assert.deepEqual((await repo.getRecentCaptureTickets()).map(row => row.encounterId), ["v4-shiny"]);
  } finally { reopened.close(); }
});
