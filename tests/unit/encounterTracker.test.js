import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeEvent } from "../../domain/events.js";
import {
  createTrackerState,
  applyEvent,
  sweepStale,
  STALE_TIMEOUT_MS
} from "../../domain/encounterTracker.js";

let idCounter = 0;
function resetIds() {
  idCounter = 0;
}
function nextId() {
  idCounter += 1;
  return `enc-${idCounter}`;
}

function envelope(type, rawData, { socketId = 1, seq, ts }) {
  const data = normalizeEvent(type, rawData);
  assert.ok(data, `expected ${type} to normalize successfully`);
  return { type, socketId, seq, ts, data };
}

function combatStarted(
  wildId,
  {
    level = 90,
    quality = "common",
    elements = ["normal"],
    gender = "female",
    nature = "brave",
    ivs = { atk: 3, def: 1, hp: 1, spa: 27, spd: 5, spe: 6 },
    qualityMultiplier = 1.02,
    ts,
    seq
  }
) {
  return envelope(
    "combat.started",
    {
      enemy: {
        id: wildId,
        species_id: "chansey",
        level,
        quality,
        is_shiny: false,
        ivs,
        map_id: 14,
        zone_id: "zone_0001",
        elements,
        gender,
        nature,
        quality_multiplier: qualityMultiplier
      },
      session: {
        id: "server_session_0001",
        auto_capture: { enabled: true, min_quality: "common" }
      }
    },
    { seq, ts }
  );
}

function lootReceived(wildId, { ts, seq }) {
  return envelope(
    "loot.received",
    {
      wild_monster_id: wildId,
      species_id: "chansey",
      exp: 2870,
      trainer_exp: 4305,
      pokemon_exp: 4305,
      gold: 37,
      loot_sell_value: 0
    },
    { seq, ts }
  );
}

function autoPotionUsed({ ts, seq, moveId = "potion_ultra", cost = 22 }) {
  return envelope(
    "loot.received",
    {
      auto_potion_used: moveId,
      new_hp: 745,
      supply_cost: cost
    },
    { seq, ts }
  );
}

function captureFailed(wildId, { ts, seq, quality = "common" }) {
  return envelope(
    "capture.failed",
    {
      wild_monster_id: wildId,
      species_id: "chansey",
      species_name: "Chansey",
      level: 90,
      quality,
      iv_total: 6,
      is_shiny: false,
      capsule_item_id: "capsule_ultra",
      capsule_name: "Ultra Ball",
      chance: 0.05,
      supply_cost: 130
    },
    { seq, ts }
  );
}

function captureSuccess(
  wildId,
  {
    ts,
    seq,
    autoSold = false,
    creatureQuality = "common",
    creatureLevel = 1,
    gender = "female",
    nature = "lax",
    qualityMultiplier = 1.374341469965942,
    isShiny = false,
    ivs = { atk: 8, def: 11, hp: 15, spa: 24, spd: 8, spe: 16 }
  }
) {
  return envelope(
    "capture.success",
    {
      wild_monster_id: wildId,
      species_id: "chansey",
      species_name: "Chansey",
      capsule_item_id: "capsule_ultra",
      capsule_name: "Ultra Ball",
      chance: 0.05,
      supply_cost: 130,
      auto_sold: autoSold,
      auto_sell_value: autoSold ? 2260 : 0,
      creature: {
        species_id: "chansey",
        level: creatureLevel,
        quality: creatureQuality,
        is_shiny: isShiny,
        ivs,
        elements: ["normal"],
        gender,
        nature,
        quality_multiplier: qualityMultiplier
      }
    },
    { seq, ts }
  );
}

test("start -> loot: creates then updates with a correct cycle_ms", (t) => {
  resetIds();
  let state = createTrackerState();

  const started = applyEvent(
    state,
    combatStarted("wild_1", { ts: 1000, seq: 1 }),
    nextId
  );
  state = started.state;
  assert.equal(started.effects[1].type, "encounter.create");
  const encounterId = started.effects[1].row.encounterId;
  assert.equal(started.effects[1].row.state, "started");

  const looted = applyEvent(state, lootReceived("wild_1", { ts: 1500, seq: 2 }), nextId);
  state = looted.state;
  const updateEffect = looted.effects.find((e) => e.type === "encounter.update");
  assert.equal(updateEffect.encounterId, encounterId);
  assert.equal(updateEffect.patch.cycleMs, 500);
  assert.equal(updateEffect.patch.state, "looted");
});

