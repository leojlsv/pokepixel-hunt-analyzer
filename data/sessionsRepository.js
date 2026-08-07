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
 * or "manual" (driven by the Side Panel's New Hunt/Pause/Resume/End Hunt
 * buttons, via background.js). Automatic methods respect `locked`
 * (domain/sessionTiming.js) and no-op while it's set; manual methods are
 * the only ones that set or clear it. This is what keeps a manual
 * Pause/End Hunt from being silently undone by the next `combat.started`.
 *
 * `recoverOnStartup` must be called exactly once from
 * `chrome.runtime.onStartup` (a real browser restart) — never from the
 * per-event path. MV3 suspends/wakes the service worker constantly during
 * normal use; applying the browser-restart recovery formula on every wake
 * would incorrectly zero out the active-time baseline on every message.
 */

import { createRepository } from "./repository.js";
import { STORE_NAMES } from "./migrations.js";
import {
  createSession,
  touchActivity,
  pause,
  endSession,
  recoverFromRestart,
  adoptServerContext as adoptServerContextPure,
  lockSession,
  unlockSession
} from "../domain/sessionTiming.js";

const CURRENT_SESSION_KEY = "currentSessionId";

export function createSessionsRepository(db, { now = Date.now } = {}) {
  const sessions = createRepository(db, STORE_NAMES.SESSIONS);
  const meta = createRepository(db, STORE_NAMES.META);

  async function readCurrent() {
    const currentSessionId = await meta.get(CURRENT_SESSION_KEY);
    if (!currentSessionId) return null;

    const session = await sessions.get(currentSessionId);
    return session ?? null;
  }

  async function startNew() {
    const session = createSession({
      sessionId: crypto.randomUUID(),
      now: now()
    });

    await sessions.put(session);
    await meta.put(session.sessionId, CURRENT_SESSION_KEY);

    return session;
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
    const base = current ?? createSession({ sessionId: crypto.randomUUID(), now: now() });

    const ended = lockSession(endSession(base, now()));
    await sessions.put(ended);

    if (!current) {
      await meta.put(ended.sessionId, CURRENT_SESSION_KEY);
    }

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
   * current and starts a fresh, unlocked one, regardless of its state.
   */
  async function forceNewSession() {
    const current = await readCurrent();

    if (current && current.status !== "ended") {
      await sessions.put(endSession(current, now()));
    }

    return startNew();
  }

  /**
   * Read-only accessor for the Side Panel's Current view — unlike
   * getOrStartCurrent(), this NEVER creates a session as a side effect of
   * merely looking at it. Returns null if no Hunt has started yet.
   */
  function getCurrentReadOnly() {
    return readCurrent();
  }

  return {
    getOrStartCurrent,
    touchActivityAutomatic,
    pauseAutomatic,
    pauseManual,
    resumeManual,
    endManual,
    recoverOnStartup,
    adoptServerContext,
    forceNewSession,
    getCurrentReadOnly
  };
}
