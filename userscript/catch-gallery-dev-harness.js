export const CATCH_GALLERY_DEV_HARNESS = true;

const BASE_CAPTURE_AT_MS = new Date("2026-08-24T17:40:00-03:00").getTime();

const SAMPLE_ROWS = Object.freeze([
  ["Charizard", "legendary", false, 1.72, 189],
  ["Mew", "mythical", false, 1.95, 186],
  ["Dragonite", "common", true, 1.44, 177],
  ["Mewtwo", "legendary", true, 2.08, 192],
  ["Articuno", "legendary", false, 1.61, 181],
  ["Celebi", "mythical", false, 1.88, 184],
  ["Gengar", "common", true, 1.37, 173],
  ["Lugia", "legendary", false, 2.01, 190]
]);

export function catchGalleryDevEncounters() {
  if (!CATCH_GALLERY_DEV_HARNESS) return [];

  return SAMPLE_ROWS.map(([speciesName, quality, isShiny, qualityMultiplier, ivTotal], index) => ({
    encounterId: `dev-catch-gallery-${index + 1}`,
    captureResult: "success",
    speciesName,
    quality,
    qualityMultiplier,
    ivTotal,
    isShiny,
    capturedByName: "Rhyxus",
    captureAtMs: BASE_CAPTURE_AT_MS - index * 60_000
  }));
}

export function withCatchGalleryDevHarness(encounters) {
  if (!CATCH_GALLERY_DEV_HARNESS) return encounters;
  return [...catchGalleryDevEncounters(), ...(Array.isArray(encounters) ? encounters : [])];
}
