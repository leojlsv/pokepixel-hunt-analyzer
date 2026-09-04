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

function encounterContribution(encounter) {
  if (!encounter) {
    return {
      trainerExp: 0,
      pokemonExp: 0,
      gold: 0,
      capsulesCost: 0,
      ...computeRarityBreakdown([])
    };
  }

  return {
    trainerExp: Number(encounter.trainerExp) || 0,
    pokemonExp: Number(encounter.pokemonExp) || 0,
    gold:
      (Number(encounter.gold) || 0) +
      (Number(encounter.lootSellValue) || 0) +
      (encounter.autoSold ? Number(encounter.autoSellValue) || 0 : 0),
    capsulesCost: Number(encounter.supplyCost) || 0,
    ...computeRarityBreakdown([encounter])
  };
}

/**
 * Replaces one encounter's contribution without rescanning the Hunt. The
 * caller still refreshes session clock/status fields with refreshSessionMetrics.
 */
export function updateSessionMetricsForEncounter(
  metrics,
  previousEncounter,
  nextEncounter
) {
  if (!metrics) return null;

  const previous = encounterContribution(previousEncounter);
  const next = encounterContribution(nextEncounter);
  const difference = (field) => next[field] - previous[field];
  const rarities = {};

  for (const quality of ["unknown", ...QUALITIES]) {
    rarities[quality] = {};
    for (const field of [
      "seen",
      "captured",
      "failed",
      "shinySeen",
      "shinyCaptured",
      "shinyFailed"
    ]) {
      rarities[quality][field] =
        metrics.rarities[quality][field] +
        next.rarities[quality][field] -
        previous.rarities[quality][field];
    }
  }

  const shiny = {};
  for (const field of ["seen", "captured", "failed"]) {
    shiny[field] = metrics.shiny[field] + next.shiny[field] - previous.shiny[field];
  }

  const captured = metrics.captured + difference("captured");
  const failed = metrics.failed + difference("failed");
  const seen = captured + failed;
  const trainerExp = metrics.trainerExp + difference("trainerExp");
  const pokemonExp = metrics.pokemonExp + difference("pokemonExp");
  const gold = metrics.gold + difference("gold");
  const capsulesCost = metrics.capsulesCost + difference("capsulesCost");
  const expenses = capsulesCost + (metrics.potionsCost || 0);

  return {
    ...metrics,
    trainerExp,
    trainerExpPerHour: perHour(trainerExp, metrics.activeMs),
    pokemonExp,
    pokemonExpPerHour: perHour(pokemonExp, metrics.activeMs),
    gold,
    goldPerHour: perHour(gold, metrics.activeMs),
    seen,
    seenPerHour: perHour(seen, metrics.activeMs),
    captured,
    failed,
    seenToCaptureRate: rate(captured, seen),
    attemptRate: rate(captured, captured + failed),
    rarePlusFailed:
      rarities.rare.failed +
      rarities.epic.failed +
      rarities.legendary.failed +
      rarities.mythical.failed,
    rarities,
    shiny,
    hasUnknownQuality: rarities.unknown.seen > 0,
    capsulesCost,
    expenses,
    expensesPerHour: perHour(expenses, metrics.activeMs)
  };
}
