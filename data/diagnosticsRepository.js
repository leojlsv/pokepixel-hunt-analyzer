/**
 * `meta` store repository for the safe diagnostics counters
 * (docs/DEVELOPMENT.md §9). `meta` is a generic out-of-line-key store
 * (data/migrations.js) already shared with data/sessionsRepository.js's
 * `currentSessionId` pointer — this just adds one more key.
 *
 * Only the 6 cumulative counters live here. The other 3 diagnostics
 * fields (active_encounters, db_version, app_version) are point-in-time
 * gauges, not counters — they'd go stale the instant they're written
 * with no reader, so services/eventPipeline.js's getDiagnosticsSnapshot()
 * computes them on demand instead of persisting them.
 */

import { createRepository } from "./repository.js";
import { STORE_NAMES } from "./migrations.js";

const DIAGNOSTICS_KEY = "diagnosticsCounters";

function emptyCounters() {
  return {
    eventsReceived: 0,
    eventsIgnored: 0,
    parseErrors: 0,
    dbErrors: 0,
    orphanEvents: 0,
    duplicateEvents: 0
  };
}

export function createDiagnosticsRepository(db) {
  const meta = createRepository(db, STORE_NAMES.META);

  async function getCounters() {
    const stored = await meta.get(DIAGNOSTICS_KEY);
    return { ...emptyCounters(), ...stored };
  }

  // Read-modify-write: sums each field in `patch` onto the current
  // stored value (defaulting missing/unknown fields to 0) and persists
  // the result. No batching — see docs/DEVELOPMENT.md's Fase 5
  // Performance step for whether this ever needs to change.
  async function increment(patch) {
    const current = await getCounters();
    const next = { ...current };

    for (const [field, amount] of Object.entries(patch)) {
      next[field] = (next[field] || 0) + amount;
    }

    await meta.put(next, DIAGNOSTICS_KEY);
    return next;
  }

  return { getCounters, increment };
}
