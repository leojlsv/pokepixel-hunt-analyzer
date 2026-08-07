import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase, STORE_NAMES } from "../../data/db.js";
import { createRepository } from "../../data/repository.js";
import { createSessionsRepository } from "../../data/sessionsRepository.js";

async function setup() {
  return openDatabase({ indexedDBFactory: new IDBFactory() });
}

function fakeClock(start = 0) {
  let value = start;
  return {
    now: () => value,
    advance(ms) {
      value += ms;
      return value;
    }
  };
}

test("getOrStartCurrent creates a session when none exists", async () => {
  const db = await setup();
  const clock = fakeClock(1000);
  const repo = createSessionsRepository(db, { now: clock.now });

  const session = await repo.getOrStartCurrent();

  assert.equal(session.status, "running");
  assert.equal(session.startedAtMs, 1000);
  assert.equal(session.locked, false);
});

test("getOrStartCurrent returns the same session on subsequent calls", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db, { now: fakeClock(1000).now });

  const first = await repo.getOrStartCurrent();
  const second = await repo.getOrStartCurrent();

  assert.equal(first.sessionId, second.sessionId);
});

test("touchActivityAutomatic resumes a paused session and pauseAutomatic folds elapsed time", async () => {
  const db = await setup();
  const clock = fakeClock(0);
  const repo = createSessionsRepository(db, { now: clock.now });

  await repo.getOrStartCurrent(); // creates, running, startedAtMs=0
  clock.advance(5000);
  const paused = await repo.pauseAutomatic();

  assert.equal(paused.status, "paused");
  assert.equal(paused.accumulatedActiveMs, 5000);
  assert.equal(paused.locked, false); // automatic pause never locks

  clock.advance(2000); // browser-open idle time before resuming
  const resumed = await repo.touchActivityAutomatic();

  assert.equal(resumed.status, "running");
  assert.equal(resumed.activeStartedAtMs, 7000);
  assert.equal(resumed.accumulatedActiveMs, 5000);
});

test("a session marked ended (and not locked) is replaced by a new one on the next getOrStartCurrent", async () => {
  const db = await setup();
  const clock = fakeClock(0);
  const repo = createSessionsRepository(db, { now: clock.now });

  const first = await repo.getOrStartCurrent();

  // Simulate a session ended directly via the store, unlocked.
  const raw = createRepository(db, STORE_NAMES.SESSIONS);
  await raw.put({ ...first, status: "ended", endedAtMs: 999, locked: false });

  const second = await repo.getOrStartCurrent();

  assert.notEqual(second.sessionId, first.sessionId);
  assert.equal(second.status, "running");
});

test("recoverOnStartup pauses a 'running' session and folds only up to lastActivityAtMs", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db, { now: () => 999999 });

  // Manually seed a session left "running" from a previous browser session
  // (as if the service worker had just been created fresh at startup).
  const raw = createRepository(db, STORE_NAMES.SESSIONS);
  const meta = createRepository(db, STORE_NAMES.META);

  const seed = {
    sessionId: "seed-1",
    status: "running",
    startedAtMs: 0,
    endedAtMs: null,
    activeStartedAtMs: 1000,
    accumulatedActiveMs: 2000,
    lastActivityAtMs: 4000,
    createdAtMs: 0,
    updatedAtMs: 4000
  };
  await raw.put(seed);
  await meta.put("seed-1", "currentSessionId");

  const recovered = await repo.recoverOnStartup();

  assert.equal(recovered.status, "paused");
  // 4000 - 1000 = 3000 folded in, NOT (999999 - 1000).
  assert.equal(recovered.accumulatedActiveMs, 5000);
  assert.equal(recovered.activeStartedAtMs, null);
});

test("recoverOnStartup does not disturb a session that is already paused/ended", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db, { now: () => 50000 });

  const session = await repo.getOrStartCurrent();
  const paused = await repo.pauseAutomatic();

  const recovered = await repo.recoverOnStartup();
  assert.deepEqual(recovered, paused);
  assert.notEqual(recovered.status, "running");
  void session;
});

test("getCurrentReadOnly never creates a session as a side effect", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db, { now: () => 0 });

  assert.equal(await repo.getCurrentReadOnly(), null);

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(sessions.length, 0);
});

test("adoptServerContext records serverSessionId/zoneId on the current session", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db, { now: () => 1000 });

  const adopted = await repo.adoptServerContext({
    serverSessionId: "server_session_0001",
    zoneId: "zone_0001"
  });

  assert.equal(adopted.serverSessionId, "server_session_0001");
  assert.equal(adopted.zoneId, "zone_0001");

  const persisted = await repo.getCurrentReadOnly();
  assert.equal(persisted.serverSessionId, "server_session_0001");
});

