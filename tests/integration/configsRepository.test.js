import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase, STORE_NAMES } from "../../data/db.js";
import { createRepository } from "../../data/repository.js";
import { createConfigsRepository } from "../../data/configsRepository.js";
import { buildCanonicalConfig } from "../../domain/config.js";
import {
  hashConfig,
  selectHashableConfig
} from "../../domain/configHash.js";
import { stableStringify } from "../../domain/canonicalJson.js";

async function setup() {
  return openDatabase({ indexedDBFactory: new IDBFactory() });
}

function fakeClock() {
  let tick = 0;
  return () => ++tick;
}

test("getOrCreate is deterministic: same semantic config -> same configId, single row (create)", async () => {
  const db = await setup();
  const now = fakeClock();
  const configs = createConfigsRepository(db, { now });

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

  const rowA = await configs.getOrCreate(a);
  const rowB = await configs.getOrCreate(b);

  assert.equal(rowA.configId, rowB.configId);
  // Same createdAtMs proves the second call hit the existing row and did
  // not perform a second insert.
  assert.equal(rowA.createdAtMs, rowB.createdAtMs);

  const raw = createRepository(db, STORE_NAMES.CONFIGS);
  const all = await raw.getAll();
  assert.equal(all.length, 1);
});

test("EXP rate change creates a new config_id and a new row (read + create)", async () => {
  const db = await setup();
  const configs = createConfigsRepository(db, { now: fakeClock() });

  const base = { captureConfig: { enabled: true } };

  const rowA = await configs.getOrCreate(
    buildCanonicalConfig({ ...base, expRateLabel: "1x" })
  );
  const rowB = await configs.getOrCreate(
    buildCanonicalConfig({ ...base, expRateLabel: "2x" })
  );

  assert.notEqual(rowA.configId, rowB.configId);

  const raw = createRepository(db, STORE_NAMES.CONFIGS);
  assert.equal((await raw.getAll()).length, 2);
});

test("auto_capture change creates a new config_id and a new row", async () => {
  const db = await setup();
  const configs = createConfigsRepository(db, { now: fakeClock() });

  const rowA = await configs.getOrCreate(
    buildCanonicalConfig({ captureConfig: { min_quality: "rare" } })
  );
  const rowB = await configs.getOrCreate(
    buildCanonicalConfig({ captureConfig: { min_quality: "epic" } })
  );

  assert.notEqual(rowA.configId, rowB.configId);

  const raw = createRepository(db, STORE_NAMES.CONFIGS);
  assert.equal((await raw.getAll()).length, 2);
});

test("getById reads back an existing row and returns undefined for an unknown id", async () => {
  const db = await setup();
  const configs = createConfigsRepository(db, { now: fakeClock() });

  const created = await configs.getOrCreate(
    buildCanonicalConfig({ expRateLabel: "3x" })
  );

  const found = await configs.getById(created.configId);
  assert.deepEqual(found, created);

  const missing = await configs.getById("does-not-exist");
  assert.equal(missing, undefined);
});

test("rows are immutable: a different captureConfigSource for the same values does not overwrite the row", async () => {
  const db = await setup();
  const configs = createConfigsRepository(db, { now: fakeClock() });

  const first = await configs.getOrCreate(
    buildCanonicalConfig({
      captureConfigSource: "protocol",
      captureConfig: { enabled: true }
    })
  );

  const second = await configs.getOrCreate(
    buildCanonicalConfig({
      captureConfigSource: "manual",
      captureConfig: { enabled: true }
    })
  );

  assert.equal(first.configId, second.configId);
  // The stored row keeps the source it was first created with.
  assert.equal(second.captureConfigSource, "protocol");

  const raw = createRepository(db, STORE_NAMES.CONFIGS);
  assert.equal((await raw.getAll()).length, 1);
});

test("canonicalJson stored on the row is exactly what config_id was hashed from", async () => {
  const db = await setup();
  const configs = createConfigsRepository(db, { now: fakeClock() });

  const canonicalConfig = buildCanonicalConfig({
    expRateLabel: "2x",
    captureConfig: { enabled: true, min_quality: "rare" }
  });

  const row = await configs.getOrCreate(canonicalConfig);

  assert.equal(await hashConfig(canonicalConfig), row.configId);
  assert.equal(
    row.canonicalJson,
    stableStringify(selectHashableConfig(canonicalConfig))
  );
});
