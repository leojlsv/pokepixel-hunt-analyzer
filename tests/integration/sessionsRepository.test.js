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
});

test("getOrStartCurrent returns the same session on subsequent calls", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db, { now: fakeClock(1000).now });

  const first = await repo.getOrStartCurrent();
  const second = await repo.getOrStartCurrent();

  assert.equal(first.sessionId, second.sessionId);
});

test("touchActivityOnCurrent resumes a paused session and pauseCurrent folds elapsed time", async () => {
  const db = await setup();
  const clock = fakeClock(0);
  const repo = createSessionsRepository(db, { now: clock.now });

  await repo.getOrStartCurrent(); // creates, running, startedAtMs=0
  clock.advance(5000);
  const paused = await repo.pauseCurrent();

  assert.equal(paused.status, "paused");
  assert.equal(paused.accumulatedActiveMs, 5000);

  clock.advance(2000); // browser-open idle time before resuming
  const resumed = await repo.touchActivityOnCurrent();

  assert.equal(resumed.status, "running");
  assert.equal(resumed.activeStartedAtMs, 7000);
  assert.equal(resumed.accumulatedActiveMs, 5000);
});

test("a session marked ended is replaced by a new one on the next getOrStartCurrent", async () => {
  const db = await setup();
  const clock = fakeClock(0);
  const repo = createSessionsRepository(db, { now: clock.now });

  const first = await repo.getOrStartCurrent();

  // Simulate Phase 3's future "New Hunt" ending the session directly via
  // the store (sessionsRepository itself doesn't expose end() yet).
  const raw = createRepository(db, STORE_NAMES.SESSIONS);
  await raw.put({ ...first, status: "ended", endedAtMs: 999 });

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
  const paused = await repo.pauseCurrent();

  const recovered = await repo.recoverOnStartup();
  assert.deepEqual(recovered, paused);
  assert.notEqual(recovered.status, "running");
  void session;
});
