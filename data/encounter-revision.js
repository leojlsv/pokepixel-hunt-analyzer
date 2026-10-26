/**
 * Durable, per-session encounter revision. All writes made by the current
 * encounters repository bump this record in the SAME IndexedDB transaction as
 * their encounter mutation. This is a commit fence between cooperating tabs,
 * not proof that an older userscript or external IDB writer cooperates.
 *
 * Meta exists in every supported schema (v1+), so adding this prerequisite
 * does not upgrade the user's production database or rewrite historical rows.
 */
import { STORE_NAMES } from "./migrations.js";

const REVISION_PREFIX = "encounterRevision:";

function revisionKey(sessionId) {
  if (typeof sessionId !== "string" || !sessionId) {
    throw new TypeError("Encounter revision requires a nonempty sessionId");
  }
  return `${REVISION_PREFIX}${sessionId}`;
}

/** Queue a read+write within the caller's open readwrite transaction. */
export function bumpEncounterRevision(transaction, sessionId, checkOwnership) {
  // Historic orphan/Gallery records can legitimately have no sessionId.
  if (sessionId == null) return;
  const key = revisionKey(sessionId);
  const meta = transaction.objectStore(STORE_NAMES.META);
  const read = meta.get(key);
  read.onsuccess = () => {
    if (checkOwnership && !checkOwnership()) return;
    const previous = read.result;
    // An unexpected revision shape must not silently reset an old token.
    if (previous !== undefined && (
      !previous || typeof previous.token !== "string" || !previous.token ||
      !Number.isSafeInteger(previous.sequence) || previous.sequence < 1 ||
      previous.sequence === Number.MAX_SAFE_INTEGER
    )) {
      transaction.abort();
      return;
    }
    const next = previous
      ? { token: previous.token, sequence: previous.sequence + 1 }
      : { token: crypto.randomUUID(), sequence: 1 };
    const write = meta.put(next, key);
    write.onsuccess = () => { if (checkOwnership) checkOwnership(); };
  };
}

/**
 * `null` means UNTRACKED, not revision zero: old databases contain rows that
 * predate this journal, and non-cooperating writers remain possible.
 */
export function readEncounterRevision(db, sessionId) {
  let key;
  try { key = revisionKey(sessionId); } catch (error) { return Promise.reject(error); }
  return new Promise((resolve, reject) => {
    let transaction;
    let revision;
    try {
      transaction = db.transaction(STORE_NAMES.META, "readonly");
      const read = transaction.objectStore(STORE_NAMES.META).get(key);
      // Never present this as an authoritative snapshot fence while old
      // `version:null` fallback clients can bypass repository instrumentation.
      read.onsuccess = () => {
        const value = read.result;
        const valid = value && typeof value.token === "string" &&
          value.token.length > 0 && Number.isSafeInteger(value.sequence) &&
          value.sequence > 0 && value.sequence < Number.MAX_SAFE_INTEGER;
        revision = valid ? {
          token: value.token,
          sequence: value.sequence,
          coverage: "cooperating-only"
        } : null;
      };
      transaction.oncomplete = () => resolve(revision);
      transaction.onabort = () => reject(transaction.error ?? new Error("Encounter revision read aborted"));
    } catch (error) {
      try { transaction?.abort(); } catch {}
      reject(error);
    }
  });
}
