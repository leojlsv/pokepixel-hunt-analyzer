import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase } from "../../data/db.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { createSessionsRepository } from "../../data/sessionsRepository.js";
import { computeSessionMetrics } from "../../domain/sessionMetrics.js";
import { createEventPipeline } from "../../services/eventPipeline.js";

test("profit accounting includes kill gold, loot sell value and realized Pokémon auto-sell", async () => {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const pipeline = createEventPipeline(db, { now: () => 0 });

  await pipeline.handle({
    type: "combat.started",
    seq: 1,
    ts: 1000,
    socketId: 1,
    data: {
      enemy: {
        id: "wild_gengar_1",
        species_id: "gengar",
        level: 90,
        quality: "uncommon",
        is_shiny: false,
        ivs: { hp: 1, atk: 1, def: 14, spa: 6, spd: 24, spe: 2 },
        map_id: 32,
        zone_id: "zone_1",
        elements: ["ghost", "poison"],
        gender: "male",
        nature: "gentle",
        quality_multiplier: 1.1871979044401952
      },
      session: {
        id: "server_session_1",
        auto_capture: { enabled: true }
      }
    }
  });

  await pipeline.handle({
    type: "loot.received",
    seq: 2,
    ts: 1100,
    socketId: 1,
    data: {
      wild_monster_id: "wild_gengar_1",
      species_id: "gengar",
      exp: 100,
      trainer_exp: 100,
      pokemon_exp: 100,
      gold: 100,
      loot_sell_value: 40
    }
  });

  await pipeline.handle({
    type: "capture.success",
    seq: 3,
    ts: 1200,
    socketId: 1,
    data: {
      auto_sell_value: 250,
      auto_sold: true,
      capsule_item_id: "capsule_super",
      capsule_name: "Super Ball",
      chance: 0.03,
      creature: {
        species_id: "gengar",
        quality: "uncommon",
        is_shiny: false,
        ivs: { hp: 1, atk: 1, def: 14, spa: 6, spd: 24, spe: 2 },
        elements: ["ghost", "poison"],
        gender: "male",
        nature: "gentle",
        quality_multiplier: 1.1871979044401952,
        captured_by_name: "Rhyosa"
      },
      species_id: "gengar",
      species_name: "Gengar",
      supply_cost: 50,
      wild_monster_id: "wild_gengar_1"
    }
  });

  const session = await createSessionsRepository(db).getCurrentReadOnly();
  const encounters = await createEncountersRepository(db).getBySessionId(session.sessionId);

  assert.equal(encounters.length, 1);
  assert.equal(encounters[0].gold, 100);
  assert.equal(encounters[0].lootSellValue, 40);
  assert.equal(encounters[0].autoSold, true);
  assert.equal(encounters[0].autoSellValue, 250);

  const metrics = computeSessionMetrics({ session, encounters, now: 3_600_000 });

  assert.equal(metrics.gold, 390);
  assert.equal(metrics.goldPerHour, 390);
  assert.equal(metrics.expenses, 50);
  assert.equal(metrics.gold - metrics.expenses, 340);
});
