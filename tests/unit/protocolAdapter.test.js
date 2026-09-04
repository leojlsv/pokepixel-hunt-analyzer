import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createProtocolAdapter,
  decodeHuntSimFullFrame
} from "../../userscript/protocol-adapter.js";

const FULL_FRAME_WITH_SHINY_EVENT_1 =
  "AgEADklopBNiNI5wAAACzigoCgAAAAAcCQIAAAAAACSdAAABAQAAHwwCABxXHFcknQEGc2Npem9yAgIAAQsJBgEAlQCVIwQBBnBpZGdleQMCAAIbCgYEAAAAQxQEAAZwaWRnZXkEAgADIQ4IAABkAGQUBAAGcGlkZ2V5BQIAEAcPBAQAAABGFAQABnBpZGdleQYCABEaIgIAAFAAUBQEAAZwaWRnZXkHAgAYIhoGAABBAEEUBAAGcGlkZ2V5CAIAGQccCAAARgBGFAQABnBpZGdleQkCABoRIgYAAEkASRQEAAZwaWRnZXk=";

test("decodes the stable HuntSim full-frame entity directory", () => {
  const entities = decodeHuntSimFullFrame({
    kind: "full",
    b: FULL_FRAME_WITH_SHINY_EVENT_1
  });

  assert.equal(entities.length, 8);
  assert.deepEqual(entities[0], {
    slot: 2,
    eventId: 1,
    x: 11,
    y: 9,
    hp: 149,
    maxHp: 149,
    level: 4,
    isShiny: true,
    speciesId: "pidgey"
  });
  assert.equal(entities[7].eventId, 26);
  assert.equal(entities[7].speciesId, "pidgey");
});

test("HuntSim flow becomes canonical start -> terminal -> late loot without duplicate reward projections", () => {
  const adapter = createProtocolAdapter();

  assert.deepEqual(
    adapter.adapt({
      type: "hunt.analyzer_reset",
      seq: 91,
      ts: 100,
      data: { active: true, session_id: "server-session", zone_id: "zone-pidgey" }
    }),
    [
      {
        type: "hunt.analyzer_reset",
        seq: 91,
        ts: 100,
        data: { active: true, session_id: "server-session", zone_id: "zone-pidgey" }
      }
    ]
  );

  assert.deepEqual(
    adapter.adapt({
      type: "combat.started",
      seq: 92,
      ts: 101,
      data: {
        combat_epoch: 0,
        session: {
          id: "server-session",
          zone_id: "zone-pidgey",
          map_id: 14,
          auto_capture: {
            enabled: true,
            min_quality: "common",
            mode: "split",
            common_enabled: true,
            common_capsule_item_id: "capsule_ultra"
          }
        }
      }
    }),
    []
  );

  assert.deepEqual(
    adapter.adapt({
      type: "hunt.frame",
      seq: 93,
      ts: 102,
      data: { kind: "full", b: FULL_FRAME_WITH_SHINY_EVENT_1 }
    }),
    []
  );

  adapter.adapt({
    type: "hunt.capture_queue",
    seq: 100,
    ts: 900,
    data: { add: [{ id: 308, lv: 4, sp: "pidgey", x: 11, y: 9 }] }
  });

  const started = adapter.adapt({
    type: "hunt.events",
    seq: 101,
    ts: 1000,
    data: [
      { a: 1, cap: { id: 308, x: 11, y: 9 }, k: "knockout", t: 2 },
      { a: 1, d: 100, k: "hit", t: 2 }
    ]
  });

  assert.equal(started.length, 1);
  assert.equal(started[0].type, "combat.started");
  assert.equal(started[0].data.enemy.id, "huntsim:server-session:308");
  assert.equal(started[0].data.enemy.species_id, "pidgey");
  assert.equal(started[0].data.enemy.level, 4);
  assert.equal(started[0].data.enemy.started_at_ms, 1000);
  assert.equal(started[0].data.session.id, "server-session");

  const terminal = adapter.adapt({
    type: "capture.success",
    seq: 102,
    ts: 1010,
    data: {
      event_id: 1,
      map_id: 14,
      zone_id: "zone-pidgey",
      wild_monster_id: "real-server-wild-id",
      species_id: "pidgey",
      species_name: "Pidgey",
      capsule_item_id: "capsule_master",
      capsule_name: "Master Ball",
      chance: 1,
      supply_cost: 0,
      auto_sold: false,
      auto_sell_value: 0,
      creature: {
        species_id: "pidgey",
        level: 1,
        quality: "epic",
        is_shiny: true,
        captured_by_name: "Rhyxus",
        gender: "male",
        nature: "bold",
        quality_multiplier: 1.72,
        elements: ["normal", "flying"],
        ivs: { hp: 20, atk: 14, def: 8, spa: 17, spd: 27, spe: 17 }
      }
    }
  });

  assert.equal(terminal.length, 1);
  assert.equal(terminal[0].type, "capture.success");
  assert.equal(terminal[0].data.wild_monster_id, "huntsim:server-session:308");

  assert.deepEqual(
    adapter.adapt({
      type: "hunt.kill_reward",
      seq: 103,
      ts: 1011,
      data: { kills: [{ seq: 308, exp: 798 }] }
    }),
    []
  );

  const loot = adapter.adapt({
    type: "loot.received",
    seq: 104,
    ts: 1200,
    data: {
      kills: 1,
      loot_sell_value: 8,
      per_kill: [
        {
          seq: 308,
          exp: 798,
          trainer_exp: 798,
          pokemon_exp: 798,
          gold: 1
        }
      ]
    }
  });

  assert.equal(loot.length, 1);
  assert.equal(loot[0].type, "loot.received");
  assert.equal(loot[0].data.wild_monster_id, "huntsim:server-session:308");
  assert.equal(loot[0].data.species_id, "pidgey");
  assert.equal(loot[0].data.loot_sell_value, 8);
});

