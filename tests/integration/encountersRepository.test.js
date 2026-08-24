import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase } from "../../data/db.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";

async function setup() {
  return openDatabase({ indexedDBFactory: new IDBFactory() });
}

test("create persists a row and get reads it back", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  const row = { encounterId: "e1", state: "started", speciesId: "chansey" };
  await repo.create(row);

  const found = await repo.get("e1");
  assert.deepEqual(found, row);
  db.close();
});

test("update merges a patch over the existing row", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await repo.create({ encounterId: "e1", state: "started", lootAtMs: null });
  const updated = await repo.update("e1", { state: "looted", lootAtMs: 1234 });

  assert.equal(updated.state, "looted");
  assert.equal(updated.lootAtMs, 1234);

  const found = await repo.get("e1");
  assert.deepEqual(found, updated);
  db.close();
});

test("update throws for an unknown encounterId", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await assert.rejects(() => repo.update("does-not-exist", { state: "failed" }));
  db.close();
});

test("getAll lists every persisted encounter", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await repo.create({ encounterId: "e1", state: "started" });
  await repo.create({ encounterId: "e2", state: "orphan" });

  const all = await repo.getAll();
  assert.equal(all.length, 2);
  db.close();
});

test("getBySessionId returns only encounters for that session", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await repo.create({ encounterId: "e1", sessionId: "s1", state: "started" });
  await repo.create({ encounterId: "e2", sessionId: "s1", state: "success" });
  await repo.create({ encounterId: "e3", sessionId: "s2", state: "started" });

  const forS1 = await repo.getBySessionId("s1");
  assert.equal(forS1.length, 2);
  assert.deepEqual(
    forS1.map((row) => row.encounterId).sort(),
    ["e1", "e2"]
  );

  const forUnknown = await repo.getBySessionId("does-not-exist");
  assert.equal(forUnknown.length, 0);
  db.close();
});

test("getRecentSuccessfulCaptures returns newest successes only and respects limit", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await repo.create({
    encounterId: "success-old",
    captureResult: "success",
    captureAtMs: 100,
    state: "success"
  });
  await repo.create({
    encounterId: "failed-new",
    captureResult: "failed",
    captureAtMs: 500,
    state: "failed"
  });
  await repo.create({
    encounterId: "success-mid",
    captureResult: "success",
    captureAtMs: 300,
    state: "success"
  });
  await repo.create({
    encounterId: "success-new",
    captureResult: "success",
    captureAtMs: 700,
    state: "success"
  });

  const recent = await repo.getRecentSuccessfulCaptures(2);

  assert.deepEqual(
    recent.map((row) => row.encounterId),
    ["success-new", "success-mid"]
  );
  db.close();
});

test("getRecentSuccessfulCaptures is bounded even when more successes exist", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  for (let index = 0; index < 12; index += 1) {
    await repo.create({
      encounterId: `success-${index}`,
      captureResult: "success",
      captureAtMs: index + 1,
      state: "success"
    });
  }

  const recent = await repo.getRecentSuccessfulCaptures(5);
  assert.equal(recent.length, 5);
  assert.deepEqual(
    recent.map((row) => row.captureAtMs),
    [12, 11, 10, 9, 8]
  );
  db.close();
});

test("getRecentSuccessfulCaptures rejects invalid limits", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await assert.rejects(() => repo.getRecentSuccessfulCaptures(0), /limit must be >= 1/);
  db.close();
});

test("deleteBySessionId removes only that session's encounters", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await repo.create({ encounterId: "e1", sessionId: "s1", state: "started" });
  await repo.create({ encounterId: "e2", sessionId: "s1", state: "success" });
  await repo.create({ encounterId: "e3", sessionId: "s2", state: "started" });

  await repo.deleteBySessionId("s1");

  assert.equal((await repo.getBySessionId("s1")).length, 0);
  assert.equal((await repo.getBySessionId("s2")).length, 1);
  assert.equal((await repo.getAll()).length, 1);
  db.close();
});

test("deleteBySessionId on a session with no encounters is a safe no-op", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await repo.create({ encounterId: "e1", sessionId: "s1", state: "started" });

  await repo.deleteBySessionId("does-not-exist");

  assert.equal((await repo.getAll()).length, 1);
  db.close();
});
