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

test("create rejects an encounter ID collision without replacing the original row", async () => {
  const db = await setup();
  try {
    const repo = createEncountersRepository(db);
    const first = { encounterId: "same-id", sessionId: "session-a", gold: 15 };
    await repo.create(first);
    await assert.rejects(repo.create({ encounterId: "same-id", sessionId: "session-b", gold: 999 }),
      (error) => error?.name === "ConstraintError");
    assert.deepEqual(await repo.get("same-id"), first);
  } finally { db.close(); }
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

test("updateWithPrevious returns committed before/after images from one transaction", async () => {
  const db = await setup();
  try {
    const repo = createEncountersRepository(db);
    const before = { encounterId: "e1", sessionId: "hunt", gold: 12, lootAtMs: null };
    await repo.create(before);
    const originalTransaction = db.transaction.bind(db);
    let updates = 0;
    db.transaction = (...args) => {
      if (Array.isArray(args[0]) && args[0].includes("encounters") &&
        args[0].includes("meta") && args[1] === "readwrite") updates += 1;
      return originalTransaction(...args);
    };
    const transition = await repo.updateWithPrevious("e1", { gold: 25, lootAtMs: 100 }, {
      finish: (row) => ({ ...row, captureTicketAtMs: row.lootAtMs })
    });
    assert.equal(updates, 1, "read and replacement must share one transaction");
    assert.deepEqual(transition.before, before);
    assert.deepEqual(transition.after, { ...before, gold: 25, lootAtMs: 100, captureTicketAtMs: 100 });
    assert.deepEqual(await repo.get("e1"), transition.after);
    const second = await repo.updateWithPrevious("e1", { gold: 32 });
    assert.deepEqual(second.before, transition.after);
    assert.equal(second.after.gold, 32);
  } finally { db.close(); }
});

test("concurrent committed encounter corrections do not lose independent patches", async () => {
  const db = await setup();
  try {
    const repo = createEncountersRepository(db);
    const original = { encounterId: "same", sessionId: "hunt", gold: 1, lootSellValue: 2 };
    await repo.create(original);
    const [gold, loot] = await Promise.all([
      repo.updateWithPrevious("same", { gold: 40 }),
      repo.updateWithPrevious("same", { lootSellValue: 70 })
    ]);
    const stored = await repo.get("same");
    assert.equal(stored.gold, 40);
    assert.equal(stored.lootSellValue, 70);
    assert.deepEqual(gold.before, original);
    assert.deepEqual(loot.before, gold.after,
      "the second read must observe the first committed transaction");
    assert.deepEqual(loot.after, stored);
  } finally { db.close(); }
});

test("updateWithPrevious rejects invalid derivations without changing persisted data", async () => {
  const db = await setup();
  try {
    const repo = createEncountersRepository(db);
    const original = { encounterId: "e1", gold: 10 };
    await repo.create(original);
    await assert.rejects(repo.updateWithPrevious("e1", { gold: 999 }, {
      finish: () => ({ encounterId: "other", gold: 999 })
    }), /invalid final encounter identity/);
    assert.deepEqual(await repo.get("e1"), original);
    await assert.rejects(repo.updateWithPrevious("missing", { gold: 20 }), /unknown encounterId/);
    await assert.rejects(repo.updateWithPrevious("e1", { sessionId: "other" }), /identity\/session/);
    assert.equal(await repo.get("missing"), undefined);
    assert.deepEqual(await repo.get("e1"), original);
  } finally { db.close(); }
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

test("getRecentCaptureTickets returns newest indexed tickets only and respects limit", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await repo.create({
    encounterId: "ticket-old",
    captureResult: "success",
    captureAtMs: 100,
    captureTicketAtMs: 100,
    state: "success"
  });
  await repo.create({
    encounterId: "ordinary-new",
    captureResult: "success",
    captureAtMs: 900,
    state: "success"
  });
  await repo.create({
    encounterId: "ticket-mid",
    captureResult: "success",
    captureAtMs: 300,
    captureTicketAtMs: 300,
    state: "success"
  });
  await repo.create({
    encounterId: "ticket-new",
    captureResult: "success",
    captureAtMs: 700,
    captureTicketAtMs: 700,
    state: "success"
  });

  const recent = await repo.getRecentCaptureTickets(2);

  assert.deepEqual(
    recent.map((row) => row.encounterId),
    ["ticket-new", "ticket-mid"]
  );
  db.close();
});

test("getRecentCaptureTickets is bounded even when more tickets exist", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  for (let index = 0; index < 12; index += 1) {
    await repo.create({
      encounterId: `ticket-${index}`,
      captureResult: "success",
      captureAtMs: index + 1,
      captureTicketAtMs: index + 1,
      state: "success"
    });
  }

  const recent = await repo.getRecentCaptureTickets(5);
  assert.equal(recent.length, 5);
  assert.deepEqual(
    recent.map((row) => row.captureTicketAtMs),
    [12, 11, 10, 9, 8]
  );
  db.close();
});

test("getRecentCaptureTickets rejects invalid limits", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await assert.rejects(() => repo.getRecentCaptureTickets(0), /limit must be >= 1/);
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

test("individual Hunt deletion detaches real Gallery tickets, but removes non-ticket data", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);
  const captured = {
    encounterId: "legendary-capture", sessionId: "former-hunt", state: "finalized",
    captureResult: "success", speciesName: "Lugia", quality: "legendary",
    qualityMultiplier: 1.92, ivTotal: 180, capturedByName: "Trainer",
    captureAtMs: 1_800_000_000_000, captureTicketAtMs: 1_800_000_000_000,
    gold: 10_000, lootItems: [{ itemId: "loot", qty: 3 }]
  };
  try {
    await repo.create(captured);
    await repo.create({ encounterId: "ordinary", sessionId: "former-hunt", state: "finalized" });
    await repo.create({ encounterId: "other", sessionId: "another-hunt", state: "started" });

    await repo.deleteBySessionId("former-hunt");
    assert.deepEqual(await repo.getBySessionId("former-hunt"), []);
    assert.equal(await repo.get("ordinary"), undefined);
    assert.deepEqual((await repo.getBySessionId("another-hunt")).map(row => row.encounterId), ["other"]);
    const archive = await repo.get("legendary-capture");
    assert.equal(archive.sessionId, undefined);
    assert.equal(archive.lootItems, undefined);
    assert.equal(archive.gold, undefined);
    assert.equal(archive.speciesName, "Lugia");
    assert.deepEqual((await repo.getRecentCaptureTickets()).map(row => row.encounterId), ["legendary-capture"]);
    await repo.deleteBySessionId("former-hunt");
    assert.equal((await repo.getRecentCaptureTickets()).length, 1, "retry cannot remove detached tickets");
  } finally { db.close(); }
});

test("deleteBySessionId on a session with no encounters is a safe no-op", async () => {
  const db = await setup();
  const repo = createEncountersRepository(db);

  await repo.create({ encounterId: "e1", sessionId: "s1", state: "started" });

  await repo.deleteBySessionId("does-not-exist");

  assert.equal((await repo.getAll()).length, 1);
  db.close();
});
