import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { openDatabase, STORE_NAMES } from "../../data/db.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { readEncounterRevision } from "../../data/encounter-revision.js";
import { clearAllAnalytics } from "../../data/clear-all.js";

test("session revision is committed with create/update and visible across connections", async () => {
  const indexedDBFactory = new IDBFactory();
  const a = await openDatabase({ indexedDBFactory });
  const b = await openDatabase({ indexedDBFactory });
  try {
    const writerA = createEncountersRepository(a);
    const writerB = createEncountersRepository(b);
    assert.equal(await writerA.getSessionRevision("hunt-a"), null);
    const first = { encounterId: "one", sessionId: "hunt-a", gold: 10 };
    await writerA.create(first);
    const r1 = await writerB.getSessionRevision("hunt-a");
    assert.equal(r1.sequence, 1);
    assert.equal(r1.coverage, "cooperating-only");
    assert.equal(typeof r1.token, "string");
    await writerB.updateWithPrevious("one", { gold: 20 });
    const r2 = await writerA.getSessionRevision("hunt-a");
    assert.equal(r2.token, r1.token);
    assert.equal(r2.sequence, 2);
    await writerA.create({ encounterId: "two", sessionId: "hunt-b" });
    assert.deepEqual(await writerA.getSessionRevision("hunt-a"), r2);
    assert.equal((await writerB.getSessionRevision("hunt-b")).sequence, 1);
    await assert.rejects(writerB.create(first), { name: "ConstraintError" });
    await assert.rejects(writerA.updateWithPrevious("one", { sessionId: "hunt-b" }));
    assert.deepEqual(await writerB.getSessionRevision("hunt-a"), r2,
      "aborted mutations cannot advance durable revision");
  } finally { a.close(); b.close(); }
});

test("parallel writers serialize revision bumps, and deletion invalidates session page tokens", async () => {
  const indexedDBFactory = new IDBFactory();
  const a = await openDatabase({ indexedDBFactory });
  const b = await openDatabase({ indexedDBFactory });
  try {
    const writerA = createEncountersRepository(a);
    const writerB = createEncountersRepository(b);
    await writerA.create({ encounterId: "a", sessionId: "s", captureResult: "failed" });
    const initial = await writerA.getSessionRevision("s");
    await Promise.all([
      writerA.updateWithPrevious("a", { gold: 4 }),
      writerB.create({ encounterId: "b", sessionId: "s", captureResult: "success" }),
      writerB.updateWithPrevious("a", { lootSellValue: 2 })
    ]);
    const changed = await writerA.getSessionRevision("s");
    assert.equal(changed.sequence, initial.sequence + 3);
    assert.equal(changed.token, initial.token);
    await writerB.deleteBySessionId("s");
    assert.deepEqual(await writerA.getBySessionId("s"), []);
    assert.equal((await writerA.getSessionRevision("s")).sequence, changed.sequence + 1);
    await clearAllAnalytics(a);
    assert.equal(await writerB.getSessionRevision("s"), null,
      "a manual wipe must invalidate any previously captured revision token");
    await writerB.create({ encounterId: "after-wipe", sessionId: "s" });
    const afterWipe = await writerA.getSessionRevision("s");
    assert.equal(afterWipe.sequence, 1);
    assert.notEqual(afterWipe.token, initial.token,
      "a new incarnation must never alias a pre-wipe page token");
  } finally { a.close(); b.close(); }
});

test("legacy/raw IDB writers are explicitly NOT covered by the cooperation-only token", async () => {
  const indexedDBFactory = new IDBFactory();
  const a = await openDatabase({ indexedDBFactory });
  const oldClient = await openDatabase({ indexedDBFactory });
  try {
    const repo = createEncountersRepository(a);
    await repo.create({ encounterId: "e", sessionId: "legacy", gold: 1 });
    const before = await readEncounterRevision(a, "legacy");
    // This is the exact semantic hazard of a v1.15.7 or external IndexedDB
    // client. Version checks alone cannot prevent old `version:null` reopen.
    const tx = oldClient.transaction(STORE_NAMES.ENCOUNTERS, "readwrite");
    tx.objectStore(STORE_NAMES.ENCOUNTERS).put({ encounterId: "e", sessionId: "legacy", gold: 999 });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    assert.deepEqual(await readEncounterRevision(a, "legacy"), before);
    assert.equal((await repo.get("e")).gold, 999);
    assert.equal(before.coverage, "cooperating-only");
  } finally { a.close(); oldClient.close(); }
});

test("aborting after meta revision put rolls back both the new row and its revision", async () => {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const originalPut = IDBObjectStore.prototype.put;
  let aborted = false;
  try {
    const repo = createEncountersRepository(db);
    await repo.create({ encounterId: "baseline", sessionId: "s", gold: 2 });
    const initial = await repo.getSessionRevision("s");
    IDBObjectStore.prototype.put = function (value, key, ...args) {
      const request = originalPut.call(this, value, key, ...args);
      if (!aborted && this.name === STORE_NAMES.META &&
        typeof key === "string" && key.startsWith("encounterRevision:")) {
        request.addEventListener("success", () => {
          aborted = true;
          request.transaction.abort();
        });
      }
      return request;
    };
    await assert.rejects(repo.updateWithPrevious("baseline", { gold: 300 }), /abort/i);
    assert.equal(aborted, true);
    assert.equal((await repo.get("baseline")).gold, 2);
    assert.deepEqual(await repo.getSessionRevision("s"), initial);
  } finally {
    IDBObjectStore.prototype.put = originalPut;
    db.close();
  }
});

test("orphan/archive rows without sessionId do not invent phantom session revisions", async () => {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  try {
    const repo = createEncountersRepository(db);
    await repo.create({ encounterId: "orphan", state: "started" });
    await repo.updateWithPrevious("orphan", { state: "finalized" });
    assert.equal(await repo.getSessionRevision("unrelated"), null);
    await assert.rejects(() => repo.getSessionRevision(""), /nonempty sessionId/);
  } finally { db.close(); }
});

test("malformed revision metadata fails closed and refuses new encounter mutation", async () => {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  try {
    const repo = createEncountersRepository(db);
    await repo.create({ encounterId: "one", sessionId: "s", gold: 10 });
    const tx = db.transaction(STORE_NAMES.META, "readwrite");
    tx.objectStore(STORE_NAMES.META).put({ token: "bad", sequence: Number.MAX_SAFE_INTEGER }, "encounterRevision:s");
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    assert.equal(await repo.getSessionRevision("s"), null);
    await assert.rejects(repo.updateWithPrevious("one", { gold: 400 }));
    assert.equal((await repo.get("one")).gold, 10);
  } finally { db.close(); }
});
