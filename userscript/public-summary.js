export const PUBLIC_SUMMARY_PROTOCOL = 1;
export const PUBLIC_SUMMARY_GLOBAL = "__POKEPIXEL_HUNT_ANALYZER_PUBLIC__";
export const PUBLIC_CONTROL_GLOBAL = "__POKEPIXEL_HUNT_ANALYZER_CONTROL__";
export const EMBED_MARKER_GLOBAL = "__POKEPIXEL_HUNT_ANALYZER_EMBED__";

const RARITIES = new Set([
  "weak",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical"
]);
const ELEMENTS = new Set([
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"
]);
const IV_STATS = ["hp", "atk", "def", "spa", "spd", "spe"];
const NUMBER_LIMIT = 1e15;
const LOOT_ITEM_LIMIT = 32;

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function nonNegative(value) {
  const number = finiteOrNull(value);
  return number == null ? 0 : Math.max(0, number);
}

function boundedAmount(value) {
  return Math.min(NUMBER_LIMIT, nonNegative(value));
}

function normalizedChance(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function normalizedStatus(value) {
  return value === "running" || value === "paused" ? value : "waiting";
}

function boundedText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function copyElements(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze([...new Set(value
    .map((entry) => boundedText(entry, 16).toLowerCase())
    .filter((entry) => ELEMENTS.has(entry)))].slice(0, 2));
}

function boundedInteger(value, max) {
  return Number.isFinite(value) && value >= 0 && value <= max ? Math.floor(value) : null;
}

function copyCaptureDetails(value, result) {
  if (result !== "captured" || !value || typeof value !== "object") return null;
  const ivs = {};
  for (const stat of IV_STATS) ivs[stat] = boundedInteger(value?.ivs?.[stat], 31);
  return Object.freeze({
    gender: boundedText(value.gender, 16),
    nature: boundedText(value.nature, 32),
    ivTotal: boundedInteger(value.ivTotal, 186),
    ivs: Object.freeze(ivs)
  });
}

function cloneCaptureDetails(value) {
  return value ? { ...value, ivs: { ...value.ivs } } : null;
}

function cloneAttempt(entry) {
  return { ...entry, captureDetails: cloneCaptureDetails(entry?.captureDetails) };
}

function cloneLoot(entry) {
  return {
    ...entry,
    items: Array.isArray(entry?.items) ? entry.items.map((item) => ({ ...item })) : []
  };
}

function copyLootItems(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  const items = [];
  for (const entry of value) {
    if (items.length >= LOOT_ITEM_LIMIT) break;
    const itemId = boundedText(entry?.itemId, 64);
    if (!itemId || !Number.isFinite(entry?.qty) || entry.qty < 0) continue;
    items.push(Object.freeze({
      itemId,
      qty: Math.min(NUMBER_LIMIT, Math.floor(entry.qty))
    }));
  }
  return Object.freeze(items);
}

function copyCurrentTarget(value) {
  if (!value || typeof value !== "object") return null;
  const species = boundedText(value.species, 64);
  if (!species) return null;
  return Object.freeze({
    speciesId: boundedText(value.speciesId, 64),
    zoneId: boundedText(value.zoneId, 64),
    species,
    level: Number.isFinite(value.level) && value.level >= 0 ? Math.floor(value.level) : null,
    rarity: RARITIES.has(value.rarity) ? value.rarity : "",
    shiny: typeof value.shiny === "boolean" ? value.shiny : null,
    elements: copyElements(value.elements),
    pokemonExp: Number.isFinite(value.pokemonExp) && value.pokemonExp >= 0
      ? Math.min(NUMBER_LIMIT, value.pokemonExp)
      : null
  });
}

function copyAttemptHistory(value, limit = 32) {
  if (!Array.isArray(value)) return Object.freeze([]);
  const attempts = [];
  for (const entry of value) {
    if (attempts.length >= limit) break;
    const atMs = Number.isFinite(entry?.atMs) && entry.atMs >= 0 ? entry.atMs : null;
    const species = boundedText(entry?.species, 64);
    const result = entry?.result === "captured" || entry?.result === "fled" ? entry.result : "";
    if (atMs == null || !species || !result) continue;
    attempts.push(Object.freeze({
      atMs,
      speciesId: boundedText(entry?.speciesId, 64),
      species,
      rarity: RARITIES.has(entry?.rarity) ? entry.rarity : "unknown",
      qualityMultiplier: Number.isFinite(entry?.qualityMultiplier) && entry.qualityMultiplier >= 0
        ? Math.min(NUMBER_LIMIT, entry.qualityMultiplier)
        : null,
      shiny: typeof entry?.shiny === "boolean" ? entry.shiny : null,
      chance: normalizedChance(entry?.chance),
      result,
      ball: boundedText(entry?.ball, 32),
      ivTotal: boundedInteger(entry?.ivTotal, 186),
      captureDetails: copyCaptureDetails(entry?.captureDetails, result)
    }));
  }
  return Object.freeze(attempts);
}

function copySpecialHistory(value) {
  return Object.freeze(copyAttemptHistory(value, 32)
    .filter(entry => ["epic", "legendary", "mythical"].includes(entry.rarity) || entry.shiny === true));
}

function copyLootHistory(value, limit = 32) {
  if (!Array.isArray(value)) return Object.freeze([]);
  const loot = [];
  for (const entry of value) {
    if (loot.length >= limit) break;
    const atMs = Number.isFinite(entry?.atMs) && entry.atMs >= 0 ? entry.atMs : null;
    const species = boundedText(entry?.species, 64);
    if (atMs == null || !species) continue;
    const directGold = boundedAmount(entry?.directGold);
    const lootSellValue = boundedAmount(entry?.lootSellValue);
    const autoSold = entry?.autoSold === true;
    const autoSellValue = autoSold ? boundedAmount(entry?.autoSellValue) : 0;
    loot.push(Object.freeze({
      atMs,
      species,
      directGold,
      lootSellValue,
      autoSold,
      autoSellValue,
      items: copyLootItems(entry?.items),
      totalValue: Math.min(NUMBER_LIMIT, directGold + lootSellValue + autoSellValue)
    }));
  }
  return Object.freeze(loot);
}

function copyRarityCounts(rarities) {
  const source = rarities && typeof rarities === "object" ? rarities : {};
  const copy = {};
  for (const key of ["unknown", ...RARITIES]) {
    const bucket = source[key] || {};
    copy[key] = Object.freeze({
      captured: nonNegative(bucket.captured),
      seen: nonNegative(bucket.seen),
      shinyCaptured: nonNegative(bucket.shinyCaptured),
      shinySeen: nonNegative(bucket.shinySeen)
    });
  }
  return Object.freeze(copy);
}

export function createPublicSummary({
  appVersion = "",
  leadershipActive = false,
  currentState = null,
  now = Date.now()
} = {}) {
  const metrics = currentState?.metrics || null;
  const shiny = metrics?.shiny || {};
  const rarities = metrics?.rarities || {};
  const latestAttemptChance = normalizedChance(currentState?.latestCaptureAttempt?.chance);
  const presentation = currentState?.cardPresentation || {};
  const available = Boolean(metrics);
  const attemptHistory = available ? copyAttemptHistory(presentation.attemptHistory) : Object.freeze([]);
  const specialHistory = available ? copySpecialHistory(presentation.specialHistory) : Object.freeze([]);
  const lootHistory = available ? copyLootHistory(presentation.lootHistory) : Object.freeze([]);
  const epicAttempts = Object.freeze(attemptHistory.filter((entry) => entry.rarity === "epic").slice(0, 8));

  return Object.freeze({
    protocol: PUBLIC_SUMMARY_PROTOCOL,
    appVersion: String(appVersion || ""),
    capturedAtMs: finiteOrNull(now),
    available,
    leadershipActive: Boolean(leadershipActive),
    status: normalizedStatus(metrics?.status),
    startedAtMs: finiteOrNull(metrics?.startedAtMs),
    activeMs: nonNegative(metrics?.activeMs),
    seen: nonNegative(metrics?.seen),
    seenPerHour: finiteOrNull(metrics?.seenPerHour),
    captured: nonNegative(metrics?.captured),
    failed: nonNegative(metrics?.failed),
    captureRate: finiteOrNull(metrics?.seenToCaptureRate),
    trainerExp: nonNegative(metrics?.trainerExp),
    trainerExpPerHour: finiteOrNull(metrics?.trainerExpPerHour),
    pokemonExp: nonNegative(metrics?.pokemonExp),
    pokemonExpPerHour: finiteOrNull(metrics?.pokemonExpPerHour),
    directGold: nonNegative(metrics?.directGold),
    lootSellValue: nonNegative(metrics?.lootSellValue),
    autoSellValue: nonNegative(metrics?.autoSellValue),
    revenue: nonNegative(metrics?.revenue ?? metrics?.gold),
    revenuePerHour: finiteOrNull(metrics?.revenuePerHour ?? metrics?.goldPerHour),
    dollar: nonNegative(metrics?.gold),
    dollarPerHour: finiteOrNull(metrics?.goldPerHour),
    expenses: nonNegative(metrics?.expenses),
    expensesPerHour: finiteOrNull(metrics?.expensesPerHour),
    profit: finiteOrNull(metrics?.profit),
    profitPerHour: finiteOrNull(metrics?.profitPerHour),
    rarePlusFailed: nonNegative(metrics?.rarePlusFailed),
    epicPlusFailed: nonNegative(metrics?.epicPlusFailed),
    shinySeen: nonNegative(shiny.seen),
    shinyCaptured: nonNegative(shiny.captured),
    seenUnknown: nonNegative(rarities.unknown?.seen),
    seenWeak: nonNegative(rarities.weak?.seen),
    seenCommon: nonNegative(rarities.common?.seen),
    seenUncommon: nonNegative(rarities.uncommon?.seen),
    seenRare: nonNegative(rarities.rare?.seen),
    seenEpic: nonNegative(rarities.epic?.seen),
    seenLegendary: nonNegative(rarities.legendary?.seen),
    seenMythical: nonNegative(rarities.mythical?.seen),
    rarityCounts: copyRarityCounts(rarities),
    latestCaptureChance: latestAttemptChance,
    currentTarget: available && normalizedStatus(metrics?.status) === "running"
      ? copyCurrentTarget(presentation.currentTarget)
      : null,
    attemptHistory,
    specialHistory,
    lootHistory,
    // Protocol-v1 compatibility for older coupled consumers. New card mode uses
    // the all-rarity attemptHistory projection above.
    epicAttempts
  });
}

export function isEmbedMode(pageWindow) {
  const marker = pageWindow?.[EMBED_MARKER_GLOBAL];
  return Boolean(marker && marker.protocol === PUBLIC_SUMMARY_PROTOCOL);
}

export function installPublicSummaryBridge({
  pageWindow,
  appVersion = "",
  getSummary,
  onRead
}) {
  if (!pageWindow || typeof getSummary !== "function") return () => {};

  const api = Object.freeze({
    protocol: PUBLIC_SUMMARY_PROTOCOL,
    appVersion: String(appVersion || ""),
    getSummary() {
      try { onRead?.(); } catch {}
      const summary = getSummary();
      if (!summary || typeof summary !== "object") return null;
      return {
        ...summary,
        currentTarget: summary.currentTarget ? { ...summary.currentTarget, elements: [...(summary.currentTarget.elements || [])] } : null,
        attemptHistory: Array.isArray(summary.attemptHistory)
          ? summary.attemptHistory.map(cloneAttempt)
          : [],
        specialHistory: Array.isArray(summary.specialHistory)
          ? summary.specialHistory.map(cloneAttempt)
          : [],
        lootHistory: Array.isArray(summary.lootHistory)
          ? summary.lootHistory.map(cloneLoot)
          : [],
        rarityCounts: summary.rarityCounts && typeof summary.rarityCounts === "object"
          ? Object.fromEntries(Object.entries(summary.rarityCounts).map(([key, bucket]) => [key, { ...bucket }]))
          : {},
        epicAttempts: Array.isArray(summary.epicAttempts)
          ? summary.epicAttempts.map(cloneAttempt)
          : []
      };
    }
  });

  try {
    Object.defineProperty(pageWindow, PUBLIC_SUMMARY_GLOBAL, {
      value: api,
      configurable: true,
      enumerable: false,
      writable: false
    });
  } catch {
    return () => {};
  }

  return () => {
    try {
      if (pageWindow[PUBLIC_SUMMARY_GLOBAL] === api) {
        delete pageWindow[PUBLIC_SUMMARY_GLOBAL];
      }
    } catch {
    }
  };
}

export function installPublicSessionControl({ pageWindow, performAction }) {
  if (!pageWindow || typeof performAction !== "function") return () => {};
  const allowed = new Set(["pause", "resume", "reset"]);
  const api = Object.freeze({
    protocol: PUBLIC_SUMMARY_PROTOCOL,
    async act(action) {
      const normalized = String(action || "").trim().toLowerCase();
      if (!allowed.has(normalized)) return { ok: false, reason: "unsupported-action" };
      try {
        const ok = await performAction(normalized);
        if (ok === false) return { ok: false, reason: "action-unavailable" };
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: "action-failed", detail: error?.message || "" };
      }
    }
  });
  try {
    Object.defineProperty(pageWindow, PUBLIC_CONTROL_GLOBAL, {
      value: api,
      configurable: true,
      enumerable: false,
      writable: false
    });
  } catch {
    return () => {};
  }
  return () => {
    try {
      if (pageWindow[PUBLIC_CONTROL_GLOBAL] === api) delete pageWindow[PUBLIC_CONTROL_GLOBAL];
    } catch {}
  };
}
