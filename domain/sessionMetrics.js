/**
 * "Current" view aggregation (docs/DEVELOPMENT.md §2, docs/PROTOCOL_AND_ANALYTICS.md §10-11).
 *
 * Pure: takes an already-fetched session row + its encounters and derives
 * every number the Side Panel's Current view shows. No IndexedDB access
 * here — sidepanel/sidepanel.js does the fetching, this just computes.
 *
 * The rarity/seen/captured/failed bucketing (`Seen = Captured + Failed`,
 * exactly — see domain/rarityBreakdown.js's header) lives there —
 * Compare's "By Rarity" theme needs the exact same aggregation over a
 * different (filtered, cross-session) encounter set, so it's shared
 * rather than duplicated.
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
    hasUnknownQuality: false,
    capsulesCost: 0,
    potionsUsed: 0,
    potionsCost: 0,
    expenses: 0,
    expensesPerHour: null
  };
}

export function computeSessionMetrics({ session, encounters = [], now = Date.now() }) {
  if (!session) return emptyMetrics();

  const elapsedMs = sessionActiveMs(session, now);

  let trainerExp = 0;
  let pokemonExp = 0;
  let gold = 0;
  let capsulesCost = 0;

  for (const encounter of encounters) {
    trainerExp += Number(encounter.trainerExp) || 0;
    pokemonExp += Number(encounter.pokemonExp) || 0;
    gold += Number(encounter.gold) || 0;
    // A captured Pokémon the game auto-sold is realized income too, not
    // just the wild monster's own loot.received drop.
    if (encounter.autoSold) gold += Number(encounter.autoSellValue) || 0;
    // Pokébolas: the capsule cost charged on any capture attempt, success
    // or failed (null until an attempt happens).
    capsulesCost += Number(encounter.supplyCost) || 0;
  }

  const { seen, captured, failed, rarities, shiny, rarePlusFailed, hasUnknownQuality } =
    computeRarityBreakdown(encounters);

  // Potions: a trainer-wide expense, not tied to any one encounter (§9 in
  // docs/ARCHITECTURE.md) — accumulated directly on the session row
  // instead of summed from encounters, unlike everything else here.
  const potionsUsed = session.potionsUsed || 0;
  const potionsCost = session.potionsCost || 0;
  const expenses = capsulesCost + potionsCost;

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
    hasUnknownQuality,
    capsulesCost,
    potionsUsed,
    potionsCost,
    expenses,
    expensesPerHour: perHour(expenses, elapsedMs)
  };
}
