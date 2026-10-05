const KNOWN_RARITIES = new Set([
  "weak", "common", "uncommon", "rare", "epic", "legendary", "mythical"
]);

const RARITY_ALIASES = Object.freeze({
  fraco: "weak",
  fraca: "weak",
  comum: "common",
  incomum: "uncommon",
  raro: "rare",
  rara: "rare",
  epico: "epic",
  epica: "epic",
  lendario: "legendary",
  lendaria: "legendary",
  mitico: "mythical",
  mitica: "mythical"
});

export function knownLootItemRarity(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return KNOWN_RARITIES.has(normalized) ? normalized : (RARITY_ALIASES[normalized] || "");
}

// Inventory still owns quantity/type data for Ball/Potion HUDs. Loot rarity is
// deliberately sourced elsewhere from the game's items.json catalog.
export function inventoryItemRarity(item) {
  for (const value of [
    item?.rarity, item?.quality, item?.tier,
    item?.item?.rarity, item?.item?.quality, item?.item?.tier
  ]) {
    const rarity = knownLootItemRarity(value);
    if (rarity) return rarity;
  }
  return "";
}

function itemDefinitions(payload) {
  return Array.isArray(payload) ? payload : [];
}

/**
 * Build loot metadata only from the items.json payload already received by the
 * game. Missing/unsupported rarity stays unknown; there is no Backpack/DOM or
 * Inventory API fallback for loot classification.
 */
export function createLootItemCatalog(payload) {
  const catalog = new Map();
  for (const item of itemDefinitions(payload)) {
    const itemId = String(item?.id ?? item?.item_id ?? "").trim();
    if (!itemId) continue;
    const name = typeof item?.name === "string" && item.name.trim()
      ? item.name.trim()
      : itemId;
    catalog.set(itemId, {
      name,
      rarity: knownLootItemRarity(item?.rarity)
    });
  }
  return catalog;
}

export function lootItemCatalogSignature(items, catalog) {
  return JSON.stringify(items.map(({ itemId }) => {
    const metadata = catalog?.get?.(itemId);
    return [itemId, metadata?.name || "", knownLootItemRarity(metadata?.rarity)];
  }));
}
