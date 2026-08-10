import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";

import { normalizeEvent } from "../../domain/events.js";
import { openDatabase, STORE_NAMES } from "../../data/db.js";
import { createRepository } from "../../data/repository.js";
import { createEncountersRepository } from "../../data/encountersRepository.js";
import { createEventPipeline } from "../../services/eventPipeline.js";

const FIXTURE_URL = new URL(
  "../fixtures/rhyxus_hunting2.regression.json",
  import.meta.url
);

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_URL, "utf8"));
}

/**
 * The stored array is newest-first (see tests/fixtures/README.md). `ts` is
 * the documented replay ordering signal (docs/PROTOCOL_AND_ANALYTICS.md §9
 * "Timestamp priority") — sorting by it ascending reproduces real-time
 * arrival order far more faithfully than `seq`, which this same fixture
 * proves is not globally monotonic (duplicate values across reconnects).
 * A stable sort keeps original relative order for the handful of same-ts
 * events.
 */
function chronological(events) {
  return events.slice().sort((a, b) => a.ts - b.ts);
}

// Replaying all 4300+ fixture events through the real pipeline against
// fake-indexeddb costs ~25s (measured, Fase 5 step 3 performance audit —
// fake-indexeddb is a pure-JS polyfill, far slower per-operation than a
// real browser's native IndexedDB; this cost is a test-suite artifact, not
// a production concern, confirmed separately by benchmarking the actual
// Current/History/Compare read paths at this same fixture's scale). Two
// tests below each need their own full replay's end state — memoizing it
// here means the expensive part only ever runs once no matter which test
// (or both) actually execute, instead of ~50s combined.
let replayOnce = null;

function replayFixture() {
  if (!replayOnce) {
    replayOnce = (async () => {
      const fixture = loadFixture();
      const events = chronological(fixture.events);

      const db = await openDatabase({ indexedDBFactory: new IDBFactory() });
      const pipeline = createEventPipeline(db, { now: () => Date.now() });

      const resultCounts = { ok: 0, ignored: 0 };

      for (const event of events) {
        const result = await pipeline.handle({
          type: event.type,
          seq: event.seq,
          ts: event.ts,
          socketId: 1, // single continuous connection for this fixture
          data: event.data
        });

        if (result.ok) {
          resultCounts.ok += 1;
        } else {
          resultCounts.ignored += 1;
        }
      }

      return { fixture, events, db, resultCounts };
    })();
  }

  return replayOnce;
}

test("domain/events.js recognizes every event in the fixture (no silent drops)", () => {
  const fixture = loadFixture();

  const eventCounts = {};
  for (const event of fixture.events) {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;

    const normalized = normalizeEvent(event.type, event.data);
    assert.ok(
      normalized !== null,
      `expected ${event.type} (seq=${event.seq}) to normalize successfully`
    );
  }

  assert.deepEqual(eventCounts, fixture.expected.eventCounts);
});

test("capture.failed quality tally matches the fixture's documented baseline", () => {
  const fixture = loadFixture();

  const failedByQuality = {};
  for (const event of fixture.events) {
    if (event.type !== "capture.failed") continue;

    const quality = event.data.quality ?? "unknown";
    failedByQuality[quality] = (failedByQuality[quality] ?? 0) + 1;
  }

  assert.deepEqual(failedByQuality, fixture.expected.failedByQuality);

  const rarePlusFailed =
    (failedByQuality.rare ?? 0) +
    (failedByQuality.epic ?? 0) +
    (failedByQuality.legendary ?? 0) +
    (failedByQuality.mythical ?? 0);

  assert.equal(rarePlusFailed, fixture.expected.rarePlusFailed);
});

test("the full event pipeline replays all 4000+ fixture events without throwing", async (t) => {
  const { fixture, events, db, resultCounts } = await replayFixture();

  // Every event in this fixture is one of the 6 documented types with a
  // well-formed payload, so none should be dropped as unrecognized/malformed.
  assert.equal(resultCounts.ignored, 0);
  assert.equal(resultCounts.ok, events.length);

  const encounters = await createEncountersRepository(db).getAll();

  // At minimum one persisted encounter per combat.started (wild-id reuse
  // finalizes via patch, it never removes the earlier row) — plus however
  // many loot/capture events arrived orphaned.
  assert.ok(encounters.length >= fixture.expected.eventCounts["combat.started"]);

  t.diagnostic(`persisted ${encounters.length} encounter rows`);
});

test("the Automatic Hunt lifecycle splits the fixture into its 3 real Hunts", async () => {
  // This fixture contains 3 genuine, cleanly-separated Hunts
  // (server_session_0001/0002/0003, each with its own zoneId, ~50min-1h40
  // apart) — a real-data proof of domain/huntLifecycle.js's boundary
  // decision, not just the synthetic cases in tests/unit/huntLifecycle.test.js.
  const { db } = await replayFixture();

  const sessions = await createRepository(db, STORE_NAMES.SESSIONS).getAll();

  assert.equal(sessions.length, 3);
  assert.equal(sessions.filter((s) => s.status === "ended").length, 2);
  assert.equal(sessions.filter((s) => s.status !== "ended").length, 1);
  assert.deepEqual(
    new Set(sessions.map((s) => s.serverSessionId)),
    new Set(["server_session_0001", "server_session_0002", "server_session_0003"])
  );
});
