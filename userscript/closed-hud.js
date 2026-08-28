import {
  RARITIES,
  formatDuration,
  formatNumber,
  formatRate
} from "./ui-utils.js";
import { createInventoryState } from "./inventory-state.js";

export const CLOSED_HUD_STORAGE_KEY = "pokepixel_hunt_analyzer_closed_hud_v1";
export const POTION_USAGE_STORAGE_KEY = "pokepixel_hunt_analyzer_potion_usage_v1";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const RARITY_ABBR = Object.freeze({
  weak: "W",
  common: "C",
  uncommon: "U",
  rare: "R",
  epic: "E",
  legendary: "L",
  mythical: "M"
});
const RARITY_KEYS = RARITIES.map(([key]) => key);
const RARITY_KEY_SET = new Set(RARITY_KEYS);
const DEFAULT_RARITY_KEYS = Object.freeze([...RARITY_KEYS]);
const RARE_PLUS_KEYS = new Set(["rare", "epic", "legendary", "mythical"]);

export const CLOSED_HUD_WIDGETS = Object.freeze([
  { id: "empty", label: "Empty", category: "Layout", size: 1 },
  { id: "seen", label: "Seen", category: "Hunt", size: 1 },
  { id: "seenPerHour", label: "Seen/h", category: "Hunt", size: 1 },
  { id: "huntTime", label: "Hunt Time", category: "Hunt", size: 1 },

  { id: "captured", label: "Captured", category: "Capture", size: 1 },
  { id: "failed", label: "Failed", category: "Capture", size: 1 },
  { id: "captureRate", label: "Capture Rate", category: "Capture", size: 1 },
  {
    id: "rarityTracker",
    label: "Rarity Tracker",
    category: "Capture",
    size: 2,
    configurableSize: true
  },
  { id: "shinyTracker", label: "Shiny Tracker", category: "Capture", size: 1 },
  { id: "rarePlusAttempts", label: "Rare+ Attempts", category: "Capture", size: 1 },
  { id: "rarePlusCaptured", label: "Rare+ Captured", category: "Capture", size: 1 },
  { id: "rarePlusFailed", label: "Rare+ Failed", category: "Capture", size: 1 },

  { id: "highestIv", label: "Highest IV", category: "Quality", size: 1 },

  { id: "trainerXpPerHour", label: "Trainer XP/h", category: "Leveling", size: 1 },
  { id: "pokemonXpPerHour", label: "Pokémon XP/h", category: "Leveling", size: 1 },

  { id: "dollar", label: "Dollar", category: "Economy", size: 1 },
  { id: "dollarPerHour", label: "Dollar/h", category: "Economy", size: 1 },
  { id: "profit", label: "Profit", category: "Economy", size: 1 },
  { id: "profitPerHour", label: "Profit/h", category: "Economy", size: 1 },
  { id: "expenses", label: "Expenses", category: "Economy", size: 1 },

  { id: "totalBallsUsed", label: "Total Balls Used", category: "Supplies", size: 1 },
  {
    id: "ballTracker",
    label: "Ball Tracker",
    category: "Supplies",
    itemType: "capsule",
    size: 1
  },
  {
    id: "ballSuccess",
    label: "Ball Success",
    category: "Supplies",
    itemType: "capsule",
    size: 1
  },
  {
    id: "ballFailed",
    label: "Ball Failed",
    category: "Supplies",
    itemType: "capsule",
    size: 1
  },
  {
    id: "ballCaptureRate",
    label: "Ball Capture Rate",
    category: "Supplies",
    itemType: "capsule",
    size: 1
  },
  {
    id: "ballCost",
    label: "Ball Cost",
    category: "Supplies",
    itemType: "capsule",
    size: 1
  },
  {
    id: "potionTracker",
    label: "Potion Tracker",
    category: "Supplies",
    itemType: "potion",
    size: 1
  }
]);

const WIDGET_BY_ID = new Map(CLOSED_HUD_WIDGETS.map((widget) => [widget.id, widget]));
const EMPTY_SLOT = Object.freeze({
  widget: "empty",
  itemId: null,
  size: 1,
  rarityKeys: null,
  showFailed: false
});

function emptySlot() {
  return { ...EMPTY_SLOT };
}

function defaultRaritySlot(size = 2) {
  return {
    widget: "rarityTracker",
    itemId: null,
    size: size === 1 ? 1 : 2,
    rarityKeys: [...DEFAULT_RARITY_KEYS],
    showFailed: false
  };
}

function defaultShinySlot() {
  return { ...EMPTY_SLOT, widget: "shinyTracker" };
}

export const CLOSED_HUD_PRESETS = Object.freeze({
  default: Object.freeze([
    { widget: "seen" },
    { widget: "seenPerHour" },
    defaultRaritySlot(2),
    { widget: "empty" }
  ]),
  leveling: Object.freeze([
    { widget: "trainerXpPerHour" },
    { widget: "pokemonXpPerHour" },
    { widget: "seen" },
    { widget: "seenPerHour" }
  ]),
  economy: Object.freeze([
    { widget: "dollarPerHour" },
    { widget: "profitPerHour" },
    { widget: "expenses" },
    { widget: "huntTime" }
  ]),
  capture: Object.freeze([
    { widget: "seen" },
    { widget: "captured" },
    { widget: "failed" },
    { widget: "captureRate" }
  ])
});

function normalizeRarityKeys(value) {
  if (!Array.isArray(value)) return [...DEFAULT_RARITY_KEYS];
  const selected = RARITY_KEYS.filter((key) => value.includes(key) && RARITY_KEY_SET.has(key));
  return selected.length > 0 ? selected : [...DEFAULT_RARITY_KEYS];
}

function cloneSlot(slot) {
  let widget = String(slot?.widget || "empty");
  if (widget === "capturedRarities") widget = "rarityTracker";
  if (widget === "shinyCaptured" || widget === "shinySeen") widget = "shinyTracker";

  const rarity = widget === "rarityTracker";
  return {
    widget,
    itemId: slot?.itemId ? String(slot.itemId) : null,
    size: rarity ? (Number(slot?.size) === 1 ? 1 : 2) : 1,
    rarityKeys: rarity ? normalizeRarityKeys(slot?.rarityKeys) : null,
    showFailed: rarity ? Boolean(slot?.showFailed) : false
  };
}

