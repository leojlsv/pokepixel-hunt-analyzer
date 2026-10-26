import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase } from "../../data/db.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { createSessionsRepository } from "../../data/sessionsRepository.js";
import { computeSessionMetrics } from "../../domain/sessionMetrics.js";
import { createEventPipeline } from "../../services/eventPipeline.js";
import { createProtocolAdapter } from "../../userscript/protocol-adapter.js";

async function setup() {
  let clock = 1_000;
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const adapter = createProtocolAdapter({ now: () => clock });
  const pipeline = createEventPipeline(db, { now: () => clock });
  const encounters = createEncountersRepository(db);
  const sessions = createSessionsRepository(db, { now: () => clock });

  async function ingest(type, seq, data, ts = clock, socketId = 1) {
    const canonical = adapter.adapt({ type, seq, ts, data });
    const results = [];
    for (const event of canonical) {
      results.push(await pipeline.handle({ ...event, socketId }));
    }
    return { canonical, results };
  }

  async function startHunt(sid, seq = 1, zone = "same-zone") {
    await ingest("hunt.analyzer_reset", seq, { active: true, session_id: sid, zone_id: zone });
    await ingest("combat.started", seq + 1, {
      session: { id: sid, zone_id: zone, map_id: 14 }
    });
  }

  async function kill(killSeq, rawSeq = 10) {
    await ingest("hunt.capture_queue", rawSeq - 1, {
      add: [{ id: killSeq, lv: 4, sp: "pidgey" }]
    });
    return ingest("hunt.events", rawSeq, [
      { k: "knockout", t: 2, cap: { id: killSeq } }
    ]);
  }

  async function reward(sid, killSeq, xp, rawSeq = 11, socketId = 1) {
    return ingest("loot.received", rawSeq, {
      session_id: sid,
      per_kill: [{ seq: killSeq, exp: xp, trainer_exp: xp, pokemon_exp: xp, gold: 1 }]
    }, clock, socketId);
  }

  async function metrics(sessionId) {
    const session = await sessions.getCurrentReadOnly();
    const rows = await encounters.getBySessionId(sessionId ?? session.sessionId);
    return computeSessionMetrics({ session, encounters: rows, now: clock });
  }

  return { adapter, pipeline, encounters, sessions, ingest, startHunt, kill, reward, metrics,
    setClock(value) { clock = value; } };
}

test("same-zone restart with recycled transport session must not route new kill to retired hunt", async () => {
  const ctx = await setup();
  await ctx.startHunt("recycled");
  await ctx.kill(1);
  const previous = await ctx.sessions.getCurrentReadOnly();
  ctx.setClock(2_000);
  await ctx.startHunt("recycled", 20);
  await ctx.kill(2, 25);
  const result = await ctx.reward("recycled", 2, 200, 26);

  assert.equal(result.canonical.filter((e) => e.type === "loot.received").length, 1);
  assert.equal(result.results.at(-1)?.ok, true);
  assert.equal(result.results.at(-1)?.duplicate, undefined);
  const current = await ctx.sessions.getCurrentReadOnly();
  assert.equal(current.sessionId, previous.sessionId, "transport reset must not force New Hunt");
  assert.equal((await ctx.metrics()).trainerExp, 200);
  assert.equal((await ctx.metrics()).pokemonExp, 200);
  const rows = await ctx.encounters.getBySessionId(previous.sessionId);
  assert.equal(rows.find((row) => row.trainerExp === 200)?.speciesId, "pidgey");
  assert.equal(rows.find((row) => row.wildMonsterId.endsWith(":1"))?.trainerExp, null);
});

