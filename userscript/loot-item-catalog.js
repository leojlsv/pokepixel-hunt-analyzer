const KNOWN_RARITIES = new Set([
  "weak", "common", "uncommon", "rare", "epic", "legendary", "mythical"
]);
const MAX_NATIVE_INVENTORY_SCENES = 24;
const MAX_NATIVE_INVENTORY_ITEMS = 4_000;
const MAX_NATIVE_BAG_SLOTS = 4_000;

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

function nativeSlotEvidence(slots) {
  const byId = new Map();
  const byName = new Map();
  const conflictsById = new Set();
  const conflictsByName = new Set();
  const collect = (map, conflicts, key, rarity) => {
    if (!key || !rarity || conflicts.has(key)) return;
    const previous = map.get(key);
    if (previous && previous !== rarity) {
      map.set(key, "");
      conflicts.add(key);
    } else {
      map.set(key, rarity);
    }
  };

  for (const slot of slots) {
    try {
      // Native inventory slots can also represent owned Pokémon; their
      // creature rarity must never become an item's rarity.
      if (slot.classList?.contains("inventory-slot--pokemon")) continue;
      const slotId = String(slot.dataset?.itemId || slot.dataset?.item || "").trim();
      const choices = new Set([
        knownLootItemRarity(slot.dataset?.rarity),
        knownLootItemRarity(slot.dataset?.quality),
        ...[...KNOWN_RARITIES].filter((key) => slot.classList?.contains(`rarity-${key}`))
      ].filter(Boolean));
      if (choices.size !== 1) continue; // Ambiguous badges or data/class disagreement.
      const rarity = [...choices][0];
      if (slotId) {
        collect(byId, conflictsById, slotId, rarity);
        continue;
      }
      // Use the full accessible name, not a prefix. The native Bag uses
      // '<name>, <quantity> units' / 'unidades' (see inventory/dom.js).
      const aria = String(slot.getAttribute?.("aria-label") || "").trim();
      const name = aria.replace(/,\s*[\d.,\s]+\s+(?:units?|unidades?)$/iu, "").trim().toLowerCase();
      if (name) collect(byName, conflictsByName, name, rarity);
    } catch {
      // Native slots are optional presentation data. A broken getter does not
      // interrupt Current or History, and never supplies a guessed rarity.
    }
  }
  return { byId, byName, conflictsById, conflictsByName };
}

function bagSlotRarity(evidence, itemId, name, allowNameMatch) {
  // An explicit-ID collision is stronger evidence of ambiguity than another
  // name-only slot. Never repair a disputed ID by matching the display name.
  if (evidence.byId.has(itemId)) return evidence.byId.get(itemId) || "";
  return (allowNameMatch ? evidence.byName.get(name.toLowerCase()) : "") || "";
}

function bagSlotConflict(evidence, itemId, name, allowNameMatch) {
  if (evidence.byId.has(itemId)) return evidence.conflictsById.has(itemId);
  return allowNameMatch && evidence.conflictsByName.has(name.toLowerCase());
}

function nativeItemIdentity(item) {
  const itemId = item?.item_id ?? item?.id ?? item?.item?.item_id ?? item?.item?.id;
  const name = item?.name ?? item?.item?.name;
  return {
    itemId: typeof itemId === "string" && itemId.trim() ? itemId.trim() : "",
    name: typeof name === "string" && name.trim() ? name.trim() : ""
  };
}

/** Read scene objects the game already cached. Never open a Bag window, call
 * game actions, or query live gameplay state. These retained native elements
 * are often detached from document after the Bag closes. */