test("start -> loot -> failed finalizes as failed", () => {
  resetIds();
  let state = createTrackerState();

  ({ state } = applyEvent(state, combatStarted("wild_1", { ts: 1000, seq: 1 }), nextId));
  ({ state } = applyEvent(state, lootReceived("wild_1", { ts: 1500, seq: 2 }), nextId));

  const result = applyEvent(state, captureFailed("wild_1", { ts: 1600, seq: 3 }), nextId);
  const finalize = result.effects.find((e) => e.type === "encounter.finalize");

  assert.equal(finalize.patch.state, "failed");
  assert.equal(finalize.patch.captureResult, "failed");
  assert.equal(result.state.activeByWildMonsterId.has("wild_1"), false);
});

test("start -> loot -> success finalizes as success", () => {
  resetIds();
  let state = createTrackerState();

  ({ state } = applyEvent(state, combatStarted("wild_1", { ts: 1000, seq: 1 }), nextId));
  ({ state } = applyEvent(state, lootReceived("wild_1", { ts: 1500, seq: 2 }), nextId));

  const result = applyEvent(state, captureSuccess("wild_1", { ts: 1600, seq: 3 }), nextId);
  const finalize = result.effects.find((e) => e.type === "encounter.finalize");

  assert.equal(finalize.patch.state, "success");
});

test("auto-sold success is still a successful capture", () => {
  resetIds();
  let state = createTrackerState();

  ({ state } = applyEvent(state, combatStarted("wild_1", { ts: 1000, seq: 1 }), nextId));
  ({ state } = applyEvent(state, lootReceived("wild_1", { ts: 1500, seq: 2 }), nextId));

  const result = applyEvent(
    state,
    captureSuccess("wild_1", { ts: 1600, seq: 3, autoSold: true }),
    nextId
  );
  const finalize = result.effects.find((e) => e.type === "encounter.finalize");

  assert.equal(finalize.patch.state, "success");
  assert.equal(finalize.patch.autoSold, true);
  assert.equal(finalize.patch.autoSellValue, 2260);
});

test("no capture event: a started-only encounter becomes incomplete after the stale timeout", () => {
  resetIds();
  let state = createTrackerState();

  ({ state } = applyEvent(state, combatStarted("wild_1", { ts: 1000, seq: 1 }), nextId));

  const notYetStale = sweepStale(state, 1000 + STALE_TIMEOUT_MS - 1);
  assert.equal(notYetStale.effects.length, 0);

  const stale = sweepStale(state, 1000 + STALE_TIMEOUT_MS + 1);
  assert.equal(stale.effects.length, 1);
  assert.equal(stale.effects[0].patch.state, "incomplete");
  assert.equal(stale.state.activeByWildMonsterId.has("wild_1"), false);
});

test("no capture event: a looted encounter also becomes incomplete after the stale timeout", () => {
  resetIds();
  let state = createTrackerState();

  ({ state } = applyEvent(state, combatStarted("wild_1", { ts: 1000, seq: 1 }), nextId));
  ({ state } = applyEvent(state, lootReceived("wild_1", { ts: 1500, seq: 2 }), nextId));

  const stale = sweepStale(state, 1500 + STALE_TIMEOUT_MS + 1);
  assert.equal(stale.effects[0].patch.state, "incomplete");
});

test("wild-id reuse by a genuinely different individual finalizes the previous unresolved encounter and starts a new one", () => {
  resetIds();
  let state = createTrackerState();

  const first = applyEvent(state, combatStarted("wild_1", { ts: 1000, seq: 1 }), nextId);
  state = first.state;
  const firstEncounterId = first.effects[1].row.encounterId;

  // Different level and IVs — a genuinely different Pokémon reusing the
  // same wild_monster_id slot, not the same individual re-announced.
  const second = applyEvent(
    state,
    combatStarted("wild_1", {
      ts: 5000,
      seq: 2,
      level: 95,
      ivs: { atk: 10, def: 10, hp: 10, spa: 10, spd: 10, spe: 10 }
    }),
    nextId
  );
  state = second.state;

  const finalizePrevious = second.effects.find(
    (e) => e.type === "encounter.finalize" && e.encounterId === firstEncounterId
  );
  assert.ok(finalizePrevious, "expected the first encounter to be finalized");
  assert.equal(finalizePrevious.patch.state, "incomplete");

  const createSecond = second.effects.find((e) => e.type === "encounter.create");
  assert.notEqual(createSecond.row.encounterId, firstEncounterId);
  assert.equal(state.activeByWildMonsterId.get("wild_1"), createSecond.row.encounterId);
});

