import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCatchGalleryRows,
  CATCH_GALLERY_PAGE_SIZE,
  matchesCatchGalleryFilters,
  paginateCatchGallery
} from "../../domain/catchGallery.js";

function encounter(overrides = {}) {
  return {
    encounterId: "e-1",
    captureResult: "success",
    speciesName: "Charizard",
    quality: "legendary",
    qualityMultiplier: 1.72,
    ivTotal: 189,
    isShiny: false,
    capturedByName: "Rhyxus",
    captureAtMs: 1000,
    ...overrides
  };
}

test("Catch Gallery filters only eligible captures and Pokémon search is case-insensitive", () => {
  assert.equal(matchesCatchGalleryFilters(encounter(), { pokemon: "chari" }), true);
  assert.equal(matchesCatchGalleryFilters(encounter(), { pokemon: "MEW" }), false);
  assert.equal(matchesCatchGalleryFilters(encounter({ captureResult: "failed" })), false);
  assert.equal(matchesCatchGalleryFilters(encounter({ capturedByName: null })), false);
});

test("Catch Gallery rarity filter supports Legendary, Mythical and Shiny", () => {
  assert.equal(matchesCatchGalleryFilters(encounter(), { rarity: "legendary" }), true);
  assert.equal(matchesCatchGalleryFilters(encounter({ quality: "mythical" }), { rarity: "mythical" }), true);
  assert.equal(matchesCatchGalleryFilters(encounter({ quality: "common", isShiny: true }), { rarity: "shiny" }), true);
  assert.equal(matchesCatchGalleryFilters(encounter(), { rarity: "shiny" }), false);
});

test("Catch Gallery sorts by Captured, Quality and IV in both directions", () => {
  const source = [
    encounter({ encounterId: "old-high", captureAtMs: 1000, qualityMultiplier: 2.1, ivTotal: 190 }),
    encounter({ encounterId: "new-low", captureAtMs: 3000, qualityMultiplier: 1.2, ivTotal: 150 }),
    encounter({ encounterId: "mid-mid", captureAtMs: 2000, qualityMultiplier: 1.7, ivTotal: 170 })
  ];

  assert.deepEqual(
    buildCatchGalleryRows(source).map((row) => row.encounterId),
    ["new-low", "mid-mid", "old-high"]
  );
  assert.deepEqual(
    buildCatchGalleryRows(source, { sortKey: "quality", sortDirection: "desc" }).map((row) => row.encounterId),
    ["old-high", "mid-mid", "new-low"]
  );
  assert.deepEqual(
    buildCatchGalleryRows(source, { sortKey: "iv", sortDirection: "asc" }).map((row) => row.encounterId),
    ["new-low", "mid-mid", "old-high"]
  );
});

test("Catch Gallery paginates at five rows and clamps invalid pages", () => {
  const rows = Array.from({ length: 12 }, (_, index) => encounter({ encounterId: `e-${index + 1}` }));
  assert.equal(CATCH_GALLERY_PAGE_SIZE, 5);

  const page2 = paginateCatchGallery(rows, 2);
  assert.equal(page2.rows.length, 5);
  assert.equal(page2.page, 2);
  assert.equal(page2.totalPages, 3);

  const page99 = paginateCatchGallery(rows, 99);
  assert.equal(page99.page, 3);
  assert.equal(page99.rows.length, 2);
});
