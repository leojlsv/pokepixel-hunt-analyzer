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
