export const RARITIES = [
  ["weak", "Weak"],
  ["common", "Common"],
  ["uncommon", "Uncommon"],
  ["rare", "Rare"],
  ["epic", "Epic"],
  ["legendary", "Legendary"],
  ["mythical", "Mythical"]
];

export const RARITY_ORDER = new Map(
  RARITIES.map(([key], index) => [key, index])
);

const RARITY_KEYS = new Set(RARITIES.map(([key]) => key));
const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0
});

export function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

export function formatCompact(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 100_000) {
    return `${formatNumber(Math.round(number / 1_000))}K`;
  }
  return formatNumber(number);
}

export function formatRate(value) {
  return value == null ? "—" : `${(value * 100).toFixed(2)}%`;
}

export function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  const parts = hours > 0
    ? [hours, minutes, remainingSeconds]
    : [minutes, remainingSeconds];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

export function speciesLabel(encounter) {
  const raw = encounter.speciesName || encounter.speciesId || "—";
  return String(raw)
    .split(/[\s_-]+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

export function rarityClass(value) {
  const key = String(value || "").toLowerCase();
  return RARITY_KEYS.has(key) ? `rarity-${key}` : "";
}