test("restarted raw seq and kill seq on the same socket produce a distinct reward exactly once", async () => {
  const ctx = await setup();
  await ctx.startHunt("same-id");
  await ctx.kill(7, 10);
  await ctx.ingest("capture.failed", 12, {
    species_id: "pidgey", species_name: "Pidgey", zone_id: "same-zone",
    map_id: 14, level: 4, quality: "common", chance: .2
  });
  await ctx.reward("same-id", 7, 50, 11);
  assert.equal((await ctx.metrics()).trainerExp, 50);
  const initial = await ctx.sessions.getCurrentReadOnly();
  ctx.setClock(2_000);
  await ctx.startHunt("same-id", 1);
  const restarted = await ctx.kill(7, 10);
  const updated = await ctx.reward("same-id", 7, 200, 11);

  assert.equal(restarted.results[0]?.duplicate, undefined, "new start is not a replay of A");
  assert.equal(updated.results.at(-1)?.duplicate, undefined, "new reward is not a replay of A");
  assert.equal((await ctx.metrics()).trainerExp, 250);
  assert.equal((await ctx.metrics()).pokemonExp, 250);
  const current = await ctx.sessions.getCurrentReadOnly();
  assert.equal(current.sessionId, initial.sessionId);
  const rows = await ctx.encounters.getBySessionId(current.sessionId);
  assert.equal(rows.length, 2, "same-scope kill sequence must not overwrite the old encounter");
  assert.equal(new Set(rows.map((r) => r.wildMonsterId)).size, 2);

  // A same-generation replay of B is still idempotent.
  const replay = await ctx.reward("same-id", 7, 200, 11);
  assert.equal(replay.results.at(-1)?.duplicate, true);
  assert.equal((await ctx.metrics()).trainerExp, 250);
});

test("a late reward with the retired transport session belongs only to the previous Hunt", async () => {
  const ctx = await setup();
  await ctx.startHunt("old-id");
  await ctx.kill(9);
  const oldSession = await ctx.sessions.getCurrentReadOnly();
  await ctx.ingest("hunt.stopped", 12, {});
  ctx.setClock(3_000);
  await ctx.startHunt("new-id", 20, "city-return-zone");
  await ctx.kill(9, 25);
  const newSession = await ctx.sessions.getCurrentReadOnly();
  assert.notEqual(oldSession.sessionId, newSession.sessionId);

  const late = await ctx.reward("old-id", 9, 77, 27);
  assert.equal(late.canonical.filter((e) => e.type === "loot.received").length, 1);
  const oldRows = await ctx.encounters.getBySessionId(oldSession.sessionId);
  const newRows = await ctx.encounters.getBySessionId(newSession.sessionId);
  assert.equal(oldRows[0].trainerExp, 77);
  assert.equal(newRows[0].trainerExp, null);
  assert.equal((await ctx.metrics()).trainerExp, 0);

  const currentReward = await ctx.reward("new-id", 9, 150, 28);
  assert.equal(currentReward.canonical.filter((e) => e.type === "loot.received").length, 1);
  assert.equal((await ctx.metrics()).trainerExp, 150);
  assert.equal((await ctx.encounters.getBySessionId(oldSession.sessionId))[0].trainerExp, 77);
});

test("recycled transport session plus overlapping pending kill seq fails closed instead of cross-applying loot", async () => {
  const ctx = await setup();
  await ctx.startHunt("recycled");
  await ctx.kill(7);
  ctx.setClock(2_000);
  await ctx.startHunt("recycled", 20);
  await ctx.kill(7, 25);
  const reward = await ctx.reward("recycled", 7, 333, 26);
  assert.deepEqual(reward.canonical.filter((e) => e.type === "loot.received"), [],
    "identical transport id and pending kill seq cannot establish reward generation");
  assert.equal(ctx.adapter.snapshot().ambiguousLootEntriesDropped, 1);
  const rows = await ctx.encounters.getAll();
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.trainerExp === null));
});

test("same-session reconnect reannouncement does not split or retire a live kill", async () => {
  const ctx = await setup();
  await ctx.startHunt("connection-stable");
  await ctx.kill(13);
  const before = ctx.adapter.snapshot();
  assert.ok(before.killsBySeq.has(13));

  await ctx.ingest("combat.started", 28, {
    session: { id: "connection-stable", zone_id: "same-zone", map_id: 14 }
  });
  const after = ctx.adapter.snapshot();
  assert.equal(after.protocolGeneration, before.protocolGeneration);
  assert.ok(after.killsBySeq.has(13), "metadata refresh must not retire an active kill");

  const result = await ctx.reward("connection-stable", 13, 120, 29);
  assert.equal(result.canonical.filter((e) => e.type === "loot.received").length, 1);
  assert.equal((await ctx.metrics()).trainerExp, 120);
});

