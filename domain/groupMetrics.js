/**
 * Compare view aggregation — one `groupKey` (species+level+config) at a
 * time, docs/DEVELOPMENT.md §2 "Compare aggregates by species + level +
 * config". Grouping itself (splitting an encounters array by `groupKey`)
 * happens in the caller; this only computes the numbers for one group's
 * encounters.
 *
 * Deliberately different math from domain/sessionMetrics.js: rates here
 * are per CYCLE hour (summed `encounter.cycleMs`), not per session
 * active_ms — docs/PROTOCOL_AND_ANALYTICS.md §11: "Do not assign the
 * entire session time to every group_key."
 */

function perHour(amount, elapsedMs) {
  return elapsedMs > 0 ? amount / (elapsedMs / 3600000) : null;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

export function computeGroupMetrics(encounters = []) {
  let seen = 0;
  let captured = 0;
  let failed = 0;
  let trainerExp = 0;
  let pokemonExp = 0;
  let gold = 0;
  let groupCycleMs = 0;

  for (const encounter of encounters) {
    // Same convention as domain/sessionMetrics.js: an orphan was never
    // really "seen" (no combat.started), but a capture attempt attached
    // to it is still real data.
    if (encounter.state !== "orphan") seen += 1;
    if (encounter.captureResult === "success") captured += 1;
    if (encounter.captureResult === "failed") failed += 1;

    trainerExp += Number(encounter.trainerExp) || 0;
    pokemonExp += Number(encounter.pokemonExp) || 0;
    gold += Number(encounter.gold) || 0;

    if (Number.isFinite(encounter.cycleMs)) {
      groupCycleMs += encounter.cycleMs;
    }
  }

  return {
    seen,
    captured,
    failed,
    seenToCaptureRate: rate(captured, seen),
    attemptRate: rate(captured, captured + failed),
    groupCycleMs,
    trainerExp,
    trainerExpPerCycleHour: perHour(trainerExp, groupCycleMs),
    pokemonExp,
    pokemonExpPerCycleHour: perHour(pokemonExp, groupCycleMs),
    gold,
    dollarPerCycleHour: perHour(gold, groupCycleMs)
  };
}
