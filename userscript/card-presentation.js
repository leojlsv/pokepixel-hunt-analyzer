const TERMINAL_RESULTS = new Set(["success", "failed"]);
const ACTIVE_STATES = new Set(["started", "looted"]);
const RARITIES = new Set([
  "weak",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical"
]);
const ATTEMPT_HISTORY_LIMIT = 32;
const SPECIAL_HISTORY_LIMIT = 32;
const LOOT_HISTORY_LIMIT = 32;
const SPECIAL_RARITIES = new Set(["epic", "legendary", "mythical"]);
const ELEMENTS = new Set([
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"
]);
const IV_STATS = ["hp", "atk", "def", "spa", "spd", "spe"];
const NUMBER_LIMIT = 1e15;
const LOOT_ITEM_LIMIT = 32;
const SNAPSHOT_CACHE = new WeakMap();

function boundedText(value, maxLength = 64) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function displaySpecies(encounter) {
  const named = boundedText(encounter?.speciesName, 64);
  if (named) return named;
  const speciesId = boundedText(encounter?.speciesId, 64);
  if (!speciesId) return "";
  return speciesId
    .replace(/[-_]+/g, " ")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function strictChance(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function boundedAmount(value) {
  return Number.isFinite(value) && value >= 0 ? Math.min(NUMBER_LIMIT, value) : 0;
}

function boundedOptionalAmount(value) {
  return Number.isFinite(value) && value >= 0 ? Math.min(NUMBER_LIMIT, value) : null;
}

function lootItems(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  const items = [];
  for (const entry of value) {
    if (items.length >= LOOT_ITEM_LIMIT) break;
    const itemId = boundedText(entry?.item_id ?? entry?.itemId, 64);
    if (!itemId || !Number.isFinite(entry?.qty) || entry.qty < 0) continue;
    items.push(Object.freeze({
      itemId,
      qty: Math.min(NUMBER_LIMIT, Math.floor(entry.qty))
    }));
  }
  return Object.freeze(items);
}

function elementList(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze([...new Set(value
    .map((entry) => boundedText(entry, 16).toLowerCase())
    .filter((entry) => ELEMENTS.has(entry)))].slice(0, 2));
}

function ivValue(value) {
  return Number.isFinite(value) && value >= 0 && value <= 31 ? Math.floor(value) : null;
}

function ivTotalValue(value) {
  return Number.isFinite(value) && value >= 0 && value <= 186 ? Math.floor(value) : null;
}

function captureDetails(row) {
  if (row?.captureResult !== "success") return null;
  const ivs = {};
  for (const stat of IV_STATS) ivs[stat] = ivValue(row?.ivs?.[stat]);
  const total = ivTotalValue(row?.ivTotal);
  return Object.freeze({
    gender: boundedText(row?.gender, 16),
    nature: boundedText(row?.nature, 32),
    ivTotal: total,
    ivs: Object.freeze(ivs)
  });
}

function copyAttempt(entry) {
  return Object.freeze({
    ...entry,
    captureDetails: entry?.captureDetails
      ? Object.freeze({ ...entry.captureDetails, ivs: Object.freeze({ ...entry.captureDetails.ivs }) })
      : null
  });
}

function copyLoot(entry) {
  return Object.freeze({
    ...entry,
    items: Object.freeze((entry?.items || []).map((item) => Object.freeze({ ...item })))
  });
}

function currentTargetEntry(row) {
  if (!row || TERMINAL_RESULTS.has(row.captureResult)) return null;
  if (!ACTIVE_STATES.has(row.state)) return null;
  const species = displaySpecies(row);
  if (!species) return null;
  return Object.freeze({
    speciesId: boundedText(row.speciesId, 64),
    zoneId: boundedText(row.zoneId, 64),
    species,
    level: Number.isFinite(row.level) ? Math.max(0, Math.floor(row.level)) : null,
    rarity: RARITIES.has(row.quality) ? row.quality : "",
    shiny: typeof row.isShiny === "boolean" ? row.isShiny : null,
    elements: elementList(row.elements),
    pokemonExp: Number.isFinite(row.pokemonExp) && row.pokemonExp >= 0 ? row.pokemonExp : null
  });
}

function attemptHistoryEntry(row) {
  if (!row || !TERMINAL_RESULTS.has(row.captureResult)) return null;
  if (!Number.isFinite(row.captureAtMs) || row.captureAtMs < 0) return null;
  const species = displaySpecies(row);
  if (!species) return null;
  return Object.freeze({
    atMs: row.captureAtMs,
    speciesId: boundedText(row.speciesId, 64),
    species,
    rarity: RARITIES.has(row.quality) ? row.quality : "unknown",
    qualityMultiplier: boundedOptionalAmount(row.qualityMultiplier),
    shiny: typeof row.isShiny === "boolean" ? row.isShiny : null,
    chance: strictChance(row.captureChance),
    result: row.captureResult === "success" ? "captured" : "fled",
    ball: boundedText(row.capsuleName, 32),
    ivTotal: ivTotalValue(row.ivTotal),
    captureDetails: captureDetails(row)
  });
}

function lootHistoryEntry(row) {
  if (!row || !Number.isFinite(row.lootAtMs) || row.lootAtMs < 0) return null;
  const species = displaySpecies(row);
  if (!species) return null;
  const directGold = boundedAmount(row.gold);
  const lootSellValue = boundedAmount(row.lootSellValue);
  const autoSold = row.autoSold === true;
  const autoSellValue = autoSold ? boundedAmount(row.autoSellValue) : 0;
  return Object.freeze({
    atMs: row.lootAtMs,
    species,
    directGold,
    lootSellValue,
    autoSold,
    autoSellValue,
    items: lootItems(row.lootItems),
    totalValue: Math.min(NUMBER_LIMIT, directGold + lootSellValue + autoSellValue)
  });
}

function rowKey(row) {
  return String(row?.encounterId || "");
}

function retainNewest(map, key, entry, limit) {
  if (!entry) return;
  map.set(key, entry);
  if (map.size <= limit) return;

  let oldestKey = null;
  let oldestAtMs = Infinity;
  for (const [candidateKey, candidate] of map) {
    if (candidate.atMs < oldestAtMs) {
      oldestKey = candidateKey;
      oldestAtMs = candidate.atMs;
    }
  }
  if (oldestKey !== null) map.delete(oldestKey);
}

function specialAttempt(entry) {
  return entry && (SPECIAL_RARITIES.has(entry.rarity) || entry.shiny === true);
}

export function updateLiveActiveKeys(keys = [], rows = []) {
  const next = new Set(keys || []);
  for (const row of rows || []) {
    const key = rowKey(row);
    if (!key) continue;
    if (currentTargetEntry(row)) next.add(key);
    else next.delete(key);
  }
  return next;
}

export function createCardPresentationCache(encounters = [], { activeKeys = [] } = {}) {
  const activeTargets = new Map();
  const attemptHistory = new Map();
  const specialHistory = new Map();
  const lootHistory = new Map();
  const liveActiveKeys = new Set(activeKeys || []);
  for (const row of encounters || []) {
    const key = rowKey(row);
    if (!key) continue;
    const target = liveActiveKeys.has(key) ? currentTargetEntry(row) : null;
    if (target) activeTargets.set(key, target);
    else liveActiveKeys.delete(key);
    const attempt = attemptHistoryEntry(row);
    retainNewest(attemptHistory, key, attempt, ATTEMPT_HISTORY_LIMIT);
    if (specialAttempt(attempt)) retainNewest(specialHistory, key, attempt, SPECIAL_HISTORY_LIMIT);
    const loot = lootHistoryEntry(row);
    retainNewest(lootHistory, key, loot, LOOT_HISTORY_LIMIT);
  }
  return { activeTargets, attemptHistory, specialHistory, lootHistory, liveActiveKeys };
}

export function updateCardPresentationCache(cache, rows = []) {
  const next = cache || createCardPresentationCache();
  for (const row of rows || []) {
    const key = rowKey(row);
    if (!key) continue;
    SNAPSHOT_CACHE.delete(next);
    next.activeTargets.delete(key);
    next.liveActiveKeys?.delete(key);
    next.attemptHistory.delete(key);
    next.specialHistory?.delete(key);
    next.lootHistory?.delete(key);
    const target = currentTargetEntry(row);
    if (target) {
      next.activeTargets.set(key, target);
      next.liveActiveKeys?.add(key);
    }
    const attempt = attemptHistoryEntry(row);
    retainNewest(next.attemptHistory, key, attempt, ATTEMPT_HISTORY_LIMIT);
    if (specialAttempt(attempt)) retainNewest(next.specialHistory, key, attempt, SPECIAL_HISTORY_LIMIT);
    const loot = lootHistoryEntry(row);
    retainNewest(next.lootHistory, key, loot, LOOT_HISTORY_LIMIT);
  }
  return next;
}

export function cardPresentationSnapshot(cache) {
  const cacheable = cache !== null && (typeof cache === "object" || typeof cache === "function");
  const cachedSnapshot = cacheable ? SNAPSHOT_CACHE.get(cache) : null;
  if (cachedSnapshot) return cachedSnapshot;
  const activeTargets = cache?.activeTargets || new Map();
  const attempts = cache?.attemptHistory || new Map();
  const specials = cache?.specialHistory || new Map();
  const loot = cache?.lootHistory || new Map();
  const currentTarget = activeTargets.size === 1
    ? activeTargets.values().next().value
    : null;
  const orderedAttempts = [...attempts.values()]
    .sort((left, right) => right.atMs - left.atMs);
  const attemptHistory = orderedAttempts.slice(0, ATTEMPT_HISTORY_LIMIT);
  const specialHistory = [...specials.values()]
    .sort((left, right) => right.atMs - left.atMs)
    .slice(0, SPECIAL_HISTORY_LIMIT);
  const lootHistory = [...loot.values()]
    .sort((left, right) => right.atMs - left.atMs)
    .slice(0, LOOT_HISTORY_LIMIT);
  const snapshot = Object.freeze({
    currentTarget: currentTarget ? Object.freeze({ ...currentTarget, elements: Object.freeze([...currentTarget.elements]) }) : null,
    attemptHistory: Object.freeze(attemptHistory.map(copyAttempt)),
    specialHistory: Object.freeze(specialHistory.map(copyAttempt)),
    lootHistory: Object.freeze(lootHistory.map(copyLoot))
  });
  if (cacheable) SNAPSHOT_CACHE.set(cache, snapshot);
  return snapshot;
}
