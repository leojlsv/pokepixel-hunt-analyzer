import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";

import { openDatabase, STORE_NAMES, SCHEMA_VERSION } from "../../data/db.js";
import { createRepository } from "../../data/repository.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { createSessionsRepository } from "../../data/sessionsRepository.js";
import { createEventPipeline } from "../../services/eventPipeline.js";

async function setup(now = () => 0, options = {}) {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
  const pipeline = createEventPipeline(db, { now, ...options });
  return { db, pipeline };
}

function combatStarted({
  wildId,
  level = 90,
  quality = "common",
  autoCapture,
  serverSessionId = "server_session_0001",
  zoneId = "zone_0001",
  seq,
  ts
}) {
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
        zone_id: zoneId
      },
      session: {
        id: serverSessionId,
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

test("same serverSessionId+zoneId after a pause resumes the same local session", async () => {
  let clock = 0;
  const { db, pipeline } = await setup(() => clock);

  await pipeline.handle(combatStarted({ wildId: "wild_1", seq: 1, ts: 1000 }));
  const firstSession = (await createRepository(db, STORE_NAMES.SESSIONS).getAll())[0];

  clock = 5000;
  await pipeline.handle({ type: "hunt.stopped", seq: 2, ts: 5000, socketId: 1, data: {} });

  clock = 6000;
  await pipeline.handle(combatStarted({ wildId: "wild_2", seq: 3, ts: 6000 }));

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].sessionId, firstSession.sessionId);
  assert.equal(sessions[0].status, "running");
});

test("a confirmed new serverSessionId starts a new local session and ends the previous one", async () => {
  const { db, pipeline } = await setup();

  await pipeline.handle(
    combatStarted({ wildId: "wild_1", serverSessionId: "server_session_0001", zoneId: "zone_0001", seq: 1, ts: 1000 })
  );
  await pipeline.handle(lootReceived({ wildId: "wild_1", seq: 2, ts: 1100 }));
  await pipeline.handle(captureFailed({ wildId: "wild_1", seq: 3, ts: 1200 }));

  await pipeline.handle(
    combatStarted({ wildId: "wild_2", serverSessionId: "server_session_0002", zoneId: "zone_0002", seq: 4, ts: 5_000_000 })
  );
  await pipeline.handle(lootReceived({ wildId: "wild_2", seq: 5, ts: 5_000_100 }));
  await pipeline.handle(captureFailed({ wildId: "wild_2", seq: 6, ts: 5_000_200 }));

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(sessions.length, 2);
  assert.equal(sessions.filter((s) => s.status === "ended").length, 1);
  assert.equal(sessions.filter((s) => s.status === "running").length, 1);

  const encounters = await createEncountersRepository(db).getAll();
  assert.equal(encounters.length, 2);
  assert.notEqual(encounters[0].sessionId, encounters[1].sessionId);
});

test("a confirmed zoneId change starts a new local Hunt even when serverSessionId stays the same", async () => {
  const { db, pipeline } = await setup();

  await pipeline.handle(
    combatStarted({ wildId: "wild_1", serverSessionId: "server_session_0001", zoneId: "zone_0001", seq: 1, ts: 1000 })
  );
  await pipeline.handle(
    combatStarted({ wildId: "wild_2", serverSessionId: "server_session_0001", zoneId: "zone_0002", seq: 2, ts: 2000 })
  );

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(sessions.length, 2);
  assert.equal(sessions.filter((s) => s.status === "ended").length, 1);
  assert.equal(sessions.filter((s) => s.status === "running").length, 1);

  const current = await createSessionsRepository(db).getCurrentReadOnly();
  assert.equal(current.zoneId, "zone_0002");
  assert.equal(current.serverSessionId, "server_session_0001");

  const encounters = await createEncountersRepository(db).getAll();
  assert.equal(encounters.length, 2);
  assert.notEqual(encounters[0].sessionId, encounters[1].sessionId);
});

