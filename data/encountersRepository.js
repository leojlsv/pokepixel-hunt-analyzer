/**
 * `encounters` store repository (docs/ARCHITECTURE.md §4).
 *
 * Thin persistence layer over data/repository.js — all correlation/state
 * logic lives in domain/encounterTracker.js; this module just applies the
 * effects it produces (`encounter.create` / `encounter.update` /
 * `encounter.finalize`, the latter two both being a patch merge here).
 */

import { createRepository } from "./repository.js";
import { promisifyRequest } from "./db.js";
import { STORE_NAMES } from "./migrations.js";

export function createEncountersRepository(db) {
  const repo = createRepository(db, STORE_NAMES.ENCOUNTERS);

  async function create(row) {
    await repo.put(row);
    return row;
  }

  async function update(encounterId, patch) {
    const existing = await repo.get(encounterId);

    if (!existing) {
      throw new Error(
        `encountersRepository.update: unknown encounterId "${encounterId}"`
      );
    }

    const updated = { ...existing, ...patch };
    await repo.put(updated);

    return updated;
  }

  function get(encounterId) {
    return repo.get(encounterId);
  }

  function getAll() {
    return repo.getAll();
  }

  // Uses the `sessionId` index created in Fase 1's migration — needed by
  // the Side Panel's Current view (domain/sessionMetrics.js) to fetch only
  // the current session's encounters instead of the whole store.
  function getBySessionId(sessionId) {
    const store = db
      .transaction(STORE_NAMES.ENCOUNTERS, "readonly")
      .objectStore(STORE_NAMES.ENCOUNTERS);

    return promisifyRequest(store.index("sessionId").getAll(sessionId));
  }

  /**
   * Deletes every encounter belonging to one session (History's delete
   * control, Fase 4). Callers must run this BEFORE
   * sessionsRepository.deleteSession(sessionId) — see that module's
   * docstring for why the ordering matters.
   */
  function deleteBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const store = db
        .transaction(STORE_NAMES.ENCOUNTERS, "readwrite")
        .objectStore(STORE_NAMES.ENCOUNTERS);

      // A bare (non-IDBKeyRange) query is treated as an exact-match range.
      const request = store.index("sessionId").openCursor(sessionId);

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          resolve();
          return;
        }

        cursor.delete();
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  return { create, update, get, getAll, getBySessionId, deleteBySessionId };
}
