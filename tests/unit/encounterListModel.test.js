import test from "node:test";
import assert from "node:assert/strict";

import {
  compareEncounters,
  formatCaptureTime,
  formatCaptureTimestamp,
  passesEncounterFilters,
  sortEncounters
} from "../../userscript/encounter-list-model.js";

function encounter(overrides = {}) {
  return {
    encounterId: overrides.encounterId || crypto.randomUUID(),
    quality: "rare",
    qualityMultiplier: 1.25,
    ivTotal: 100,
    isShiny: false,
    captureAtMs: 1_000,
    ...overrides
  };
}

test("passesEncounterFilters combines rarity, quality, IV and shiny filters", () => {
  const shiny = encounter({ isShiny: true, quality: "epic", qualityMultiplier: 1.5, ivTotal: 150 });

  assert.equal(passesEncounterFilters(shiny, {
    rarity: "epic",
    qualityMin: 1.4,
    ivMin: 140,
    shiny: "yes"
  }), true);

  assert.equal(passesEncounterFilters(shiny, {
    rarity: "epic",
    qualityMin: 1.4,
    ivMin: 140,
    shiny: "no"
  }), false);

  assert.equal(passesEncounterFilters(shiny, {
    rarity: "rare",
    qualityMin: null,
    ivMin: null,
    shiny: "*"
  }), false);
});

test("multi-rarity filter accepts every checked rarity and All preserves unknown values", () => {
  const rare = encounter({ quality: "rare" });
  const epic = encounter({ quality: "epic" });
  const common = encounter({ quality: "common" });
  const unknown = encounter({ quality: "future-rarity" });
  const baseFilters = { qualityMin: null, ivMin: null, shiny: "*" };

  const selected = new Set(["rare", "epic"]);
  assert.equal(passesEncounterFilters(rare, { ...baseFilters, rarities: selected }), true);
  assert.equal(passesEncounterFilters(epic, { ...baseFilters, rarities: selected }), true);
  assert.equal(passesEncounterFilters(common, { ...baseFilters, rarities: selected }), false);
  assert.equal(passesEncounterFilters(unknown, { ...baseFilters, rarities: selected }), false);

  // `null` is the Current UI's explicit All (*) state: do not filter by rarity.
  assert.equal(passesEncounterFilters(unknown, { ...baseFilters, rarities: null }), true);
  assert.equal(passesEncounterFilters(common, { ...baseFilters, rarities: null }), true);

  assert.equal(passesEncounterFilters(rare, {
    ...baseFilters,
    rarities: new Set()
  }), false);
});

test("capture timestamp is the Pokémon-column sort key", () => {
  const old = encounter({ encounterId: "old", captureAtMs: 1_000 });
  const recent = encounter({ encounterId: "recent", captureAtMs: 2_000 });

  assert.deepEqual(
    sortEncounters([old, recent], { key: "capturedAt", direction: "desc" }).map((row) => row.encounterId),
    ["recent", "old"]
  );
  assert.deepEqual(
    sortEncounters([old, recent], { key: "capturedAt", direction: "asc" }).map((row) => row.encounterId),
    ["old", "recent"]
  );
});

test("Quality and IV sorting are numeric and put missing values last", () => {
  const rows = [
    encounter({ encounterId: "low", qualityMultiplier: 1.05, ivTotal: 50 }),
    encounter({ encounterId: "high", qualityMultiplier: 1.65, ivTotal: 170 }),
    encounter({ encounterId: "missing", qualityMultiplier: null, ivTotal: null })
  ];

  assert.deepEqual(
    sortEncounters(rows, { key: "quality", direction: "desc" }).map((row) => row.encounterId),
    ["high", "low", "missing"]
  );
  assert.deepEqual(
    sortEncounters(rows, { key: "iv", direction: "asc" }).map((row) => row.encounterId),
    ["low", "high", "missing"]
  );
});

test("compareEncounters has a deterministic capture-time tie-breaker", () => {
  const newer = encounter({ encounterId: "b", qualityMultiplier: 1.5, captureAtMs: 2_000 });
  const older = encounter({ encounterId: "a", qualityMultiplier: 1.5, captureAtMs: 1_000 });

  assert.ok(compareEncounters(newer, older, { key: "quality", direction: "desc" }) < 0);
});

test("capture time/timestamp render local time consistently", () => {
  const local = new Date(2026, 7, 22, 13, 45, 12).getTime();
  assert.equal(formatCaptureTime(local), "13:45:12");
  assert.equal(formatCaptureTimestamp(local), "2026-08-22 13:45:12");
  assert.equal(formatCaptureTime(null), "—");
  assert.equal(formatCaptureTimestamp(null), "—");
});
