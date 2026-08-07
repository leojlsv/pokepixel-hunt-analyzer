import { test } from "node:test";
import assert from "node:assert/strict";

import { EVENT_TYPES, normalizeEvent } from "../../domain/events.js";

// Sample payloads below are taken verbatim from
// tests/fixtures/rhyxus_hunting2.regression.json (real, sanitized protocol
// data) so the normalizer is proven against the actual wire shape, not an
// assumption of it.

test("EVENT_TYPES lists exactly the 6 documented inbound events", () => {
  assert.deepEqual(
    [...EVENT_TYPES].sort(),
    [
      "capture.failed",
      "capture.success",
      "combat.started",
      "hunt.analyzer_reset",
      "hunt.stopped",
      "loot.received"
    ].sort()
  );
});

test("unrecognized event type returns null", () => {
  assert.equal(normalizeEvent("some.other.event", { x: 1 }), null);
});

test("missing or non-object data returns null", () => {
  assert.equal(normalizeEvent("combat.started", null), null);
  assert.equal(normalizeEvent("combat.started", undefined), null);
  assert.equal(normalizeEvent("combat.started", "not an object"), null);
});

test("combat.started extracts enemy and session.auto_capture (raw)", () => {
  const normalized = normalizeEvent("combat.started", {
    enemy: {
      id: "wild_0001",
      species_id: "chansey",
      level: 90,
      quality: "common",
      is_shiny: false,
      ivs: { atk: 3, def: 1, hp: 1, spa: 27, spd: 5, spe: 6 },
      map_id: 14,
      zone_id: "zone_0001"
    },
    session: {
      id: "server_session_0001",
      auto_capture: {
        enabled: true,
        mode: "split",
        capsule_item_id: "",
        common_enabled: true,
        common_capsule_item_id: "capsule_ultra",
        min_quality: "common",
        shiny_enabled: true,
        shiny_capsule_item_id: "e834a843-486a-4f38-95c4-cfda5febe4a5",
        species_filter: []
      }
    }
  });

  assert.equal(normalized.enemy.id, "wild_0001");
  assert.equal(normalized.enemy.species_id, "chansey");
  assert.equal(normalized.enemy.level, 90);
  assert.equal(normalized.enemy.quality, "common");
  assert.equal(normalized.enemy.is_shiny, false);
  assert.deepEqual(normalized.enemy.ivs, {
    atk: 3,
    def: 1,
    hp: 1,
    spa: 27,
    spd: 5,
    spe: 6
  });
  assert.equal(normalized.enemy.map_id, 14);
  assert.equal(normalized.enemy.zone_id, "zone_0001");
  assert.equal(normalized.session.id, "server_session_0001");
  assert.equal(normalized.session.auto_capture.min_quality, "common");
});

test("combat.started without enemy is dropped (null)", () => {
  assert.equal(
    normalizeEvent("combat.started", { session: { id: "x" } }),
    null
  );
});

test("combat.started without session still normalizes (session is optional)", () => {
  const normalized = normalizeEvent("combat.started", {
    enemy: { id: "wild_0001", species_id: "chansey" }
  });

  assert.equal(normalized.session, null);
});

test("loot.received extracts the documented reward fields", () => {
  const normalized = normalizeEvent("loot.received", {
    wild_monster_id: "wild_0002",
    species_id: "chansey",
    creature_id: "creature_0001", // present on the wire, not documented — ignored
    exp: 2870,
    trainer_exp: 4305,
    pokemon_exp: 4305,
    gold: 37,
    loot_sell_value: 0
  });

  assert.equal(normalized.wild_monster_id, "wild_0002");
  assert.equal(normalized.trainer_exp, 4305);
  assert.equal(normalized.pokemon_exp, 4305);
  assert.equal(normalized.gold, 37);
  assert.equal(normalized.creature_id, undefined);
});

test("capture.failed extracts the documented fields including iv_total", () => {
  const normalized = normalizeEvent("capture.failed", {
    wild_monster_id: "wild_0002",
    species_id: "chansey",
    species_name: "Chansey",
    level: 90,
    quality: "weak",
    iv_total: 6,
    is_shiny: false,
    capsule_item_id: "capsule_ultra",
    capsule_name: "Ultra Ball",
    chance: 0.033936651583710405,
    supply_cost: 130
  });

  assert.equal(normalized.iv_total, 6);
  assert.equal(normalized.quality, "weak");
  assert.equal(normalized.chance, 0.033936651583710405);
});

test("capture.success extracts creature.quality/is_shiny/ivs but not creature.level", () => {
  const normalized = normalizeEvent("capture.success", {
    wild_monster_id: "wild_0029",
    species_id: "chansey",
    species_name: "Chansey",
    capsule_item_id: "capsule_ultra",
    capsule_name: "Ultra Ball",
    chance: 0.03223981900452488,
    supply_cost: 130,
    auto_sold: true,
    auto_sell_value: 2260,
    creature: {
      species_id: "chansey",
      level: 1,
      quality: "uncommon",
      is_shiny: false,
      ivs: { atk: 8, def: 11, hp: 15, spa: 24, spd: 8, spe: 16 }
    }
  });

  assert.equal(normalized.auto_sold, true);
  assert.equal(normalized.creature.quality, "uncommon");
  assert.equal(normalized.creature.is_shiny, false);
  assert.deepEqual(normalized.creature.ivs, {
    atk: 8,
    def: 11,
    hp: 15,
    spa: 24,
    spd: 8,
    spe: 16
  });
  // The documented rule: never extract creature.level as target level.
  assert.equal(normalized.creature.level, undefined);
});

test("hunt.stopped and hunt.analyzer_reset normalize to an empty signal object", () => {
  assert.deepEqual(
    normalizeEvent("hunt.stopped", {
      paused: true,
      wild_monster_id: "wild_0025",
      zone_id: "zone_0001"
    }),
    {}
  );

  assert.deepEqual(
    normalizeEvent("hunt.analyzer_reset", {
      active: true,
      session_id: "server_session_0001",
      zone_id: "zone_0001"
    }),
    {}
  );
});
