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

function isTicketEligibleV3(row) {
  const notable =
    row?.isShiny === true ||
    row?.quality === "legendary" ||
    row?.quality === "mythical";

  return Boolean(
    row?.captureResult === "success" &&
    notable &&
    row.speciesName &&
    row.capturedByName &&
    Number.isFinite(row.qualityMultiplier) &&
    Number.isFinite(row.ivTotal) &&
    Number.isFinite(row.captureAtMs)
  );
}

function applyV3(_db, transaction) {
  const store = transaction.objectStore(STORE_NAMES.ENCOUNTERS);

  // Sparse index: only rows with a numeric captureTicketAtMs participate.
  // This lets Catch Gallery read ticket-eligible captures directly without
  // scanning successes or materializing the whole encounter store.
  store.createIndex("captureTicketAtMs", "captureTicketAtMs", { unique: false });

  // Backfill only rows that already satisfy the exact v3 ticket contract.
  // Old encounters missing capturedByName remain untouched/ineligible.
  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;

    const row = cursor.value;
    if (isTicketEligibleV3(row) && row.captureTicketAtMs !== row.captureAtMs) {
      cursor.update({ ...row, captureTicketAtMs: row.captureAtMs });
    }
    cursor.continue();
  };
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
