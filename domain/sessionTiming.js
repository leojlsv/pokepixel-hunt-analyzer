/**
 * Pure timing state machine for a `sessions` row
 * (docs/ARCHITECTURE.md §7 "Session timing").
 *
 * Authoritative active time is always timestamps + accumulated
 * milliseconds — never an incrementing UI counter:
 *
 *   active_ms = accumulatedActiveMs + (now - activeStartedAtMs), when running
 *
 * Every function here is pure (returns a new session object, never
 * mutates its input) so it can be tested without IndexedDB — persistence
 * is data/sessionsRepository.js's job.
 */

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

export function createSession({ sessionId, now }) {
  return {
    sessionId,
    status: "running",
    startedAtMs: now,
    endedAtMs: null,
    activeStartedAtMs: now,
    accumulatedActiveMs: 0,
    lastActivityAtMs: now,
    createdAtMs: now,
    updatedAtMs: now
  };
}

/**
 * Records that hunt activity was observed. If the session was paused (or
 * this is the very first activity), it also (re)starts the clock — this
 * is the persisted equivalent of the fallback resume behavior
 * `combat.started` / `loot.received` / `hunt.analyzer_reset` already have
 * today (docs/ARCHITECTURE.md §7 / README "Observação sobre pausa/retomada").
 */
export function touchActivity(session, now) {
  if (session.status !== "running") {
    return {
      ...session,
      status: "running",
      activeStartedAtMs: now,
      lastActivityAtMs: now,
      updatedAtMs: now
    };
  }

  return {
    ...session,
    lastActivityAtMs: now,
    updatedAtMs: now
  };
}

/** Folds the elapsed running time into accumulatedActiveMs and stops the clock. */
export function pause(session, now) {
  if (session.status !== "running") return session;

  const startedAt = session.activeStartedAtMs;
  const elapsed = isFiniteNumber(startedAt) ? Math.max(0, now - startedAt) : 0;

  return {
    ...session,
    status: "paused",
    accumulatedActiveMs: session.accumulatedActiveMs + elapsed,
    activeStartedAtMs: null,
    updatedAtMs: now
  };
}

/** Pauses (folding any running time) and marks the session ended. */
export function endSession(session, now) {
  const paused = pause(session, now);

  return {
    ...paused,
    status: "ended",
    endedAtMs: now,
    updatedAtMs: now
  };
}

/** Authoritative active time for display/metrics. Never an incrementing counter. */
export function activeMs(session, now) {
  let total = session.accumulatedActiveMs;

  if (session.status === "running" && isFiniteNumber(session.activeStartedAtMs)) {
    total += Math.max(0, now - session.activeStartedAtMs);
  }

  return total;
}

/**
 * Browser-restart recovery (docs/ARCHITECTURE.md §7): if the persisted
 * session still says "running" when the extension starts back up, time
 * elapsed while Edge/the browser was closed must NOT count as active.
 * Folds up to `lastActivityAtMs` only, then pauses; resumes on the next
 * real activity via touchActivity().
 */
export function recoverFromRestart(session, now) {
  if (session.status !== "running") return session;

  const activeStartedAtMs = isFiniteNumber(session.activeStartedAtMs)
    ? session.activeStartedAtMs
    : session.lastActivityAtMs;

  const lastActivityAtMs = isFiniteNumber(session.lastActivityAtMs)
    ? session.lastActivityAtMs
    : activeStartedAtMs;

  const elapsed = isFiniteNumber(activeStartedAtMs)
    ? Math.max(0, lastActivityAtMs - activeStartedAtMs)
    : 0;

  return {
    ...session,
    status: "paused",
    accumulatedActiveMs: session.accumulatedActiveMs + elapsed,
    activeStartedAtMs: null,
    updatedAtMs: now
  };
}
