export const AUDIO_ALERT_KEYS = Object.freeze([
  "epic_captured",
  "epic_fled",
  "legendary_captured",
  "legendary_fled",
  "mythic_captured",
  "mythic_fled",
  "shiny_captured",
  "shiny_fled"
]);

const NOTABLE_PREFIX = Object.freeze({
  epic: "epic",
  legendary: "legendary",
  mythical: "mythic"
});

export function defaultAudioAlertSettings() {
  return Object.fromEntries(AUDIO_ALERT_KEYS.map((key) => [key, false]));
}

export function selectAudioAlertKey(alert, enabled = {}) {
  if (!alert || !["captured", "fled"].includes(alert.result)) return null;

  const candidates = [];
  if (alert.isShiny === true) {
    candidates.push(`shiny_${alert.result}`);
  }

  const rarity = typeof alert.rarity === "string" ? alert.rarity.toLowerCase() : null;
  const rarityPrefix = rarity ? NOTABLE_PREFIX[rarity] : null;
  if (rarityPrefix) {
    candidates.push(`${rarityPrefix}_${alert.result}`);
  }

  return candidates.find((key) => enabled[key] === true) ?? null;
}
