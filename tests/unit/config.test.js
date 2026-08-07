import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CONFIG_SCHEMA_VERSION,
  AUTO_CAPTURE_FIELDS,
  normalizeAutoCapture,
  buildCanonicalConfig
} from "../../domain/config.js";
import { stableStringify } from "../../domain/canonicalJson.js";

test("normalizeAutoCapture fills every confirmed field, missing -> null", () => {
  const normalized = normalizeAutoCapture({
    enabled: true,
    min_quality: "rare"
  });

  for (const field of AUTO_CAPTURE_FIELDS) {
    assert.ok(Object.prototype.hasOwnProperty.call(normalized, field));
  }

  assert.equal(normalized.enabled, true);
  assert.equal(normalized.min_quality, "rare");
  assert.equal(normalized.mode, null);
  assert.equal(normalized.species_filter, null);
});

test("normalizeAutoCapture handles null/undefined input", () => {
  const normalized = normalizeAutoCapture(undefined);

  for (const field of AUTO_CAPTURE_FIELDS) {
    assert.equal(normalized[field], null);
  }
});

test("normalizeAutoCapture ignores unknown extra keys", () => {
  const normalized = normalizeAutoCapture({
    enabled: true,
    some_future_field: "x"
  });

  assert.equal(normalized.some_future_field, undefined);
});

test("buildCanonicalConfig defaults expRateLabel and captureConfigSource to unknown", () => {
  const config = buildCanonicalConfig({});

  assert.equal(config.schemaVersion, CONFIG_SCHEMA_VERSION);
  assert.equal(config.expRateLabel, "unknown");
  assert.equal(config.captureConfigSource, "unknown");
});

test("buildCanonicalConfig rejects an invalid captureConfigSource", () => {
  assert.throws(
    () => buildCanonicalConfig({ captureConfigSource: "guessed" }),
    TypeError
  );
});

test("semantically equal configs serialize identically regardless of key order", () => {
  const a = buildCanonicalConfig({
    expRateLabel: "2x",
    captureConfigSource: "protocol",
    captureConfig: { enabled: true, min_quality: "rare" }
  });

  const b = buildCanonicalConfig({
    captureConfig: { min_quality: "rare", enabled: true },
    captureConfigSource: "protocol",
    expRateLabel: "2x"
  });

  assert.equal(stableStringify(a), stableStringify(b));
});

test("a different expRateLabel changes the canonical serialization", () => {
  const base = { captureConfig: { enabled: true } };

  const a = buildCanonicalConfig({ ...base, expRateLabel: "1x" });
  const b = buildCanonicalConfig({ ...base, expRateLabel: "2x" });

  assert.notEqual(stableStringify(a), stableStringify(b));
});

test("a different auto_capture field changes the canonical serialization", () => {
  const a = buildCanonicalConfig({
    captureConfig: { min_quality: "rare" }
  });

  const b = buildCanonicalConfig({
    captureConfig: { min_quality: "epic" }
  });

  assert.notEqual(stableStringify(a), stableStringify(b));
});
