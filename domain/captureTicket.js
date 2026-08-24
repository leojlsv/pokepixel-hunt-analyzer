const ELIGIBLE_RARITIES = new Set(["legendary", "mythical"]);

export const CAPTURE_TICKET_THEMES = Object.freeze({
  LEGEND: "legend",
  MYTHIC: "mythic",
  SHINY: "shiny"
});

export function resolveCaptureTicketTheme(encounter) {
  if (!encounter || encounter.captureResult !== "success") return null;
  if (encounter.isShiny === true) return CAPTURE_TICKET_THEMES.SHINY;
  if (encounter.quality === "mythical") return CAPTURE_TICKET_THEMES.MYTHIC;
  if (encounter.quality === "legendary") return CAPTURE_TICKET_THEMES.LEGEND;
  return null;
}

export function canGenerateCaptureTicket(encounter) {
  if (!resolveCaptureTicketTheme(encounter)) return false;

  return Boolean(
    encounter.speciesName &&
    encounter.capturedByName &&
    Number.isFinite(encounter.qualityMultiplier) &&
    Number.isFinite(encounter.ivTotal) &&
    Number.isFinite(encounter.captureAtMs) &&
    (encounter.isShiny === true || ELIGIBLE_RARITIES.has(encounter.quality))
  );
}

export function pokemonDbSlug(speciesName) {
  return String(speciesName || "")
    .trim()
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pokemonDbSpriteUrl(encounter) {
  const slug = pokemonDbSlug(encounter?.speciesName);
  if (!slug) return null;
  const variant = encounter?.isShiny === true ? "shiny" : "normal";
  return `https://img.pokemondb.net/sprites/black-white/${variant}/${slug}.png`;
}

export function buildCaptureTicketData(encounter, formatTimestamp) {
  if (!canGenerateCaptureTicket(encounter)) {
    throw new Error("Capture ticket: encounter is not eligible or is missing required data");
  }

  return {
    theme: resolveCaptureTicketTheme(encounter),
    pokemonName: String(encounter.speciesName).toUpperCase(),
    qualityLine: `QUALITY ${encounter.qualityMultiplier.toFixed(2)} · IV ${encounter.ivTotal}`,
    capturedBy: `CAPTURED BY ${String(encounter.capturedByName).toUpperCase()}`,
    timestamp: formatTimestamp(encounter.captureAtMs),
    spriteUrl: pokemonDbSpriteUrl(encounter)
  };
}
