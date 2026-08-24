import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import {
  openDatabase,
  DB_NAME,
  SCHEMA_VERSION,
  STORE_NAMES
} from "../../data/db.js";

// A fresh IDBFactory per test keeps fake-indexeddb's in-memory storage
// isolated between tests instead of sharing the module-level singleton.
function freshIndexedDBFactory() {
  return new IDBFactory();
}

test("creates all stores and the current encounters indexes", async () => {
  const db = await openDatabase({
    indexedDBFactory: freshIndexedDBFactory()
  });

  try {
    assert.equal(db.version, SCHEMA_VERSION);

    assert.deepEqual(
      Array.from(db.objectStoreNames).sort(),
      [
        STORE_NAMES.CONFIGS,
        STORE_NAMES.ENCOUNTERS,
        STORE_NAMES.META,
        STORE_NAMES.SESSIONS
      ].sort()
    );

    const tx = db.transaction(STORE_NAMES.ENCOUNTERS, "readonly");
    const encounters = tx.objectStore(STORE_NAMES.ENCOUNTERS);

    assert.deepEqual(Array.from(encounters.indexNames).sort(), [
      "captureTicketAtMs",
      "groupKey",
      "quality",
      "sessionId",
      "speciesId",
      "startedAtMs"
    ]);
  } finally {
    db.close();
  }
});

test("configs and sessions stores use the documented keyPath", async () => {
  const db = await openDatabase({
    indexedDBFactory: freshIndexedDBFactory()
  });

  try {
    const tx = db.transaction(
      [STORE_NAMES.CONFIGS, STORE_NAMES.SESSIONS],
      "readonly"
    );

    assert.equal(tx.objectStore(STORE_NAMES.CONFIGS).keyPath, "configId");
    assert.equal(tx.objectStore(STORE_NAMES.SESSIONS).keyPath, "sessionId");
  } finally {
    db.close();
  }
});

test("reopening the same database at the same version does not duplicate or break stores", async () => {
  const indexedDBFactory = freshIndexedDBFactory();

  const first = await openDatabase({ indexedDBFactory });
  first.close();

  const second = await openDatabase({ indexedDBFactory });

  try {
    assert.equal(second.version, SCHEMA_VERSION);
    assert.equal(second.objectStoreNames.length, 4);
  } finally {
    second.close();
  }
});

test("rejects when no IndexedDB implementation is available", async () => {
  await assert.rejects(() =>
    openDatabase({ indexedDBFactory: undefined })
  );
});

