import assert from "node:assert/strict";
import { test } from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { openDatabase } from "../../data/db.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { createSessionsRepository } from "../../data/sessionsRepository.js";
import { computeSessionMetrics } from "../../domain/sessionMetrics.js";
import { createEventPipeline } from "../../services/eventPipeline.js";

const combat = (wildId, seq, ts) => ({
  type: "combat.started",
  seq,
  ts,
  socketId: 1,
  data: {
    enemy: {
      id: wildId, species_id: "pidgey", level: 5, quality: "common",
      zone_id: "same-zone", map_id: 14, is_shiny: false
    },
    session: { id: "native-hunt-still-running", auto_capture: null }
  }
});
const loot = (wildId, seq, ts, xp) => ({
  type: "loot.received",
  seq,
  ts,
  socketId: 1,
  data: {
    wild_monster_id: wildId, species_id: "pidgey",
    exp: xp, trainer_exp: xp, pokemon_exp: xp, gold: 2
  }
});

test("Card Mode atomic reset-running keeps the new Hunt clock/EXP tracking active and isolates pre-reset late EXP", async () => {
  let clock = 1_000;
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const pipeline = createEventPipeline(db, { now: () => clock });
  const sessions = createSessionsRepository(db, { now: () => clock });
  const encounters = createEncountersRepository(db);
  try {
    await pipeline.handle(combat("pending-before-card-reset", 1, 1_000));
    const old = await sessions.getCurrentReadOnly();
    assert.equal(old.status, "running");

    // PUBLIC_CONTROL.act("reset-running") delegates through main.js to
    // forceNewSession() inside the serialized protocol/action queue. Native
    // game Hunt/WS continues; this does NOT reset the adapter/transport.
    clock = 2_000;
    const current = await sessions.forceNewSession();
    assert.notEqual(current.sessionId, old.sessionId);
    assert.equal(current.status, "running");
    assert.equal(current.locked, false);
    assert.equal(current.serverSessionId, null);

    // E1 began BEFORE Card Reset. Late EXP belongs in A, not arbitrarily
    // moved into the new current Hunt to inflate its counters.
    clock = 2_100;
    await pipeline.handle(loot("pending-before-card-reset", 2, clock, 50));
    const previousRows = await encounters.getBySessionId(old.sessionId);
    assert.equal(previousRows.length, 1);
    assert.equal(previousRows[0].trainerExp, 50);
    assert.equal(previousRows[0].pokemonExp, 50);
    assert.equal((await encounters.getBySessionId(current.sessionId)).length, 0);

    clock = 2_200;
    await pipeline.handle(combat("new-after-card-reset", 3, clock));
    clock = 2_500;
    await pipeline.handle(loot("new-after-card-reset", 4, clock, 200));
    clock = 4_000;
    const selected = await sessions.getCurrentReadOnly();
    assert.equal(selected.sessionId, current.sessionId);
    assert.equal(selected.status, "running");
    assert.equal(selected.locked, false);
    const currentRows = await encounters.getBySessionId(selected.sessionId);
    const metrics = computeSessionMetrics({ session: selected, encounters: currentRows, now: clock });
    assert.equal(currentRows.length, 1);
    assert.equal(metrics.trainerExp, 200);
    assert.equal(metrics.pokemonExp, 200);
    assert.equal(metrics.activeMs, 2_000);
    assert.equal(metrics.trainerExpPerHour, 360_000);
    assert.equal(metrics.pokemonExpPerHour, 360_000);
    assert.equal((await encounters.getAll()).reduce((xp, row) => xp + (row.trainerExp || 0), 0), 250);
    const historical = await sessions.getById?.(old.sessionId);
    if (historical) assert.equal(historical.status, "ended");
  } finally {
    db.close();
  }
});
