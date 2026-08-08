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
    autoSold: false,
    autoSellValue: null,
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

test("seen is the exact identity captured + failed, regardless of state", () => {
  const encounters = [
    encounter({ state: "success", captureResult: "success" }),
    encounter({ state: "failed", captureResult: "failed" }),
    // orphan, but a real attempt -> still "seen".
    encounter({ state: "orphan", captureResult: "failed" }),
    // never attempted -> NOT "seen", even though it's not an orphan.
    encounter({ state: "success", captureResult: "none" })
  ];

  const metrics = computeGroupMetrics(encounters);

  assert.equal(metrics.captured, 1);
  assert.equal(metrics.failed, 2);
  assert.equal(metrics.seen, metrics.captured + metrics.failed);
  assert.equal(metrics.seen, 3);
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
    encounter({ captureResult: "none" }) // no attempt yet -> not "seen"
  ];

  const metrics = computeGroupMetrics(encounters);

  assert.equal(metrics.seenToCaptureRate, 1 / 3);
  assert.equal(metrics.attemptRate, 1 / 3);
});

test("Dollar/Cycle Hour includes autoSellValue only when autoSold is true", () => {
  const encounters = [
    encounter({ cycleMs: 1_800_000, gold: 100, autoSold: true, autoSellValue: 250 }),
    // Not auto-sold -> its autoSellValue must NOT count, even if present.
    encounter({ cycleMs: 1_800_000, gold: 50, autoSold: false, autoSellValue: 999 })
  ];
  // group_cycle_ms = 3_600_000 = exactly 1 cycle hour.

  const metrics = computeGroupMetrics(encounters);

  assert.equal(metrics.gold, 100 + 250 + 50);
  assert.equal(metrics.dollarPerCycleHour, 400);
});
