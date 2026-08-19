import { test } from "node:test";
import assert from "node:assert/strict";

import { computeSessionMetrics } from "../../domain/sessionMetrics.js";
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
    autoSold: false,
    autoSellValue: null,
    supplyCost: null,
    ...overrides
  };
}

test("no session yet -> empty/waiting metrics, no per-hour crash", () => {
  const metrics = computeSessionMetrics({ session: null, encounters: [], now: 1000 });

  assert.equal(metrics.status, "waiting");
  assert.equal(metrics.activeMs, 0);
  assert.equal(metrics.trainerExpPerHour, null);
  assert.equal(metrics.seenPerHour, null);
  assert.equal(metrics.seenToCaptureRate, null);
  assert.equal(metrics.attemptRate, null);
});

test("status mirrors session.status (running/paused/ended->waiting)", () => {
  const base = createSession({ sessionId: "s1", now: 0 });

  assert.equal(
    computeSessionMetrics({ session: base, encounters: [], now: 0 }).status,
    "running"
  );
  assert.equal(
    computeSessionMetrics({ session: { ...base, status: "paused" }, encounters: [], now: 0 })
      .status,
    "paused"
  );
  assert.equal(
    computeSessionMetrics({ session: { ...base, status: "ended" }, encounters: [], now: 0 })
      .status,
    "waiting"
  );
});

test("seen is the exact identity captured + failed, regardless of state", () => {
  const session = createSession({ sessionId: "s1", now: 0 });

  const encounters = [
    encounter({ state: "success", captureResult: "success" }),
    encounter({ state: "failed", captureResult: "failed" }),
    encounter({ state: "orphan", captureResult: "failed" }), // orphan, but a real attempt -> still "seen"
    encounter({ state: "incomplete", captureResult: "none" }) // never attempted -> NOT "seen"
  ];

  const metrics = computeSessionMetrics({ session, encounters, now: 3_600_000 });

  assert.equal(metrics.captured, 1);
  assert.equal(metrics.failed, 2);
  assert.equal(metrics.seen, metrics.captured + metrics.failed);
  assert.equal(metrics.seen, 3);
  assert.equal(metrics.seenPerHour, 3);
});

test("EXP/gold sums and per-hour rates over active_ms", () => {
  const session = createSession({ sessionId: "s1", now: 0 });

  const encounters = [
    encounter({ trainerExp: 1000, pokemonExp: 500, gold: 50 }),
    encounter({ trainerExp: 2000, pokemonExp: 1000, gold: 100 })
  ];

  // 1 active hour elapsed.
  const metrics = computeSessionMetrics({ session, encounters, now: 3_600_000 });

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

  const metrics = computeSessionMetrics({ session, encounters, now: 0 });

  assert.equal(metrics.trainerExpPerHour, null);
  assert.equal(metrics.seenPerHour, null);
});

test("rarity buckets, Rare+ failed, and unknown-quality flag", () => {
  const session = createSession({ sessionId: "s1", now: 0 });

  const encounters = [
    encounter({ quality: "rare", captureResult: "failed" }),
    encounter({ quality: "epic", captureResult: "failed" }),
    encounter({ quality: "weak", captureResult: "failed" }),
    encounter({ quality: "not-a-real-quality", captureResult: "failed" })
  ];

  const metrics = computeSessionMetrics({ session, encounters, now: 1000 });

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

  const metrics = computeSessionMetrics({ session, encounters, now: 1000 });

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
    encounter({ captureResult: "none" }) // no attempt yet -> not "seen"
  ];

  const metrics = computeSessionMetrics({ session, encounters, now: 1000 });

  assert.equal(metrics.seen, 3);
  assert.equal(metrics.captured, 1);
  assert.equal(metrics.failed, 2);
  assert.equal(metrics.seenToCaptureRate, 1 / 3);
  assert.equal(metrics.attemptRate, 1 / 3);
});

test("Dólar/h includes autoSellValue only when autoSold is true", () => {
  const session = createSession({ sessionId: "s1", now: 0 });

  const encounters = [
    encounter({ gold: 100, autoSold: true, autoSellValue: 250 }),
    // Not auto-sold -> its autoSellValue must NOT count, even if present.
    encounter({ gold: 50, autoSold: false, autoSellValue: 999 })
  ];

  const metrics = computeSessionMetrics({ session, encounters, now: 3_600_000 });

  assert.equal(metrics.gold, 100 + 250 + 50);
  assert.equal(metrics.goldPerHour, 400);
});

test("Gastos/h: capsulesCost sums supplyCost across encounters (Pokébolas)", () => {
  const session = createSession({ sessionId: "s1", now: 0 });

  const encounters = [
    encounter({ captureResult: "failed", supplyCost: 50 }),
    encounter({ captureResult: "success", supplyCost: 130 }),
    encounter({ captureResult: "none", supplyCost: null }) // no attempt -> nothing charged
  ];

  const metrics = computeSessionMetrics({ session, encounters, now: 3_600_000 });

  assert.equal(metrics.capsulesCost, 180);
  assert.equal(metrics.potionsCost, 0);
  assert.equal(metrics.expenses, 180);
  assert.equal(metrics.expensesPerHour, 180);
});

test("potionsUsed/potionsCost come from the session row, not from encounters", () => {
  const session = { ...createSession({ sessionId: "s1", now: 0 }), potionsUsed: 7, potionsCost: 84 };

  const metrics = computeSessionMetrics({
    session,
    encounters: [encounter({ captureResult: "failed", supplyCost: 50 })],
    now: 3_600_000
  });

  assert.equal(metrics.potionsUsed, 7);
  assert.equal(metrics.potionsCost, 84);
  assert.equal(metrics.capsulesCost, 50);
  assert.equal(metrics.expenses, 50 + 84);
});

test("potionsUsed/potionsCost default to 0 on a session row from before these fields existed", () => {
  const { potionsUsed, potionsCost, ...legacySession } = createSession({
    sessionId: "s1",
    now: 0
  });

  const metrics = computeSessionMetrics({ session: legacySession, encounters: [], now: 1000 });

  assert.equal(metrics.potionsUsed, 0);
  assert.equal(metrics.potionsCost, 0);
  assert.equal(metrics.expenses, 0);
});
