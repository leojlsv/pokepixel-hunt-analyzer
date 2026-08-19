/**
 * Pure aggregation for the Current view.
 *
 * Takes one session plus its already-fetched encounters and returns every
 * derived metric needed by the UI. Persistence and rendering stay outside
 * this module.
 */

import { activeMs as sessionActiveMs } from "./sessionTiming.js";
import {
  QUALITIES,
  computeRarityBreakdown,
  buildEmptyRarities,
  emptyBucket
} from "./rarityBreakdown.js";

export { QUALITIES };

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
    seenPerHour: null,
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

    if (encounter.autoSold) {
      gold += Number(encounter.autoSellValue) || 0;
    }

    capsulesCost += Number(encounter.supplyCost) || 0;
  }

  const {
    seen,
    captured,
    failed,
    rarities,
    shiny,
    rarePlusFailed,
    hasUnknownQuality
  } = computeRarityBreakdown(encounters);

  // Potion costs are session-level because potion events are not tied to a
  // specific wild encounter.
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
    seenPerHour: perHour(seen, elapsedMs),
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