function nativeInventorySources(pageDocument, pageWindow) {
  let liveSlots = [];
  try {
    liveSlots = Array.from(
      pageDocument?.querySelectorAll?.("button.inventory-slot:not(.is-empty)") || []
    ).slice(0, MAX_NATIVE_BAG_SLOTS);
  } catch {
    // Read-only native presentation is optional.
  }
  const slots = new Set(liveSlots);
  const definitions = new Map();
  const conflictingDefinitions = new Set();
  let inspectedItems = 0;
  const scenes = [];
  try {
    const cached = pageWindow?.PokeIdle?.ReactiveWindows?.cached?.();
    if (Array.isArray(cached)) scenes.push(...cached.slice(0, MAX_NATIVE_INVENTORY_SCENES));
  } catch {
    // An unavailable native cache is not proof of an item's rarity.
  }
  try {
    if (pageWindow?.SceneManager?._scene) scenes.push(pageWindow.SceneManager._scene);
  } catch {
    // The active scene is an optional read-only fallback.
  }

  const visited = new Set();
  for (const scene of scenes) {
    if (!scene || visited.has(scene)) continue;
    visited.add(scene);
    try {
      const body = scene?._panel?.body;
      if (!body?.querySelectorAll || !(
        body.matches?.(".inventory-window--slots, .inventory-slot-grid")
        || body.closest?.(".inventory-window--slots")
        || body.querySelector?.(".inventory-slot-grid")
      )) continue;

      for (const slot of Array.from(body.querySelectorAll("button.inventory-slot:not(.is-empty)"))
        .slice(0, Math.max(0, MAX_NATIVE_BAG_SLOTS - slots.size))) {
        slots.add(slot);
      }
      const nativeItems = Array.isArray(scene._items)
        ? scene._items.slice(0, Math.max(0, MAX_NATIVE_INVENTORY_ITEMS - inspectedItems)) : [];
      for (const item of nativeItems) {
        inspectedItems += 1;
        try {
          const { itemId, name } = nativeItemIdentity(item);
          if (!itemId) continue;
          const rarity = inventoryItemRarity(item);
          const previous = definitions.get(itemId);
          if (!previous) {
            definitions.set(itemId, { name: name || itemId, rarity });
          } else if (rarity && previous.rarity && rarity !== previous.rarity) {
            // Conflicting native definitions are not a trustworthy classification.
            conflictingDefinitions.add(itemId);
            previous.rarity = "";
          } else if (rarity && !conflictingDefinitions.has(itemId)) {
            previous.rarity = rarity;
          }
        } catch {
          // Skip only the malformed native item.
        }
      }
    } catch {
      // Retained game scene may have been disposed between two reads.
    }
  }
  return { evidence: nativeSlotEvidence(slots), definitions, conflictingDefinitions };
}

/**
 * Read-only item metadata from the authoritative Inventory API, cached native
 * Bag item definitions, and the corresponding native Bag slot. Never infer
 * by item ID prefix, item name semantics, drop value, or an unrelated slot.
 */
export function createLootItemCatalog(snapshot, pageDocument, previousCatalog = null, pageWindow = null) {
  const catalog = new Map(previousCatalog || []);
  const { evidence, definitions, conflictingDefinitions } = nativeInventorySources(pageDocument, pageWindow);
  const inventory = snapshot?.ready && snapshot.byId?.entries ? snapshot.byId : new Map();
  const identifiers = new Set([...catalog.keys(), ...inventory.keys(), ...definitions.keys()]);
  const candidates = [];
  const nameCounts = new Map();
  for (const itemId of identifiers) {
    const item = inventory.get(itemId);
    const native = definitions.get(itemId);
    const previous = catalog.get(itemId);
    const name = typeof item?.name === "string" && item.name.trim()
      ? item.name.trim()
      : (native?.name || previous?.name || itemId);
    const nameKey = name.trim().toLowerCase();
    candidates.push({ itemId, item, native, previous, name, nameKey });
    nameCounts.set(nameKey, (nameCounts.get(nameKey) || 0) + 1);
  }
  for (const { itemId, item, native, previous, name, nameKey } of candidates) {
    const authoritativeRarity = inventoryItemRarity(item);
    const allowNameMatch = nameCounts.get(nameKey) === 1;
    const disputed = conflictingDefinitions.has(itemId)
      || bagSlotConflict(evidence, itemId, name, allowNameMatch);
    const rarity = authoritativeRarity || (disputed ? "" : (
      knownLootItemRarity(native?.rarity)
      || bagSlotRarity(evidence, itemId, name, allowNameMatch)
      || knownLootItemRarity(previous?.rarity)
    ));
    catalog.set(itemId, { name, rarity });
  }
  return catalog;
}

export function lootItemCatalogSignature(items, catalog) {
  return JSON.stringify(items.map(({ itemId }) => {
    const metadata = catalog?.get?.(itemId);
    return [itemId, metadata?.name || "", knownLootItemRarity(metadata?.rarity)];
  }));
}

/** Inventory update events trigger immediate reads; otherwise, rescan the
 * retained native Bag at most once per interval. The normal one-second
 * Current redraw does not traverse the game DOM on every tick. */
export function createLootItemCatalogReader({
  getSnapshot = () => null,
  getPageDocument = () => null,
  getPageWindow = () => null,
  now = () => Date.now(),
  refreshIntervalMs = 2_500
} = {}) {
  let catalog = new Map();
  let lastInventoryUpdatedAt = undefined;
  let lastReadAt = Number.NEGATIVE_INFINITY;
  return () => {
    const snapshot = getSnapshot();
    const snapshotUpdatedAt = snapshot?.updatedAtMs ?? null;
    const timestamp = now();
    if (snapshotUpdatedAt === lastInventoryUpdatedAt
      && timestamp - lastReadAt < refreshIntervalMs) return catalog;

    catalog = createLootItemCatalog(snapshot, getPageDocument(), catalog, getPageWindow());
    lastInventoryUpdatedAt = snapshotUpdatedAt;
    lastReadAt = timestamp;
    return catalog;
  };
}
