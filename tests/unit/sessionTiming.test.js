import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createSession,
  touchActivity,
  pause,
  endSession,
  activeMs,
  recoverFromRestart,
  adoptServerContext,
  lockSession,
  unlockSession
} from "../../domain/sessionTiming.js";

test("createSession starts with no server context adopted yet", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });

  assert.equal(session.serverSessionId, null);
  assert.equal(session.zoneId, null);
});

test("createSession starts unlocked", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });
  assert.equal(session.locked, false);
});

test("lockSession/unlockSession only toggle the flag", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });

  const locked = lockSession(session);
  assert.equal(locked.locked, true);
  assert.equal(locked.status, session.status);

  const unlocked = unlockSession(locked);
  assert.equal(unlocked.locked, false);
});

test("adoptServerContext records serverSessionId/zoneId without touching timing", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });

  const adopted = adoptServerContext(
    session,
    { serverSessionId: "server_session_0001", zoneId: "zone_0001" },
    2000
  );

  assert.equal(adopted.serverSessionId, "server_session_0001");
  assert.equal(adopted.zoneId, "zone_0001");
  assert.equal(adopted.updatedAtMs, 2000);
  assert.equal(adopted.status, "running");
  assert.equal(adopted.activeStartedAtMs, session.activeStartedAtMs);
});

test("adoptServerContext only updates the zoneId (update_zone case)", () => {
  const session = adoptServerContext(
    createSession({ sessionId: "s1", now: 1000 }),
    { serverSessionId: "server_session_0001", zoneId: "zone_0001" },
    1000
  );

  const updated = adoptServerContext(
    session,
    { serverSessionId: null, zoneId: "zone_0002" },
    3000
  );

  assert.equal(updated.serverSessionId, "server_session_0001");
  assert.equal(updated.zoneId, "zone_0002");
});

test("createSession starts running with zero accumulated time", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });

  assert.equal(session.status, "running");
  assert.equal(session.accumulatedActiveMs, 0);
  assert.equal(session.activeStartedAtMs, 1000);
  assert.equal(activeMs(session, 1000), 0);
});

test("activeMs grows with elapsed time while running", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });
  assert.equal(activeMs(session, 5000), 4000);
});

test("pause folds elapsed running time into accumulatedActiveMs and stops the clock", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });
  const paused = pause(session, 6000);

  assert.equal(paused.status, "paused");
  assert.equal(paused.accumulatedActiveMs, 5000);
  assert.equal(paused.activeStartedAtMs, null);
  // Time frozen after pausing.
  assert.equal(activeMs(paused, 999999), 5000);
});

test("pause on an already-paused session is a no-op", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });
  const pausedOnce = pause(session, 2000);
  const pausedTwice = pause(pausedOnce, 9000);

  assert.deepEqual(pausedOnce, pausedTwice);
});

test("touchActivity resumes a paused session and restarts the clock from now", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });
  const paused = pause(session, 2000); // accumulated 1000ms

  const resumed = touchActivity(paused, 10000);

  assert.equal(resumed.status, "running");
  assert.equal(resumed.activeStartedAtMs, 10000);
  assert.equal(activeMs(resumed, 12000), 1000 + 2000);
});

test("touchActivity while already running only updates lastActivityAtMs", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });
  const touched = touchActivity(session, 3000);

  assert.equal(touched.status, "running");
  assert.equal(touched.activeStartedAtMs, 1000); // unchanged
  assert.equal(touched.lastActivityAtMs, 3000);
});

test("endSession folds running time and marks the session ended", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });
  const ended = endSession(session, 4000);

  assert.equal(ended.status, "ended");
  assert.equal(ended.endedAtMs, 4000);
  assert.equal(ended.accumulatedActiveMs, 3000);
  assert.equal(activeMs(ended, 999999), 3000);
});

test("recoverFromRestart pauses a session left 'running' and does not count browser-closed time", () => {
  // Browser closed at ts=5000 without a clean pause; lastActivityAtMs
  // captures the last moment we know activity happened. Service worker
  // restarts much later at now=999999 (e.g. next day).
  const session = {
    ...createSession({ sessionId: "s1", now: 1000 }),
    lastActivityAtMs: 5000
  };

  const recovered = recoverFromRestart(session, 999999);

  assert.equal(recovered.status, "paused");
  // Only the 1000 -> 5000 window counts, not up to the restart time.
  assert.equal(recovered.accumulatedActiveMs, 4000);
  assert.equal(recovered.activeStartedAtMs, null);
});

test("recoverFromRestart is a no-op for an already paused/ended session", () => {
  const session = createSession({ sessionId: "s1", now: 1000 });
  const paused = pause(session, 2000);

  assert.deepEqual(recoverFromRestart(paused, 999999), paused);
});