test("forceNewSession always ends the current session and starts a fresh, unlocked one", async () => {
  const db = await setup();
  const clock = fakeClock(0);
  const repo = createSessionsRepository(db, { now: clock.now });

  const first = await repo.getOrStartCurrent();
  await repo.adoptServerContext({
    serverSessionId: "server_session_0001",
    zoneId: "zone_0001"
  });
  clock.advance(1000);

  const second = await repo.forceNewSession();

  assert.notEqual(second.sessionId, first.sessionId);
  assert.equal(second.status, "running");
  assert.equal(second.locked, false);
  // The new session starts with no adopted server context.
  assert.equal(second.serverSessionId, null);

  const oldRow = await createRepository(db, STORE_NAMES.SESSIONS).get(first.sessionId);
  assert.equal(oldRow.status, "ended");
  assert.equal(oldRow.accumulatedActiveMs, 1000);
});

// --- Manual Pause/Resume/End Hunt vs. the automatic lifecycle ---

test("pauseManual locks the session; touchActivityAutomatic does not resume it", async () => {
  const db = await setup();
  const clock = fakeClock(0);
  const repo = createSessionsRepository(db, { now: clock.now });

  await repo.getOrStartCurrent();
  clock.advance(3000);

  const paused = await repo.pauseManual();
  assert.equal(paused.status, "paused");
  assert.equal(paused.locked, true);

  clock.advance(10000); // real game activity keeps happening in the background
  const stillPaused = await repo.touchActivityAutomatic();

  assert.equal(stillPaused.status, "paused");
  assert.equal(stillPaused.locked, true);
  assert.equal(stillPaused.accumulatedActiveMs, 3000); // clock did not resume
});

test("pauseAutomatic never touches an already manually-locked session", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db, { now: () => 0 });

  await repo.getOrStartCurrent();
  const manuallyPaused = await repo.pauseManual();

  const result = await repo.pauseAutomatic();
  assert.deepEqual(result, manuallyPaused);
});

test("resumeManual resumes and clears the lock regardless of how it was set", async () => {
  const db = await setup();
  const clock = fakeClock(0);
  const repo = createSessionsRepository(db, { now: clock.now });

  await repo.getOrStartCurrent();
  clock.advance(2000);
  await repo.pauseManual();

  clock.advance(5000); // time paused, not counted
  const resumed = await repo.resumeManual();

  assert.equal(resumed.status, "running");
  assert.equal(resumed.locked, false);
  assert.equal(resumed.accumulatedActiveMs, 2000);

  // A subsequent automatic activity signal behaves normally again.
  clock.advance(1000);
  const touched = await repo.touchActivityAutomatic();
  assert.equal(touched.status, "running");
});

test("endManual locks the session; getOrStartCurrent does not replace it", async () => {
  const db = await setup();
  const clock = fakeClock(0);
  const repo = createSessionsRepository(db, { now: clock.now });

  const first = await repo.getOrStartCurrent();
  clock.advance(4000);

  const ended = await repo.endManual();
  assert.equal(ended.status, "ended");
  assert.equal(ended.locked, true);
  assert.equal(ended.accumulatedActiveMs, 4000);

  // Simulated real game activity keeps calling getOrStartCurrent/touch —
  // it must keep landing on the same (frozen) session, not a fresh one.
  const stillCurrent = await repo.getOrStartCurrent();
  assert.equal(stillCurrent.sessionId, first.sessionId);
  assert.equal(stillCurrent.status, "ended");

  const touched = await repo.touchActivityAutomatic();
  assert.equal(touched.sessionId, first.sessionId);
  assert.equal(touched.status, "ended"); // still frozen, no-op
});

test("endManual with no session yet creates one already ended and locked", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db, { now: () => 1000 });

  const ended = await repo.endManual();

  assert.equal(ended.status, "ended");
  assert.equal(ended.locked, true);
  assert.equal(ended.accumulatedActiveMs, 0);

  const persisted = await repo.getCurrentReadOnly();
  assert.equal(persisted.sessionId, ended.sessionId);

  // Later activity attaches to this same frozen session, no new one appears.
  const stillCurrent = await repo.getOrStartCurrent();
  assert.equal(stillCurrent.sessionId, ended.sessionId);
});

test("forceNewSession (New Hunt) always clears a manual lock, even right after End Hunt", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db, { now: () => 0 });

  const ended = await repo.endManual();
  const fresh = await repo.forceNewSession();

  assert.notEqual(fresh.sessionId, ended.sessionId);
  assert.equal(fresh.status, "running");
  assert.equal(fresh.locked, false);
});
