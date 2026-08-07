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

  return { create, update, get, getAll, getBySessionId };
}
