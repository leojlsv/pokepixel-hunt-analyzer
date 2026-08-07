/**
 * `sessions` store repository (docs/ARCHITECTURE.md §4/§7).
 *
 * Tracks "the current local Hunt session" via a pointer
 * (`currentSessionId`) in the `meta` store — there is no "New Hunt" UI yet
 * (Phase 3), so Phase 2 keeps reusing one implicit session until it's
 * marked `ended`, mirroring the single-implicit-session behavior
 * `background.js`'s legacy counter already has today.
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
  recoverFromRestart
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

  async function getOrStartCurrent() {
    const current = await readCurrent();

    if (!current || current.status === "ended") {
      return startNew();
    }

    return current;
  }

  async function touchActivityOnCurrent() {
    const session = await getOrStartCurrent();
    const touched = touchActivity(session, now());

    if (touched !== session) {
      await sessions.put(touched);
    }

    return touched;
  }

  async function pauseCurrent() {
    const current = await readCurrent();
    if (!current) return null;

    const paused = pause(current, now());

    if (paused !== current) {
      await sessions.put(paused);
    }

    return paused;
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

  return {
    getOrStartCurrent,
    touchActivityOnCurrent,
    pauseCurrent,
    recoverOnStartup
  };
}