test("retired loot sharing a recycled session ID cannot be attributed from kill seq alone", async () => {
  const ctx = await setup();
  await ctx.startHunt("recycled");
  await ctx.kill(101);
  ctx.setClock(2_000);
  await ctx.startHunt("recycled", 20);
  await ctx.kill(202, 25);

  const late = await ctx.reward("recycled", 101, 90, 26);
  assert.equal(late.canonical.filter((e) => e.type === "loot.received").length, 0,
    "without upstream run ID, this could also be B loot with a missing B knockout");
  assert.equal(ctx.adapter.snapshot().ambiguousLootEntriesDropped, 1);
  const recent = await ctx.reward("recycled", 202, 200, 27);
  assert.equal(recent.canonical.filter((e) => e.type === "loot.received").length, 1);
  assert.equal((await ctx.metrics()).trainerExp, 200);
  assert.equal((await ctx.metrics()).pokemonExp, 200);

  const rows = await ctx.encounters.getAll();
  const old = rows.find((row) => row.wildMonsterId === "huntsim:recycled:101");
  const fresh = rows.find((row) => row.wildMonsterId === "huntsim:recycled:202:g1");
  assert.equal(old?.trainerExp, null);
  assert.equal(fresh?.trainerExp, 200);
  assert.equal(rows.length, 2);
});

test("an overlapping late capture with no generation authority cannot finalize B as A", async () => {
  const ctx = await setup();
  await ctx.startHunt("recycled");
  await ctx.kill(1);
  ctx.setClock(2_000);
  await ctx.startHunt("recycled", 20);
  await ctx.kill(2, 25);

  const terminal = await ctx.ingest("capture.failed", 26, {
    species_id: "pidgey", species_name: "Pidgey", zone_id: "same-zone",
    map_id: 14, level: 4, quality: "common", chance: .2
  });
  assert.deepEqual(terminal.canonical, []);
  assert.equal(ctx.adapter.getDiagnosticsSnapshot().ambiguousTerminalEventsDropped, 1);
  const rows = await ctx.encounters.getAll();
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.captureResult === "none"));
});

test("a restart on a new socket still counts once without duplicate or old-session contamination", async () => {
  const ctx = await setup();
  await ctx.startHunt("id-A");
  await ctx.kill(4, 10);
  await ctx.ingest("capture.failed", 12, {
    species_id: "pidgey", zone_id: "same-zone", map_id: 14, chance: .2
  });
  await ctx.reward("id-A", 4, 50, 11);

  ctx.setClock(2_000);
  await ctx.startHunt("id-B", 20);
  await ctx.kill(4, 10); // repeat same raw sequence on a fresh transport
  const result = await ctx.reward("id-B", 4, 80, 11, 2);
  assert.equal(result.results.at(-1)?.duplicate, undefined);
  const current = await ctx.sessions.getCurrentReadOnly();
  const rows = await ctx.encounters.getBySessionId(current.sessionId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].trainerExp, 80);
  assert.equal((await ctx.metrics()).trainerExp, 80);
  assert.equal((await ctx.encounters.getAll()).length, 2);
});

test("an unknown transport session and an empty per_kill array never invent EXP", async () => {
  const ctx = await setup();
  await ctx.startHunt("authoritative");
  await ctx.kill(3);
  const foreign = await ctx.reward("unknown-id", 3, 999, 30);
  assert.deepEqual(foreign.canonical, []);

  const empty = await ctx.ingest("loot.received", 31, {
    session_id: "authoritative", trainer_exp: 999,
    pokemon_exp: 999, per_kill: []
  });
  assert.deepEqual(empty.canonical, []);
  assert.equal((await ctx.metrics()).trainerExp, 0);
  assert.equal((await ctx.metrics()).pokemonExp, 0);
});

