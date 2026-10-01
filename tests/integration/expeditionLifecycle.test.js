import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { Window } from "happy-dom";
import { openDatabase } from "../../data/db.js";
import { createSessionsRepository } from "../../data/sessionsRepository.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { createEventPipeline } from "../../services/eventPipeline.js";
import { createProtocolAdapter } from "../../userscript/protocol-adapter.js";
import { computeSessionMetrics } from "../../domain/sessionMetrics.js";
import { createCurrentView } from "../../userscript/current-view.js";
import { createUiMarkup } from "../../userscript/ui-markup.js";

// These are sanitized, minimal shapes from the uploaded expedition WebSocket
// history. IDs and all private/account/authentication fields are excluded.
const RUN = "simulation-expedition-001";
const HUNT_ONE = "simulation-hunt-before";
const HUNT_TWO = "simulation-hunt-after";

function event(type, seq, data, ts = seq * 1000) {
  return { type, seq, ts, data };
}

function started(seq = 585) {
  return event("expedition.run_started", seq, {
    lobby: { id: RUN, status: "running" }, map_id: 261
  });
}

function live(seq, remainingSeconds) {
  return event("expedition.run_live", seq, {
    run_id: RUN, remaining_seconds: remainingSeconds,
    members: [{ away: true, attached: false }]
  });
}

function finished(seq = 15309, reason = "time_up") {
  return event("expedition.run_finished", seq, { run_id: RUN, reason });
}

function combat(seq, wildId, sessionId, zoneId) {
  return event("combat.started", seq, {
    enemy: {
      id: wildId, species_id: "pidgey", level: 60, quality: "epic",
      zone_id: zoneId, map_id: zoneId === "expedition" ? 261 : 14,
      is_shiny: false
    },
    session: { id: sessionId, zone_id: zoneId, auto_capture: null }
  });
}

function loot(seq, wildId, trainerExp = 100) {
  return event("loot.received", seq, {
    wild_monster_id: wildId,
    species_id: "pidgey",
    trainer_exp: trainerExp, pokemon_exp: trainerExp, gold: 10, loot_sell_value: 5
  });
}

function capture(seq, wildId) {
  return event("capture.failed", seq, {
    wild_monster_id: wildId, species_id: "pidgey", species_name: "Pidgey",
    level: 60, quality: "epic", is_shiny: false, capsule_item_id: "ultra",
    capsule_name: "Ultra Ball", supply_cost: 5, chance: .25
  });
}

async function setup() {
  let clock = 1000;
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const pipeline = createEventPipeline(db, { now: () => clock });
  const adapter = createProtocolAdapter({ now: () => clock });
  const sessions = createSessionsRepository(db, { now: () => clock });
  const encounters = createEncountersRepository(db);
  async function ingest(payload) {
    const normalized = adapter.adapt(payload);
    const results = [];
    for (const message of normalized) {
      results.push(await pipeline.handle({ ...message, socketId: 1 }));
    }
    return { normalized, results };
  }
  return { db, pipeline, adapter, sessions, encounters, ingest, clock: (next) => { clock = next; } };
}

