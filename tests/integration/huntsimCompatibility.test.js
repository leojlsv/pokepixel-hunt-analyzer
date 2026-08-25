import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase } from "../../data/db.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { createEventPipeline } from "../../services/eventPipeline.js";
import { createProtocolAdapter } from "../../userscript/protocol-adapter.js";

const FULL_FRAME =
  "AgEADklopBNiNI5wAAACzigoCgAAAAAcCQIAAAAAACSdAAABAQAAHwwCABxXHFcknQEGc2Npem9yAgIAAQsJBgEAlQCVIwQBBnBpZGdleQMCAAIbCgYEAAAAQxQEAAZwaWRnZXkEAgADIQ4IAABkAGQUBAAGcGlkZ2V5BQIAEAcPBAQAAABGFAQABnBpZGdleQYCABEaIgIAAFAAUBQEAAZwaWRnZXkHAgAYIhoGAABBAEEUBAAGcGlkZ2V5CAIAGQccCAAARgBGFAQABnBpZGdleQkCABoRIgYAAEkASRQEAAZwaWRnZXk=";

async function setup() {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const pipeline = createEventPipeline(db, {
    now: () => 0,
    appVersion: "1.8.0-dev-test"
  });
  const adapter = createProtocolAdapter();

  async function ingest(payload) {
    const canonical = adapter.adapt(payload);
    const results = [];
    for (const event of canonical) {
      results.push(
        await pipeline.handle({
          ...event,
          socketId: 1
        })
      );
    }
    return { canonical, results };
  }

  return { db, adapter, pipeline, ingest };
}

async function primeHuntSim(ingest) {
  await ingest({
    type: "hunt.analyzer_reset",
    seq: 1,
    ts: 900,
    data: {
      active: true,
      session_id: "server-session",
      zone_id: "zone-pidgey"
    }
  });

  // DEV emits session context without the old combat.started.data.enemy.
  await ingest({
    type: "combat.started",
    seq: 2,
    ts: 901,
    data: {
      session: {
        id: "server-session",
        zone_id: "zone-pidgey",
        map_id: 14,
        auto_capture: {
          enabled: true,
          mode: "split",
          min_quality: "common",
          common_enabled: true,
          common_capsule_item_id: "capsule_ultra",
          shiny_enabled: true,
          shiny_capsule_item_id: "capsule_master",
          species_filter: []
        }
      }
    }
  });

  await ingest({
    type: "hunt.frame",
    seq: 3,
    ts: 902,
    data: { kind: "full", b: FULL_FRAME }
  });
}

