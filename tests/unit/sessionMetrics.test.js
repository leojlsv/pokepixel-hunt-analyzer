import { test } from "node:test";
import assert from "node:assert/strict";

import { computeCurrentMetrics } from "../../domain/sessionMetrics.js";
import { createSession } from "../../domain/sessionTiming.js";

function encounter(overrides = {}) {
  return {
    state: "success",
    captureResult: "none",
    quality: "common",
    isShiny: false,
    trainerExp: 0,
    pokemonExp: 0,
    gold: 0,
    ...overrides
  };
}

test("no session yet -> empty/waiting metrics, no per-hour crash", () => {
  const metrics = computeCurrentMetrics({ session: null, encounters: [], now: 1000 });

  assert.equal(metrics.status, "waiting");
  assert.equal(metrics.activeMs, 0);
  assert.equal(metrics.trainerExpPerHour, null);
  assert.equal(metrics.seenToCaptureRate, null);
  assert.equal(metrics.attemptRate, null);
});

test("status mirrors session.status (running/paused/ended->waiting)", () => {
  const base = createSession({ sessionId: "s1", now: 0 });

  assert.equal(
    computeCurrentMetrics({ session: base, encounters: [], now: 0 }).status,
    "running"
  );
  assert.equal(
    computeCurrentMetrics({ session: { ...base, status: "paused" }, encounters: [], now: 0 })
      .status,
    "paused"
  );
  assert.equal(
    computeCurrentMetrics({ session: { ...base, status: "ended" }, encounters: [], now: 0 })
      .status,
    "waiting"
  );
});

test("seen excludes orphans; captured/failed count regardless of state", () => {
  const session = createSession({ sessionId: "s1", now: 0 });

  const encounters = [
    encounter({ state: "success", captureResult: "success" }),
    encounter({ state: "failed", captureResult: "failed" }),
    encounter({ state: "orphan", captureResult: "failed" }), // orphan: not "seen", still "failed"
    encounter({ state: "incomplete", captureResult: "none" })
  ];

  const metrics = computeCurrentMetrics({ session, encounters, now: 3_600_000 });

  // 3 non-orphan encounters -> seen=3; captured=1 success; failed=2 (one from
  // the regular encounter, one from the orphan).
  assert.equal(metrics.seen, 3);
  assert.equal(metrics.captured, 1);
  assert.equal(metrics.failed, 2);
});

test("EXP/gold sums and per-hour rates over active_ms", () => {
  const session = createSession({ sessionId: "s1", now: 0 });

  const encounters = [
    encounter({ trainerExp: 1000, pokemonExp: 500, gold: 50 }),
    encounter({ trainerExp: 2000, pokemonExp: 1000, gold: 100 })
  ];

  // 1 active hour elapsed.
  const metrics = computeCurrentMetrics({ session, encounters, now: 3_600_000 });

  assert.equal(metrics.trainerExp, 3000);
  assert.equal(metrics.trainerExpPerHour, 3000);
  assert.equal(metrics.pokemonExp, 1500);
  assert.equal(metrics.pokemonExpPerHour, 1500);
  assert.equal(metrics.gold, 150);
  assert.equal(metrics.goldPerHour, 150);
});

test("per-hour figures are null when elapsed active time is zero", () => {
  const session = createSession({ sessionId: "s1", now: 0 });
  const encounters = [encounter({ trainerExp: 1000 })];

  const metrics = computeCurrentMetrics({ session, encounters, now: 0 });

  assert.equal(metrics.trainerExpPerHour, null);
});

test("rarity buckets, Rare+ failed, and unknown-quality flag", () => {
  const session = createSession({ sessionId: "s1", now: 0 });

  const encounters = [
    encounter({ quality: "rare", captureResult: "failed" }),
    encounter({ quality: "epic", captureResult: "failed" }),
    encounter({ quality: "weak", captureResult: "failed" }),
    encounter({ quality: "not-a-real-quality", captureResult: "failed" })
  ];

  const metrics = computeCurrentMetrics({ session, encounters, now: 1000 });

  assert.equal(metrics.rarities.rare.failed, 1);
  assert.equal(metrics.rarities.epic.failed, 1);
  assert.equal(metrics.rarities.weak.failed, 1);
  assert.equal(metrics.rarities.unknown.failed, 1);
  assert.equal(metrics.rarePlusFailed, 2); // rare + epic, not weak
  assert.equal(metrics.hasUnknownQuality, true);
});

test("shiny buckets follow the same seen/captured/failed split as totals", () => {
  const session = createSession({ sessionId: "s1", now: 0 });

  const encounters = [
    encounter({ isShiny: true, captureResult: "success" }),
    encounter({ isShiny: true, captureResult: "failed" }),
    encounter({ isShiny: false, captureResult: "failed" })
  ];

  const metrics = computeCurrentMetrics({ session, encounters, now: 1000 });

  // Only the 2 shiny encounters count toward shiny.seen (both non-orphan).
  assert.equal(metrics.shiny.seen, 2);
  assert.equal(metrics.shiny.captured, 1);
  assert.equal(metrics.shiny.failed, 1);
});

test("Seen->Capture and Attempt Rate formulas", () => {
  const session = createSession({ sessionId: "s1", now: 0 });

  const encounters = [
    encounter({ captureResult: "success" }),
    encounter({ captureResult: "failed" }),
    encounter({ captureResult: "failed" }),
    encounter({ captureResult: "none" }) // seen but no attempt yet
  ];

  const metrics = computeCurrentMetrics({ session, encounters, now: 1000 });

  assert.equal(metrics.seen, 4);
  assert.equal(metrics.captured, 1);
  assert.equal(metrics.failed, 2);
  assert.equal(metrics.seenToCaptureRate, 1 / 4);
  assert.equal(metrics.attemptRate, 1 / 3);
});
