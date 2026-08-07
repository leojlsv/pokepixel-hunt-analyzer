/**
 * `configs` store repository (docs/ARCHITECTURE.md §4).
 *
 * Config rows are immutable: `getOrCreate` returns the existing row for a
 * given config_id and never overwrites it, even if the caller passes a
 * different `captureConfigSource` for otherwise-identical values. Editing
 * the effective configuration always produces a new config_id, never an
 * in-place update.
 */

import { createRepository } from "./repository.js";
import { STORE_NAMES } from "./migrations.js";
import { hashConfig, selectHashableConfig } from "../domain/configHash.js";
import { stableStringify } from "../domain/canonicalJson.js";

export function createConfigsRepository(db, { now = Date.now } = {}) {
  const repo = createRepository(db, STORE_NAMES.CONFIGS);

  async function getOrCreate(canonicalConfig) {
    const configId = await hashConfig(canonicalConfig);
    const existing = await repo.get(configId);

    if (existing) return existing;

    const row = {
      configId,
      schemaVersion: canonicalConfig.schemaVersion,
      expRateLabel: canonicalConfig.expRateLabel,
      captureConfigSource: canonicalConfig.captureConfigSource,
      captureConfig: canonicalConfig.captureConfig,
      canonicalJson: stableStringify(selectHashableConfig(canonicalConfig)),
      createdAtMs: now()
    };

    await repo.put(row);

    return row;
  }

  function getById(configId) {
    return repo.get(configId);
  }

  return { getOrCreate, getById };
}
