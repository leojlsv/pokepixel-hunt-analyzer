/**
 * Sums the 6 IV stats the protocol exposes on `enemy.ivs` /
 * `creature.ivs` into the single `ivTotal` column
 * (docs/ARCHITECTURE.md §4 `encounters.ivTotal`).
 *
 * Defensive like the rest of the parsing layer: a missing/non-finite stat
 * contributes 0 instead of poisoning the total with NaN.
 */

const IV_STATS = Object.freeze(["atk", "def", "hp", "spa", "spd", "spe"]);

export function sumIvs(ivs) {
  const source = ivs && typeof ivs === "object" ? ivs : {};

  let total = 0;

  for (const stat of IV_STATS) {
    const value = Number(source[stat]);
    total += Number.isFinite(value) ? value : 0;
  }

  return total;
}
