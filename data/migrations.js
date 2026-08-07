/**
 * IndexedDB schema for `pokepixel_hunt_analyzer` (docs/ARCHITECTURE.md §4).
 *
 * Each entry in MIGRATIONS is the upgrade step that takes the database from
 * `version - 1` to `version`. Migrations only ever add — they must stay
 * runnable against every earlier version a real user's browser might still
 * have on disk. Never edit a migration that has shipped; add a new one.
 */

export const STORE_NAMES = Object.freeze({
  META: "meta",
  SESSIONS: "sessions",
  CONFIGS: "configs",
  ENCOUNTERS: "encounters"
});

function applyV1(db) {
  // Generic key/value store for future diagnostics counters and schema
  // bookkeeping (docs/DEVELOPMENT.md §9). Out-of-line keys — no fixed
  // record shape is imposed yet.
  db.createObjectStore(STORE_NAMES.META);

  db.createObjectStore(STORE_NAMES.SESSIONS, {
    keyPath: "sessionId"
  });

  // configId is the config hash itself (domain/configHash.js) — rows are
  // immutable, never updated in place.
  db.createObjectStore(STORE_NAMES.CONFIGS, {
    keyPath: "configId"
  });

  const encounters = db.createObjectStore(STORE_NAMES.ENCOUNTERS, {
    keyPath: "encounterId"
  });

  // Initial indexes per docs/ARCHITECTURE.md §4.
  encounters.createIndex("sessionId", "sessionId", { unique: false });
  encounters.createIndex("groupKey", "groupKey", { unique: false });
  encounters.createIndex("speciesId", "speciesId", { unique: false });
  encounters.createIndex("quality", "quality", { unique: false });
  encounters.createIndex("startedAtMs", "startedAtMs", { unique: false });
}

const MIGRATIONS = new Map([[1, applyV1]]);

export const SCHEMA_VERSION = Math.max(...MIGRATIONS.keys());

/**
 * Runs every migration between `oldVersion` (exclusive) and `newVersion`
 * (inclusive) against `db`, in order. Called from inside
 * IDBOpenDBRequest.onupgradeneeded (data/db.js), which is the only place
 * IndexedDB allows object store/index creation.
 */
export function runMigrations(db, oldVersion, newVersion) {
  for (let version = oldVersion + 1; version <= newVersion; version += 1) {
    const migrate = MIGRATIONS.get(version);

    if (!migrate) {
      throw new Error(
        `runMigrations: no migration registered for schema version ${version}`
      );
    }

    migrate(db);
  }
}