test("combat.started re-announcing the SAME individual on the same wild_monster_id does not duplicate the encounter", () => {
  resetIds();
  let state = createTrackerState();

  const first = applyEvent(state, combatStarted("wild_1", { ts: 1000, seq: 1 }), nextId);
  state = first.state;
  const firstEncounterId = first.effects[1].row.encounterId;

  // Exact same species/level/quality/gender/nature/ivs/qualityMultiplier
  // (all combatStarted() defaults) — the game re-announcing the same
  // real encounter, confirmed against a real backup (docs/PROTOCOL_AND_
  // ANALYTICS.md §7).
  const second = applyEvent(state, combatStarted("wild_1", { ts: 5000, seq: 2 }), nextId);
  state = second.state;

  assert.equal(
    second.effects.some((e) => e.type === "encounter.finalize"),
    false,
    "must not finalize the original as incomplete"
  );
  assert.equal(
    second.effects.some((e) => e.type === "encounter.create"),
    false,
    "must not create a duplicate encounter"
  );

  const touch = second.effects.find(
    (e) => e.type === "encounter.update" && e.encounterId === firstEncounterId
  );
  assert.ok(touch, "expected an encounter.update touching the original encounter");
  assert.equal(touch.patch.updatedAtMs, 5000);

  assert.equal(state.activeByWildMonsterId.get("wild_1"), firstEncounterId);
  assert.ok(state.inProgress.has(firstEncounterId));
});

test("after a same-individual re-announcement, a capture result still attaches to the original encounterId", () => {
  resetIds();
  let state = createTrackerState();

  const first = applyEvent(state, combatStarted("wild_1", { ts: 1000, seq: 1 }), nextId);
  state = first.state;
  const firstEncounterId = first.effects[1].row.encounterId;

  ({ state } = applyEvent(state, combatStarted("wild_1", { ts: 5000, seq: 2 }), nextId));
  ({ state } = applyEvent(state, lootReceived("wild_1", { ts: 5500, seq: 3 }), nextId));

  const result = applyEvent(state, captureFailed("wild_1", { ts: 6000, seq: 4 }), nextId);

  const finalize = result.effects.find((e) => e.type === "encounter.finalize");
  assert.ok(finalize, "expected a finalize effect");
  assert.equal(finalize.encounterId, firstEncounterId);
  assert.equal(finalize.patch.captureResult, "failed");
});

test("orphan: loot.received with no active encounter creates an orphan row", () => {
  resetIds();
  const state = createTrackerState();

  const result = applyEvent(state, lootReceived("wild_9", { ts: 1000, seq: 1 }), nextId);
  const create = result.effects.find((e) => e.type === "encounter.create");

  assert.equal(create.row.state, "orphan");
  assert.equal(create.row.wildMonsterId, "wild_9");
});

test("orphan: capture.failed with no active encounter creates an orphan row", () => {
  resetIds();
  const state = createTrackerState();

  const result = applyEvent(state, captureFailed("wild_9", { ts: 1000, seq: 1 }), nextId);
  const create = result.effects.find((e) => e.type === "encounter.create");

  assert.equal(create.row.state, "orphan");
  assert.equal(create.row.captureResult, "failed");
});

test("loot.received's auto-potion-used variant never creates an encounter (fixes the phantom-orphan bug)", () => {
  resetIds();
  const state = createTrackerState();

  const result = applyEvent(state, autoPotionUsed({ ts: 1000, seq: 1, cost: 22 }), nextId);

  assert.equal(result.effects.some((e) => e.type === "encounter.create"), false);
  assert.equal(result.effects.some((e) => e.type === "encounter.update"), false);
  assert.deepEqual(result.effects, [
    { type: "session.activity" },
    { type: "session.potion_used", cost: 22 }
  ]);
  // No active/in-progress encounter should be touched or created either.
  assert.equal(result.state.inProgress.size, 0);
  assert.equal(result.state.activeByWildMonsterId.size, 0);
});

test("orphan: capture.failed inherits quality/level/ivTotal/isShiny from the event itself", () => {
  resetIds();
  const state = createTrackerState();

  const result = applyEvent(
    state,
    captureFailed("wild_9", { ts: 1000, seq: 1, quality: "rare" }),
    nextId
  );
  const create = result.effects.find((e) => e.type === "encounter.create");

  assert.equal(create.row.quality, "rare");
  assert.equal(create.row.level, 90);
  assert.equal(create.row.ivTotal, 6);
  assert.equal(create.row.isShiny, false);
});

