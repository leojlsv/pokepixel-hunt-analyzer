export const DEFAULT_ENCOUNTER_SORT = Object.freeze({
  key: "capturedAt",
  direction: "desc"
});

const DAY_MS = 24 * 60 * 60 * 1000;

function finiteOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compareNullableNumbers(a, b, direction) {
  const left = finiteOrNull(a);
  const right = finiteOrNull(b);

  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  const result = left - right;
  return direction === "asc" ? result : -result;
}

function passesRarityFilter(encounter, filters) {
  if (filters.rarities instanceof Set) {
    return filters.rarities.has(encounter.quality);
  }

  // Backward-compatible fallback for callers/tests using the old single-value
  // shape. `rarities: null` is the new explicit "All (*)" state.
  return filters.rarity === undefined ||
    filters.rarity === "*" ||
    encounter.quality === filters.rarity;
}

export function passesEncounterFilters(encounter, filters) {
  if (!passesRarityFilter(encounter, filters)) return false;

  if (filters.qualityMin != null && !(
    Number.isFinite(encounter.qualityMultiplier) &&
    encounter.qualityMultiplier > filters.qualityMin
  )) return false;

  if (filters.ivMin != null && !(
    Number.isFinite(encounter.ivTotal) && encounter.ivTotal > filters.ivMin
  )) return false;

  if (filters.shiny === "yes" && encounter.isShiny !== true) return false;
  if (filters.shiny === "no" && encounter.isShiny === true) return false;

  return true;
}

export function compareEncounters(a, b, sort = DEFAULT_ENCOUNTER_SORT) {
  const direction = sort.direction === "asc" ? "asc" : "desc";
  let result = 0;

  switch (sort.key) {
    case "quality":
      result = compareNullableNumbers(a.qualityMultiplier, b.qualityMultiplier, direction);
      break;
    case "iv":
      result = compareNullableNumbers(a.ivTotal, b.ivTotal, direction);
      break;
    case "capturedAt":
    default:
      result = compareNullableNumbers(a.captureAtMs, b.captureAtMs, direction);
      break;
  }

  if (result !== 0) return result;

  // Stable, useful tie-breakers: newest capture first, then encounter id.
  const captureTie = compareNullableNumbers(a.captureAtMs, b.captureAtMs, "desc");
  if (captureTie !== 0) return captureTie;
  return String(a.encounterId || "").localeCompare(String(b.encounterId || ""));
}

export function sortEncounters(encounters, sort = DEFAULT_ENCOUNTER_SORT) {
  return [...encounters].sort((a, b) => compareEncounters(a, b, sort));
}

function captureDate(value) {
  const milliseconds = finiteOrNull(value);
  if (milliseconds == null) return null;

  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

function padTimePart(part) {
  return String(part).padStart(2, "0");
}

function localCalendarDay(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

export function formatCaptureTime(value) {
  const date = captureDate(value);
  if (!date) return "—";

  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:${padTimePart(date.getSeconds())}`;
}

export function formatCurrentHuntTimestamp(value, huntStartedAtMs) {
  const date = captureDate(value);
  if (!date) return "—";

  const time = formatCaptureTime(value);
  const huntDate = captureDate(huntStartedAtMs);
  if (!huntDate) return time;

  const dayOffset = Math.max(0, localCalendarDay(date) - localCalendarDay(huntDate));
  return dayOffset > 0 ? `+${dayOffset}d ${time}` : time;
}

export function formatCaptureTimestamp(value) {
  const date = captureDate(value);
  if (!date) return "—";

  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())} ` +
    formatCaptureTime(value);
}