test("upgrading v1 -> current adds indexes without rewriting historical encounters", async () => {
  const indexedDBFactory = freshIndexedDBFactory();

  // Open at v1 only — simulates a real user's browser that installed the
  // analyzer before later migrations shipped.
  const v1 = await openDatabase({ indexedDBFactory, version: 1 });

  const seedSession = { sessionId: "s1", status: "ended", startedAtMs: 1000 };
  const historicalEncounter = {
    encounterId: "historical",
    captureResult: "success",
    captureAtMs: 2000,
    speciesName: "Mewtwo",
    capturedByName: "Rhyxus",
    quality: "legendary",
    qualityMultiplier: 1.72,
    ivTotal: 189,
    isShiny: false,
    state: "success"
  };

  await new Promise((resolve, reject) => {
    const transaction = v1.transaction(
      [STORE_NAMES.SESSIONS, STORE_NAMES.ENCOUNTERS],
      "readwrite"
    );
    transaction.objectStore(STORE_NAMES.SESSIONS).put(seedSession);
    transaction.objectStore(STORE_NAMES.ENCOUNTERS).put(historicalEncounter);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });

  assert.equal(
    v1.transaction(STORE_NAMES.SESSIONS).objectStore(STORE_NAMES.SESSIONS).indexNames
      .length,
    0
  );
  assert.equal(
    v1.transaction(STORE_NAMES.ENCOUNTERS).objectStore(STORE_NAMES.ENCOUNTERS)
      .indexNames.contains("captureTicketAtMs"),
    false
  );

  v1.close();

  const current = await openDatabase({ indexedDBFactory, version: SCHEMA_VERSION });

  try {
    assert.equal(current.version, SCHEMA_VERSION);

    const sessionsStore = current
      .transaction(STORE_NAMES.SESSIONS, "readonly")
      .objectStore(STORE_NAMES.SESSIONS);
    assert.deepEqual(Array.from(sessionsStore.indexNames), ["startedAtMs"]);

    const preservedSession = await new Promise((resolve, reject) => {
      const request = sessionsStore.get("s1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    assert.deepEqual(preservedSession, seedSession);

    const encountersStore = current
      .transaction(STORE_NAMES.ENCOUNTERS, "readonly")
      .objectStore(STORE_NAMES.ENCOUNTERS);
    assert.equal(encountersStore.indexNames.contains("captureTicketAtMs"), true);

    const preservedEncounter = await new Promise((resolve, reject) => {
      const request = encountersStore.get("historical");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    assert.deepEqual(preservedEncounter, historicalEncounter);

    const indexedRows = await new Promise((resolve, reject) => {
      const request = encountersStore.index("captureTicketAtMs").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    assert.deepEqual(indexedRows, []);
  } finally {
    current.close();
  }
});

test("managed older connections close on versionchange so a schema upgrade can proceed", async () => {
  const indexedDBFactory = freshIndexedDBFactory();
  const older = await openDatabase({ indexedDBFactory, version: 1 });

  const current = await openDatabase({
    indexedDBFactory,
    version: SCHEMA_VERSION
  });

  try {
    assert.equal(current.version, SCHEMA_VERSION);
    assert.throws(
      () => older.transaction(STORE_NAMES.META, "readonly"),
      /closed|closing|InvalidStateError/i
    );
  } finally {
    current.close();
  }
});

// Migration robustness — the 3 tests below exercise failure paths explicitly.

test("a deliberately stuck older connection still reports a blocked upgrade", async () => {
  const indexedDBFactory = freshIndexedDBFactory();
  const older = await openDatabase({ indexedDBFactory, version: 1 });

  // Override the normal auto-close behavior to simulate a genuinely stuck
  // third-party/legacy connection that ignores versionchange.
  older.onversionchange = () => {};

  await assert.rejects(
    () => openDatabase({ indexedDBFactory, version: SCHEMA_VERSION }),
    /blocked/
  );

  older.close();
});

test("a migration that throws mid-upgrade aborts atomically — no partial index survives", async () => {
  const indexedDBFactory = freshIndexedDBFactory();

  const v1 = await openDatabase({ indexedDBFactory, version: 1 });
  v1.close();

  // Simulates a broken v2 migration directly against the raw IndexedDB API
  // (bypassing data/migrations.js on purpose) — partially creates an index,
  // then throws, to confirm the whole upgrade transaction rolls back.
  const brokenOpen = indexedDBFactory.open(DB_NAME, 2);

  const brokenResult = await new Promise((resolve) => {
    brokenOpen.onupgradeneeded = () => {
      brokenOpen.transaction
        .objectStore(STORE_NAMES.SESSIONS)
        .createIndex("startedAtMs", "startedAtMs");

      throw new Error("simulated migration failure");
    };

    brokenOpen.onerror = () => resolve({ ok: false });
    brokenOpen.onsuccess = () => resolve({ ok: true, db: brokenOpen.result });
  });

  assert.equal(brokenResult.ok, false);

  const reopened = await openDatabase({ indexedDBFactory, version: 1 });

  try {
    assert.equal(reopened.version, 1);

    const store = reopened
      .transaction(STORE_NAMES.SESSIONS, "readonly")
      .objectStore(STORE_NAMES.SESSIONS);

    assert.deepEqual(Array.from(store.indexNames), []);
  } finally {
    reopened.close();
  }
});

test("opening at a version lower than what is already persisted rejects cleanly", async () => {
  const indexedDBFactory = freshIndexedDBFactory();

  const atCurrent = await openDatabase({ indexedDBFactory, version: SCHEMA_VERSION });
  atCurrent.close();

  await assert.rejects(() => openDatabase({ indexedDBFactory, version: 1 }));
});
