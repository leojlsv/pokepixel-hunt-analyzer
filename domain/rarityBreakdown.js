/**
 * Rarity-tier aggregation shared by Current ("By Rarity" table,
 * domain/sessionMetrics.js) and Compare's "By Rarity" theme
 * (docs/ARCHITECTURE.md §9) — same bucketing rule, just over a
 * different encounter set (one session's vs. Compare's filtered
 * cross-session set), so it lives here once instead of twice.
 *
 * Pure: takes an already-fetched encounter list, no I/O.
 *
 * `Seen` only counts non-orphan encounters (an orphan never had a
 * combat.started, so it was never really "seen"). `Captured`/`Failed`
 * count by `captureResult` regardless of state.
 */

export const QUALITIES = Object.freeze([
  "weak",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical"
]);

function emptyBucket() {
  return { seen: 0, captured: 0, failed: 0 };
}

function buildEmptyRarities() {
  const rarities = { unknown: emptyBucket() };
  for (const quality of QUALITIES) rarities[quality] = emptyBucket();
  return rarities;
}

function qualityKey(quality) {
  return QUALITIES.includes(quality) ? quality : "unknown";
}

export function computeRarityBreakdown(encounters = []) {
  let seen = 0;
  let captured = 0;
  let failed = 0;

  const rarities = buildEmptyRarities();
  const shiny = emptyBucket();

  for (const encounter of encounters) {
    const key = qualityKey(encounter.quality);
    const isSeen = encounter.state !== "orphan";
    const isCaptured = encounter.captureResult === "success";
    const isFailed = encounter.captureResult === "failed";

    if (isSeen) {
      seen += 1;
      rarities[key].seen += 1;
      if (encounter.isShiny) shiny.seen += 1;
    }

    if (isCaptured) {
      captured += 1;
      rarities[key].captured += 1;
      if (encounter.isShiny) shiny.captured += 1;
    }

    if (isFailed) {
      failed += 1;
      rarities[key].failed += 1;
      if (encounter.isShiny) shiny.failed += 1;
    }
  }

  const rarePlusFailed =
    rarities.rare.failed +
    rarities.epic.failed +
    rarities.legendary.failed +
    rarities.mythical.failed;

  const hasUnknownQuality =
    rarities.unknown.seen + rarities.unknown.captured + rarities.unknown.failed > 0;

  return { seen, captured, failed, rarities, shiny, rarePlusFailed, hasUnknownQuality };
}
