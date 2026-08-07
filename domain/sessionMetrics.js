/**
 * "Current" view aggregation (docs/DEVELOPMENT.md §2, docs/PROTOCOL_AND_ANALYTICS.md §10-11).
 *
 * Pure: takes an already-fetched session row + its encounters and derives
 * every number the Side Panel's Current view shows. No IndexedDB access
 * here — sidepanel/sidepanel.js does the fetching, this just computes.
 *
 * `Seen` only counts non-orphan encounters (an orphan never had a
 * combat.started, so it was never really "seen" the way the legacy
 * counter meant it). `Captured`/`Failed` count by `captureResult`
 * regardless of state — a capture attempt is real data even if its
 * encounter is an orphan.
 */

import { activeMs as sessionActiveMs } from "./sessionTiming.js";

export const QUALITIES = Object.freeze([
  "weak",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical"
]);

function emptyBucket() {
  return { seen: 0, captured: 0, failed: 0 };
}

function buildEmptyRarities() {
  const rarities = { unknown: emptyBucket() };
  for (const quality of QUALITIES) rarities[quality] = emptyBucket();
  return rarities;
}

function qualityKey(quality) {
  return QUALITIES.includes(quality) ? quality : "unknown";
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

export function computeCurrentMetrics({ session, encounters = [], now = Date.now() }) {
  if (!session) return emptyMetrics();

  const elapsedMs = sessionActiveMs(session, now);

  let trainerExp = 0;
  let pokemonExp = 0;
  let gold = 0;
  let seen = 0;
  let captured = 0;
  let failed = 0;

  const rarities = buildEmptyRarities();
  const shiny = emptyBucket();

  for (const encounter of encounters) {
    trainerExp += Number(encounter.trainerExp) || 0;
    pokemonExp += Number(encounter.pokemonExp) || 0;
    gold += Number(encounter.gold) || 0;

    const key = qualityKey(encounter.quality);
    const isSeen = encounter.state !== "orphan";
    const isCaptured = encounter.captureResult === "success";
    const isFailed = encounter.captureResult === "failed";

    if (isSeen) {
      seen += 1;
      rarities[key].seen += 1;
      if (encounter.isShiny) shiny.seen += 1;
    }

    if (isCaptured) {
      captured += 1;
      rarities[key].captured += 1;
      if (encounter.isShiny) shiny.captured += 1;
    }

    if (isFailed) {
      failed += 1;
      rarities[key].failed += 1;
      if (encounter.isShiny) shiny.failed += 1;
    }
  }

  const rarePlusFailed =
    rarities.rare.failed +
    rarities.epic.failed +
    rarities.legendary.failed +
    rarities.mythical.failed;

  const status =
    session.status === "running"
      ? "running"
      : session.status === "paused"
        ? "paused"
        : "waiting";

  const hasUnknownQuality =
    rarities.unknown.seen + rarities.unknown.captured + rarities.unknown.failed > 0;

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
