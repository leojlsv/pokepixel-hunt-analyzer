import { test } from "node:test";
import assert from "node:assert/strict";

import { hashConfig } from "../../domain/configHash.js";
import { buildCanonicalConfig } from "../../domain/config.js";

test("hashConfig produces a 64-char lowercase hex SHA-256 digest", async () => {
  const config = buildCanonicalConfig({
    expRateLabel: "2x",
    captureConfig: { enabled: true, min_quality: "rare" }
  });

  const hash = await hashConfig(config);

  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("same semantic config, different key order -> same hash", async () => {
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

  assert.equal(await hashConfig(a), await hashConfig(b));
});

test("EXP rate change -> different hash", async () => {
  const base = { captureConfig: { enabled: true } };

  const a = buildCanonicalConfig({ ...base, expRateLabel: "1x" });
  const b = buildCanonicalConfig({ ...base, expRateLabel: "2x" });

  assert.notEqual(await hashConfig(a), await hashConfig(b));
});

test("auto_capture change -> different hash", async () => {
  const a = buildCanonicalConfig({
    captureConfig: { min_quality: "rare" }
  });

  const b = buildCanonicalConfig({
    captureConfig: { min_quality: "epic" }
  });

  assert.notEqual(await hashConfig(a), await hashConfig(b));
});

test("captureConfigSource alone does NOT change the hash", async () => {
  // docs/ARCHITECTURE.md §5 formula is schema version + EXP rate state +
  // auto_capture only. captureConfigSource is provenance metadata (was it
  // read from the protocol or entered manually?) persisted alongside the
  // row, not part of the config's identity — two functionally identical
  // configs must share one config_id regardless of source.
  const a = buildCanonicalConfig({
    captureConfigSource: "protocol",
    captureConfig: { enabled: true }
  });

  const b = buildCanonicalConfig({
    captureConfigSource: "manual",
    captureConfig: { enabled: true }
  });

  assert.equal(await hashConfig(a), await hashConfig(b));
});
