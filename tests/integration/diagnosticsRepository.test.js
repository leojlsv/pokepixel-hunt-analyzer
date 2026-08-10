import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase } from "../../data/db.js";
import { createDiagnosticsRepository } from "../../data/diagnosticsRepository.js";

async function setup() {
  return openDatabase({ indexedDBFactory: new IDBFactory() });
}

test("getCounters defaults every field to 0 when nothing has been recorded yet", async () => {
  const db = await setup();
  const diagnostics = createDiagnosticsRepository(db);

  assert.deepEqual(await diagnostics.getCounters(), {
    eventsReceived: 0,
    eventsIgnored: 0,
    parseErrors: 0,
    dbErrors: 0,
    orphanEvents: 0,
    duplicateEvents: 0
  });
});

test("increment sums onto the current value and persists across calls", async () => {
  const db = await setup();
  const diagnostics = createDiagnosticsRepository(db);

  await diagnostics.increment({ eventsReceived: 1 });
  await diagnostics.increment({ eventsReceived: 1, parseErrors: 1 });
  const after = await diagnostics.increment({ eventsReceived: 1 });

  assert.equal(after.eventsReceived, 3);
  assert.equal(after.parseErrors, 1);
  assert.equal(after.dbErrors, 0);

  assert.deepEqual(await diagnostics.getCounters(), after);
});

test("increment accepts more than 1 (e.g. multiple orphans from one event)", async () => {
  const db = await setup();
  const diagnostics = createDiagnosticsRepository(db);

  const after = await diagnostics.increment({ orphanEvents: 2 });
  assert.equal(after.orphanEvents, 2);
});

test("a fresh repository instance over the same db reads the same persisted counters", async () => {
  const db = await setup();

  await createDiagnosticsRepository(db).increment({ dbErrors: 1 });

  const reopened = createDiagnosticsRepository(db);
  assert.equal((await reopened.getCounters()).dbErrors, 1);
});
