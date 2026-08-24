import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase } from "../../data/db.js";
import { createEventPipeline } from "../../services/eventPipeline.js";

test("pipeline emits one terminal alert per accepted capture event", async () => {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const pipeline = createEventPipeline(db, { now: () => 0 });

  await pipeline.handle({
    type: "combat.started",
    seq: 1,
    ts: 1000,
    socketId: 1,
    data: {
      enemy: {
        id: "wild_alert",
        species_id: "dragonite",
        level: 90,
        quality: "legendary",
        is_shiny: true,
        ivs: { hp: 1, atk: 2, def: 3, spa: 4, spd: 5, spe: 6 },
        map_id: 14,
        zone_id: "zone_1"
      },
      session: { id: "session_1", auto_capture: null }
    }
  });

  const failed = {
    type: "capture.failed",
    seq: 2,
    ts: 1200,
    socketId: 1,
    data: {
      wild_monster_id: "wild_alert",
      species_id: "dragonite",
      species_name: "Dragonite",
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

  const first = await pipeline.handle(failed);
  assert.deepEqual(first.terminalAlert, {
    result: "fled",
    rarity: "legendary",
    isShiny: true
  });

  const duplicate = await pipeline.handle(failed);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.terminalAlert, undefined);
});