test("sanitized Hunt -> Expedition -> Hunt replay isolates encounters and closes only the matched run", async () => {
  const ctx = await setup();
  const { ingest, sessions, encounters, clock } = ctx;

  const waiting = await ingest(event("expedition.lobby_updated", 0, {
    id: RUN, status: "waiting"
  }));
  assert.deepEqual(waiting.normalized, []);
  assert.equal(await sessions.getCurrentReadOnly(), null);

  await ingest(combat(1, "old-hunt-wild", HUNT_ONE, "route-1"));
  const huntBefore = await sessions.getCurrentReadOnly();
  assert.equal(huntBefore.activityKind, "hunt");

  clock(2_000);
  const first = await ingest(started());
  assert.equal(first.normalized.length, 1);
  const expedition = await sessions.getCurrentReadOnly();
  assert.notEqual(expedition.sessionId, huntBefore.sessionId);
  assert.equal(expedition.activityKind, "expedition");
  assert.equal(expedition.activityInstanceId, RUN);
  assert.equal((await encounters.getAll())[0].sessionId, huntBefore.sessionId);

  // A late reward from the old Hunt still patches its original encounter.
  // It must not restart the Expedition clock or count its XP as Expedition XP.
  clock(2_100);
  await ingest(loot(586, "old-hunt-wild", 333));
  let rows = await encounters.getAll();
  assert.equal(rows.find((r) => r.wildMonsterId === "old-hunt-wild").sessionId, huntBefore.sessionId);
  assert.equal(rows.find((r) => r.wildMonsterId === "old-hunt-wild").trainerExp, 333);

  clock(3_000);
  await ingest(live(587, 1798));
  await ingest(event("expedition.run_updated", 589, { id: RUN, status: "running" }));
  // HuntSim's kill counter and map-local sequence are allowed to reset in Expedition.
  await ingest(event("hunt.capture_queue", 590, {
    add: [{ id: 1, sp: "pidgey", lv: 60, x: 1, y: 1 }]
  }));
  const knockout = await ingest(event("hunt.events", 596, [{
    k: "knockout", t: 2, cap: { id: 1, x: 1, y: 1 }
  }]));
  assert.equal(knockout.normalized[0].type, "combat.started");
  assert.equal(knockout.normalized[0].data.enemy.zone_id, "expedition");
  const expEncounter = (await encounters.getAll()).find((r) => r.zoneId === "expedition");
  assert.ok(expEncounter, "Expedition combat is persisted");
  assert.equal(expEncounter.sessionId, expedition.sessionId);

  // An observed zero-second live tick or temporary 'away' is not a finish.
  clock(10_000);
  await ingest(live(15301, 0));
  assert.equal((await sessions.getCurrentReadOnly()).status, "running");

  // Real capture and reward shapes are intentionally stripped to data needed
  // by the existing canonical adapter and the analytics model.
  await ingest(event("capture.failed", 15303, {
    zone_id: "expedition", map_id: 261, wild_monster_id: "server-wild",
    species_id: "pidgey", species_name: "Pidgey", quality: "epic",
    level: 60, is_shiny: false, chance: .25, capsule_item_id: "ultra"
  }, 596_050));
  await ingest(event("loot.received", 15308, {
    session_id: "expedition-transport-session",
    per_kill: [{ seq: 1, exp: 100, trainer_exp: 100, pokemon_exp: 100, gold: 10, items: [] }],
    loot_sell_value: 5
  }, 596_150));

  rows = await encounters.getAll();
  const expRow = rows.find((r) => r.sessionId === expedition.sessionId);
  assert.equal(expRow.captureResult, "failed");
  assert.equal(expRow.trainerExp, 100);
  assert.equal((await sessions.getCurrentReadOnly()).sessionId, expedition.sessionId);

  clock(31_000);
  await ingest(finished());
  let current = await sessions.getCurrentReadOnly();
  assert.equal(current.sessionId, expedition.sessionId);
  assert.equal(current.status, "ended");
  assert.equal(current.endedAtMs, 31_000);
  assert.equal(computeSessionMetrics({ session: current, encounters: await encounters.getBySessionId(current.sessionId), now: 60_000 }).trainerExp, 100);

  // Finish replay, or a late live tick, cannot resume a completed run.
  await ingest(finished(15310));
  await ingest(live(15311, 0));
  assert.equal((await sessions.getCurrentReadOnly()).status, "ended");

  // A late Expedition reward after completion remains on the same session.
  await ingest(event("loot.received", 15312, {
    session_id: "expedition-transport-session",
    per_kill: [{ seq: 2, exp: 50, trainer_exp: 50, pokemon_exp: 50, gold: 5, items: [] }],
    loot_sell_value: 0
  }));
  assert.equal((await sessions.getCurrentReadOnly()).sessionId, expedition.sessionId);
  assert.equal((await sessions.getCurrentReadOnly()).status, "ended");

  // A new session-only HuntSim combat snapshot announces the next Hunt zone.
  // The next actual encounter reuses existing canonical Hunt logic.
  clock(40_000);
  await ingest(event("combat.started", 15313, {
    session: { id: HUNT_TWO, zone_id: "route-1", map_id: 14 }
  }));
  await ingest(combat(15314, "new-hunt-wild", HUNT_TWO, "route-1"));
  current = await sessions.getCurrentReadOnly();
  assert.equal(current.activityKind, "hunt");
  assert.notEqual(current.sessionId, expedition.sessionId);
  assert.notEqual(current.sessionId, huntBefore.sessionId);
  await ingest(loot(15315, "new-hunt-wild", 123));
  const newHuntMetrics = computeSessionMetrics({
    session: await sessions.getCurrentReadOnly(),
    encounters: await encounters.getBySessionId(current.sessionId),
    now: 40_100
  });
  assert.equal(newHuntMetrics.trainerExp, 123);

  // A delayed finish for the previous run must not end the new Hunt.
  await ingest(finished(15316));
  await ingest(live(15317, 0));
  assert.equal((await sessions.getCurrentReadOnly()).sessionId, current.sessionId);
  assert.equal((await sessions.getCurrentReadOnly()).status, "running");
});

