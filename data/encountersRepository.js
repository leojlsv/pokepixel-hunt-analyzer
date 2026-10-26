/**
 * `encounters` store repository (docs/ARCHITECTURE.md §4).
 *
 * Thin persistence layer over data/repository.js — all correlation/state
 * logic lives in domain/encounterTracker.js; this module just applies the
 * effects it produces (`encounter.create` / `encounter.update` /
 * `encounter.finalize`, the latter two both being a patch merge here).
 */

import { createRepository } from "./repository.js";
import { promisifyRequest } from "./db.js";
import { STORE_NAMES } from "./migrations.js";
import { archivedCatchGalleryRow } from "./catch-gallery-archive.js";
import { bumpEncounterRevision, readEncounterRevision } from "./encounter-revision.js";
import {
  abortIfWriteGateLost,
  assertDatabaseWriteGate,
  WriteLeadershipLostError
} from "./write-gate.js";

export function createEncountersRepository(db) {
  const repo = createRepository(db, STORE_NAMES.ENCOUNTERS);

  function create(row) {
    // IDs are immutable. A retried create must never overwrite an existing
    // encounter while announcing a `{before:null, after:row}` transition.
    return new Promise((resolve, reject) => {
      let transaction;
      let leadershipLost = false;
      try {
        assertDatabaseWriteGate(db);
        transaction = db.transaction([STORE_NAMES.ENCOUNTERS, STORE_NAMES.META], "readwrite");
        const checkOwnership = () => {
          if (!abortIfWriteGateLost(db, transaction)) return true;
          leadershipLost = true;
          return false;
        };
        const createRequest = transaction.objectStore(STORE_NAMES.ENCOUNTERS).add(row);
        createRequest.onsuccess = () => {
          if (!checkOwnership()) return;
          bumpEncounterRevision(transaction, row.sessionId, checkOwnership);
        };
        transaction.oncomplete = () => resolve(row);
        transaction.onabort = () => reject(leadershipLost
          ? new WriteLeadershipLostError()
          : transaction.error ?? new Error("Encounter creation aborted"));
      } catch (error) {
        try { transaction?.abort(); } catch {}
        reject(error);
      }
    });
  }

  /**
   * Reads the authoritative before-image and commits its replacement in one
   * readwrite transaction. A full-session UI cache is no longer required to
   * derive corrected encounter deltas. Resolve only after transaction commit;
   * leader loss aborts the write and never returns a successful transition.
   * `finish` may synchronously derive extra persisted fields from the merged
   * encounter, e.g. capture-ticket eligibility.
   */
  function updateWithPrevious(encounterId, patch, { finish = null } = {}) {
    return new Promise((resolve, reject) => {
      let transaction;
      let leadershipLost = false;
      let failure = null;
      let transition = null;
      try {
        assertDatabaseWriteGate(db);
        transaction = db.transaction([STORE_NAMES.ENCOUNTERS, STORE_NAMES.META], "readwrite");
        const store = transaction.objectStore(STORE_NAMES.ENCOUNTERS);
        const checkOwnership = () => {
          if (!abortIfWriteGateLost(db, transaction)) return true;
          leadershipLost = true;
          return false;
        };
        const request = store.get(encounterId);

        request.onsuccess = () => {
          if (!checkOwnership()) return;
          const before = request.result;
          if (!before) {
            failure = new Error(`encountersRepository.update: unknown encounterId "${encounterId}"`);
            transaction.abort();
            return;
          }
          try {
            const merged = { ...before, ...patch };
            const after = finish ? finish(merged) : merged;
            if (!after || after.encounterId !== encounterId || after.sessionId !== before.sessionId) {
              throw new Error("encountersRepository.updateWithPrevious: invalid final encounter identity/session");
            }
            const put = store.put(after);
            put.onsuccess = () => {
              if (!checkOwnership()) return;
              bumpEncounterRevision(transaction, before.sessionId, checkOwnership);
            };
            transition = { before, after };
          } catch (error) {
            failure = error;
            transaction.abort();
          }
        };
        transaction.oncomplete = () => resolve(transition);
        transaction.onabort = () => reject(leadershipLost
          ? new WriteLeadershipLostError()
          : failure || transaction.error || new Error("Encounter update aborted"));
        transaction.onerror = () => {
          if (!failure) failure = transaction.error;
        };
      } catch (error) {
        try { transaction?.abort(); } catch {}
        reject(error);
      }
    });
  }

  async function update(encounterId, patch) {
    const result = await updateWithPrevious(encounterId, patch);
    return result.after;
  }

  function get(encounterId) {
    return repo.get(encounterId);
  }

  function getAll() {
    return repo.getAll();
  }

  // Uses the `sessionId` index created in the initial migration — needed by
  // the Analyzer's Current view (domain/sessionMetrics.js) to fetch only
  // the current session's encounters instead of the whole store.
  function getBySessionId(sessionId) {
    const store = db
      .transaction(STORE_NAMES.ENCOUNTERS, "readonly")
      .objectStore(STORE_NAMES.ENCOUNTERS);

    return promisifyRequest(store.index("sessionId").getAll(sessionId));
  }

  /**
   * Returns at most `limit` ticket-eligible captures, newest first.
   *
   * `captureTicketAtMs` is a sparse v3 index: only encounters that satisfy
   * the Capture Ticket contract receive this derived field. Catch Gallery
   * therefore reads only relevant rows and never materializes the complete
   * encounters store.
   */
  function getRecentCaptureTickets(limit = 500) {
    if (!Number.isInteger(limit) || limit < 1) {
      return Promise.reject(
        new RangeError(
          "encountersRepository.getRecentCaptureTickets: limit must be >= 1"
        )
      );
    }

    return new Promise((resolve, reject) => {
      const rows = [];
      const store = db
        .transaction(STORE_NAMES.ENCOUNTERS, "readonly")
        .objectStore(STORE_NAMES.ENCOUNTERS);
      const request = store.index("captureTicketAtMs").openCursor(null, "prev");

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          resolve(rows);
          return;
        }

        rows.push(cursor.value);

        if (rows.length >= limit) {
          resolve(rows);
          return;
        }

        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes every ordinary encounter belonging to one session (History's delete
   * control), while detaching/retaining eligible Catch Gallery tickets. Call
   * this BEFORE
   * sessionsRepository.deleteSession(sessionId) — see that module's
   * docstring for why the ordering matters.
   */
  function deleteBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      let transaction;
      try {
        assertDatabaseWriteGate(db);
        transaction = db.transaction([STORE_NAMES.ENCOUNTERS, STORE_NAMES.META], "readwrite");
      } catch (error) {
        reject(error);
        return;
      }
      const store = transaction.objectStore(STORE_NAMES.ENCOUNTERS);
      let leadershipLost = false;
      function checkOwnership() {
        if (!abortIfWriteGateLost(db, transaction)) return true;
        leadershipLost = true;
        return false;
      }

      transaction.addEventListener("complete", () => resolve());
      transaction.addEventListener("abort", () => reject(
        leadershipLost ? new WriteLeadershipLostError() : transaction.error ?? new Error("Encounter deletion aborted")
      ));

      // A bare (non-IDBKeyRange) query is treated as an exact-match range.
      const request = store.index("sessionId").openCursor(sessionId);

      request.onsuccess = () => {
        if (!checkOwnership()) return;
        const cursor = request.result;

        if (!cursor) {
          // One bump represents the whole committed deletion/archive batch.
          // Repeated deletion safely changes only the revision, not the rows.
          bumpEncounterRevision(transaction, sessionId, checkOwnership);
          return;
        }

        const galleryTicket = archivedCatchGalleryRow(cursor.value);
        const mutation = galleryTicket ? cursor.update(galleryTicket) : cursor.delete();
        mutation.addEventListener("success", () => { checkOwnership(); });
        cursor.continue();
      };

      request.onerror = () => reject(
        leadershipLost ? new WriteLeadershipLostError() : request.error
      );
    });
  }

  return {
    create,
    update,
    updateWithPrevious,
    get,
    getAll,
    getBySessionId,
    getSessionRevision: (sessionId) => readEncounterRevision(db, sessionId),
    getRecentCaptureTickets,
    deleteBySessionId
  };
}
