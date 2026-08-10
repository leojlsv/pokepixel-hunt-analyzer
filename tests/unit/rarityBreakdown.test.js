import test from "node:test";
import assert from "node:assert/strict";
import { computeRarityBreakdown, QUALITIES } from "../../domain/rarityBreakdown.js";

test("empty input returns zeroed buckets for every known quality plus unknown", () => {
  const breakdown = computeRarityBreakdown([]);

  assert.equal(breakdown.seen, 0);
  assert.equal(breakdown.captured, 0);
  assert.equal(breakdown.failed, 0);
  assert.equal(breakdown.rarePlusFailed, 0);
  assert.equal(breakdown.hasUnknownQuality, false);

  for (const quality of [...QUALITIES, "unknown"]) {
    assert.deepEqual(breakdown.rarities[quality], {
      seen: 0,
      captured: 0,
      failed: 0,
      shinySeen: 0,
      shinyCaptured: 0,
      shinyFailed: 0
    });
  }
});

test("seen is the exact identity captured + failed, regardless of state", () => {
  const encounters = [
    { state: "success", quality: "rare", captureResult: "success" },
    // An orphan still counts as "seen" if it carries a real capture
    // attempt — state alone never decided "seen", the attempt does.
    { state: "orphan", quality: "rare", captureResult: "failed" },
    { state: "failed", quality: "common", captureResult: "failed" },
    // Battled but never actually attempted a capture (e.g. only farmed
    // EXP/gold) — NOT seen, even though it's a real, non-orphan encounter.
    { state: "success", quality: "common", captureResult: "none" }
  ];

  const breakdown = computeRarityBreakdown(encounters);

  assert.equal(breakdown.captured, 1);
  assert.equal(breakdown.failed, 2);
  assert.equal(breakdown.seen, breakdown.captured + breakdown.failed);
  assert.equal(breakdown.seen, 3);
  assert.equal(breakdown.rarities.rare.seen, 2);
  assert.equal(breakdown.rarities.rare.captured, 1);
  assert.equal(breakdown.rarities.rare.failed, 1);
  assert.equal(breakdown.rarities.common.seen, 1); // only the failed one, not the "none" one
  assert.equal(breakdown.rarities.common.failed, 1);
});

test("unknown quality is bucketed separately and flagged", () => {
  const breakdown = computeRarityBreakdown([
    { state: "success", quality: "not-a-real-quality", captureResult: "success" }
  ]);

  assert.equal(breakdown.rarities.unknown.seen, 1);
  assert.equal(breakdown.rarities.unknown.captured, 1);
  assert.equal(breakdown.hasUnknownQuality, true);
});

test("rarePlusFailed sums only Rare/Epic/Legendary/Mythical failures", () => {
  const encounters = [
    { state: "failed", quality: "weak", captureResult: "failed" },
    { state: "failed", quality: "common", captureResult: "failed" },
    { state: "failed", quality: "rare", captureResult: "failed" },
    { state: "failed", quality: "epic", captureResult: "failed" },
    { state: "failed", quality: "legendary", captureResult: "failed" },
    { state: "failed", quality: "mythical", captureResult: "failed" }
  ];

  assert.equal(computeRarityBreakdown(encounters).rarePlusFailed, 4);
});

test("shiny buckets follow the same seen/captured/failed split as totals", () => {
  const encounters = [
    { state: "success", quality: "rare", captureResult: "success", isShiny: true },
    { state: "failed", quality: "common", captureResult: "failed", isShiny: true },
    { state: "success", quality: "common", captureResult: "success", isShiny: false }
  ];

  const breakdown = computeRarityBreakdown(encounters);

  assert.equal(breakdown.shiny.seen, 2);
  assert.equal(breakdown.shiny.captured, 1);
  assert.equal(breakdown.shiny.failed, 1);
});

test("per-rarity shiny sub-counts are an annotation, already included in seen/captured/failed", () => {
  const encounters = [
    { state: "success", quality: "rare", captureResult: "success", isShiny: true },
    { state: "failed", quality: "common", captureResult: "failed", isShiny: true },
    { state: "success", quality: "common", captureResult: "success", isShiny: false }
  ];

  const breakdown = computeRarityBreakdown(encounters);

  assert.equal(breakdown.rarities.rare.captured, 1);
  assert.equal(breakdown.rarities.rare.shinyCaptured, 1);
  assert.equal(breakdown.rarities.rare.shinySeen, 1);

  assert.equal(breakdown.rarities.common.seen, 2); // 1 shiny-failed + 1 non-shiny-captured
  assert.equal(breakdown.rarities.common.failed, 1);
  assert.equal(breakdown.rarities.common.shinyFailed, 1);
  assert.equal(breakdown.rarities.common.shinySeen, 1);
  assert.equal(breakdown.rarities.common.shinyCaptured, 0); // the common capture wasn't shiny
});
