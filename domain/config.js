/**
 * Canonical hunt configuration shape.
 *
 * A "config" is the immutable snapshot that `config_id` (domain/configHash.js)
 * is derived from: schema version + EXP rate state + normalized
 * `auto_capture` snapshot (docs/ARCHITECTURE.md §5-6).
 *
 * This module only builds the canonical *shape*. It never reads protocol
 * events itself — callers (Phase 2 parser, Phase 3 manual EXP rate UI)
 * decide what values and `captureConfigSource` to pass in.
 */

// Bump only when the canonical shape below changes in a way that should
// produce a different config_id for otherwise-identical input.
export const CONFIG_SCHEMA_VERSION = 1;

// docs/ARCHITECTURE.md §6 — confirmed fixture fields of
// `combat.started.data.session.auto_capture`. Do not add fields here
// without a protocol fixture proving them.
export const AUTO_CAPTURE_FIELDS = Object.freeze([
  "enabled",
  "mode",
  "capsule_item_id",
  "common_enabled",
  "common_capsule_item_id",
  "min_quality",
  "shiny_enabled",
  "shiny_capsule_item_id",
  "species_filter"
]);

// docs/ARCHITECTURE.md §4 (`configs.captureConfigSource`).
export const CAPTURE_CONFIG_SOURCES = Object.freeze([
  "protocol",
  "manual",
  "unknown"
]);

const DEFAULT_EXP_RATE_LABEL = "unknown";
const DEFAULT_CAPTURE_CONFIG_SOURCE = "unknown";

/**
 * Normalizes an `auto_capture` snapshot (or any partial/absent value) into
 * a fixed shape: every confirmed field is always present, missing/undefined
 * fields become `null`. Unknown extra keys are ignored so an unexpected
 * protocol addition cannot silently change the config hash.
 */
export function normalizeAutoCapture(raw) {
  const source =
    raw && typeof raw === "object" ? raw : {};

  const normalized = {};

  for (const field of AUTO_CAPTURE_FIELDS) {
    const value = source[field];

    normalized[field] =
      value === undefined ? null : value;
  }

  return normalized;
}

function normalizeExpRateLabel(expRateLabel) {
  if (
    typeof expRateLabel === "string" &&
    expRateLabel.trim().length > 0
  ) {
    return expRateLabel;
  }

  return DEFAULT_EXP_RATE_LABEL;
}

function normalizeCaptureConfigSource(captureConfigSource) {
  if (captureConfigSource === undefined) {
    return DEFAULT_CAPTURE_CONFIG_SOURCE;
  }

  if (!CAPTURE_CONFIG_SOURCES.includes(captureConfigSource)) {
    throw new TypeError(
      `buildCanonicalConfig: invalid captureConfigSource "${captureConfigSource}"`
    );
  }

  return captureConfigSource;
}

/**
 * Builds the canonical config object that domain/configHash.js hashes and
 * data/configsRepository.js persists. Every input is optional except that
 * `captureConfigSource`, when given, must be one of CAPTURE_CONFIG_SOURCES.
 */
export function buildCanonicalConfig({
  schemaVersion = CONFIG_SCHEMA_VERSION,
  expRateLabel,
  captureConfig,
  captureConfigSource
} = {}) {
  return {
    schemaVersion,
    expRateLabel: normalizeExpRateLabel(expRateLabel),
    captureConfigSource: normalizeCaptureConfigSource(captureConfigSource),
    captureConfig: normalizeAutoCapture(captureConfig)
  };
}
