/**
 * IndexedDB connection helper. Promisifies the callback-based IndexedDB API
 * used by data/repository.js and data/configsRepository.js.
 *
 * `indexedDBFactory` is injectable (defaults to the global `indexedDB`) so
 * tests can pass an isolated fake-indexeddb instance instead of relying on
 * global state (tests/integration/*.test.js).
 */

import { SCHEMA_VERSION, STORE_NAMES, runMigrations } from "./migrations.js";

export const DB_NAME = "pokepixel_hunt_analyzer";
export { SCHEMA_VERSION, STORE_NAMES };

export function openDatabase({
  indexedDBFactory = globalThis.indexedDB,
  name = DB_NAME,
  version = SCHEMA_VERSION
} = {}) {
  if (!indexedDBFactory) {
    return Promise.reject(
      new Error("openDatabase: no IndexedDB implementation available")
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(name, version);

    request.onupgradeneeded = (event) => {
      // The upgrade transaction is the only way to add an index to an
      // EXISTING store (creating a brand-new store only needs `db`).
      runMigrations(request.result, event.oldVersion, event.newVersion, request.transaction);
    };

    request.onblocked = () => {
      reject(
        new Error(
          "openDatabase: blocked by another open connection with an older version"
        )
      );
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/** Wraps an IDBRequest in a Promise. Shared by every repository. */
export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
