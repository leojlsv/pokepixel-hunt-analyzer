export const DEFAULT_ENCOUNTER_SORT = Object.freeze({
  key: "capturedAt",
  direction: "desc"
});

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

export function passesEncounterFilters(encounter, filters) {
  if (filters.rarity !== "*" && encounter.quality !== filters.rarity) return false;

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

export function formatCaptureTimestamp(value) {
  const milliseconds = finiteOrNull(value);
  if (milliseconds == null) return "—";

  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) return "—";

  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
