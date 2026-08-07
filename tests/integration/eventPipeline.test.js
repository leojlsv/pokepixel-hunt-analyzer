import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase, STORE_NAMES } from "../../data/db.js";
import { createRepository } from "../../data/repository.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { createEventPipeline } from "../../services/eventPipeline.js";

async function setup(now = () => 0) {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const pipeline = createEventPipeline(db, { now });
  return { db, pipeline };
}

function combatStarted({ wildId, level = 90, quality = "common", autoCapture, seq, ts }) {
  return {
    type: "combat.started",
    seq,
    ts,
    socketId: 1,
    data: {
      enemy: {
        id: wildId,
        species_id: "chansey",
        level,
        quality,
        is_shiny: false,
        ivs: { atk: 3, def: 1, hp: 1, spa: 27, spd: 5, spe: 6 },
        map_id: 14,
        zone_id: "zone_0001"
      },
      session: {
        id: "server_session_0001",
        auto_capture: autoCapture
      }
    }
  };
}

function lootReceived({ wildId, seq, ts }) {
  return {
    type: "loot.received",
    seq,
    ts,
    socketId: 1,
    data: {
      wild_monster_id: wildId,
      species_id: "chansey",
      exp: 2870,
      trainer_exp: 4305,
      pokemon_exp: 4305,
      gold: 37,
      loot_sell_value: 0
    }
  };
}

function captureFailed({ wildId, seq, ts }) {
  return {
    type: "capture.failed",
    seq,
    ts,
    socketId: 1,
    data: {
      wild_monster_id: wildId,
      species_id: "chansey",
      species_name: "Chansey",
      level: 90,
      quality: "weak",
      iv_total: 6,
      is_shiny: false,
      capsule_item_id: "capsule_ultra",
      capsule_name: "Ultra Ball",
      chance: 0.05,
      supply_cost: 130
    }
  };
}

test("full round trip persists a complete encounter with sessionId/configId/groupKey", async () => {
  const { db, pipeline } = await setup();

  await pipeline.handle(
    combatStarted({
      wildId: "wild_1",
      autoCapture: { enabled: true, min_quality: "common" },
      seq: 1,
      ts: 1000
    })
  );
  await pipeline.handle(lootReceived({ wildId: "wild_1", seq: 2, ts: 1500 }));
  await pipeline.handle(captureFailed({ wildId: "wild_1", seq: 3, ts: 1600 }));

  const encounters = createEncountersRepository(db);
  const all = await encounters.getAll();

  assert.equal(all.length, 1);
  const row = all[0];

  assert.equal(row.state, "failed");
  assert.equal(row.cycleMs, 500);
  assert.ok(row.sessionId);
  assert.ok(row.configId);
  assert.equal(row.groupKey, `chansey|90|${row.configId}`);

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].status, "running");
});

test("config change between encounters produces different config_id/group_key", async () => {
  const { db, pipeline } = await setup();

  await pipeline.handle(
    combatStarted({
      wildId: "wild_1",
      autoCapture: { enabled: true, min_quality: "common" },
      seq: 1,
      ts: 1000
    })
  );
  await pipeline.handle(lootReceived({ wildId: "wild_1", seq: 2, ts: 1100 }));
  await pipeline.handle(captureFailed({ wildId: "wild_1", seq: 3, ts: 1200 }));

  await pipeline.handle(
    combatStarted({
      wildId: "wild_2",
      autoCapture: { enabled: true, min_quality: "epic" }, // different config
      seq: 4,
      ts: 2000
    })
  );
  await pipeline.handle(lootReceived({ wildId: "wild_2", seq: 5, ts: 2100 }));
  await pipeline.handle(captureFailed({ wildId: "wild_2", seq: 6, ts: 2200 }));

  const encounters = createEncountersRepository(db);
  const all = await encounters.getAll();

  assert.equal(all.length, 2);
  assert.notEqual(all[0].configId, all[1].configId);
  assert.notEqual(all[0].groupKey, all[1].groupKey);

  const configs = await createRepository(db, STORE_NAMES.CONFIGS).getAll();
  assert.equal(configs.length, 2);
});

test("hunt.stopped pauses the session clock", async () => {
  let clock = 0;
  const { db, pipeline } = await setup(() => clock);

  await pipeline.handle(
    combatStarted({ wildId: "wild_1", autoCapture: null, seq: 1, ts: 1000 })
  );

  clock = 5000;
  await pipeline.handle({ type: "hunt.stopped", seq: 2, ts: 5000, socketId: 1, data: {} });

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(sessions[0].status, "paused");
  assert.equal(sessions[0].accumulatedActiveMs, 5000);
});

test("an orphan encounter is persisted without configId/groupKey", async () => {
  const { db, pipeline } = await setup();

  await pipeline.handle(lootReceived({ wildId: "wild_9", seq: 1, ts: 1000 }));

  const encounters = createEncountersRepository(db);
  const all = await encounters.getAll();

  assert.equal(all.length, 1);
  assert.equal(all[0].state, "orphan");
  assert.equal(all[0].configId, null);
  assert.equal(all[0].groupKey, null);
  assert.ok(all[0].sessionId); // still tagged to a session
});

test("an unrecognized event type is ignored without touching the database", async () => {
  const { db, pipeline } = await setup();

  const result = await pipeline.handle({
    type: "some.unknown.event",
    seq: 1,
    ts: 1000,
    socketId: 1,
    data: {}
  });

  assert.deepEqual(result, { ok: false, reason: "ignored" });

  const encounters = await createEncountersRepository(db).getAll();
  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(encounters.length, 0);
  assert.equal(sessions.length, 0);
});
