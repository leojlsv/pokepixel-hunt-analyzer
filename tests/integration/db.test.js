import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import {
  openDatabase,
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
