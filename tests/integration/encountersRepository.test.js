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
});

test("update throws for an unknown encounterId", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await assert.rejects(() => repo.update("does-not-exist", { state: "failed" }));
});

test("getAll lists every persisted encounter", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await repo.create({ encounterId: "e1", state: "started" });
  await repo.create({ encounterId: "e2", state: "orphan" });

  const all = await repo.getAll();
  assert.equal(all.length, 2);
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
});

test("deleteBySessionId on a session with no encounters is a safe no-op", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await repo.create({ encounterId: "e1", sessionId: "s1", state: "started" });

  await repo.deleteBySessionId("does-not-exist");

  assert.equal((await repo.getAll()).length, 1);
});
