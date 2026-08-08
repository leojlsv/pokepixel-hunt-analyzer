import { test } from "node:test";
import assert from "node:assert/strict";

import { buildJsonBackup, BACKUP_FORMAT_VERSION } from "../../domain/export.js";

test("builds the documented backup shape (docs/DEVELOPMENT.md §3)", () => {
  const sessions = [{ sessionId: "s1" }];
  const configs = [{ configId: "c1" }];
  const encounters = [{ encounterId: "e1" }];

  const backup = buildJsonBackup({
    appVersion: "1.0.0",
    sessions,
    configs,
    encounters
  });

  assert.deepEqual(backup, {
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: "1.0.0",
    sessions,
    configs,
    encounters
  });
});

test("defaults missing arrays to empty and appVersion to 'unknown'", () => {
  const backup = buildJsonBackup({});

  assert.deepEqual(backup.sessions, []);
  assert.deepEqual(backup.configs, []);
  assert.deepEqual(backup.encounters, []);
  assert.equal(backup.appVersion, "unknown");
});
