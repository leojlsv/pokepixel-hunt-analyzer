export const PUBLIC_UI_PROTOCOL = 1;
export const PUBLIC_UI_GLOBAL = "__POKEPIXEL_HUNT_ANALYZER_UI__";

const DESTINATIONS = new Set([
  "current",
  "current-rarity",
  "current-captured",
  "current-failed",
  "current-loot",
  "history-hunts",
  "history-pokemon",
  "history-attempts",
  "history-loot"
]);

function boundedText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function installPublicUiBridge({ pageWindow, appVersion, navigate }) {
  if (!pageWindow || typeof navigate !== "function") return () => {};

  const api = Object.freeze({
    protocol: PUBLIC_UI_PROTOCOL,
    appVersion: boundedText(appVersion, 32),
    async navigate(destination) {
      const normalized = boundedText(destination, 48).toLowerCase();
      if (!DESTINATIONS.has(normalized)) {
        return { ok: false, reason: "unsupported-destination" };
      }
      try {
        const result = await navigate(normalized);
        return result?.ok === false
          ? { ok: false, reason: boundedText(result.reason, 64) || "navigation-unavailable" }
          : { ok: true };
      } catch {
        return { ok: false, reason: "navigation-failed" };
      }
    }
  });

  try {
    Object.defineProperty(pageWindow, PUBLIC_UI_GLOBAL, {
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
      if (pageWindow[PUBLIC_UI_GLOBAL] === api) delete pageWindow[PUBLIC_UI_GLOBAL];
    } catch {}
  };
}