test("DEV capture success persists one complete canonical encounter and accepts late loot", async () => {
  const { db, ingest } = await setup();
  await primeHuntSim(ingest);

  await ingest({
    type: "hunt.capture_queue",
    seq: 10,
    ts: 990,
    data: { add: [{ id: 308, lv: 4, sp: "pidgey", ttl: 20000, x: 11, y: 9 }] }
  });

  const knockout = await ingest({
    type: "hunt.events",
    seq: 11,
    ts: 1000,
    data: [
      { a: 1, cap: { id: 308, x: 11, y: 9 }, k: "knockout", t: 2 },
      { a: 1, an: 26, d: 94513, e: 1, el: "steel", h: 47256, k: "hit", m: "steel-wing", t: 2 }
    ]
  });

  assert.equal(knockout.canonical.length, 1);
  assert.equal(knockout.canonical[0].type, "combat.started");
  assert.equal(knockout.canonical[0].data.enemy.species_id, "pidgey");
  assert.equal(knockout.canonical[0].data.enemy.level, 4);

  const terminal = await ingest({
    type: "capture.success",
    seq: 12,
    ts: 1010,
    data: {
      auto_sell_value: 0,
      auto_sold: false,
      capsule_item_id: "capsule_master",
      capsule_name: "Master Ball",
      capture_sell_value: 680,
      chance: 1,
      creature: {
        species_id: "pidgey",
        level: 1,
        quality: "epic",
        is_shiny: true,
        captured_by_name: "Rhyxus",
        elements: ["normal", "flying"],
        gender: "male",
        nature: "bold",
        quality_multiplier: 1.72,
        ivs: { hp: 20, atk: 14, def: 8, spa: 17, spd: 27, spe: 17 }
      },
      event_id: 1,
      map_id: 14,
      species_id: "pidgey",
      species_name: "Pidgey",
      supply_cost: 0,
      wild_monster_id: "server-wild-id",
      zone_id: "zone-pidgey"
    }
  });

  assert.equal(terminal.canonical.length, 1);
  assert.equal(
    terminal.canonical[0].data.wild_monster_id,
    "huntsim:server-session:308"
  );

  // Real DEV ordering removes the capture-queue entry before late loot.
  await ingest({
    type: "hunt.capture_queue",
    seq: 13,
    ts: 1020,
    data: { rm: [308] }
  });

  // Duplicate reward projection is intentionally ignored.
  const duplicateProjection = await ingest({
    type: "hunt.kill_reward",
    seq: 14,
    ts: 1021,
    data: { kills: [{ seq: 308, exp: 798, gold: 1 }] }
  });
  assert.deepEqual(duplicateProjection.canonical, []);

  await ingest({
    type: "loot.received",
    seq: 15,
    ts: 1200,
    data: {
      exp: 798,
      gold: 1,
      kills: 1,
      loot_sell_value: 8,
      per_kill: [
        {
          exp: 798,
          gold: 1,
          items: [{ item_id: "reference_straw", qty: 3 }],
          pokemon_exp: 798,
          seq: 308,
          trainer_exp: 798
        }
      ],
      pokemon_exp: 798,
      session_id: "server-session",
      trainer_exp: 798
    }
  });

  const rows = await createEncountersRepository(db).getAll();
  assert.equal(rows.length, 1);

  const row = rows[0];
  assert.equal(row.state, "success");
  assert.equal(row.captureResult, "success");
  assert.equal(row.wildMonsterId, "huntsim:server-session:308");
  assert.equal(row.speciesId, "pidgey");
  assert.equal(row.speciesName, "Pidgey");
  assert.equal(row.level, 4, "captured creature level=1 must never replace target level");
  assert.equal(row.quality, "epic");
  assert.equal(row.isShiny, true);
  assert.equal(row.ivTotal, 103);
  assert.deepEqual(row.ivs, { hp: 20, atk: 14, def: 8, spa: 17, spd: 27, spe: 17 });
  assert.deepEqual(row.elements, ["normal", "flying"]);
  assert.equal(row.gender, "male");
  assert.equal(row.nature, "bold");
  assert.equal(row.qualityMultiplier, 1.72);
  assert.equal(row.capturedByName, "Rhyxus");
  assert.equal(row.exp, 798);
  assert.equal(row.trainerExp, 798);
  assert.equal(row.pokemonExp, 798);
  assert.equal(row.gold, 1);
  assert.equal(row.lootSellValue, 8);
  assert.equal(row.cycleMs, 200);
  assert.ok(row.configId);
  assert.equal(row.groupKey, `pidgey|4|${row.configId}`);
  assert.equal(row.captureTicketAtMs, 1010, "shiny success remains Capture Ticket eligible");
});

test("DEV capture failure preserves the fields the terminal protocol actually exposes", async () => {
  const { db, ingest } = await setup();
  await primeHuntSim(ingest);

  // slot 5 in the real frame is event_id 16.
  await ingest({
    type: "hunt.capture_queue",
    seq: 20,
    ts: 1990,
    data: { add: [{ id: 309, lv: 4, sp: "pidgey", ttl: 20000, x: 7, y: 16 }] }
  });

  await ingest({
    type: "hunt.events",
    seq: 21,
    ts: 2000,
    data: [
      { a: 1, cap: { id: 309, x: 7, y: 16 }, k: "knockout", t: 5 },
      { a: 1, an: 26, d: 67201, e: 1, el: "steel", h: 33600, k: "hit", m: "gyro-ball", t: 5 }
    ]
  });

  await ingest({
    type: "capture.failed",
    seq: 22,
    ts: 2010,
    data: {
      capsule_item_id: "capsule_ultra",
      capsule_name: "Ultra Ball",
      chance: 0.15,
      event_id: 16,
      is_shiny: false,
      iv_total: 56,
      level: 4,
      map_id: 14,
      quality: "common",
      species_id: "pidgey",
      species_name: "Pidgey",
      supply_cost: 130,
      wild_monster_id: "server-wild-id-2",
      zone_id: "zone-pidgey"
    }
  });

  await ingest({
    type: "hunt.capture_queue",
    seq: 23,
    ts: 2020,
    data: { rm: [309] }
  });

  await ingest({
    type: "loot.received",
    seq: 24,
    ts: 2200,
    data: {
      kills: 1,
      loot_sell_value: 0,
      per_kill: [
        { exp: 798, gold: 1, pokemon_exp: 798, seq: 309, trainer_exp: 798 }
      ]
    }
  });

  const rows = await createEncountersRepository(db).getAll();
  assert.equal(rows.length, 1);
  const row = rows[0];

  assert.equal(row.state, "failed");
  assert.equal(row.captureResult, "failed");
  assert.equal(row.speciesId, "pidgey");
  assert.equal(row.level, 4);
  assert.equal(row.quality, "common");
  assert.equal(row.ivTotal, 56);
  assert.equal(row.isShiny, false);
  assert.equal(row.gender, null);
  assert.equal(row.nature, null);
  assert.equal(row.ivs, null);
  assert.equal(row.qualityMultiplier, null);
  assert.equal(row.cycleMs, 200);
});