test("a manual Pause survives the next combat.started — it does not auto-resume", async () => {
  let clock = 0;
  const { db, pipeline } = await setup(() => clock);
  const sessionsRepo = createSessionsRepository(db, { now: () => clock });

  await pipeline.handle(
    combatStarted({ wildId: "wild_1", serverSessionId: "server_session_0001", zoneId: "zone_0001", seq: 1, ts: 1000 })
  );

  clock = 5000;
  const paused = await sessionsRepo.pauseManual(); // the "Pause" button
  assert.equal(paused.status, "paused");
  assert.equal(paused.locked, true);

  clock = 6000;
  await pipeline.handle(
    combatStarted({ wildId: "wild_2", serverSessionId: "server_session_0001", zoneId: "zone_0001", seq: 2, ts: 6000 })
  );

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].status, "paused"); // still paused, not resumed
  assert.equal(sessions[0].accumulatedActiveMs, 5000); // clock did not advance

  // The encounter itself still gets recorded against the (paused) session.
  const encounters = await createEncountersRepository(db).getAll();
  assert.equal(encounters.length, 2);
  assert.equal(encounters[0].sessionId, sessions[0].sessionId);
  assert.equal(encounters[1].sessionId, sessions[0].sessionId);
});

test("a manual Pause is not broken by a genuinely new serverSessionId either — only Resume/New Hunt", async () => {
  const { db, pipeline } = await setup();
  const sessionsRepo = createSessionsRepository(db);

  await pipeline.handle(
    combatStarted({ wildId: "wild_1", serverSessionId: "server_session_0001", zoneId: "zone_0001", seq: 1, ts: 1000 })
  );
  await sessionsRepo.pauseManual();

  await pipeline.handle(
    combatStarted({ wildId: "wild_2", serverSessionId: "server_session_0002", zoneId: "zone_0002", seq: 2, ts: 2000 })
  );

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(sessions.length, 1); // no split happened while locked
  assert.equal(sessions[0].status, "paused");
  assert.equal(sessions[0].serverSessionId, "server_session_0001"); // not adopted
});

test("a manual End Hunt survives the next combat.started — stays ended, data still recorded", async () => {
  const { db, pipeline } = await setup();
  const sessionsRepo = createSessionsRepository(db);

  await pipeline.handle(
    combatStarted({ wildId: "wild_1", serverSessionId: "server_session_0001", zoneId: "zone_0001", seq: 1, ts: 1000 })
  );
  const ended = await sessionsRepo.endManual(); // the "End Hunt" button
  assert.equal(ended.status, "ended");

  await pipeline.handle(
    combatStarted({ wildId: "wild_2", serverSessionId: "server_session_0001", zoneId: "zone_0001", seq: 2, ts: 2000 })
  );

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].status, "ended"); // still ended, no new session

  const encounters = await createEncountersRepository(db).getAll();
  assert.equal(encounters.length, 2);
  assert.equal(encounters[1].sessionId, sessions[0].sessionId);
});

test("New Hunt always starts fresh and unlocked, even right after a manual Pause/End Hunt", async () => {
  const { db, pipeline } = await setup();
  const sessionsRepo = createSessionsRepository(db);

  await pipeline.handle(
    combatStarted({ wildId: "wild_1", serverSessionId: "server_session_0001", zoneId: "zone_0001", seq: 1, ts: 1000 })
  );
  const ended = await sessionsRepo.endManual();

  const fresh = await sessionsRepo.forceNewSession(); // the "New Hunt" button
  assert.notEqual(fresh.sessionId, ended.sessionId);
  assert.equal(fresh.locked, false);

  await pipeline.handle(
    combatStarted({ wildId: "wild_2", serverSessionId: "server_session_0002", zoneId: "zone_0002", seq: 2, ts: 2000 })
  );

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();
  assert.equal(sessions.length, 2);

  const current = await sessionsRepo.getCurrentReadOnly();
  assert.equal(current.sessionId, fresh.sessionId);
  assert.equal(current.status, "running");
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

  const diagnostics = await pipeline.getDiagnosticsSnapshot();
  assert.equal(diagnostics.eventsReceived, 1);
  assert.equal(diagnostics.eventsIgnored, 1);
  assert.equal(diagnostics.parseErrors, 0);
});

// ============================================================
// Diagnostics (docs/DEVELOPMENT.md §9 — Fase 5, no UI yet)
// ============================================================

test("a known event type with a malformed payload counts as a parse error, not an ignore", async () => {
  const { pipeline } = await setup();

  // combat.started with no `enemy` at all — normalizeEvent() rejects it
  // (domain/events.js), but the type itself is recognized.
  const result = await pipeline.handle({
    type: "combat.started",
    seq: 1,
    ts: 1000,
    socketId: 1,
    data: {}
  });

  assert.deepEqual(result, { ok: false, reason: "ignored" });

  const diagnostics = await pipeline.getDiagnosticsSnapshot();
  assert.equal(diagnostics.eventsReceived, 1);
  assert.equal(diagnostics.parseErrors, 1);
  assert.equal(diagnostics.eventsIgnored, 0);
});

