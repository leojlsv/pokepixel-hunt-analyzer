/**
 * group_key = species_id | level | config_id (docs/ARCHITECTURE.md §5).
 *
 * The ball actually used in one attempt is encounter data, not part of the
 * group key. A group key is never built partially — a missing field means
 * the encounter isn't ready to be grouped yet, so callers get a hard error
 * instead of a silently wrong key like "123|null|abc".
 */

function isNonEmptyStringOrFiniteNumber(value) {
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return false;
}

export function buildGroupKey({ speciesId, level, configId } = {}) {
  if (!isNonEmptyStringOrFiniteNumber(speciesId)) {
    throw new TypeError("buildGroupKey: speciesId is required");
  }

  if (!Number.isFinite(level)) {
    throw new TypeError("buildGroupKey: level is required");
  }

  if (typeof configId !== "string" || configId.length === 0) {
    throw new TypeError("buildGroupKey: configId is required");
  }

  return `${speciesId}|${level}|${configId}`;
}
