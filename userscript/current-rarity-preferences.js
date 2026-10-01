import { RARITIES } from "./ui-utils.js";

export const CURRENT_RARITY_PREFERENCES_KEY = "pokepixel_hunt_analyzer_current_rarities_v1";

const RARITY_KEYS = new Set(RARITIES.map(([key]) => key));
const LISTS = new Set(["captured", "failed"]);

function normalizeSelection(value) {
  if (value === null) return null; // All (*), including any future rarities.
  if (!Array.isArray(value) || value.length > RARITY_KEYS.size) return null;
  if (value.length === 0) return []; // Explicitly select none.

  const selected = [...new Set(value.filter((key) => typeof key === "string" && RARITY_KEYS.has(key)))];
  // Invalid stored values must never silently turn a populated list into None.
  return selected.length ? selected : null;
}

export function readCurrentRarityPreferences(storage) {
  const fallback = { captured: null, failed: null };
  try {
    const activeStorage = storage === undefined ? globalThis.localStorage : storage;
    const stored = JSON.parse(activeStorage?.getItem(CURRENT_RARITY_PREFERENCES_KEY) || "null");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return fallback;
    return {
      captured: normalizeSelection(stored.captured),
      failed: normalizeSelection(stored.failed)
    };
  } catch {
    return fallback;
  }
}

export function saveCurrentRarityPreference(list, selection, storage) {
  if (!LISTS.has(list)) return;
  try {
    const activeStorage = storage === undefined ? globalThis.localStorage : storage;
    const preferences = readCurrentRarityPreferences(activeStorage);
    preferences[list] = normalizeSelection(selection);
    activeStorage?.setItem(CURRENT_RARITY_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // The selection still applies to the current UI when storage is blocked.
  }
}