test("an exact old reward-frame replay cannot poison the new generation's reused sequence", async () => {
  const ctx = await setup();
  await ctx.startHunt("same-id");
  await ctx.kill(7, 10);
  await ctx.ingest("capture.failed", 12, {
    species_id: "pidgey", zone_id: "same-zone", map_id: 14, chance: .2
  });
  const originalData = {
    session_id: "same-id",
    per_kill: [{ seq: 7, exp: 50, trainer_exp: 50, pokemon_exp: 50, gold: 1 }]
  };
  await ctx.ingest("loot.received", 11, originalData, 1_000);
  assert.equal((await ctx.metrics()).trainerExp, 50);

  ctx.setClock(2_000);
  await ctx.startHunt("same-id");
  await ctx.kill(7, 10);

  const staleReplay = await ctx.ingest("loot.received", 11, originalData, 1_000);
  assert.deepEqual(staleReplay.canonical, [], "exact old frame must not attach to new B");
  const actualB = await ctx.reward("same-id", 7, 200, 11);
  assert.equal(actualB.results.at(-1)?.duplicate, undefined);
  assert.equal((await ctx.metrics()).trainerExp, 250);
  assert.equal((await ctx.metrics()).pokemonExp, 250);
  const rows = await ctx.encounters.getAll();
  assert.deepEqual(rows.map((row) => row.trainerExp).sort((a, b) => a - b), [50, 200]);
  assert.equal(ctx.adapter.getDiagnosticsSnapshot().replayedLootFramesDropped, 1);
});

test("old raw reward replay without session_id cannot poison a same-socket restarted kill", async () => {
  const ctx = await setup();
  await ctx.startHunt("same-id");
  await ctx.kill(7, 10);
  await ctx.ingest("capture.failed", 12, {
    species_id: "pidgey", zone_id: "same-zone", map_id: 14, chance: .2
  });
  const oldData = {
    per_kill: [{ seq: 7, exp: 50, trainer_exp: 50, pokemon_exp: 50, gold: 1 }]
  };
  await ctx.ingest("loot.received", 11, oldData, 1_000);
  assert.equal((await ctx.metrics()).trainerExp, 50);

  ctx.setClock(2_000);
  await ctx.startHunt("same-id");
  await ctx.kill(7, 10);
  const stale = await ctx.ingest("loot.received", 11, oldData, 1_000);
  assert.deepEqual(stale.canonical, []);

  const actual = await ctx.ingest("loot.received", 11, {
    per_kill: [{ seq: 7, exp: 200, trainer_exp: 200, pokemon_exp: 200, gold: 1 }]
  }, 2_000);
  assert.equal(actual.results.at(-1)?.duplicate, undefined);
  assert.equal((await ctx.metrics()).trainerExp, 250);
  assert.equal((await ctx.metrics()).pokemonExp, 250);
  assert.equal(ctx.adapter.getDiagnosticsSnapshot().replayedLootFramesDropped, 1);
});

test("first delayed A reward without session_id is ambiguous when B reuses its pending kill sequence", async () => {
  const ctx = await setup();
  await ctx.startHunt("recycled");
  await ctx.kill(7, 10);
  ctx.setClock(2_000);
  await ctx.startHunt("recycled", 20);
  await ctx.kill(7, 25);

  const lateFirstLoot = await ctx.ingest("loot.received", 26, {
    per_kill: [{ seq: 7, trainer_exp: 50, pokemon_exp: 50, exp: 50 }]
  }, 2_000);
  assert.deepEqual(lateFirstLoot.canonical, [],
    "a never-before-seen A reward without transport identity must not update B");
  assert.equal(ctx.adapter.getDiagnosticsSnapshot().ambiguousLootEntriesDropped, 1);
  const current = await ctx.sessions.getCurrentReadOnly();
  const rows = await ctx.encounters.getBySessionId(current.sessionId);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.trainerExp === null && row.pokemonExp === null));

  // A later distinct sequence B reward with a recycled transport ID is also
  // ambiguous; neither loss nor double counting may be hidden as success.
  const b = await ctx.reward("recycled", 7, 200, 27);
  assert.deepEqual(b.canonical, []);
  assert.equal(ctx.adapter.getDiagnosticsSnapshot().ambiguousLootEntriesDropped, 2);
  assert.ok((await ctx.encounters.getAll()).every((row) => row.trainerExp === null));
});
