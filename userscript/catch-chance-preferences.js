export const CATCH_CHANCE_DECIMALS_KEY = "pokepixel_hunt_analyzer_catch_chance_decimals_v1";
export const DEFAULT_CATCH_CHANCE_DECIMALS = 3;
export const MAX_CATCH_CHANCE_DECIMALS = 6;

export function normalizeCatchChanceDecimals(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return DEFAULT_CATCH_CHANCE_DECIMALS;
  }
  const digits = Number(value);
  return String(value).trim() !== "" && Number.isInteger(digits) &&
    digits >= 0 && digits <= MAX_CATCH_CHANCE_DECIMALS
    ? digits
    : DEFAULT_CATCH_CHANCE_DECIMALS;
}

export function readCatchChanceDecimals(storage = globalThis.localStorage) {
  try {
    return normalizeCatchChanceDecimals(storage?.getItem(CATCH_CHANCE_DECIMALS_KEY));
  } catch {
    return DEFAULT_CATCH_CHANCE_DECIMALS;
  }
}

export function saveCatchChanceDecimals(value, storage = globalThis.localStorage) {
  const digits = normalizeCatchChanceDecimals(value);
  try {
    storage?.setItem(CATCH_CHANCE_DECIMALS_KEY, String(digits));
  } catch {
    // Display preference still applies during this session.
  }
  return digits;
}