test("periodic live recovers a missed start; voluntary finish is idempotent", async () => {
  const { ingest, sessions, clock } = await setup();
  await ingest(live(586, 1200));
  const current = await sessions.getCurrentReadOnly();
  assert.equal(current.activityKind, "expedition");
  // The supplied run contained 896 periodic live frames over its lifetime.
  for (let index = 0; index < 896; index++) {
    clock(5_000 + index * 2_000);
    await ingest(live(600 + index, 1798 - index * 2));
  }
  assert.equal((await sessions.getCurrentReadOnly()).sessionId, current.sessionId);
  clock(1_810_000);
  await ingest(finished(1500, "voluntary"));
  assert.equal((await sessions.getCurrentReadOnly()).status, "ended");
  await ingest(started(1501));
  assert.equal((await sessions.getCurrentReadOnly()).sessionId, current.sessionId);
  assert.equal((await sessions.getCurrentReadOnly()).status, "ended");
});

test("manual Pause stays authoritative over expedition-start signals", async () => {
  const { ingest, sessions } = await setup();
  await ingest(combat(1, "wild", HUNT_ONE, "route-1"));
  const paused = await sessions.pauseManual();
  await ingest(started());
  await ingest(live(586, 1200));
  const current = await sessions.getCurrentReadOnly();
  assert.equal(current.sessionId, paused.sessionId);
  assert.equal(current.status, "paused");
  assert.equal(current.locked, true);
});

test("a reconnect resumes the same run, omitting offline time", async () => {
  const ctx = await setup();
  await ctx.ingest(started());
  const original = await ctx.sessions.getCurrentReadOnly();
  ctx.clock(5_000);
  const paused = await ctx.sessions.recoverOnStartup();
  assert.equal(paused.status, "paused");
  const rebuilt = createEventPipeline(ctx.db, { now: () => 12_000 });
  await rebuilt.handle({ ...live(2000, 40), socketId: 2 });
  const recovered = await ctx.sessions.getCurrentReadOnly();
  assert.equal(recovered.sessionId, original.sessionId);
  assert.equal(recovered.status, "running");
  assert.equal(recovered.activeStartedAtMs, 12_000);
  assert.equal(recovered.accumulatedActiveMs, paused.accumulatedActiveMs);
});

test("a new Hunt explicitly retires the old run against delayed live updates", async () => {
  const ctx = await setup();
  await ctx.ingest(started());
  const expedition = await ctx.sessions.getCurrentReadOnly();
  ctx.clock(2_000);
  const newHunt = await ctx.sessions.forceNewSession();
  assert.notEqual(newHunt.sessionId, expedition.sessionId);
  const rebuilt = createEventPipeline(ctx.db, { now: () => 3_000 });
  await rebuilt.handle({ ...live(2000, 40), socketId: 2 });
  const current = await ctx.sessions.getCurrentReadOnly();
  assert.equal(current.sessionId, newHunt.sessionId);
  assert.equal(current.activityKind, "hunt");
});

