import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory, IDBCursor, IDBObjectStore } from "fake-indexeddb";
import { openDatabase, STORE_NAMES } from "../../data/db.js";
import { createRepository } from "../../data/repository.js";
import { createSessionsRepository } from "../../data/sessionsRepository.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { createEventPipeline } from "../../services/eventPipeline.js";
import { registerDatabaseWriteGate, WriteLeadershipLostError } from "../../data/write-gate.js";

async function setup() {
  return openDatabase({ indexedDBFactory: new IDBFactory() });
}

test("registered gate rejects writes after handoff but allows read-only access", async () => {
  const db = await setup();
  const repo = createRepository(db, STORE_NAMES.SESSIONS);
  let owner = true;
  registerDatabaseWriteGate(db, () => owner);
  await repo.put({ sessionId: "retained", status: "paused" });

  owner = false;
  await assert.rejects(repo.put({ sessionId: "forbidden" }), WriteLeadershipLostError);
  await assert.rejects(repo.delete("retained"), WriteLeadershipLostError);
  assert.equal((await repo.get("retained")).status, "paused");
  assert.equal(await repo.get("forbidden"), undefined);
  db.close();
});

test("gate aborts an already-issued write request if ownership changes before IDB success", async () => {
  const db = await setup();
  const repo = createRepository(db, STORE_NAMES.SESSIONS);
  let owner = true;
  registerDatabaseWriteGate(db, () => owner);

  const pending = repo.put({ sessionId: "in-flight" });
  owner = false;
  await assert.rejects(pending, WriteLeadershipLostError);
  assert.equal(await repo.get("in-flight"), undefined);
  db.close();
});

test("creating a new Hunt cannot leave a session without its current pointer", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db);
  let owner = true;
  registerDatabaseWriteGate(db, () => owner);

  const originalPut = IDBObjectStore.prototype.put;
  let triggered = false;
  try {
    IDBObjectStore.prototype.put = function (value, ...args) {
      const request = originalPut.call(this, value, ...args);
      if (!triggered && this.name === STORE_NAMES.SESSIONS) {
        triggered = true;
        owner = false;
      }
      return request;
    };
    await assert.rejects(repo.getOrStartCurrent(), WriteLeadershipLostError);
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }

  assert.equal(triggered, true);
  assert.equal(await repo.getCurrentReadOnly(), null);
  assert.deepEqual(await createRepository(db, STORE_NAMES.SESSIONS).getAll(), []);
  owner = true;
  assert.equal((await repo.getOrStartCurrent()).status, "running");
  db.close();
});

test("ending before the first Hunt also commits its locked row and pointer together", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db);
  let owner = true;
  registerDatabaseWriteGate(db, () => owner);
  const originalPut = IDBObjectStore.prototype.put;
  let triggered = false;
  try {
    IDBObjectStore.prototype.put = function (value, ...args) {
      const request = originalPut.call(this, value, ...args);
      if (!triggered && this.name === STORE_NAMES.SESSIONS) {
        triggered = true;
        owner = false;
      }
      return request;
    };
    await assert.rejects(repo.endManual(), WriteLeadershipLostError);
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }
  assert.equal(triggered, true);
  assert.equal(await repo.getCurrentReadOnly(), null);
  assert.deepEqual(await createRepository(db, STORE_NAMES.SESSIONS).getAll(), []);
  owner = true;
  const ended = await repo.endManual();
  assert.equal(ended.status, "ended");
  assert.equal(ended.locked, true);
  assert.equal((await repo.getCurrentReadOnly()).sessionId, ended.sessionId);
  db.close();
});

test("a session switch is atomic when leadership is lost after its first queued put", async () => {
  const db = await setup();
  const repo = createSessionsRepository(db, { now: () => 1_000 });
  const original = await repo.getOrStartCurrent();
  let owner = true;
  registerDatabaseWriteGate(db, () => owner);

  const priorPut = IDBObjectStore.prototype.put;
  let triggered = false;
  try {
    IDBObjectStore.prototype.put = function (value, ...args) {
      const request = priorPut.call(this, value, ...args);
      if (!triggered && this.name === STORE_NAMES.SESSIONS &&
          value?.sessionId === original.sessionId && value?.status === "ended") {
        triggered = true;
        owner = false;
      }
      return request;
    };
    await assert.rejects(repo.forceNewSession({ startPaused: true }), WriteLeadershipLostError);
  } finally {
    IDBObjectStore.prototype.put = priorPut;
  }

  assert.equal(triggered, true, "test must force the takeover mid-switch");
  assert.equal((await repo.getCurrentReadOnly()).sessionId, original.sessionId);
  assert.equal((await repo.getCurrentReadOnly()).status, "running");
  assert.equal((await createRepository(db, STORE_NAMES.SESSIONS).getAll()).length, 1);
  db.close();
});

