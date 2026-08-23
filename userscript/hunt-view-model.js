export const NOTABLE_RARITIES = Object.freeze([
  "epic",
  "legendary",
  "mythical"
]);

function finite(value) {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function recency(encounter) {
  return Math.max(
    finite(encounter.startedAtMs),
    finite(encounter.lootAtMs),
    finite(encounter.captureAtMs),
    finite(encounter.updatedAtMs),
    finite(encounter.createdAtMs)
  );
}

export function latestSpeciesEncounter(encounters = []) {
  let latest = null;
  let latestAt = Number.NEGATIVE_INFINITY;

  for (const encounter of encounters) {
    if (!encounter?.speciesId && !encounter?.speciesName) continue;
    const at = recency(encounter);
    if (at < latestAt) continue;
    latest = encounter;
    latestAt = at;
  }

  return latest;
}

export function notableEncounters(encounters = [], rarity) {
  if (!NOTABLE_RARITIES.includes(rarity)) return [];

  return encounters
    .filter((encounter) =>
      encounter?.quality === rarity &&
      ["success", "failed"].includes(encounter.captureResult)
    )
    .sort((left, right) =>
      finite(right.captureAtMs) - finite(left.captureAtMs) ||
      String(left.encounterId || "").localeCompare(String(right.encounterId || ""))
    );
}