test("the first confirmed non-Expedition combat can recover a missing finish signal", async () => {
  const { ingest, sessions } = await setup();
  await ingest(started());
  const prior = await sessions.getCurrentReadOnly();
  await ingest(combat(10, "post-expedition-wild", HUNT_TWO, "route-2"));
  const resumed = await sessions.getCurrentReadOnly();
  assert.notEqual(resumed.sessionId, prior.sessionId);
  assert.equal(resumed.activityKind, "hunt");
  await ingest(live(11, 20));
  assert.equal((await sessions.getCurrentReadOnly()).sessionId, resumed.sessionId);
});

test("late Expedition loot and capture remain on their original run after HuntSim kill-sequence reuse", async () => {
  const ctx = await setup();
  const { ingest, sessions, encounters, clock } = ctx;
  await ingest(started());
  const expSession = await sessions.getCurrentReadOnly();

  // The transport session ID used by loot differs from expedition.run_id.
  // A completed first kill learns this mapping from an observed reward.
  await ingest(event("hunt.capture_queue", 10, {
    add: [{ id: 1, sp: "pidgey", lv: 60 }, { id: 2, sp: "pidgey", lv: 60 }]
  }));
  await ingest(event("hunt.events", 11, [
    { k: "knockout", t: 2, cap: { id: 1 } },
    { k: "knockout", t: 3, cap: { id: 2 } }
  ]));
  await ingest(event("loot.received", 12, {
    session_id: "expedition-transport-id",
    per_kill: [{ seq: 1, trainer_exp: 40, pokemon_exp: 40 }]
  }));

  clock(20_000);
  await ingest(finished(20));
  await ingest(event("combat.started", 21, {
    session: { id: HUNT_TWO, zone_id: "route-2", map_id: 14 }
  }));
  await ingest(event("hunt.capture_queue", 22, {
    add: [{ id: 2, sp: "pidgey", lv: 60 }]
  }));
  await ingest(event("hunt.events", 23, [
    { k: "knockout", t: 2, cap: { id: 2 } }
  ]));
  const returned = await sessions.getCurrentReadOnly();
  assert.equal(returned.activityKind, "hunt");

  // Source transport session and original synthetic wild ID disambiguate
  // identically numbered kills from the former Expedition and the new Hunt.
  clock(21_000);
  await ingest(event("loot.received", 24, {
    session_id: "expedition-transport-id",
    per_kill: [{ seq: 2, trainer_exp: 99, pokemon_exp: 99, gold: 6 }]
  }));
  await ingest(event("capture.failed", 25, {
    zone_id: "expedition", map_id: 261,
    species_id: "pidgey", species_name: "Pidgey",
    level: 60, quality: "epic", chance: .1
  }));

  const oldRows = await encounters.getBySessionId(expSession.sessionId);
  const expSecond = oldRows.find((r) => r.wildMonsterId === `huntsim:${RUN}:2`);
  assert.equal(expSecond.trainerExp, 99);
  assert.equal(expSecond.captureResult, "failed");
  const nextRows = await encounters.getBySessionId(returned.sessionId);
  assert.equal(nextRows.length, 1);
  assert.equal(nextRows[0].trainerExp, null);
  assert.equal(nextRows[0].captureResult, "none");
  assert.equal((await sessions.getCurrentReadOnly()).sessionId, returned.sessionId);

  const ignored = await ingest(event("capture.failed", 26, {
    zone_id: "expedition", map_id: 261, species_id: "unknown-late",
    species_name: "Unmatched"
  }));
  assert.equal(ignored.normalized.length, 0);
  assert.equal((await encounters.getBySessionId(returned.sessionId)).length, 1);
});

