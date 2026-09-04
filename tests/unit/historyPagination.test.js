import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadHistoryPage,
  mapWithConcurrency
} from "../../userscript/history-view.js";

function session(index) {
  return {
    sessionId: `session-${index}`,
    status: "ended",
    startedAtMs: 10_000 - index,
    accumulatedActiveMs: 1_000
  };
}

test("bounded mapper preserves order and limits concurrent work", async () => {
  let active = 0;
  let peak = 0;
  const pending = [];

  const resultPromise = mapWithConcurrency([1, 2, 3, 4, 5], async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => pending.push(resolve));
    active -= 1;
    return value * 2;
  }, 2);

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(peak, 2);
  while (pending.length > 0) {
    pending.shift()();
    await new Promise((resolve) => setImmediate(resolve));
  }

  assert.deepEqual(await resultPromise, [2, 4, 6, 8, 10]);
});

test("History page requests one lookahead row and exposes the next cursor", async () => {
  const available = Array.from({ length: 21 }, (_, index) => session(index));
  let request;
  let active = 0;
  let peak = 0;

  const page = await loadHistoryPage({
    loadSessions: async (options) => {
      request = options;
      return available;
    },
    loadSessionEncounters: async (sessionId) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return [{ encounterId: `encounter-${sessionId}` }];
    },
    range: { after: 1_000 },
    now: () => 20_000
  });

  assert.deepEqual(request, { after: 1_000, before: Infinity, limit: 21 });
  assert.equal(page.bundles.length, 20);
  assert.equal(page.nextBefore, available[19].startedAtMs);
  assert.equal(peak, 4);
});

test("final History page has no continuation cursor", async () => {
  const page = await loadHistoryPage({
    loadSessions: async () => [session(1), session(2)],
    loadSessionEncounters: async () => []
  });

  assert.equal(page.bundles.length, 2);
  assert.equal(page.nextBefore, null);
});
