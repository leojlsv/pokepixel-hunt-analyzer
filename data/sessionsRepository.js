/**
 * `sessions` store repository (docs/ARCHITECTURE.md §4/§7).
 *
 * Tracks "the current local Hunt session" via a pointer
 * (`currentSessionId`) in the `meta` store. A session is reused across
 * events until something ends it.
 *
 * Every method here is either "automatic" (driven by protocol signals via
 * services/eventPipeline.js: `hunt.stopped`, `combat.started`/
 * `loot.received`/`hunt.analyzer_reset`, a confirmed new `serverSessionId`)
 * or "manual" (driven by the Analyzer's New Hunt/Pause/Resume/End Hunt
 * controls). Automatic methods respect `locked`
 * (domain/sessionTiming.js) and no-op while it's set; manual methods are
 * the only ones that set or clear it. This is what keeps a manual
 * Pause/End Hunt from being silently undone by the next `combat.started`.
 *
 * `recoverOnStartup` is a mutating startup operation. The Tampermonkey
 * runtime must call it only after this tab has actually acquired analytics
 * leadership, never from STANDBY or from the per-event path. Re-running the
 * browser-restart recovery formula during an active Hunt would truncate the
 * active-time baseline.
 */

import { createRepository } from "./repository.js";
import { STORE_NAMES } from "./migrations.js";
import {
  abortIfWriteGateLost,
  assertDatabaseWriteGate,
  WriteLeadershipLostError
} from "./write-gate.js";
import {
  createSession,
  touchActivity,
  pause,
  endSession,
  recoverFromRestart,
  adoptServerContext as adoptServerContextPure,
  lockSession,
  unlockSession,
  recordPotionUsed as recordPotionUsedPure
} from "../domain/sessionTiming.js";

const CURRENT_SESSION_KEY = "currentSessionId";
const LAST_FINISHED_EXPEDITION_KEY = "lastFinishedExpeditionRunId";