test("Expedition capture.success and per-kill loot are counted once in their own session", async () => {
  const ctx = await setup();
  const { ingest, sessions, encounters } = ctx;
  await ingest(started());
  await ingest(event("hunt.capture_queue", 90, {
    add: [{ id: 5, sp: "charmander", lv: 115 }]
  }));
  await ingest(event("hunt.events", 91, [
    { k: "knockout", t: 2, cap: { id: 5 } }
  ]));
  await ingest(event("capture.success", 92, {
    wild_monster_id: "server-capture-id", map_id: 261, zone_id: "expedition",
    species_id: "charmander", species_name: "Charmander",
    chance: .125, auto_sold: false, auto_sell_value: 0,
    creature: {
      species_id: "charmander", quality: "legendary", is_shiny: true,
      ivs: { hp: 31, atk: 22, def: 11, spa: 31, spd: 22, spe: 31 }
    }
  }));
  const reward = await ingest(event("loot.received", 93, {
    session_id: "expedition-transport-id",
    per_kill: [{ seq: 5, trainer_exp: 200, pokemon_exp: 150, gold: 25 }]
  }));
  assert.equal(reward.normalized.length, 1);
  assert.equal(reward.normalized[0].type, "loot.received");
  assert.deepEqual((await ingest(event("hunt.kill_reward", 94, {
    kills: [{ seq: 5, exp: 200 }]
  }))).normalized, []);
  const current = await sessions.getCurrentReadOnly();
  const rows = await encounters.getBySessionId(current.sessionId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].captureResult, "success");
  assert.equal(rows[0].isShiny, true);
  assert.equal(rows[0].quality, "legendary");
  const metrics = computeSessionMetrics({ session: current, encounters: rows, now: 2_000 });
  assert.equal(metrics.captured, 1);
  assert.equal(metrics.failed, 0);
  assert.equal(metrics.trainerExp, 200);
  assert.equal(metrics.pokemonExp, 150);
  assert.equal(metrics.directGold, 25);
});

test("Current header displays EXPEDITION only while that activity is running", () => {
  const window = new Window({ url: "https://test.invalid/" });
  const previous = new Map();
  for (const name of ["document", "localStorage", "HTMLInputElement", "requestAnimationFrame"]) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true, writable: true,
      value: name === "requestAnimationFrame" ? window.requestAnimationFrame.bind(window) : window[name]
    });
  }
  try {
    const host = window.document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = createUiMarkup();
    window.document.documentElement.appendChild(host);
    const view = createCurrentView(shadow);
    const metrics = (status, activityKind) => ({
      status, activityKind, activeMs: 30_000, seen: 1,
      rarities: Object.fromEntries(["weak", "common", "uncommon", "rare", "epic", "legendary", "mythical"]
        .map((key) => [key, { seen: 0, captured: 0, failed: 0 }]))
    });
    const encounters = [{
      encounterId: "e1", speciesId: "pidgey", speciesName: "Pidgey",
      startedAtMs: 1000, captureResult: "none", quality: "epic"
    }];
    view.render({ metrics: metrics("running", "hunt"), encounters, sessionId: "h", encounterSnapshotVersion: 1 });
    assert.equal(shadow.querySelector(".status-row > span").textContent, "Pidgey");
    view.render({ metrics: metrics("running", "expedition"), encounters, sessionId: "e", encounterSnapshotVersion: 2 });
    assert.equal(shadow.querySelector(".status-row > span").textContent, "EXPEDITION");
    view.render({ metrics: metrics("paused", "expedition"), encounters, sessionId: "e", encounterSnapshotVersion: 2 });
    assert.equal(shadow.querySelector(".status-row > span").textContent, "Pidgey");
    view.render({ metrics: metrics("running", "hunt"), encounters, sessionId: "h2", encounterSnapshotVersion: 3 });
    assert.equal(shadow.querySelector(".status-row > span").textContent, "Pidgey");
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    window.happyDOM.abort();
  }
});