test("orphan: capture.success preserves terminal creature metadata but never uses creature.level", () => {
  resetIds();
  const state = createTrackerState();
  const ivs = { atk: 8, def: 11, hp: 15, spa: 24, spd: 8, spe: 16 };

  const result = applyEvent(
    state,
    captureSuccess("wild_9", {
      ts: 1000,
      seq: 1,
      creatureQuality: "rare",
      creatureLevel: 5,
      gender: "female",
      nature: "lax",
      qualityMultiplier: 1.374341469965942,
      isShiny: false,
      ivs
    }),
    nextId
  );
  const create = result.effects.find((e) => e.type === "encounter.create");

  assert.equal(create.row.state, "orphan");
  assert.equal(create.row.captureResult, "success");
  assert.equal(create.row.quality, "rare");
  assert.equal(create.row.level, null, "captured creature level must not replace target level");
  assert.equal(create.row.gender, "female");
  assert.equal(create.row.nature, "lax");
  assert.equal(create.row.qualityMultiplier, 1.374341469965942);
  assert.equal(create.row.ivTotal, 82);
  assert.deepEqual(create.row.ivs, ivs);
  assert.equal(create.row.isShiny, false);
  assert.equal(create.row.capsuleName, "Ultra Ball");
  assert.equal(create.row.captureChance, 0.05);
});

test("duplicate event (same socketId|eventType|seq) is ignored", () => {
  resetIds();
  let state = createTrackerState();

  const env = combatStarted("wild_1", { ts: 1000, seq: 1 });
  const first = applyEvent(state, env, nextId);
  state = first.state;
  assert.equal(first.effects.length, 2); // session.activity + encounter.create

  const second = applyEvent(state, env, nextId);
  assert.equal(second.effects.length, 0);
});

test("reconnect / seq reset: a different socketId is not deduped against an earlier one with the same seq", () => {
  resetIds();
  let state = createTrackerState();

  const first = applyEvent(
    state,
    { ...combatStarted("wild_1", { ts: 1000, seq: 5 }), socketId: 1 },
    nextId
  );
  state = first.state;

  const second = applyEvent(
    state,
    { ...combatStarted("wild_2", { ts: 2000, seq: 5 }), socketId: 2 },
    nextId
  );

  assert.equal(second.effects.length, 2); // processed normally, not deduped
});

test("dedupe key includes eventType: same socketId+seq across different types are not confused", () => {
  resetIds();
  let state = createTrackerState();

  const started = applyEvent(
    state,
    { ...combatStarted("wild_1", { ts: 1000, seq: 7 }), socketId: 1 },
    nextId
  );
  state = started.state;

  const loot = applyEvent(
    state,
    { ...lootReceived("wild_1", { ts: 1500, seq: 7 }), socketId: 1 },
    nextId
  );

  assert.equal(loot.effects.length, 2); // session.activity + encounter.update, not dropped as a dup
});

test("nested success quality / captured level never overwrite the combat.started snapshot", () => {
  resetIds();
  let state = createTrackerState();

  const started = applyEvent(
    state,
    combatStarted("wild_1", {
      ts: 1000,
      seq: 1,
      level: 90,
      quality: "common",
      elements: ["normal"],
      gender: "female",
      nature: "brave",
      ivs: { atk: 3, def: 1, hp: 1, spa: 27, spd: 5, spe: 6 },
      qualityMultiplier: 1.02
    }),
    nextId
  );
  state = started.state;
  const startedRow = started.effects[1].row;
  assert.equal(startedRow.level, 90);
  assert.equal(startedRow.quality, "common");
  assert.deepEqual(startedRow.elements, ["normal"]);
  assert.deepEqual(startedRow.ivs, { atk: 3, def: 1, hp: 1, spa: 27, spd: 5, spe: 6 });
  assert.equal(startedRow.qualityMultiplier, 1.02);

  ({ state } = applyEvent(state, lootReceived("wild_1", { ts: 1500, seq: 2 }), nextId));

  // creature.quality/level deliberately disagree with the started snapshot.
  const result = applyEvent(
    state,
    captureSuccess("wild_1", {
      ts: 1600,
      seq: 3,
      creatureQuality: "epic",
      creatureLevel: 1
    }),
    nextId
  );

  const finalize = result.effects.find((e) => e.type === "encounter.finalize");
  assert.equal(finalize.patch.level, undefined);
  assert.equal(finalize.patch.quality, undefined);
  assert.equal(finalize.patch.elements, undefined);
  assert.equal(finalize.patch.gender, undefined);
  assert.equal(finalize.patch.nature, undefined);
  assert.equal(finalize.patch.ivs, undefined);
  assert.equal(finalize.patch.qualityMultiplier, undefined);

  // The row a repository would persist merges patch over the original draft.
  const persisted = { ...startedRow, ...finalize.patch };
  assert.equal(persisted.level, 90);
  assert.equal(persisted.quality, "common");
  assert.deepEqual(persisted.elements, ["normal"]);
  assert.deepEqual(persisted.ivs, { atk: 3, def: 1, hp: 1, spa: 27, spd: 5, spe: 6 });
  assert.equal(persisted.qualityMultiplier, 1.02);
});
