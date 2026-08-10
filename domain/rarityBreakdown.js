/**
 * Rarity-tier aggregation shared by Current ("By Rarity" table,
 * domain/sessionMetrics.js) and Compare's "By Rarity" theme
 * (docs/ARCHITECTURE.md §9) — same bucketing rule, just over a
 * different encounter set (one session's vs. Compare's filtered
 * cross-session set), so it lives here once instead of twice.
 *
 * Pure: takes an already-fetched encounter list, no I/O.
 *
 * `Seen` is an exact identity, `Seen = Captured + Failed` — a Pokémon
 * only counts as "seen" if a capture was actually attempted against it
 * (`captureResult` is `success` or `failed`). A `combat.started` that
 * never got a capture attempt (the player farmed EXP/gold and moved on,
 * or the row is an unresolved/incomplete/orphan encounter) is not
 * "seen" — it may have just shown up in the raw log without any real
 * battle interaction. This also means an orphan CAN be "seen" if it
 * still carries a real capture attempt (docs/PROTOCOL_AND_ANALYTICS.md §10).
 *
 * Each rarity bucket also carries `shinySeen`/`shinyCaptured`/
 * `shinyFailed` — always a subset already included in the plain
 * seen/captured/failed counts, never additive. Current's "By Rarity"
 * table (no separate Shiny card anymore) renders them as
 * "Qty (ShinyQty)" in gold next to the plain count.
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

export function emptyBucket() {
  return { seen: 0, captured: 0, failed: 0 };
}

// Same shape as emptyBucket() plus shiny sub-counts — annotations only,
// never additive: shinySeen/shinyCaptured/shinyFailed are always a
// subset already included in seen/captured/failed above. Current's "By
// Rarity" table renders them as "Qty (ShinyQty)".
function emptyRarityBucket() {
  return { ...emptyBucket(), shinySeen: 0, shinyCaptured: 0, shinyFailed: 0 };
}

export function buildEmptyRarities() {
  const rarities = { unknown: emptyRarityBucket() };
  for (const quality of QUALITIES) rarities[quality] = emptyRarityBucket();
  return rarities;
}

function qualityKey(quality) {
  return QUALITIES.includes(quality) ? quality : "unknown";
}

export function computeRarityBreakdown(encounters = []) {
  let captured = 0;
  let failed = 0;

  const rarities = buildEmptyRarities();
  const shiny = emptyBucket();

  for (const encounter of encounters) {
    const key = qualityKey(encounter.quality);
    const isCaptured = encounter.captureResult === "success";
    const isFailed = encounter.captureResult === "failed";
    // Seen = Captured + Failed, exactly — see the header comment.
    const isSeen = isCaptured || isFailed;

    if (isCaptured) {
      captured += 1;
      rarities[key].captured += 1;
      if (encounter.isShiny) {
        shiny.captured += 1;
        rarities[key].shinyCaptured += 1;
      }
    }

    if (isFailed) {
      failed += 1;
      rarities[key].failed += 1;
      if (encounter.isShiny) {
        shiny.failed += 1;
        rarities[key].shinyFailed += 1;
      }
    }

    if (isSeen) {
      rarities[key].seen += 1;
      if (encounter.isShiny) {
        shiny.seen += 1;
        rarities[key].shinySeen += 1;
      }
    }
  }

  const seen = captured + failed;

  const rarePlusFailed =
    rarities.rare.failed +
    rarities.epic.failed +
    rarities.legendary.failed +
    rarities.mythical.failed;

  const hasUnknownQuality =
    rarities.unknown.seen + rarities.unknown.captured + rarities.unknown.failed > 0;

  return { seen, captured, failed, rarities, shiny, rarePlusFailed, hasUnknownQuality };
}