export function closedHudWidgetSize(widgetId, slot = null) {
  if (widgetId === "capturedRarities") return 2;
  if (widgetId === "rarityTracker") return Number(slot?.size) === 1 ? 1 : 2;
  return WIDGET_BY_ID.get(widgetId)?.size === 2 ? 2 : 1;
}

function slotSize(slot) {
  return closedHudWidgetSize(slot?.widget, slot);
}

function normalizeWideRows(slots) {
  const normalized = slots.map(cloneSlot);
  for (const rowStart of [0, 2]) {
    const rowIndexes = [rowStart, rowStart + 1];
    const wideIndex = rowIndexes.find((index) => slotSize(normalized[index]) === 2);
    if (wideIndex == null) continue;
    const wide = cloneSlot(normalized[wideIndex]);
    normalized[rowStart] = wide;
    normalized[rowStart + 1] = emptySlot();
  }
  return normalized;
}

export function closedHudConfigForPreset(preset = "default") {
  const key = Object.hasOwn(CLOSED_HUD_PRESETS, preset) ? preset : "default";
  return {
    preset: key,
    slots: normalizeWideRows(CLOSED_HUD_PRESETS[key].map(cloneSlot))
  };
}

export function normalizeClosedHudConfig(raw) {
  if (!raw || typeof raw !== "object") return closedHudConfigForPreset("default");

  const preset = Object.hasOwn(CLOSED_HUD_PRESETS, raw.preset)
    ? raw.preset
    : raw.preset === "custom"
      ? "custom"
      : "default";
  const fallback = closedHudConfigForPreset(preset === "custom" ? "default" : preset);
  const rawSlots = Array.isArray(raw.slots) ? raw.slots : fallback.slots;
  const slots = [];

  for (let index = 0; index < 4; index += 1) {
    const candidate = cloneSlot(rawSlots[index] || fallback.slots[index]);
    slots.push(WIDGET_BY_ID.has(candidate.widget)
      ? candidate
      : cloneSlot(fallback.slots[index]));
  }

  return { preset, slots: normalizeWideRows(slots) };
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatHudQuantity(value, { micro = false } = {}) {
  const number = numeric(value);
  const absolute = Math.abs(number);
  if (absolute < 1_000) return formatNumber(number);

  const units = [
    [1_000_000_000, "B"],
    [1_000_000, "M"],
    [1_000, "K"]
  ];
  const [divisor, suffix] = units.find(([threshold]) => absolute >= threshold) || units[2];
  const scaled = number / divisor;
  if (micro) return `${Math.round(scaled)}${suffix}`;
  const digits = Math.abs(scaled) < 10 ? 1 : 0;
  return `${scaled.toFixed(digits).replace(/\.0$/, "")}${suffix}`;
}

export function formatHudMetric(value) {
  const number = numeric(value);
  const absolute = Math.abs(number);
  if (absolute < 1_000) return formatNumber(number);

  const units = [
    [1_000_000_000, "B"],
    [1_000_000, "M"],
    [1_000, "K"]
  ];
  const [divisor, suffix] = units.find(([threshold]) => absolute >= threshold) || units[2];
  const scaled = number / divisor;
  const magnitude = Math.abs(scaled);
  const digits = magnitude < 10 ? 2 : magnitude < 100 ? 1 : 0;
  return `${scaled.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")}${suffix}`;
}

function signedMetric(value) {
  const number = numeric(value);
  if (number > 0) return `+${formatHudMetric(number)}`;
  return formatHudMetric(number);
}

function ballStatsRow(map, itemId) {
  return map?.get(itemId) || { used: 0, success: 0, failed: 0, cost: 0 };
}

export function deriveClosedHudState({ metrics = {}, encounters = [] } = {}) {
  const rarities = metrics.rarities || {};
  const shinyBucket = metrics.shiny || {};
  const raritySeen = {};
  const rarityCaptured = {};
  const rarityFailed = {};
  let rarePlusCaptured = 0;
  let rarePlusFailed = 0;
  let fallbackShinySeen = 0;
  let fallbackShinyCaptured = 0;

  for (const [key] of RARITIES) {
    const row = rarities[key] || {};
    raritySeen[key] = numeric(row.seen);
    rarityCaptured[key] = numeric(row.captured);
    rarityFailed[key] = numeric(row.failed);
    fallbackShinySeen += numeric(row.shinySeen);
    fallbackShinyCaptured += numeric(row.shinyCaptured);
    if (RARE_PLUS_KEYS.has(key)) {
      rarePlusCaptured += numeric(row.captured);
      rarePlusFailed += numeric(row.failed);
    }
  }

  const ballStats = new Map();
  let highestIv = null;

  for (const encounter of encounters || []) {
    const ivTotal = finiteOrNull(encounter?.ivTotal);
    if (ivTotal !== null) highestIv = highestIv === null ? ivTotal : Math.max(highestIv, ivTotal);

    if (!["success", "failed"].includes(encounter?.captureResult)) continue;
    const itemId = String(encounter?.capsuleItemId || "");
    if (!itemId) continue;

    const current = ballStatsRow(ballStats, itemId);
    const next = {
      used: current.used + 1,
      success: current.success + (encounter.captureResult === "success" ? 1 : 0),
      failed: current.failed + (encounter.captureResult === "failed" ? 1 : 0),
      cost: current.cost + numeric(encounter.supplyCost)
    };
    ballStats.set(itemId, next);
  }

  const activeMs = numeric(metrics.activeMs);
  const dollar = numeric(metrics.gold);
  const expenses = numeric(metrics.expenses);
  const profit = dollar - expenses;
  const profitPerHour = activeMs > 0 ? profit * 3_600_000 / activeMs : null;
  const totalBallsUsed = [...ballStats.values()].reduce((sum, row) => sum + row.used, 0);

  return {
    seen: numeric(metrics.seen),
    seenPerHour: metrics.seenPerHour == null ? null : numeric(metrics.seenPerHour),
    captured: numeric(metrics.captured),
    failed: numeric(metrics.failed),
    captureRate: metrics.seenToCaptureRate == null ? null : Number(metrics.seenToCaptureRate),
    trainerXpPerHour: metrics.trainerExpPerHour == null ? null : numeric(metrics.trainerExpPerHour),
    pokemonXpPerHour: metrics.pokemonExpPerHour == null ? null : numeric(metrics.pokemonExpPerHour),
    dollar,
    dollarPerHour: metrics.goldPerHour == null ? null : numeric(metrics.goldPerHour),
    profit,
    profitPerHour,
    expenses,
    activeMs,
    raritySeen,
    rarityCaptured,
    rarityFailed,
    rarePlusAttempts: rarePlusCaptured + rarePlusFailed,
    rarePlusCaptured,
    rarePlusFailed,
    shinySeen: shinyBucket.seen == null ? fallbackShinySeen : numeric(shinyBucket.seen),
    shinyCaptured: shinyBucket.captured == null ? fallbackShinyCaptured : numeric(shinyBucket.captured),
    highestIv,
    totalBallsUsed,
    ballStats,
    ballUsage: new Map([...ballStats].map(([itemId, row]) => [itemId, row.used]))
  };
}

function humanizeItemId(itemId, type) {
  let raw = String(itemId || "");
  raw = raw.replace(type === "capsule" ? /^capsule_/i : /^potion_/i, "");
  if (!raw) return type === "capsule" ? "Ball" : "Potion";
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function shortInventoryName(item, type) {
  const raw = String(item?.name || humanizeItemId(item?.item_id, type));
  if (type === "capsule") return raw.replace(/\s+Ball$/i, "") || raw;
  if (type === "potion") return raw.replace(/\s+Potion$/i, "") || raw;
  return raw;
}

function firstInventoryItem(inventory, type) {
  const items = type === "capsule" ? inventory?.capsules : inventory?.potions;
  if (!Array.isArray(items) || items.length === 0) return null;
  if (type === "capsule") return items.find((item) => item.item_id === "capsule_ultra") || items[0];
  return items[0];
}

function inventoryItemForSlot(slot, inventory, type) {
  if (slot?.itemId) {
    const item = inventory?.byId?.get(slot.itemId);
    if (item) return item;
    return {
      item_id: slot.itemId,
      name: humanizeItemId(slot.itemId, type),
      qty: 0,
      quantity: 0
    };
  }
  return firstInventoryItem(inventory, type);
}

function numberDisplay(label, value) {
  return {
    label,
    value: formatNumber(value),
    compactValue: formatHudQuantity(value),
    microValue: formatHudQuantity(value, { micro: true })
  };
}

function inventoryDisplay(label, value, secondaryValue = null, title = "") {
  return { label, kind: "inventory", value, secondaryValue, title };
}

export function closedHudDisplay(slot, derived, inventory) {
  const normalizedSlot = cloneSlot(slot);
  const widgetId = normalizedSlot.widget;

  switch (widgetId) {
    case "empty":
      return { label: "", value: "", empty: true };
    case "seen":
      return { label: "Seen", value: formatHudQuantity(derived.seen) };
    case "seenPerHour":
      return { label: "Seen/h", value: derived.seenPerHour == null ? "—" : formatHudMetric(derived.seenPerHour) };
    case "huntTime":
      return { label: "Time", value: formatDuration(derived.activeMs) };
    case "captured":
      return { label: "Cap", value: formatNumber(derived.captured) };
    case "failed":
      return numberDisplay("Fail", derived.failed);
    case "captureRate":
      return { label: "Capture", value: formatRate(derived.captureRate) };
    case "trainerXpPerHour":
      return { label: "XP/h", value: derived.trainerXpPerHour == null ? "—" : formatHudMetric(derived.trainerXpPerHour) };
    case "pokemonXpPerHour":
      return { label: "PK XP/h", value: derived.pokemonXpPerHour == null ? "—" : formatHudMetric(derived.pokemonXpPerHour) };
    case "dollar":
      return { label: "$", value: formatHudMetric(derived.dollar) };
    case "dollarPerHour":
      return { label: "$/h", value: derived.dollarPerHour == null ? "—" : formatHudMetric(derived.dollarPerHour) };
    case "profit":
      return {
        label: "Profit",
        value: signedMetric(derived.profit),
        tone: derived.profit < 0 ? "negative" : derived.profit > 0 ? "positive" : ""
      };
    case "profitPerHour":
      return {
        label: "Profit/h",
        value: derived.profitPerHour == null ? "—" : signedMetric(derived.profitPerHour),
        tone: derived.profitPerHour == null ? "" : derived.profitPerHour < 0 ? "negative" : derived.profitPerHour > 0 ? "positive" : ""
      };
    case "expenses":
      return { label: "Expenses", value: formatHudMetric(derived.expenses) };
    case "rarityTracker": {
      const selected = normalizeRarityKeys(normalizedSlot.rarityKeys);
      const showFailed = Boolean(normalizedSlot.showFailed);
      return {
        label: "Rarity",
        kind: "rarities",
        size: normalizedSlot.size,
        showFailed,
        rarities: selected.map((key) => {
          const label = RARITIES.find(([rarityKey]) => rarityKey === key)?.[1] || key;
          return {
            key,
            label,
            abbr: RARITY_ABBR[key] || label.slice(0, 1).toUpperCase(),
            seen: numeric(derived.raritySeen?.[key]),
            captured: numeric(derived.rarityCaptured?.[key]),
            failed: numeric(derived.rarityFailed?.[key])
          };
        })
      };
    }
    case "shinyTracker": {
      const seen = numeric(derived.shinySeen);
      const captured = numeric(derived.shinyCaptured);
      return {
        kind: "shiny",
        seenValue: formatHudQuantity(seen),
        capturedValue: formatNumber(captured),
        title: `Shiny — Seen: ${formatNumber(seen)} · Captured: ${formatNumber(captured)}`
      };
    }
    case "rarePlusAttempts":
      return numberDisplay("R+ Attempts", derived.rarePlusAttempts);
    case "rarePlusCaptured":
      return numberDisplay("R+ Cap", derived.rarePlusCaptured);
    case "rarePlusFailed":
      return numberDisplay("R+F", derived.rarePlusFailed);
    case "highestIv":
      return { label: "IV Max", value: derived.highestIv == null ? "—" : formatNumber(derived.highestIv), title: "Highest IV observed in this Hunt" };
    case "totalBallsUsed":
      return numberDisplay("Balls ↓", derived.totalBallsUsed);
    case "ballTracker": {
      const item = inventoryItemForSlot(normalizedSlot, inventory, "capsule");
      const itemId = item?.item_id || normalizedSlot.itemId || "";
      const remaining = item ? numeric(item.qty ?? item.quantity) : null;
      const used = itemId ? ballStatsRow(derived.ballStats, itemId).used : 0;
      return inventoryDisplay(
        shortInventoryName(item, "capsule"),
        remaining == null ? "—" : formatNumber(remaining),
        `↓${formatNumber(used)}`,
        `${item?.name || itemId || "Ball"}: ${remaining == null ? "unknown" : formatNumber(remaining)} remaining, ${formatNumber(used)} used in this Hunt`
      );
    }
    case "ballSuccess":
    case "ballFailed":
    case "ballCaptureRate":
    case "ballCost": {
      const item = inventoryItemForSlot(normalizedSlot, inventory, "capsule");
      const itemId = item?.item_id || normalizedSlot.itemId || "";
      const stats = ballStatsRow(derived.ballStats, itemId);
      const label = shortInventoryName(item, "capsule");
      if (widgetId === "ballSuccess") {
        return inventoryDisplay(label, `✓${formatNumber(stats.success)}`, null, `${item?.name || itemId || "Ball"}: ${formatNumber(stats.success)} successful captures`);
      }
      if (widgetId === "ballFailed") {
        return inventoryDisplay(label, `✕${formatNumber(stats.failed)}`, null, `${item?.name || itemId || "Ball"}: ${formatNumber(stats.failed)} failed captures`);
      }
      if (widgetId === "ballCaptureRate") {
        const rate = stats.used > 0 ? stats.success / stats.used : null;
        return inventoryDisplay(label, formatRate(rate), null, `${item?.name || itemId || "Ball"}: ${formatNumber(stats.success)} / ${formatNumber(stats.used)} successful attempts`);
      }
      return inventoryDisplay(label, `$${formatHudMetric(stats.cost)}`, null, `${item?.name || itemId || "Ball"}: ${formatNumber(stats.cost)} total capture cost`);
    }
    case "potionTracker": {
      const item = inventoryItemForSlot(normalizedSlot, inventory, "potion");
      const itemId = item?.item_id || normalizedSlot.itemId || "";
      const remaining = item ? numeric(item.qty ?? item.quantity) : null;
      const hasUsage = derived.potionUsage instanceof Map;
      const used = hasUsage && itemId ? derived.potionUsage.get(itemId) || 0 : 0;
      return inventoryDisplay(
        shortInventoryName(item, "potion"),
        remaining == null ? "—" : formatNumber(remaining),
        hasUsage ? `↓${formatNumber(used)}` : null,
        `${item?.name || itemId || "Potion"}: ${remaining == null ? "unknown" : formatNumber(remaining)} remaining, ${formatNumber(used)} used in this Hunt`
      );
    }
    default:
      return { label: "", value: "", empty: true };
  }
}

function itemQuantity(item) {
  const value = Number(item?.qty ?? item?.quantity ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function potionQuantities(snapshot) {
  const quantities = new Map();
  for (const item of snapshot?.potions || []) {
    const itemId = String(item?.item_id || "");
    if (itemId) quantities.set(itemId, itemQuantity(item));
  }
  return quantities;
}

function mapFromStoredRecord(record) {
  const map = new Map();
  if (!record || typeof record !== "object") return map;
  for (const [key, rawValue] of Object.entries(record)) {
    const value = Number(rawValue);
    if (key && Number.isFinite(value) && value >= 0) map.set(key, value);
  }
  return map;
}

export function createPotionUsageTracker({ storage = null, storageKey = POTION_USAGE_STORAGE_KEY } = {}) {
  let sessionId = null;
  let lastQuantities = new Map();
  let usage = new Map();

  try {
    const stored = JSON.parse(storage?.getItem(storageKey) || "null");
    if (stored && typeof stored === "object" && stored.sessionId) {
      sessionId = String(stored.sessionId);
      lastQuantities = mapFromStoredRecord(stored.lastQuantities);
      usage = mapFromStoredRecord(stored.usage);
    }
  } catch {
    // Invalid or unavailable storage starts a fresh tracker.
  }

  function persist() {
    if (!storage || !sessionId) return;
    try {
      storage.setItem(storageKey, JSON.stringify({
        sessionId,
        lastQuantities: Object.fromEntries(lastQuantities),
        usage: Object.fromEntries(usage)
      }));
    } catch {
      // In-memory tracking remains valid if persistence fails.
    }
  }

  function reconcile(nextSessionId, inventorySnapshot) {
    const normalizedSessionId = nextSessionId ? String(nextSessionId) : null;
    if (!normalizedSessionId || !inventorySnapshot?.ready) return;

    const currentQuantities = potionQuantities(inventorySnapshot);
    if (sessionId !== normalizedSessionId) {
      sessionId = normalizedSessionId;
      lastQuantities = currentQuantities;
      usage = new Map();
      persist();
      return;
    }

    const itemIds = new Set([...lastQuantities.keys(), ...currentQuantities.keys()]);
    const nextLastQuantities = new Map();
    let changed = false;

    for (const itemId of itemIds) {
      const previous = lastQuantities.has(itemId) ? lastQuantities.get(itemId) : null;
      const current = currentQuantities.has(itemId) ? currentQuantities.get(itemId) : 0;
      if (previous !== null && current < previous) {
        usage.set(itemId, (usage.get(itemId) || 0) + previous - current);
      }
      if (previous === null || current !== previous) changed = true;
      nextLastQuantities.set(itemId, current);
    }

    if (!changed) return;
    lastQuantities = nextLastQuantities;
    persist();
  }

  return {
    reconcile,
    getUsage: (itemId) => itemId ? usage.get(String(itemId)) || 0 : 0,
    getSessionId: () => sessionId,
    getSnapshot: () => ({
      sessionId,
      lastQuantities: new Map(lastQuantities),
      usage: new Map(usage)
    })
  };
}

function readStoredConfig() {
  try {
    return normalizeClosedHudConfig(JSON.parse(localStorage.getItem(CLOSED_HUD_STORAGE_KEY) || "null"));
  } catch {
    return closedHudConfigForPreset("default");
  }
}

function writeStoredConfig(config) {
  try {
    localStorage.setItem(CLOSED_HUD_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Configuration still works for the current page if storage is unavailable.
  }
}

function widgetOptionsMarkup() {
  const groups = new Map();
  for (const widget of CLOSED_HUD_WIDGETS) {
    if (!groups.has(widget.category)) groups.set(widget.category, []);
    groups.get(widget.category).push(widget);
  }
  return [...groups.entries()].map(([category, widgets]) => `
    <optgroup label="${category}">
      ${widgets.map((widget) => `<option value="${widget.id}">${widget.label}</option>`).join("")}
    </optgroup>`).join("");
}

function rarityConfigMarkup(index) {
  return `
    <div class="pha-hud-rarity-config" data-hud-rarity-config="${index}" hidden>
      <div class="pha-hud-rarity-toolbar">
        <label>Width
          <select data-hud-rarity-width="${index}">
            <option value="1">1 slot</option>
            <option value="2">2 slots</option>
          </select>
        </label>
        <label class="pha-hud-inline-check">
          <input type="checkbox" data-hud-rarity-failed="${index}">
          <span>Show Failed</span>
        </label>
      </div>
      <div class="pha-hud-rarity-checks" aria-label="Tracked rarities">
        ${RARITIES.map(([key, label]) => `
          <label title="${label}">
            <input type="checkbox" data-hud-rarity-key="${index}" value="${key}">
            <span class="rarity-${key}">${RARITY_ABBR[key] || label[0]}</span>
          </label>`).join("")}
      </div>
    </div>`;
}

const CLOSED_HUD_STYLE = `
  .topbar.pha-hud-topbar { grid-template-columns:minmax(0,1fr) auto auto auto auto; }
  #pha-toggle.pha-custom-hud {
    width:220px !important;
    min-width:220px !important;
    height:52px !important;
    grid-template-columns:32px minmax(0,1fr) !important;
  }
  #pha-toggle.pha-custom-hud > .hud-content { display:none !important; }
  .pha-hud-grid {
    grid-column:2; grid-row:1; min-width:0; height:40px;
    display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
    grid-template-rows:repeat(2,minmax(0,1fr)); column-gap:7px; row-gap:2px;
    align-self:center;
  }
  .pha-hud-slot {
    min-width:0; padding:1px 2px; display:flex; flex-direction:column;
    justify-content:center; overflow:hidden; border-left:1px solid #41423c;
    line-height:1; text-align:center;
  }
  .pha-hud-slot.is-wide { grid-column:span 2; }
  .pha-hud-slot.is-consumed { display:none; }
  .pha-hud-slot.is-empty { opacity:.3; }
  .pha-hud-slot-label {
    overflow:hidden; color:#8f8c82; font-size:7px; font-weight:700;
    letter-spacing:.03em; text-align:center; text-overflow:ellipsis;
    text-transform:uppercase; white-space:nowrap;
  }
  .pha-hud-slot-value {
    margin-top:2px; overflow:hidden; color:#f0eee6; font-size:11px; font-weight:800;
    font-variant-numeric:tabular-nums; text-align:center; text-overflow:clip; white-space:nowrap;
  }
  .pha-hud-slot-value.positive { color:#70dfaa; }
  .pha-hud-slot-value.negative { color:#ef8b82; }

  .pha-hud-inventory-line {
    min-width:0; margin-top:2px; display:flex; align-items:baseline; justify-content:center;
    gap:5px; overflow:hidden; text-align:center; white-space:nowrap;
    font-variant-numeric:tabular-nums;
  }
  .pha-hud-inventory-primary { flex:none; color:#f0eee6; font-size:11px; font-weight:800; }
  .pha-hud-inventory-secondary {
    min-width:0; overflow:hidden; color:#aaa79c; font-size:7px; font-weight:700; text-overflow:clip;
  }
  .pha-hud-inventory-line.hide-secondary .pha-hud-inventory-secondary { display:none; }
  .pha-hud-inventory-line.tight .pha-hud-inventory-primary { font-size:10px; }
  .pha-hud-inventory-line.extra-tight .pha-hud-inventory-primary { font-size:9px; }

  .pha-hud-slot.is-rarity, .pha-hud-slot.is-shiny { padding:0 2px; }
  .pha-hud-rarity-grid {
    width:100%; min-width:0; height:100%; display:grid; align-items:center;
    justify-items:stretch; gap:2px;
  }
  .pha-hud-rarity-cell {
    min-width:0; height:100%; display:flex; align-items:center; justify-content:center;
    overflow:hidden; text-align:center; white-space:nowrap; font-variant-numeric:tabular-nums;
  }
  .pha-hud-rarity-count {
    width:100%; min-width:0; display:inline-flex; align-items:baseline; justify-content:center;
    gap:1px; overflow:hidden; font-size:12px; font-weight:800; line-height:1; white-space:nowrap;
  }
  .pha-hud-rarity-captured { min-width:0; font-size:1em; font-weight:900; line-height:1; }
  .pha-hud-rarity-failed, .pha-hud-rarity-separator {
    flex:none; color:#aaa79c; font-size:7px; font-weight:700; line-height:1;
  }
  .pha-hud-rarity-separator { color:#77746a; font-weight:600; }
  .pha-hud-rarity-grid.compact .pha-hud-rarity-count { font-size:10px; }
  .pha-hud-rarity-grid.compact .pha-hud-rarity-failed,
  .pha-hud-rarity-grid.compact .pha-hud-rarity-separator { font-size:6px; }
  .pha-hud-rarity-grid.dense { gap:1px; }
  .pha-hud-rarity-grid.dense .pha-hud-rarity-count { font-size:9px; }
  .pha-hud-rarity-grid.dense .pha-hud-rarity-failed,
  .pha-hud-rarity-grid.dense .pha-hud-rarity-separator { font-size:6px; }

  .pha-hud-shiny-line {
    width:100%; min-width:0; height:100%; display:flex; align-items:center; justify-content:center;
    gap:3px; overflow:hidden; font-variant-numeric:tabular-nums; white-space:nowrap;
  }
  .pha-hud-shiny-star {
    flex:none; color:#d7b45d; font-size:11px; font-weight:900; line-height:1;
    text-shadow:0 0 3px #d7b45d55;
  }
  .pha-hud-shiny-seen { min-width:0; overflow:hidden; color:#aaa79c; font-size:9px; font-weight:700; line-height:1; }
  .pha-hud-shiny-separator { flex:none; color:#77746a; font-size:8px; font-weight:600; }
  .pha-hud-shiny-captured { min-width:0; overflow:hidden; color:#d7b45d; font-size:12px; font-weight:800; line-height:1; }

  .pha-hud-settings-button { min-width:38px; }
  .pha-hud-settings { padding:8px 10px; border-bottom:1px solid var(--border-soft); background:#292a26; }
  .pha-hud-settings-head { margin-bottom:7px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .pha-hud-settings-head strong { color:var(--gold); font-size:10px; letter-spacing:.05em; text-transform:uppercase; }
  .pha-hud-settings-head small { color:var(--muted); font-size:8px; }
  .pha-hud-settings-toolbar { margin-bottom:7px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:6px; align-items:end; }
  .pha-hud-settings label, .pha-hud-slot-config > span { color:#c0ad72; font-size:8px; letter-spacing:.025em; text-transform:uppercase; }
  .pha-hud-settings label { display:flex; flex-direction:column; gap:3px; }
  .pha-hud-settings select, .pha-hud-settings button {
    height:25px; border:1px solid var(--border); border-radius:3px; background:var(--bg);
    color:var(--text); font-size:9px;
  }
  .pha-hud-settings button { padding:0 7px; cursor:pointer; }
  .pha-hud-slot-configs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
  .pha-hud-slot-config {
    min-width:0; padding:5px; display:grid; grid-template-columns:18px minmax(0,1fr);
    gap:4px; align-items:center; border:1px solid #3d3d37; border-radius:3px; background:#252621;
  }
  .pha-hud-slot-config > span { text-align:center; }
  .pha-hud-slot-config select { min-width:0; width:100%; }
  .pha-hud-slot-config select[data-hud-item] { grid-column:2; }
  .pha-hud-rarity-config { grid-column:1 / -1; margin-top:2px; padding-top:5px; border-top:1px solid #393a34; }
  .pha-hud-rarity-toolbar { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:5px; align-items:end; }
  .pha-hud-inline-check {
    height:25px; padding:0 5px; display:flex !important; flex-direction:row !important;
    align-items:center; gap:4px !important; border:1px solid var(--border); border-radius:3px;
    color:var(--text) !important; text-transform:none !important;
  }
  .pha-hud-inline-check input { margin:0; accent-color:#c0ad72; }
  .pha-hud-rarity-checks { margin-top:5px; display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:3px; }
  .pha-hud-rarity-checks label {
    height:23px; display:flex; flex-direction:row; align-items:center; justify-content:center;
    gap:2px; border:1px solid #41423c; border-radius:3px; background:#20211e; cursor:pointer;
  }
  .pha-hud-rarity-checks input { width:10px; height:10px; margin:0; accent-color:#c0ad72; }
  .pha-hud-rarity-checks span { font-size:8px; font-weight:800; }
  .pha-hud-inventory-status { margin-top:6px; color:var(--muted); font-size:8px; }
  .pha-hud-inventory-status.ready { color:#70dfaa; }
`;

export function createClosedHud({ pageWindow } = {}) {
  let shadow = null;
  let launcher = null;
  let grid = null;
  let settings = null;
  let settingsButton = null;
  let style = null;
  let lastState = null;
  let config = readStoredConfig();
  let inventorySnapshot = null;
  let mounted = false;
  let hydrated = false;

  const potionUsage = createPotionUsageTracker({
    storage: typeof localStorage !== "undefined" ? localStorage : null
  });

  const primedLauncher = document.getElementById(ROOT_ID)?.shadowRoot?.getElementById("pha-toggle");
  if (primedLauncher) primedLauncher.style.visibility = "hidden";

  const inventoryState = createInventoryState({
    pageWindow,
    onChange: (snapshot) => {
      inventorySnapshot = snapshot;
      syncSettings();
      renderLastState();
    }
  });

  function activeInventory() {
    return inventorySnapshot || inventoryState.getSnapshot();
  }

  function saveConfig(nextConfig) {
    config = normalizeClosedHudConfig(nextConfig);
    writeStoredConfig(config);
    syncSettings();
    renderLastState();
  }

  function selectOptionsForType(type, selectedId) {
    const inventory = activeInventory();
    const items = type === "capsule" ? inventory?.capsules : inventory?.potions;
    const options = Array.isArray(items) ? [...items] : [];
    if (selectedId && !options.some((item) => item.item_id === selectedId)) {
      options.unshift({ item_id: selectedId, name: humanizeItemId(selectedId, type) });
    }
    if (options.length === 0) return '<option value="">Waiting for inventory…</option>';
    return options.map((item) => `<option value="${item.item_id}">${item.name || item.item_id}</option>`).join("");
  }

  function syncSettings() {
    if (!settings) return;
    const presetSelect = settings.querySelector("[data-hud-preset]");
    if (presetSelect) presetSelect.value = config.preset;

    for (let index = 0; index < 4; index += 1) {
      const slot = config.slots[index];
      const widgetSelect = settings.querySelector(`[data-hud-widget="${index}"]`);
      const itemSelect = settings.querySelector(`[data-hud-item="${index}"]`);
      const rarityConfig = settings.querySelector(`[data-hud-rarity-config="${index}"]`);
      const widget = WIDGET_BY_ID.get(slot.widget);
      if (widgetSelect) widgetSelect.value = slot.widget;

      if (widget?.itemType && itemSelect) {
        const effectiveItem = inventoryItemForSlot(slot, activeInventory(), widget.itemType);
        const selectedId = effectiveItem?.item_id || slot.itemId || "";
        itemSelect.innerHTML = selectOptionsForType(widget.itemType, selectedId);
        itemSelect.hidden = false;
        if (selectedId && [...itemSelect.options].some((option) => option.value === selectedId)) itemSelect.value = selectedId;
      } else if (itemSelect) {
        itemSelect.hidden = true;
        itemSelect.replaceChildren();
      }

      const isRarity = slot.widget === "rarityTracker";
      if (rarityConfig) rarityConfig.hidden = !isRarity;
      if (isRarity && rarityConfig) {
        const width = rarityConfig.querySelector(`[data-hud-rarity-width="${index}"]`);
        const failed = rarityConfig.querySelector(`[data-hud-rarity-failed="${index}"]`);
        if (width) width.value = String(slot.size === 1 ? 1 : 2);
        if (failed) failed.checked = Boolean(slot.showFailed);
        for (const checkbox of rarityConfig.querySelectorAll(`[data-hud-rarity-key="${index}"]`)) {
          checkbox.checked = slot.rarityKeys.includes(checkbox.value);
        }
      }
    }

    const status = settings.querySelector("[data-hud-inventory-status]");
    const inventory = activeInventory();
    if (status) {
      status.textContent = inventory?.ready
        ? `Inventory live · ${inventory.capsules.length} capsules · ${inventory.potions.length} potions`
        : "Waiting for inventory snapshot…";
      status.classList.toggle("ready", Boolean(inventory?.ready));
    }
  }

  function enforceUniqueStandardWidget(index, widgetId, slots) {
    const widget = WIDGET_BY_ID.get(widgetId);
    if (!widget || widget.itemType || widgetId === "empty" || widgetId === "rarityTracker") return slots;
    return slots.map((slot, slotIndex) => slotIndex !== index && slot.widget === widgetId ? emptySlot() : slot);
  }

  function updateRaritySlot(index, patch) {
    const slots = config.slots.map(cloneSlot);
    if (slots[index]?.widget !== "rarityTracker") return;
    slots[index] = { ...slots[index], ...patch, widget: "rarityTracker" };
    saveConfig({ preset: "custom", slots });
  }

  function bindSettings() {
    settingsButton.addEventListener("click", () => {
      settings.hidden = !settings.hidden;
      settingsButton.classList.toggle("active", !settings.hidden);
    });

    settings.querySelector("[data-hud-preset]").addEventListener("change", (event) => {
      if (event.target.value !== "custom") saveConfig(closedHudConfigForPreset(event.target.value));
    });
    settings.querySelector("[data-hud-reset]").addEventListener("click", () => saveConfig(closedHudConfigForPreset("default")));

    for (const select of settings.querySelectorAll("[data-hud-widget]")) {
      select.addEventListener("change", (event) => {
        const index = Number(event.currentTarget.dataset.hudWidget);
        const widgetId = event.currentTarget.value;
        let slots = config.slots.map(cloneSlot);
        slots[index] = widgetId === "rarityTracker"
          ? defaultRaritySlot(2)
          : widgetId === "shinyTracker"
            ? defaultShinySlot()
            : { ...emptySlot(), widget: widgetId };
        slots = enforceUniqueStandardWidget(index, widgetId, slots);
        saveConfig({ preset: "custom", slots });
      });
    }

    for (const select of settings.querySelectorAll("[data-hud-item]")) {
      select.addEventListener("change", (event) => {
        const index = Number(event.currentTarget.dataset.hudItem);
        const slots = config.slots.map(cloneSlot);
        slots[index] = { ...slots[index], itemId: event.currentTarget.value || null };
        saveConfig({ preset: "custom", slots });
      });
    }

    for (const select of settings.querySelectorAll("[data-hud-rarity-width]")) {
      select.addEventListener("change", (event) => updateRaritySlot(
        Number(event.currentTarget.dataset.hudRarityWidth),
        { size: event.currentTarget.value === "1" ? 1 : 2 }
      ));
    }

    for (const input of settings.querySelectorAll("[data-hud-rarity-failed]")) {
      input.addEventListener("change", (event) => updateRaritySlot(
        Number(event.currentTarget.dataset.hudRarityFailed),
        { showFailed: event.currentTarget.checked }
      ));
    }

    for (const input of settings.querySelectorAll("[data-hud-rarity-key]")) {
      input.addEventListener("change", (event) => {
        const index = Number(event.currentTarget.dataset.hudRarityKey);
        const group = [...settings.querySelectorAll(`[data-hud-rarity-key="${index}"]`)];
        let rarityKeys = group.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
        if (rarityKeys.length === 0) {
          event.currentTarget.checked = true;
          rarityKeys = [event.currentTarget.value];
        }
        updateRaritySlot(index, { rarityKeys });
      });
    }
  }

  function mount() {
    if (mounted) return;
    shadow = document.getElementById(ROOT_ID)?.shadowRoot || null;
    if (!shadow) return;

    launcher = shadow.getElementById("pha-toggle");
    const topbar = shadow.querySelector(".topbar");
    const tabs = shadow.querySelector(".tabs");
    const alphaButton = shadow.getElementById("pha-alpha");
    if (!launcher || !topbar || !tabs || !alphaButton) return;

    launcher.style.visibility = "hidden";
    style = document.createElement("style");
    style.id = "pha-closed-hud-style";
    style.textContent = CLOSED_HUD_STYLE;
    shadow.appendChild(style);

    launcher.classList.add("pha-custom-hud");
    topbar.classList.add("pha-hud-topbar");

    grid = document.createElement("span");
    grid.className = "pha-hud-grid";
    grid.setAttribute("aria-label", "Custom Hunt HUD");
    for (let index = 0; index < 4; index += 1) {
      const slot = document.createElement("span");
      slot.className = "pha-hud-slot";
      slot.dataset.hudSlot = String(index);
      grid.appendChild(slot);
    }
    launcher.appendChild(grid);

    settingsButton = document.createElement("button");
    settingsButton.id = "pha-hud-settings-button";
    settingsButton.className = "alpha-button pha-hud-settings-button";
    settingsButton.type = "button";
    settingsButton.textContent = "HUD";
    settingsButton.title = "Configure Closed HUD";
    topbar.insertBefore(settingsButton, alphaButton);

    settings = document.createElement("section");
    settings.id = "pha-hud-settings";
    settings.className = "pha-hud-settings";
    settings.hidden = true;
    settings.innerHTML = `
      <div class="pha-hud-settings-head">
        <strong>Closed HUD</strong>
        <small>4 layout units · changes apply instantly</small>
      </div>
      <div class="pha-hud-settings-toolbar">
        <label>Preset
          <select data-hud-preset>
            <option value="default">Default</option>
            <option value="leveling">Leveling</option>
            <option value="economy">Economy</option>
            <option value="capture">Capture</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <button type="button" data-hud-reset>Reset Default</button>
      </div>
      <div class="pha-hud-slot-configs">
        ${[0, 1, 2, 3].map((index) => `
          <div class="pha-hud-slot-config">
            <span>${index + 1}</span>
            <select data-hud-widget="${index}">${widgetOptionsMarkup()}</select>
            <select data-hud-item="${index}" hidden></select>
            ${rarityConfigMarkup(index)}
          </div>`).join("")}
      </div>
      <div class="pha-hud-inventory-status" data-hud-inventory-status>Waiting for inventory snapshot…</div>
    `;
    tabs.after(settings);

    mounted = true;
    bindSettings();
    syncSettings();
    inventoryState.start();
  }

  function renderRarities(container, display) {
    const count = display.rarities.length;
    const density = count >= 6 ? " dense" : count === 5 ? " compact" : "";
    const wrap = document.createElement("span");
    wrap.className = `pha-hud-rarity-grid${display.showFailed ? " with-failed" : ""}${density}`;
    wrap.style.gridTemplateColumns = `repeat(${Math.max(1, count)}, minmax(0, 1fr))`;

    for (const rarity of display.rarities) {
      const cell = document.createElement("span");
      cell.className = "pha-hud-rarity-cell";
      cell.title = `${rarity.label} — ${display.showFailed ? `Failed: ${formatNumber(rarity.failed)} · ` : ""}Captured: ${formatNumber(rarity.captured)}`;

      const line = document.createElement("span");
      line.className = "pha-hud-rarity-count";
      const captured = document.createElement("span");
      captured.className = `pha-hud-rarity-captured rarity-${rarity.key}`;
      captured.textContent = formatNumber(rarity.captured);

      if (display.showFailed) {
        const failed = document.createElement("span");
        failed.className = "pha-hud-rarity-failed";
        failed.textContent = formatNumber(rarity.failed);
        const separator = document.createElement("span");
        separator.className = "pha-hud-rarity-separator";
        separator.textContent = "/";
        line.append(failed, separator, captured);
      } else {
        line.appendChild(captured);
      }

      cell.appendChild(line);
      wrap.appendChild(cell);
    }
    container.appendChild(wrap);
  }

  function renderShiny(container, display) {
    const line = document.createElement("span");
    line.className = "pha-hud-shiny-line";
    line.title = display.title || "";

    const star = document.createElement("span");
    star.className = "pha-hud-shiny-star";
    star.setAttribute("aria-hidden", "true");
    star.textContent = "★";
    const seen = document.createElement("span");
    seen.className = "pha-hud-shiny-seen";
    seen.textContent = display.seenValue;
    const separator = document.createElement("span");
    separator.className = "pha-hud-shiny-separator";
    separator.textContent = "/";
    const captured = document.createElement("span");
    captured.className = "pha-hud-shiny-captured";
    captured.textContent = display.capturedValue;

    line.append(star, seen, separator, captured);
    container.appendChild(line);
  }

  function fitAdaptiveValue(value, display) {
    const candidates = [display.value, display.compactValue, display.microValue]
      .filter((candidate, index, array) => candidate != null && array.indexOf(candidate) === index);
    for (const candidate of candidates) {
      value.textContent = candidate;
      if (value.scrollWidth <= value.clientWidth + 1) return;
    }
  }

  function fitInventoryLine(line) {
    const primary = line.querySelector(".pha-hud-inventory-primary");
    if (!primary) return;
    line.classList.remove("hide-secondary", "tight", "extra-tight");
    if (line.scrollWidth <= line.clientWidth + 1) return;
    line.classList.add("hide-secondary");
    if (line.scrollWidth <= line.clientWidth + 1) return;
    line.classList.add("tight");
    if (line.scrollWidth <= line.clientWidth + 1) return;
    line.classList.add("extra-tight");
  }

  function renderInventory(container, display) {
    const label = document.createElement("span");
    label.className = "pha-hud-slot-label";
    label.textContent = display.label;
    const line = document.createElement("span");
    line.className = "pha-hud-inventory-line";
    const primary = document.createElement("span");
    primary.className = "pha-hud-inventory-primary";
    primary.textContent = display.value;
    line.appendChild(primary);

    if (display.secondaryValue) {
      const secondary = document.createElement("span");
      secondary.className = "pha-hud-inventory-secondary";
      secondary.textContent = display.secondaryValue;
      line.appendChild(secondary);
    }

    container.append(label, line);
    fitInventoryLine(line);
  }

  function renderLastState() {
    if (!mounted || !grid || !lastState) return;
    const inventory = activeInventory();
    potionUsage.reconcile(lastState.sessionId, inventory);
    const derived = deriveClosedHudState(lastState);
    derived.potionUsage = potionUsage.getSnapshot().usage;

    for (let index = 0; index < 4; index += 1) {
      const slotElement = grid.querySelector(`[data-hud-slot="${index}"]`);
      const slot = config.slots[index];
      const display = closedHudDisplay(slot, derived, inventory);
      const size = slotSize(slot);
      const rowStart = index % 2 === 0;
      const consumed = !rowStart && slot.widget === "empty" && slotSize(config.slots[index - 1]) === 2;

      slotElement.className = "pha-hud-slot";
      slotElement.classList.toggle("is-empty", Boolean(display.empty));
      slotElement.classList.toggle("is-wide", size === 2 && rowStart);
      slotElement.classList.toggle("is-consumed", consumed);
      slotElement.classList.toggle("is-rarity", display.kind === "rarities");
      slotElement.classList.toggle("is-shiny", display.kind === "shiny");
      slotElement.title = display.title || "";
      slotElement.replaceChildren();

      if (consumed || display.empty) continue;
      if (display.kind === "rarities") {
        renderRarities(slotElement, display);
        continue;
      }
      if (display.kind === "shiny") {
        renderShiny(slotElement, display);
        continue;
      }
      if (display.kind === "inventory") {
        renderInventory(slotElement, display);
        continue;
      }

      const label = document.createElement("span");
      label.className = "pha-hud-slot-label";
      label.textContent = display.label;
      const value = document.createElement("span");
      value.className = `pha-hud-slot-value${display.tone ? ` ${display.tone}` : ""}`;
      value.textContent = display.value;
      slotElement.append(label, value);
      fitAdaptiveValue(value, display);
    }
  }

  function render(state) {
    lastState = state;
    renderLastState();
    if (!hydrated) {
      hydrated = true;
      if (launcher) launcher.style.visibility = "";
    }
  }

  function dispose() {
    inventoryState.dispose();
    if (launcher) {
      launcher.classList.remove("pha-custom-hud");
      launcher.style.visibility = "";
    }
    shadow?.querySelector(".topbar")?.classList.remove("pha-hud-topbar");
    grid?.remove();
    settings?.remove();
    settingsButton?.remove();
    style?.remove();
    mounted = false;
    hydrated = false;
    shadow = null;
    launcher = null;
    grid = null;
    settings = null;
    settingsButton = null;
    style = null;
    lastState = null;
  }

  return {
    mount,
    render,
    dispose,
    getConfig: () => normalizeClosedHudConfig(config),
    getInventorySnapshot: () => activeInventory()
  };
}
