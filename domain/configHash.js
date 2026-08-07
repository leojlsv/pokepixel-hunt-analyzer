/**
 * config_id derivation (docs/ARCHITECTURE.md §5):
 * "a deterministic SHA-256 hash of canonical configuration".
 *
 * Uses the Web Crypto API (`crypto.subtle`), available natively both in the
 * MV3 service worker and in Node (>= 19) — no extra dependency.
 */

import { stableStringify } from "./canonicalJson.js";

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hashes an already-canonical config object (see domain/config.js
 * buildCanonicalConfig) and returns the lowercase hex SHA-256 digest used
 * as `config_id`.
 *
 * Only the fields the doc's formula names participate in the hash:
 * schema version + EXP rate state + normalized auto_capture snapshot.
 * `captureConfigSource` ("protocol" | "manual" | "unknown") is provenance
 * metadata stored alongside the row — it must NOT affect config_id, or two
 * functionally identical configs (one detected from the protocol, one
 * re-entered manually with the same values) would get different
 * config_ids and fragment group_key analytics for what is really the same
 * configuration.
 */
export function selectHashableConfig(canonicalConfig) {
  return {
    schemaVersion: canonicalConfig.schemaVersion,
    expRateLabel: canonicalConfig.expRateLabel,
    captureConfig: canonicalConfig.captureConfig
  };
}

export async function hashConfig(canonicalConfig) {
  const canonicalJson = stableStringify(
    selectHashableConfig(canonicalConfig)
  );
  const data = new TextEncoder().encode(canonicalJson);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return toHex(digest);
}
