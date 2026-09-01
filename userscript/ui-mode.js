export const UI_MODE_AUTO = "auto";
export const UI_MODE_DESKTOP = "desktop";
export const UI_MODE_MOBILE = "mobile";
export const MOBILE_MAX_MIN_DIMENSION_PX = 768;

const UI_MODE_OVERRIDES = new Set([
  UI_MODE_AUTO,
  UI_MODE_DESKTOP,
  UI_MODE_MOBILE
]);

export function normalizeUiModeOverride(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return UI_MODE_OVERRIDES.has(normalized) ? normalized : UI_MODE_AUTO;
}

function mediaMatches(matchMedia, query) {
  if (typeof matchMedia !== "function") return false;
  try {
    return Boolean(matchMedia(query)?.matches);
  } catch {
    return false;
  }
}

export function detectAutoUiMode({
  matchMedia = globalThis.matchMedia?.bind(globalThis),
  innerWidth = globalThis.innerWidth,
  innerHeight = globalThis.innerHeight
} = {}) {
  const width = Number(innerWidth);
  const height = Number(innerHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return UI_MODE_DESKTOP;
  }

  const touchPrimary = mediaMatches(matchMedia, "(pointer: coarse)") &&
    mediaMatches(matchMedia, "(hover: none)");
  const phoneViewport = Math.min(width, height) <= MOBILE_MAX_MIN_DIMENSION_PX;

  return touchPrimary && phoneViewport ? UI_MODE_MOBILE : UI_MODE_DESKTOP;
}

export function resolveUiMode({ override = UI_MODE_AUTO, ...environment } = {}) {
  const normalized = normalizeUiModeOverride(override);
  if (normalized === UI_MODE_DESKTOP || normalized === UI_MODE_MOBILE) return normalized;
  return detectAutoUiMode(environment);
}
