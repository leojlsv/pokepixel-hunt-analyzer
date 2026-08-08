import { test } from "node:test";
import assert from "node:assert/strict";

import { computeGroupMetrics } from "../../domain/groupMetrics.js";

function encounter(overrides = {}) {
  return {
    state: "success",
    captureResult: "none",
    trainerExp: 0,
    pokemonExp: 0,
    gold: 0,
    cycleMs: null,
    ...overrides
  };
}

test("empty group has zeroed counts and null cycle-hour rates", () => {
  const metrics = computeGroupMetrics([]);

  assert.equal(metrics.seen, 0);
  assert.equal(metrics.groupCycleMs, 0);
  assert.equal(metrics.trainerExpPerCycleHour, null);
  assert.equal(metrics.seenToCaptureRate, null);
});

test("seen excludes orphans; captured/failed count regardless of state", () => {
  const encounters = [
    encounter({ state: "success", captureResult: "success" }),
    encounter({ state: "failed", captureResult: "failed" }),
    encounter({ state: "orphan", captureResult: "failed" })
  ];

  const metrics = computeGroupMetrics(encounters);

  assert.equal(metrics.seen, 2);
  assert.equal(metrics.captured, 1);
  assert.equal(metrics.failed, 2);
});

test("group_cycle_ms sums only finite cycleMs values", () => {
  const encounters = [
    encounter({ cycleMs: 500 }),
    encounter({ cycleMs: 1500 }),
    encounter({ cycleMs: null }) // no loot ever received — excluded, not treated as 0
  ];

  const metrics = computeGroupMetrics(encounters);
  assert.equal(metrics.groupCycleMs, 2000);
});

test("Trainer/Pokemon EXP and Dollar per Cycle Hour (docs/PROTOCOL_AND_ANALYTICS.md §11)", () => {
  const encounters = [
    encounter({ cycleMs: 1_800_000, trainerExp: 1000, pokemonExp: 500, gold: 50 }),
    encounter({ cycleMs: 1_800_000, trainerExp: 2000, pokemonExp: 1000, gold: 100 })
  ];
  // group_cycle_ms = 3_600_000 = exactly 1 cycle hour.

  const metrics = computeGroupMetrics(encounters);

  assert.equal(metrics.groupCycleMs, 3_600_000);
  assert.equal(metrics.trainerExp, 3000);
  assert.equal(metrics.trainerExpPerCycleHour, 3000);
  assert.equal(metrics.pokemonExp, 1500);
  assert.equal(metrics.pokemonExpPerCycleHour, 1500);
  assert.equal(metrics.gold, 150);
  assert.equal(metrics.dollarPerCycleHour, 150);
});

test("Seen->Capture and Attempt Rate formulas", () => {
  const encounters = [
    encounter({ captureResult: "success" }),
    encounter({ captureResult: "failed" }),
    encounter({ captureResult: "failed" }),
    encounter({ captureResult: "none" })
  ];

  const metrics = computeGroupMetrics(encounters);

  assert.equal(metrics.seenToCaptureRate, 1 / 4);
  assert.equal(metrics.attemptRate, 1 / 3);
});
