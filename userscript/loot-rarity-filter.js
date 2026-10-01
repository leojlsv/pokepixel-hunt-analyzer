import { RARITIES } from "./ui-utils.js";

export const LOOT_RARITY_FILTER_STORAGE_KEY = "pokepixel_hunt_analyzer_loot_item_rarities_v1";

const ITEM_RARITIES = [...RARITIES, ["none", "No rarity"]];
const ITEM_RARITY_KEYS = new Set(ITEM_RARITIES.map(([key]) => key));
const ITEM_RARITY_LABELS = new Map(ITEM_RARITIES);
const SCOPES = new Set(["current", "history"]);

function normalizeSelection(value) {
  if (value === null) return null; // All, including items with future rarities.
  if (!Array.isArray(value) || value.length > ITEM_RARITY_KEYS.size) return null;
  if (value.length === 0) return []; // Explicitly select none.
  const selected = [...new Set(value.filter((key) =>
    typeof key === "string" && ITEM_RARITY_KEYS.has(key)
  ))];
  return selected.length ? selected : null;
}

export function readLootRarityPreferences(storage) {
  const fallback = { current: null, history: null };
  try {
    const activeStorage = storage === undefined ? globalThis.localStorage : storage;
    const stored = JSON.parse(activeStorage?.getItem(LOOT_RARITY_FILTER_STORAGE_KEY) || "null");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return fallback;
    return {
      current: normalizeSelection(stored.current),
      history: normalizeSelection(stored.history)
    };
  } catch {
    return fallback;
  }
}

export function saveLootRarityPreference(scope, selection, storage) {
  if (!SCOPES.has(scope)) return;
  try {
    const activeStorage = storage === undefined ? globalThis.localStorage : storage;
    const preferences = readLootRarityPreferences(activeStorage);
    preferences[scope] = normalizeSelection(selection);
    activeStorage?.setItem(LOOT_RARITY_FILTER_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // The selection still applies until this UI is recreated.
  }
}

export function bindLootRarityFilter(shadow, { prefix, scope, onChange }) {
  const root = shadow.getElementById(`${prefix}-rarity`);
  const all = root.querySelector("[data-rarity-all]");
  const options = [...root.querySelectorAll("[data-rarity-value]")];
  const label = shadow.getElementById(`${prefix}-rarity-label`);
  let selection = null;
  let storage;
  try {
    storage = globalThis.localStorage ?? shadow.ownerDocument?.defaultView?.localStorage;
  } catch {
    storage = null;
  }

  const restored = readLootRarityPreferences(storage)[scope];
  if (restored !== null) {
    const selected = new Set(restored);
    for (const input of options) input.checked = selected.has(input.dataset.rarityValue);
  }

  const sync = () => {
    const selected = options
      .filter((input) => input.checked)
      .map((input) => input.dataset.rarityValue);
    const allSelected = selected.length === options.length;
    all.checked = allSelected;
    selection = allSelected ? null : new Set(selected);
    label.textContent = allSelected ? "All (*)" : selected.length === 0 ? "None"
      : selected.length === 1 ? ITEM_RARITY_LABELS.get(selected[0])
        : `${selected.length} selected`;
  };

  root.addEventListener("change", (event) => {
    const input = event.target;
    if (input?.tagName !== "INPUT" || input.type !== "checkbox") return;
    if (input.hasAttribute("data-rarity-all")) {
      for (const option of options) option.checked = input.checked;
    }
    sync();
    saveLootRarityPreference(scope, selection === null ? null : [...selection], storage);
    onChange();
  });
  sync();

  return {
    isAll: () => selection === null,
    matches: (rarity) => selection === null || selection.has(rarity)
  };
}
