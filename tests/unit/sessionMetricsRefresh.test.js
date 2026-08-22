import test from "node:test";
import assert from "node:assert/strict";

import {
  computeSessionMetrics,
  refreshSessionMetrics
} from "../../domain/sessionMetrics.js";

function session(overrides = {}) {
  return {
    sessionId: "s1",
    status: "running",
    activeStartedAtMs: 1_000,
    accumulatedActiveMs: 0,
    potionsUsed: 1,
    potionsCost: 10,
    ...overrides
  };
}

test("refreshSessionMetrics updates elapsed time and per-hour rates without changing aggregates", () => {
  const sourceSession = session();
  const encounters = [{
    captureResult: "success",
    quality: "common",
    trainerExp: 100,
    pokemonExp: 50,
    gold: 25,
    supplyCost: 5,
    autoSold: false,
    isShiny: false
  }];

  const base = computeSessionMetrics({ session: sourceSession, encounters, now: 2_000 });
  const refreshed = refreshSessionMetrics(base, sourceSession, 3_000);

  assert.equal(refreshed.activeMs, 2_000);
  assert.equal(refreshed.trainerExp, 100);
  assert.equal(refreshed.pokemonExp, 50);
  assert.equal(refreshed.gold, 25);
  assert.equal(refreshed.seen, 1);
  assert.equal(refreshed.captured, 1);
  assert.equal(refreshed.capsulesCost, 5);
  assert.equal(refreshed.expenses, 15);
  assert.equal(refreshed.trainerExpPerHour, 100 / (2_000 / 3_600_000));
});

test("refreshSessionMetrics applies session-only potion and status changes", () => {
  const running = session();
  const base = computeSessionMetrics({ session: running, encounters: [], now: 2_000 });
  const paused = session({
    status: "paused",
    activeStartedAtMs: null,
    accumulatedActiveMs: 5_000,
    potionsUsed: 4,
    potionsCost: 80
  });

  const refreshed = refreshSessionMetrics(base, paused, 100_000);

  assert.equal(refreshed.status, "paused");
  assert.equal(refreshed.activeMs, 5_000);
  assert.equal(refreshed.potionsUsed, 4);
  assert.equal(refreshed.potionsCost, 80);
  assert.equal(refreshed.expenses, 80);
});