export function createSessionsRepository(
  db,
  { now = Date.now, IDBKeyRange = globalThis.IDBKeyRange } = {}
) {
  const sessions = createRepository(db, STORE_NAMES.SESSIONS);
  const meta = createRepository(db, STORE_NAMES.META);

  async function readCurrent() {
    const currentSessionId = await meta.get(CURRENT_SESSION_KEY);
    if (!currentSessionId) return null;

    const session = await sessions.get(currentSessionId);
    return session ?? null;
  }

  async function startNew({ startPaused = false, startEnded = false } = {}) {
    const startedAt = now();
    const runningSession = createSession({
      sessionId: crypto.randomUUID(),
      now: startedAt
    });
    const session = startEnded
      ? lockSession(endSession(runningSession, startedAt))
      : startPaused
        ? lockSession(pause(runningSession, startedAt))
        : runningSession;

    // Creating the row without its current-session pointer would leave an
    // unreferenced Hunt if leadership changed between the two old puts.
    assertDatabaseWriteGate(db);
    return new Promise((resolve, reject) => {
      let transaction;
      let leadershipLost = false;
      try {
        transaction = db.transaction([STORE_NAMES.SESSIONS, STORE_NAMES.META], "readwrite");
        const sessionStore = transaction.objectStore(STORE_NAMES.SESSIONS);
        const metaStore = transaction.objectStore(STORE_NAMES.META);
        sessionStore.put(session);
        metaStore.put(session.sessionId, CURRENT_SESSION_KEY);
        transaction.addEventListener("success", () => {
          if (abortIfWriteGateLost(db, transaction)) leadershipLost = true;
        }, true);
        transaction.addEventListener("complete", () => resolve(session));
        transaction.addEventListener("abort", () => reject(
          leadershipLost ? new WriteLeadershipLostError() : transaction.error ?? new Error("New Hunt aborted")
        ));
      } catch (error) {
        try { transaction?.abort(); } catch {}
        reject(error);
      }
    });
  }

  // Only recreates when there is truly nothing usable to attach data to —
  // an "ended" session left locked by a manual End Hunt is deliberately
  // NOT replaced here; only forceNewSession() (New Hunt) replaces it.
  async function getOrStartCurrent() {
    const current = await readCurrent();

    if (!current) return startNew();
    if (current.status === "ended" && !current.locked) return startNew();

    return current;
  }

  /** Automatic resume/touch from combat.started/loot.received/hunt.analyzer_reset. */
  async function touchActivityAutomatic() {
    // Late loot/terminal events cannot resurrect a completed Expedition or
    // create an implicit Hunt before an authoritative combat context arrives.
    const current = await readCurrent();
    if (current?.activityKind === "expedition" && current.status === "ended") return current;
    const session = await getOrStartCurrent();
    if (session.locked) return session;

    const touched = touchActivity(session, now());

    if (touched !== session) {
      await sessions.put(touched);
    }

    return touched;
  }

  /** Automatic pause from the protocol's `hunt.stopped` signal. */
  async function pauseAutomatic() {
    const current = await readCurrent();
    if (!current || current.locked) return current ?? null;

    const paused = pause(current, now());

    if (paused !== current) {
      await sessions.put(paused);
    }

    return paused;
  }

  /**
   * Automatic — from `loot.received`'s auto-potion-used variant
   * (domain/encounterTracker.js's `session.potion_used` effect). Respects
   * `locked` like the other automatic methods: a stray potion signal must
   * not silently un-freeze a manually Paused/Ended Hunt's expense total.
   */
  async function recordPotionUsed(cost) {
    const session = await getOrStartCurrent();
    if (session.locked) return session;

    const updated = recordPotionUsedPure(session, cost, now());
    await sessions.put(updated);

    return updated;
  }

  /** Manual `Pause` button: sticky until resumeManual() or forceNewSession(). */
  async function pauseManual() {
    const current = await readCurrent();
    if (!current) return null;

    const paused = lockSession(pause(current, now()));
    await sessions.put(paused);

    return paused;
  }

  /** Manual `Resume` button: always resumes and clears the lock. */
  async function resumeManual() {
    const session = await getOrStartCurrent();
    const resumed = unlockSession(touchActivity(session, now()));

    await sessions.put(resumed);

    return resumed;
  }

  /**
   * Manual `End Hunt` button: ends and locks — no automatic signal may
   * replace this session until `forceNewSession()` (New Hunt). If nothing
   * was running yet, creates a session that is born already ended+locked,
   * so later activity still has a valid (frozen) sessionId to attach to
   * instead of silently starting a fresh Hunt.
   */
  async function endManual() {
    const current = await readCurrent();
    // End before the first observed encounter must insert the locked row and
    // its current pointer atomically, just like New Hunt/Reset.
    if (!current) return startNew({ startEnded: true });
    const ended = lockSession(endSession(current, now()));
    await sessions.put(ended);
    return ended;
  }

  async function recoverOnStartup() {
    const current = await readCurrent();
    if (!current) return null;

    const recovered = recoverFromRestart(current, now());

    if (recovered !== current) {
      await sessions.put(recovered);
    }

    return recovered;
  }

  /**
   * Records the serverSessionId/zoneId a combat.started confirmed
   * (domain/huntLifecycle.js "adopt"/"update_zone"). Never called while
   * `locked` — services/eventPipeline.js checks that before calling this.
   */
  async function adoptServerContext(context) {
    const session = await getOrStartCurrent();
    const updated = adoptServerContextPure(session, context, now());

    if (updated !== session) {
      await sessions.put(updated);
    }

    return updated;
  }

  /**
   * Manual override (`New Hunt`) or an automatic "new_hunt" boundary
   * decision (domain/huntLifecycle.js): always ends whatever session is
   * current and starts a fresh one, regardless of its state. The explicit
   * reset variant persists the new session already paused and locked.
   */
  async function forceNewSession({
    startPaused = false,
    activityKind = "hunt",
    activityInstanceId = null
  } = {}) {
    // The old session's end marker, new session, and current pointer must
    // commit together. A takeover mid-switch aborts all three writes.
    assertDatabaseWriteGate(db);
    return new Promise((resolve, reject) => {
      let transaction;
      let nextSession;
      let leadershipLost = false;
      try {
        transaction = db.transaction([STORE_NAMES.SESSIONS, STORE_NAMES.META], "readwrite");
        const sessionStore = transaction.objectStore(STORE_NAMES.SESSIONS);
        const metaStore = transaction.objectStore(STORE_NAMES.META);

        function checkOwnership() {
          if (!abortIfWriteGateLost(db, transaction)) return true;
          leadershipLost = true;
          return false;
        }

        const pointer = metaStore.get(CURRENT_SESSION_KEY);
        pointer.onsuccess = () => {
          if (!checkOwnership()) return;
          const currentId = pointer.result;
          if (!currentId) {
            scheduleSwitch(null);
            return;
          }
          const currentRequest = sessionStore.get(currentId);
          currentRequest.onsuccess = () => {
            if (!checkOwnership()) return;
            scheduleSwitch(currentRequest.result ?? null);
          };
        };

        function scheduleSwitch(current) {
          if (!checkOwnership()) return;
          const switchedAt = now();
          const runningSession = createSession({
            sessionId: crypto.randomUUID(),
            now: switchedAt,
            activityKind,
            activityInstanceId
          });
          nextSession = startPaused
            ? lockSession(pause(runningSession, switchedAt))
            : runningSession;

          if (current && current.status !== "ended") {
            sessionStore.put(endSession(current, switchedAt));
          }
          if (current?.activityKind === "expedition" && current.activityInstanceId) {
            metaStore.put(current.activityInstanceId, LAST_FINISHED_EXPEDITION_KEY);
          }
          sessionStore.put(nextSession);
          metaStore.put(nextSession.sessionId, CURRENT_SESSION_KEY);
          if (!checkOwnership()) return;
          // Every request is complete before the transaction commits; this
          // final check also runs on each request's success event below.
        }

        transaction.addEventListener("success", () => {
          checkOwnership();
        }, true);
        transaction.addEventListener("complete", () => resolve(nextSession));
        transaction.addEventListener("abort", () => reject(
          leadershipLost ? new WriteLeadershipLostError() : transaction.error ?? new Error("Hunt switch aborted")
        ));
      } catch (error) {
        try { transaction?.abort(); } catch {}
        reject(error);
      }
    });
  }

  /** Session type is independent from the server's Hunt session/zone IDs. */
  async function beginExpedition(runId) {
    const current = await readCurrent();
    if (current?.locked) return current;
    if (current?.activityKind === "expedition" && current.activityInstanceId === runId) {
      return current.status === "paused" ? touchActivityAutomatic() : current;
    }
    if (await meta.get(LAST_FINISHED_EXPEDITION_KEY) === runId) return current;

    return forceNewSession({ activityKind: "expedition", activityInstanceId: runId });
  }

  /** End only the matching run; a delayed finish must never end a later Hunt. */
  async function finishExpedition(runId) {
    assertDatabaseWriteGate(db);
    return new Promise((resolve, reject) => {
      let transaction;
      let leadershipLost = false;
      let result = null;
      try {
        transaction = db.transaction([STORE_NAMES.SESSIONS, STORE_NAMES.META], "readwrite");
        const sessionStore = transaction.objectStore(STORE_NAMES.SESSIONS);
        const metaStore = transaction.objectStore(STORE_NAMES.META);
        const checkOwnership = () => {
          if (!abortIfWriteGateLost(db, transaction)) return true;
          leadershipLost = true;
          return false;
        };
        const pointer = metaStore.get(CURRENT_SESSION_KEY);
        pointer.onsuccess = () => {
          if (!checkOwnership()) return;
          if (!pointer.result) {
            metaStore.put(runId, LAST_FINISHED_EXPEDITION_KEY);
            return;
          }
          const request = sessionStore.get(pointer.result);
          request.onsuccess = () => {
            if (!checkOwnership()) return;
            const current = request.result;
            result = current || null;
            if (current?.activityKind === "expedition" && current.activityInstanceId !== runId) {
              return; // Another run is already current; ignore stale completion.
            }
            metaStore.put(runId, LAST_FINISHED_EXPEDITION_KEY);
            if (current?.activityKind !== "expedition" || current.activityInstanceId !== runId) return;
            if (current.status === "ended") return;
            result = endSession(current, now());
            sessionStore.put(result);
          };
        };
        transaction.addEventListener("success", () => { checkOwnership(); }, true);
        transaction.addEventListener("complete", () => resolve(result));
        transaction.addEventListener("abort", () => reject(
          leadershipLost ? new WriteLeadershipLostError() : transaction.error ?? new Error("Expedition completion aborted")
        ));
      } catch (error) {
        try { transaction?.abort(); } catch {}
        reject(error);
      }
    });
  }

  /**
   * Read-only accessor for the Analyzer's Current view — unlike
   * getOrStartCurrent(), this NEVER creates a session as a side effect of
   * merely looking at it. Returns null if no Hunt has started yet.
   */
  function getCurrentReadOnly() {
    return readCurrent();
  }

  /**
   * Keyset-paginated History query (docs/DEVELOPMENT.md §6 "history and
   * filters") over the `startedAtMs` index (migration v2) — most recent
   * first, up to `limit` rows with `after <= startedAtMs < before`.
   * A page continuation also supplies `beforeSessionId` to include rows
   * with the boundary timestamp but strictly lower primary keys. The
   * startedAtMs index orders ties by sessionId (the store primary key), so
   * this avoids skipping sessions when several Hunts start in the same ms.
   * Without beforeSessionId the old exclusive timestamp/date-range contract
   * remains unchanged.
   */
  function getPage({
    limit = 20, before = Infinity, after = -Infinity, beforeSessionId = null
  } = {}) {
    return new Promise((resolve, reject) => {
      const store = db
        .transaction(STORE_NAMES.SESSIONS, "readonly")
        .objectStore(STORE_NAMES.SESSIONS);

      const hasCursor = Number.isFinite(before)
        && typeof beforeSessionId === "string" && beforeSessionId.length > 0;
      const range = IDBKeyRange.bound(after, before, false, !hasCursor);
      const request = store.index("startedAtMs").openCursor(range, "prev");
      const results = [];

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }

        if (hasCursor && cursor.key === before && cursor.primaryKey >= beforeSessionId) {
          cursor.continue();
          return;
        }
        results.push(cursor.value);
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes one session row and, if it was the current one, clears the
   * `meta` pointer too (the next real activity then starts a clean new
   * session instead of pointing at a deleted row). Does NOT delete the
   * session's encounters — callers must call
   * encountersRepository.deleteBySessionId(sessionId) themselves, and do
   * it FIRST: if a failure happens between the two calls, an orphaned
   * session row (safely re-deletable) is preferable to encounters
   * pointing at a sessionId that no longer exists.
   */
  async function deleteSession(sessionId) {
    assertDatabaseWriteGate(db);
    return new Promise((resolve, reject) => {
      let transaction;
      let leadershipLost = false;
      try {
        transaction = db.transaction([STORE_NAMES.SESSIONS, STORE_NAMES.META], "readwrite");
        const sessionsStore = transaction.objectStore(STORE_NAMES.SESSIONS);
        const metaStore = transaction.objectStore(STORE_NAMES.META);
        function checkOwnership() {
          if (!abortIfWriteGateLost(db, transaction)) return true;
          leadershipLost = true;
          return false;
        }
        const pointer = metaStore.get(CURRENT_SESSION_KEY);
        pointer.onsuccess = () => {
          if (!checkOwnership()) return;
          sessionsStore.delete(sessionId);
          if (pointer.result === sessionId) metaStore.delete(CURRENT_SESSION_KEY);
        };
        transaction.addEventListener("success", () => { checkOwnership(); }, true);
        transaction.addEventListener("complete", () => resolve());
        transaction.addEventListener("abort", () => reject(
          leadershipLost ? new WriteLeadershipLostError() : transaction.error ?? new Error("Hunt deletion aborted")
        ));
      } catch (error) {
        try { transaction?.abort(); } catch {}
        reject(error);
      }
    });
  }

  return {
    getOrStartCurrent,
    touchActivityAutomatic,
    pauseAutomatic,
    recordPotionUsed,
    pauseManual,
    resumeManual,
    endManual,
    recoverOnStartup,
    adoptServerContext,
    forceNewSession,
    beginExpedition,
    finishExpedition,
    getCurrentReadOnly,
    getPage,
    deleteSession
  };
}