test("eventsReceived counts every message handled, valid or not", async () => {
  const { pipeline } = await setup();

  await pipeline.handle(combatStarted({ wildId: "wild_1", seq: 1, ts: 1000 }));
  await pipeline.handle({ type: "some.unknown.event", seq: 2, ts: 1100, socketId: 1, data: {} });
  await pipeline.handle(lootReceived({ wildId: "wild_1", seq: 3, ts: 1200 }));

  const diagnostics = await pipeline.getDiagnosticsSnapshot();
  assert.equal(diagnostics.eventsReceived, 3);
});

test("resending the exact same socketId|type|seq counts as a duplicate, not a new orphan/effect", async () => {
  const { db, pipeline } = await setup();

  const event = combatStarted({ wildId: "wild_1", seq: 1, ts: 1000 });
  await pipeline.handle(event);
  await pipeline.handle(event); // exact resend — same socketId/type/seq

  const encounters = await createEncountersRepository(db).getAll();
  assert.equal(encounters.length, 1); // no duplicate row created

  const diagnostics = await pipeline.getDiagnosticsSnapshot();
  assert.equal(diagnostics.duplicateEvents, 1);
  assert.equal(diagnostics.orphanEvents, 0);
});

test("production dedupe registry stays within its configured event limit", async () => {
  const { pipeline } = await setup(() => 0, { dedupeEventLimit: 3 });

  for (let seq = 1; seq <= 5; seq += 1) {
    await pipeline.handle(
      combatStarted({ wildId: `wild_${seq}`, seq, ts: seq * 1000 })
    );
  }

  const diagnostics = await pipeline.getDiagnosticsSnapshot();
  assert.equal(diagnostics.dedupeRegistrySize, 3);
});

test("production dedupe rejects recent duplicates and eventually evicts the oldest key", async () => {
  const { pipeline } = await setup(() => 0, { dedupeEventLimit: 2 });
  const oldest = combatStarted({ wildId: "wild_1", seq: 1, ts: 1000 });

  const firstResult = await pipeline.handle(oldest);
  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.terminalAlert, null);
  assert.equal(firstResult.changedEncounters.length, 1);
  assert.deepEqual(await pipeline.handle(oldest), { ok: true, duplicate: true });

  await pipeline.handle(combatStarted({ wildId: "wild_2", seq: 2, ts: 2000 }));
  await pipeline.handle(combatStarted({ wildId: "wild_3", seq: 3, ts: 3000 }));

  const replayAfterEviction = await pipeline.handle(oldest);
  assert.equal(replayAfterEviction.ok, true);
  assert.equal(replayAfterEviction.duplicate, undefined);

  const diagnostics = await pipeline.getDiagnosticsSnapshot();
  assert.equal(diagnostics.dedupeRegistrySize, 2);
  assert.equal(diagnostics.duplicateEvents, 1);
});

test("event pipeline rejects invalid dedupe limits", async () => {
  const db = await openDatabase({ indexedDBFactory: new IDBFactory() });

  assert.throws(
    () => createEventPipeline(db, { dedupeEventLimit: 0 }),
    /positive safe integer/
  );
});

test("an orphan encounter (loot with no active correlated encounter) counts as an orphan event", async () => {
  const { pipeline } = await setup();

  await pipeline.handle(lootReceived({ wildId: "wild_9", seq: 1, ts: 1000 }));

  const diagnostics = await pipeline.getDiagnosticsSnapshot();
  assert.equal(diagnostics.orphanEvents, 1);
  assert.equal(diagnostics.duplicateEvents, 0);
});

test("getDiagnosticsSnapshot reports live activeEncounters, the current schema version, and the injected appVersion", async () => {
  const { pipeline } = await setup(() => 0, { appVersion: "1.0.0-test" });

  await pipeline.handle(combatStarted({ wildId: "wild_1", seq: 1, ts: 1000 }));

  const diagnostics = await pipeline.getDiagnosticsSnapshot();
  assert.equal(diagnostics.activeEncounters, 1); // wild_1 still in progress, no loot/result yet
  assert.equal(diagnostics.dbVersion, SCHEMA_VERSION);
  assert.equal(diagnostics.appVersion, "1.0.0-test");
});

test("getDiagnosticsSnapshot defaults appVersion to null when the caller does not inject one", async () => {
  const { pipeline } = await setup();

  const diagnostics = await pipeline.getDiagnosticsSnapshot();
  assert.equal(diagnostics.appVersion, null);
});
