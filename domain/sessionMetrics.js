/**
 * "Current" view aggregation (docs/DEVELOPMENT.md §2, docs/PROTOCOL_AND_ANALYTICS.md §10-11).
 *
 * Pure: takes an already-fetched session row + its encounters and derives
 * every number the Side Panel's Current view shows. No IndexedDB access
 * here — sidepanel/sidepanel.js does the fetching, this just computes.
 *
 * The rarity/seen/captured/failed bucketing (`Seen` excludes orphans,
 * `Captured`/`Failed` count by `captureResult` regardless of state) lives
 * in domain/rarityBreakdown.js — Compare's "By Rarity" theme needs the
 * exact same aggregation over a different (filtered, cross-session)
 * encounter set, so it's shared rather than duplicated.
 */

import { activeMs as sessionActiveMs } from "./sessionTiming.js";
import { QUALITIES, computeRarityBreakdown } from "./rarityBreakdown.js";

export { QUALITIES };

function emptyBucket() {
  return { seen: 0, captured: 0, failed: 0 };
}

function buildEmptyRarities() {
  const rarities = { unknown: emptyBucket() };
  for (const quality of QUALITIES) rarities[quality] = emptyBucket();
  return rarities;
}

function perHour(amount, elapsedMs) {
  if (!(elapsedMs > 0)) return null;
  return amount / (elapsedMs / 3600000);
}

function rate(numerator, denominator) {
  if (!denominator) return null;
  return numerator / denominator;
}

function emptyMetrics() {
  return {
    status: "waiting",
    activeMs: 0,
    trainerExp: 0,
    trainerExpPerHour: null,
    pokemonExp: 0,
    pokemonExpPerHour: null,
    gold: 0,
    goldPerHour: null,
    seen: 0,
    captured: 0,
    failed: 0,
    seenToCaptureRate: null,
    attemptRate: null,
    rarePlusFailed: 0,
    rarities: buildEmptyRarities(),
    shiny: emptyBucket(),
    hasUnknownQuality: false
  };
}

export function computeSessionMetrics({ session, encounters = [], now = Date.now() }) {
  if (!session) return emptyMetrics();

  const elapsedMs = sessionActiveMs(session, now);

  let trainerExp = 0;
  let pokemonExp = 0;
  let gold = 0;

  for (const encounter of encounters) {
    trainerExp += Number(encounter.trainerExp) || 0;
    pokemonExp += Number(encounter.pokemonExp) || 0;
    gold += Number(encounter.gold) || 0;
  }

  const { seen, captured, failed, rarities, shiny, rarePlusFailed, hasUnknownQuality } =
    computeRarityBreakdown(encounters);

  const status =
    session.status === "running"
      ? "running"
      : session.status === "paused"
        ? "paused"
        : "waiting";

  return {
    status,
    activeMs: elapsedMs,
    trainerExp,
    trainerExpPerHour: perHour(trainerExp, elapsedMs),
    pokemonExp,
    pokemonExpPerHour: perHour(pokemonExp, elapsedMs),
    gold,
    goldPerHour: perHour(gold, elapsedMs),
    seen,
    captured,
    failed,
    seenToCaptureRate: rate(captured, seen),
    attemptRate: rate(captured, captured + failed),
    rarePlusFailed,
    rarities,
    shiny,
    hasUnknownQuality
  };
}
