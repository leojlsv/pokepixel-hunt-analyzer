import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase } from "../../data/db.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { createEventPipeline } from "../../services/eventPipeline.js";

function combatStarted({ wildId, quality, seq, ts }) {
  return {
    type: "combat.started",
    seq,
    ts,
    socketId: 1,
    data: {
      enemy: {
        id: wildId,
        species_id: "charizard",
        level: 100,
        quality,
        is_shiny: false,
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        quality_multiplier: 1.72,
        map_id: 1,
        zone_id: "zone-1"
      },
      session: { id: "session-1", auto_capture: null }
    }
  };
}

function captureSuccess({ wildId, seq, ts }) {
  return {
    type: "capture.success",
    seq,
    ts,
    socketId: 1,
    data: {
      wild_monster_id: wildId,
      species_id: "charizard",
      species_name: "Charizard",
      captured_by_name: "Rhyxus",
      capsule_item_id: "capsule-ultra",
      capsule_name: "Ultra Ball",
      chance: 0.1,
      supply_cost: 130,
      auto_sold: false,
      auto_sell_value: 0
    }
  };
}

test("pipeline adds sparse captureTicketAtMs only to ticket-eligible successes", async () => {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const pipeline = createEventPipeline(db, { now: () => 0 });
  const encounters = createEncountersRepository(db);

  await pipeline.handle(combatStarted({
    wildId: "legendary-1",
    quality: "legendary",
    seq: 1,
    ts: 1000
  }));
  await pipeline.handle(captureSuccess({
    wildId: "legendary-1",
    seq: 2,
    ts: 2000
  }));

  await pipeline.handle(combatStarted({
    wildId: "common-1",
    quality: "common",
    seq: 3,
    ts: 3000
  }));
  await pipeline.handle(captureSuccess({
    wildId: "common-1",
    seq: 4,
    ts: 4000
  }));

  const tickets = await encounters.getRecentCaptureTickets(10);
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].quality, "legendary");
  assert.equal(tickets[0].captureAtMs, 2000);
  assert.equal(tickets[0].captureTicketAtMs, 2000);

  const all = await encounters.getAll();
  const ordinary = all.find((row) => row.captureAtMs === 4000);
  assert.equal(ordinary.captureResult, "success");
  assert.equal(ordinary.captureTicketAtMs, undefined);

  db.close();
});
