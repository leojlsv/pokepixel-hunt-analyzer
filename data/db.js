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
    // IDBOpenDBRequest has no cancel() API. A blocked notification may be
    // followed by a delayed upgrade after another tab finally closes. Once
    // the caller has been rejected, never allow that abandoned request to
    // change the schema in the background.
    let abandoned = false;
    // version:null reopens an already-upgraded database without requesting an
    // unsafe downgrade. Only used as a fallback when v1.15.6 encounters the
    // schema v4 left behind by an earlier QA candidate.
    const request = version === null
      ? indexedDBFactory.open(name)
      : indexedDBFactory.open(name, version);

    request.onupgradeneeded = (event) => {
      if (abandoned) {
        request.transaction?.abort();
        return;
      }
      // The upgrade transaction is the only way to add an index to an
      // EXISTING store (creating a brand-new store only needs `db`).
      runMigrations(request.result, event.oldVersion, event.newVersion, request.transaction);
    };

    request.onblocked = () => {
      abandoned = true;
      reject(
        new Error(
          "openDatabase: blocked by another open connection with an older version"
        )
      );
    };

    request.onsuccess = () => {
      const db = request.result;
      if (abandoned) {
        db.close();
        return;
      }

      // A userscript update can introduce a new schema while another game tab
      // still holds an older connection. Closing on versionchange lets the
      // upgrading tab proceed instead of leaving the user's database blocked
      // until every older tab is manually closed/reloaded.
      db.onversionchange = () => db.close();
      resolve(db);
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
