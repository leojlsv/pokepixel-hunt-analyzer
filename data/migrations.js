/**
 * IndexedDB schema migrations.
 *
 * Each entry upgrades the database from `version - 1` to `version`.
 * Shipped migrations are append-only: never rewrite an old migration;
 * add a new version instead.
 */

export const STORE_NAMES = Object.freeze({
  META: "meta",
  SESSIONS: "sessions",
  CONFIGS: "configs",
  ENCOUNTERS: "encounters"
});

function applyV1(db) {
  db.createObjectStore(STORE_NAMES.META);

  db.createObjectStore(STORE_NAMES.SESSIONS, {
    keyPath: "sessionId"
  });

  db.createObjectStore(STORE_NAMES.CONFIGS, {
    keyPath: "configId"
  });

  const encounters = db.createObjectStore(STORE_NAMES.ENCOUNTERS, {
    keyPath: "encounterId"
  });

  encounters.createIndex("sessionId", "sessionId", { unique: false });
  encounters.createIndex("groupKey", "groupKey", { unique: false });
  encounters.createIndex("speciesId", "speciesId", { unique: false });
  encounters.createIndex("quality", "quality", { unique: false });
  encounters.createIndex("startedAtMs", "startedAtMs", { unique: false });
}

function applyV2(_db, transaction) {
  transaction
    .objectStore(STORE_NAMES.SESSIONS)
    .createIndex("startedAtMs", "startedAtMs", { unique: false });
}

function applyV3(_db, transaction) {
  // Compound key keeps all terminal capture results grouped by result and
  // ordered by capture time. Catch Gallery can therefore walk only the
  // newest successful captures instead of materializing the encounter store.
  transaction
    .objectStore(STORE_NAMES.ENCOUNTERS)
    .createIndex(
      "captureResultCaptureAtMs",
      ["captureResult", "captureAtMs"],
      { unique: false }
    );
}

const MIGRATIONS = new Map([
  [1, applyV1],
  [2, applyV2],
  [3, applyV3]
]);

export const SCHEMA_VERSION = Math.max(...MIGRATIONS.keys());

export function runMigrations(db, oldVersion, newVersion, transaction) {
  for (let version = oldVersion + 1; version <= newVersion; version += 1) {
    const migrate = MIGRATIONS.get(version);

    if (!migrate) {
      throw new Error(
        `runMigrations: no migration registered for schema version ${version}`
      );
    }

    migrate(db, transaction);
  }
}
