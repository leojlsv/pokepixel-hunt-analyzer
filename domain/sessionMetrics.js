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

function sessionStatus(session) {
  return session.status === "running"
    ? "running"
    : session.status === "paused"
      ? "paused"
      : "waiting";
}

function emptyMetrics() {
  return {
    status: "waiting",
    startedAtMs: null,
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

/**
 * Refreshes only fields that can change with the session clock/status while
 * encounter aggregates stay unchanged. This lets the 1s Current timer reuse
 * a cached aggregate instead of scanning thousands of encounter rows again.
 */
export function refreshSessionMetrics(metrics, session, now = Date.now()) {
  if (!session) return emptyMetrics();

  const base = metrics || emptyMetrics();
  const elapsedMs = sessionActiveMs(session, now);
  const potionsUsed = session.potionsUsed || 0;
  const potionsCost = session.potionsCost || 0;
  const expenses = (base.capsulesCost || 0) + potionsCost;

  return {
    ...base,
    status: sessionStatus(session),
    startedAtMs: Number.isFinite(session.startedAtMs) ? session.startedAtMs : null,
    activeMs: elapsedMs,
    trainerExpPerHour: perHour(base.trainerExp || 0, elapsedMs),
    pokemonExpPerHour: perHour(base.pokemonExp || 0, elapsedMs),
    goldPerHour: perHour(base.gold || 0, elapsedMs),
    seenPerHour: perHour(base.seen || 0, elapsedMs),
    potionsUsed,
    potionsCost,
    expenses,
    expensesPerHour: perHour(expenses, elapsedMs)
  };
}

export function computeSessionMetrics({ session, encounters = [], now = Date.now() }) {
  if (!session) return emptyMetrics();

  let trainerExp = 0;
  let pokemonExp = 0;
  let gold = 0;
  let capsulesCost = 0;

  for (const encounter of encounters) {
    trainerExp += Number(encounter.trainerExp) || 0;
    pokemonExp += Number(encounter.pokemonExp) || 0;

    // Dollar/Profit treat all encounter reward value as revenue: direct
    // monster gold, sell value of dropped loot, and realized Pokémon auto-sell.
    gold += Number(encounter.gold) || 0;
    gold += Number(encounter.lootSellValue) || 0;

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

  const aggregate = {
    ...emptyMetrics(),
    trainerExp,
    pokemonExp,
    gold,
    seen,
    captured,
    failed,
    seenToCaptureRate: rate(captured, seen),
    attemptRate: rate(captured, captured + failed),
    rarePlusFailed,
    rarities,
    shiny,
    hasUnknownQuality,
    capsulesCost
  };

  return refreshSessionMetrics(aggregate, session, now);
}