test("aggregated multi-kill loot is split into canonical per-kill rewards preserving totals", () => {
  const adapter = createProtocolAdapter();

  adapter.adapt({
    type: "combat.started",
    seq: 1,
    ts: 1,
    data: {
      session: {
        id: "session",
        zone_id: "zone",
        map_id: 14,
        auto_capture: null
      }
    }
  });

  adapter.adapt({
    type: "hunt.capture_queue",
    seq: 2,
    ts: 2,
    data: {
      add: [
        { id: 10, lv: 4, sp: "pidgey" },
        { id: 11, lv: 4, sp: "pidgey" }
      ]
    }
  });

  const output = adapter.adapt({
    type: "loot.received",
    seq: 3,
    ts: 3,
    data: {
      loot_sell_value: 9,
      per_kill: [
        { seq: 10, exp: 10, trainer_exp: 10, pokemon_exp: 10, gold: 1 },
        { seq: 11, exp: 20, trainer_exp: 20, pokemon_exp: 20, gold: 2 }
      ]
    }
  });

  const loot = output.filter((event) => event.type === "loot.received");
  assert.equal(loot.length, 2);
  assert.deepEqual(loot.map((event) => event.data.loot_sell_value), [5, 4]);
  assert.equal(loot.reduce((sum, event) => sum + event.data.gold, 0), 3);
});

test("legacy protocol events pass through unchanged", () => {
  const adapter = createProtocolAdapter();
  const payload = {
    type: "combat.started",
    seq: 10,
    ts: 1000,
    data: {
      enemy: { id: "wild-1", species_id: "magikarp", level: 3 },
      session: { id: "legacy-session", auto_capture: null }
    }
  };

  assert.deepEqual(adapter.adapt(payload), [payload]);
});

test("temporary capture and kill registries stay within their configured limit", () => {
  const adapter = createProtocolAdapter({
    now: () => 1_000,
    runtimeEntryLimit: 3
  });

  adapter.adapt({
    type: "hunt.capture_queue",
    seq: 1,
    ts: 1_000,
    data: {
      add: Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        lv: 4,
        sp: "pidgey"
      }))
    }
  });

  adapter.adapt({
    type: "loot.received",
    seq: 2,
    ts: 1_100,
    data: {
      per_kill: Array.from({ length: 5 }, (_, index) => ({
        seq: index + 1,
        exp: 1,
        trainer_exp: 1,
        pokemon_exp: 1,
        gold: 1
      }))
    }
  });

  const snapshot = adapter.snapshot();
  assert.equal(snapshot.captureQueueByKillSeq.size, 3);
  assert.deepEqual([...snapshot.captureQueueByKillSeq.keys()], [3, 4, 5]);
  assert.equal(snapshot.killsBySeq.size, 3);
  assert.deepEqual([...snapshot.killsBySeq.keys()], [3, 4, 5]);
});

test("temporary protocol state expires after the correlation retention window", () => {
  let clock = 1_000;
  const adapter = createProtocolAdapter({
    now: () => clock,
    runtimeRetentionMs: 30_000,
    runtimeEntryLimit: 10
  });

  adapter.adapt({
    type: "hunt.capture_queue",
    seq: 1,
    ts: 1_000,
    data: { add: [{ id: 10, lv: 4, sp: "pidgey" }] }
  });
  adapter.adapt({
    type: "loot.received",
    seq: 2,
    ts: 1_100,
    data: {
      per_kill: [{ seq: 10, exp: 1, trainer_exp: 1, pokemon_exp: 1, gold: 1 }]
    }
  });

  assert.equal(adapter.snapshot().captureQueueByKillSeq.size, 1);
  assert.equal(adapter.snapshot().killsBySeq.size, 1);

  clock = 31_001;
  adapter.adapt({ type: "hunt.frame", seq: 3, ts: 31_001, data: null });

  assert.equal(adapter.snapshot().captureQueueByKillSeq.size, 0);
  assert.equal(adapter.snapshot().killsBySeq.size, 0);
});

test("protocol adapter rejects unsafe runtime retention settings", () => {
  assert.throws(
    () => createProtocolAdapter({ runtimeRetentionMs: 29_999 }),
    /terminal match window/
  );
  assert.throws(
    () => createProtocolAdapter({ runtimeEntryLimit: 0 }),
    /positive safe integer/
  );
});
