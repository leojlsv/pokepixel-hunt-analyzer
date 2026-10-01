/** Aggregate persisted encounter rewards. A drop's value cannot be allocated to
 * an individual item: lootSellValue is authoritative only for the encounter. */
function safeAmount(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function itemEntries(encounter) {
  const combined = new Map();
  for (const item of Array.isArray(encounter?.lootItems) ? encounter.lootItems : []) {
    const itemId = typeof (item?.itemId ?? item?.item_id) === "string"
      ? (item.itemId ?? item.item_id).trim()
      : "";
    const qty = item?.qty;
    if (!itemId || !Number.isSafeInteger(qty) || qty <= 0) continue;
    combined.set(itemId, (combined.get(itemId) || 0) + qty);
  }
  return combined;
}

/**
 * Only currently loaded History sessions are included. Caller-supplied
 * matchesEncounter applies the shared Pokémon/capture filters to every reward.
 */
export function aggregateLootHistory(bundles = [], {
  sessionId = "*",
  matchesEncounter = () => true
} = {}) {
  const items = new Map();
  const totals = { directGold: 0, lootSellValue: 0, autoSellValue: 0, total: 0 };
  let matchedEncounters = 0;
  let lootedEncounters = 0;
  let matchedSessions = 0;

  for (const bundle of bundles) {
    if (sessionId !== "*" && bundle.session?.sessionId !== sessionId) continue;
    let sessionMatched = false;

    for (const encounter of bundle.encounters || []) {
      if (!matchesEncounter(encounter)) continue;
      sessionMatched = true;
      matchedEncounters += 1;
      if (Number.isFinite(encounter.lootAtMs)) lootedEncounters += 1;

      totals.directGold += safeAmount(encounter.gold);
      totals.lootSellValue += safeAmount(encounter.lootSellValue);
      if (encounter.autoSold === true) {
        totals.autoSellValue += safeAmount(encounter.autoSellValue);
      }

      for (const [itemId, qty] of itemEntries(encounter)) {
        let entry = items.get(itemId);
        if (!entry) {
          entry = { itemId, qty: 0, drops: 0, sources: new Map() };
          items.set(itemId, entry);
        }
        entry.qty += qty;
        entry.drops += 1;

        const speciesId = encounter.speciesId || encounter.speciesName || "";
        const sourceId = String(speciesId);
        let source = entry.sources.get(sourceId);
        if (!source) {
          source = {
            speciesId: sourceId,
            speciesName: encounter.speciesName || encounter.speciesId || "Unknown Pokémon",
            qty: 0,
            drops: 0
          };
          entry.sources.set(sourceId, source);
        }
        source.qty += qty;
        source.drops += 1;
      }
    }
    if (sessionMatched) matchedSessions += 1;
  }

  totals.total = totals.directGold + totals.lootSellValue + totals.autoSellValue;
  const sorted = (entries) => entries.sort((a, b) =>
    b.qty - a.qty || b.drops - a.drops || a.itemId?.localeCompare(b.itemId) ||
    a.speciesName?.localeCompare(b.speciesName) || 0
  );

  return {
    totals,
    matchedEncounters,
    lootedEncounters,
    matchedSessions,
    items: sorted([...items.values()].map((item) => ({
      itemId: item.itemId,
      qty: item.qty,
      drops: item.drops,
      sources: sorted([...item.sources.values()])
    })))
  };
}
