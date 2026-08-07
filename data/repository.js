/**
 * Generic per-store CRUD wrapper. Used directly for stores that don't yet
 * have business rules of their own (`sessions`, `encounters` — their
 * lifecycle/tracker logic lands in Phase 2/3), and as the building block
 * for stores that do (data/configsRepository.js).
 */

import { promisifyRequest } from "./db.js";

export function createRepository(db, storeName) {
  function readStore() {
    return db.transaction(storeName, "readonly").objectStore(storeName);
  }

  function writeStore() {
    return db.transaction(storeName, "readwrite").objectStore(storeName);
  }

  return {
    get(key) {
      return promisifyRequest(readStore().get(key));
    },

    getAll() {
      return promisifyRequest(readStore().getAll());
    },

    // `key` is only needed for out-of-line-key stores (e.g. `meta`) —
    // in-line keyPath stores (sessions/configs/encounters) derive it from
    // the value itself.
    put(value, key) {
      const store = writeStore();

      return promisifyRequest(
        key === undefined ? store.put(value) : store.put(value, key)
      );
    },

    delete(key) {
      return promisifyRequest(writeStore().delete(key));
    }
  };
}