test("guarded encounter bulk delete rolls back when leadership changes mid-cursor", async () => {
  const db = await setup();
  const repo = createRepository(db, STORE_NAMES.ENCOUNTERS);
  await repo.put({ encounterId: "x", sessionId: "hunt" });
  await repo.put({ encounterId: "y", sessionId: "hunt" });
  let owner = true;
  registerDatabaseWriteGate(db, () => owner);

  const priorDelete = IDBCursor.prototype.delete;
  let triggered = false;
  try {
    IDBCursor.prototype.delete = function (...args) {
      const request = priorDelete.apply(this, args);
      if (!triggered) {
        triggered = true;
        owner = false;
      }
      return request;
    };
    await assert.rejects(createEncountersRepository(db).deleteBySessionId("hunt"), WriteLeadershipLostError);
  } finally {
    IDBCursor.prototype.delete = priorDelete;
  }
  assert.equal(triggered, true, "test must change ownership after the first cursor delete was queued");
  assert.equal((await repo.getAll()).length, 2);
  db.close();
});

test("deleting the current session rolls back the row and pointer together on takeover", async () => {
  const db = await setup();
  const sessions = createSessionsRepository(db);
  const original = await sessions.getOrStartCurrent();
  let owner = true;
  registerDatabaseWriteGate(db, () => owner);

  const originalDelete = IDBObjectStore.prototype.delete;
  let triggered = false;
  try {
    IDBObjectStore.prototype.delete = function (...args) {
      const request = originalDelete.apply(this, args);
      if (!triggered && this.name === STORE_NAMES.SESSIONS) {
        triggered = true;
        owner = false;
      }
      return request;
    };
    await assert.rejects(sessions.deleteSession(original.sessionId), WriteLeadershipLostError);
  } finally {
    IDBObjectStore.prototype.delete = originalDelete;
  }

  assert.equal(triggered, true);
  assert.equal((await sessions.getCurrentReadOnly()).sessionId, original.sessionId);
  assert.equal((await createRepository(db, STORE_NAMES.SESSIONS).getAll()).length, 1);
  db.close();
});

test("pipeline aborts an in-flight event and can retry it after leadership returns", async () => {
  const db = await setup();
  const pipeline = createEventPipeline(db, { now: () => 1000 });
  let owner = true;
  registerDatabaseWriteGate(db, () => owner);
  const event = {
    type: "combat.started",
    seq: 1,
    ts: 1000,
    socketId: 1,
    data: {
      enemy: {
        id: "wild-1",
        species_id: "chansey",
        level: 5,
        quality: "common",
        zone_id: "route-1"
      },
      session: { id: "server-hunt" }
    }
  };
  const originalPut = IDBObjectStore.prototype.put;
  let triggered = false;
  try {
    IDBObjectStore.prototype.put = function (value, ...args) {
      const request = originalPut.call(this, value, ...args);
      if (!triggered && this.name === STORE_NAMES.SESSIONS) {
        triggered = true;
        owner = false;
      }
      return request;
    };
    await assert.rejects(pipeline.handle(event), WriteLeadershipLostError);
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }

  assert.equal(triggered, true);
  assert.deepEqual(await createRepository(db, STORE_NAMES.SESSIONS).getAll(), []);
  assert.deepEqual(await createRepository(db, STORE_NAMES.ENCOUNTERS).getAll(), []);
  owner = true;
  const retried = await pipeline.handle(event);
  assert.equal(retried.ok, true);
  assert.equal(retried.duplicate, undefined);
  assert.equal((await createRepository(db, STORE_NAMES.SESSIONS).getAll()).length, 1);
  assert.equal((await createRepository(db, STORE_NAMES.ENCOUNTERS).getAll()).length, 1);
  db.close();
});
