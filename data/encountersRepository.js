/**
 * `encounters` store repository (docs/ARCHITECTURE.md §4).
 *
 * Thin persistence layer over data/repository.js — all correlation/state
 * logic lives in domain/encounterTracker.js; this module just applies the
 * effects it produces (`encounter.create` / `encounter.update` /
 * `encounter.finalize`, the latter two both being a patch merge here).
 */

import { createRepository } from "./repository.js";
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

  return { create, update, get, getAll };
}
