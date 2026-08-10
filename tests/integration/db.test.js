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

test("creates all v1 stores and the encounters indexes", async () => {
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

test("upgrading v1 -> v2 adds sessions.startedAtMs without touching existing data", async () => {
  const indexedDBFactory = freshIndexedDBFactory();

  // Open at v1 only — simulates a real user's browser that installed the
  // extension before this migration shipped.
  const v1 = await openDatabase({ indexedDBFactory, version: 1 });

  const seedSession = { sessionId: "s1", status: "ended", startedAtMs: 1000 };
  await new Promise((resolve, reject) => {
    const request = v1
      .transaction(STORE_NAMES.SESSIONS, "readwrite")
      .objectStore(STORE_NAMES.SESSIONS)
      .put(seedSession);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });

  assert.equal(
    v1.transaction(STORE_NAMES.SESSIONS).objectStore(STORE_NAMES.SESSIONS).indexNames
      .length,
    0
  );

  v1.close();

  // Reopen at the real current version — triggers the v1 -> v2 upgrade.
  const v2 = await openDatabase({ indexedDBFactory, version: SCHEMA_VERSION });

  try {
    assert.equal(v2.version, SCHEMA_VERSION);

    const tx = v2.transaction(STORE_NAMES.SESSIONS, "readonly");
    const store = tx.objectStore(STORE_NAMES.SESSIONS);

    assert.deepEqual(Array.from(store.indexNames), ["startedAtMs"]);

    const preserved = await new Promise((resolve, reject) => {
      const request = store.get("s1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    assert.deepEqual(preserved, seedSession);
  } finally {
    v2.close();
  }
});

// Fase 5 step 2 (migration robustness) — the 3 tests below exercise paths
// data/db.js already handles but that had zero coverage until now.

test("a stuck older connection blocks the upgrade and openDatabase() rejects via onblocked", async () => {
  const indexedDBFactory = freshIndexedDBFactory();

  // Deliberately does not close on versionchange — simulates a stuck/
  // unresponsive connection. In production, sidepanel.js's real
  // `db.onversionchange = () => db.close()` is what normally prevents this
  // from ever blocking for long.
  const older = await openDatabase({ indexedDBFactory, version: 1 });

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
  // then throws, to confirm the whole upgrade transaction rolls back
  // atomically instead of leaving a half-migrated store behind. This is a
  // native IndexedDB guarantee data/migrations.js's design depends on but
  // that was never actually verified against fake-indexeddb until now.
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

  // Reopening at v1 (the last version that actually committed) should show
  // no trace of the aborted index.
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

  // Simulates reverting the extension to an older build after a newer one
  // already upgraded the schema. No special handling needed on our side —
  // this documents the native IndexedDB rejection already covers it.
  await assert.rejects(() => openDatabase({ indexedDBFactory, version: 1 }));
});
