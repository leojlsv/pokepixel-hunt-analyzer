import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { createCurrentLootAccumulator } from "../../userscript/current-loot-aggregate.js";
import { aggregateLootHistory } from "../../userscript/loot-history-model.js";

const SESSION_ID = "long-hunt";

function row(encounterId, changes = {}) {
  return {
    encounterId,
    sessionId: SESSION_ID,
    speciesId: "pikachu",
    speciesName: "Pikachu",
    gold: 0,
    lootSellValue: 0,
    autoSold: false,
    autoSellValue: 0,
    lootItems: [],
    ...changes
  };
}

function oracle(rows, sessionId = SESSION_ID) {
  return aggregateLootHistory(
    sessionId == null ? [] : [{ session: { sessionId }, encounters: rows }]
  );
}

test("incremental Loot matches full aggregation across late loot, corrections, duplicate IDs and deletion", () => {
  const rows = [
    row("a", { lootAtMs: 100, gold: 20, lootItems: [
      { itemId: "straw", qty: 2 }, { itemId: "straw", qty: 1 }, { itemId: "invalid", qty: 0 }
    ] }),
    row("b", { speciesId: "eevee", speciesName: "Eevee", lootAtMs: 101, gold: 8,
      lootSellValue: 2, autoSold: true, autoSellValue: 30,
      lootItems: [{ itemId: "straw", qty: 2 }] }),
    row("c", { speciesId: "eevee", speciesName: "Eevee", captureResult: "none" })
  ];
  const aggregate = createCurrentLootAccumulator();
  assert.deepEqual(aggregate.hydrate(rows, { sessionId: SESSION_ID }), oracle(rows));

  function changes(previous, next, expectChanged = true) {
    const index = rows.findIndex((entry) => entry.encounterId === (previous || next).encounterId);
    if (next == null) rows.splice(index, 1);
    else if (index >= 0) rows[index] = next;
    else rows.push(next);
    const result = aggregate.applyChanges([{ previous, next }], {
      sessionId: SESSION_ID, encounterCount: rows.length
    });
    assert.deepEqual(result, {
      applied: true, changed: expectChanged, visibleChanged: expectChanged
    });
    assert.deepEqual(aggregate.getSummary(), oracle(rows));
  }

  // HuntSim can capture an encounter before its delayed loot arrives.
  const late = { ...rows[2], lootAtMs: 103, gold: 15, lootSellValue: 5,
    lootItems: [{ itemId: "straw", qty: 4 }, { item_id: "map_fragment", qty: 1 }] };
  changes(rows[2], late);

  // Repeated items count quantities twice, but one Drop per encounter.
  assert.equal(aggregate.getSummary().items.find((item) => item.itemId === "straw").drops, 3);
  assert.equal(aggregate.getSummary().items.find((item) => item.itemId === "straw").qty, 9);

  const correction = { ...late, lootAtMs: null, gold: 4, lootSellValue: 0,
    speciesId: "charizard", speciesName: "Charizard",
    lootItems: [{ itemId: "map_fragment", qty: 6 }] };
  changes(late, correction);
  const rename = { ...rows[0], speciesName: "Pikachu (variant)", autoSold: true, autoSellValue: 2 };
  changes(rows[0], rename);
  changes(rows[1], null);
  changes(rename, { ...rename, updatedAtMs: 99 }, false);

  const reintroduced = row("b", { speciesId: "squirtle", speciesName: "Squirtle",
    lootAtMs: 104, lootItems: [{ itemId: "straw", qty: 10 }] });
  changes(null, reintroduced);

  const first = rows.find((entry) => entry.encounterId === "a");
  const next = { ...first, gold: 3, lootItems: [{ itemId: "straw", qty: 5 }] };
  const last = { ...next, gold: 1, lootItems: [{ itemId: "straw", qty: 7 }] };
  const index = rows.indexOf(first);
  rows[index] = last;
  assert.deepEqual(aggregate.applyChanges([
    { previous: first, next },
    { previous: next, next: last }
  ], { sessionId: SESSION_ID, encounterCount: rows.length }),
  { applied: true, changed: true, visibleChanged: true });
  assert.deepEqual(aggregate.getSummary(), oracle(rows));

  assert.deepEqual(aggregate.hydrate([], { sessionId: "next-hunt" }),
    oracle([], "next-hunt"), "new Hunt discards previous item and source aggregates");
});

test("delta validation fails closed on stale revisions, mismatched before rows or incomplete batches", () => {
  const previous = row("a", { gold: 7, lootItems: [{ itemId: "x", qty: 2 }] });
  const next = { ...previous, gold: 12 };
  const introduced = row("b", { lootAtMs: 123, gold: 3 });
  const model = createCurrentLootAccumulator();
  model.hydrate([previous], { sessionId: SESSION_ID });
  const unchanged = model.getSummary();

  for (const [deltas, count] of [
    [[{ previous: { ...previous, gold: 999 }, next }], 1],
    [[{ previous: null, next }], 1],
    [[{ previous, next }], 2],
    [[{ previous, next: { ...next, encounterId: "other" } }], 1],
    [[{ previous, next: { ...next, sessionId: "other-session" } }], 1],
    [[{ previous }], 1],
    [null, 1]
  ]) {
    assert.equal(model.applyChanges(deltas, { sessionId: SESSION_ID, encounterCount: count }).applied, false);
    assert.equal(model.getSummary(), unchanged, "rejected batch must not partially mutate");
  }

  assert.deepEqual(model.applyChanges([
    { previous, next }, { previous: null, next: introduced }
  ], { sessionId: SESSION_ID, encounterCount: 2 }),
  { applied: true, changed: true, visibleChanged: true });
  assert.deepEqual(model.getSummary(), oracle([next, introduced]));

  const duplicateIdRows = [previous, { ...previous, lootItems: [{ itemId: "x", qty: 7 }] }];
  assert.deepEqual(model.hydrate(duplicateIdRows, { sessionId: SESSION_ID }), oracle(duplicateIdRows),
    "malformed full snapshots retain exact legacy aggregation");
  assert.equal(model.applyChanges([{ previous, next }], {
    sessionId: SESSION_ID, encounterCount: duplicateIdRows.length
  }).applied, false, "duplicate IDs cannot be incrementally keyed");
});

test("first-source labels survive consecutive oldest-record removal without a member map", () => {
  const rows = [
    row("a", { speciesName: "First", lootAtMs: 100, lootItems: [{ itemId: "stone", qty: 1 }] }),
    row("b", { speciesName: "Second", lootAtMs: 101, lootItems: [{ itemId: "stone", qty: 2 }] }),
    row("c", { speciesName: "Third", lootAtMs: 102, lootItems: [{ itemId: "stone", qty: 3 }] })
  ];
  const aggregate = createCurrentLootAccumulator();
  assert.deepEqual(aggregate.hydrate(rows, { sessionId: SESSION_ID }), oracle(rows));

  for (const id of ["a", "b"]) {
    const index = rows.findIndex((entry) => entry.encounterId === id);
    const [previous] = rows.splice(index, 1);
    assert.equal(aggregate.applyChanges([{ previous, next: null }], {
      sessionId: SESSION_ID, encounterCount: rows.length
    }).applied, true);
    assert.deepEqual(aggregate.getSummary(), oracle(rows));
  }
  const previous = rows[0];
  const next = { ...previous, speciesName: "Third (corrected)", lootItems: [{ itemId: "stone", qty: 4 }] };
  rows[0] = next;
  assert.equal(aggregate.applyChanges([{ previous, next }], {
    sessionId: SESSION_ID, encounterCount: rows.length
  }).applied, true);
  assert.deepEqual(aggregate.getSummary(), oracle(rows));
});

test("seeded mixed 2k-row replay stays equivalent after 400 inserts, updates and removals", () => {
  let seed = 0x6d2b79f5;
  const random = (limit) => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) % limit;
  };
  const names = ["Pikachu", "Pikachu alternate", "Eevee", "Squirtle"];
  const makeRandom = (id) => {
    const speciesId = ["pikachu", "pikachu", "eevee", "squirtle"][random(4)];
    return row(id, {
      speciesId,
      speciesName: names[random(4)],
      lootAtMs: random(4) === 0 ? null : random(99999),
      gold: random(201),
      lootSellValue: random(100),
      autoSold: random(2) === 0,
      autoSellValue: random(500),
      lootItems: Array.from({ length: random(4) }, () => ({
        itemId: `item_${random(15)}`, qty: random(5) + 1
      }))
    });
  };
  const rows = Array.from({ length: 2_000 }, (_, index) => makeRandom(`initial-${index}`));
  const model = createCurrentLootAccumulator();
  assert.deepEqual(model.hydrate(rows, { sessionId: SESSION_ID }), oracle(rows));

  for (let step = 0; step < 400; step++) {
    const operation = random(10);
    let previous = null;
    let next = null;
    if (operation < 2 || rows.length === 0) {
      next = makeRandom(`added-${step}`);
      rows.push(next);
    } else {
      const index = random(rows.length);
      previous = rows[index];
      if (operation === 2) rows.splice(index, 1);
      else {
        next = makeRandom(previous.encounterId);
        rows[index] = next;
      }
    }
    const applied = model.applyChanges([{ previous, next }], {
      sessionId: SESSION_ID, encounterCount: rows.length
    });
    assert.equal(applied.applied, true);
    assert.equal(applied.changed, true);
    assert.deepEqual(model.getSummary(), oracle(rows), `seeded replay diverged at step ${step}`);
  }
});

test("50k Hunt: accepted deltas match a full recomputation without reading the full array", () => {
  const records = Array.from({ length: 50_000 }, (_, index) => row(`enc-${index}`, {
    speciesId: index % 3 === 0 ? "pikachu" : index % 3 === 1 ? "eevee" : "squirtle",
    speciesName: index % 3 === 0 ? "Pikachu" : index % 3 === 1 ? "Eevee" : "Squirtle",
    lootAtMs: index + 1,
    gold: index % 11,
    lootSellValue: index % 7,
    autoSold: index % 13 === 0,
    autoSellValue: index % 13 === 0 ? 100 : 0,
    lootItems: [{ itemId: `drop_${index % 19}`, qty: index % 5 + 1 }]
  }));
  const model = createCurrentLootAccumulator();
  const initialStart = performance.now();
  model.hydrate(records, { sessionId: SESSION_ID });
  const hydrationMs = performance.now() - initialStart;
  assert.deepEqual(model.getSummary(), oracle(records));

  // The changed session snapshot is already cached by the caller. Deliberately
  // refuse index/iteration reads to prove the delta path touches no 50k rows.
  const deltas = [];
  for (let index = 49_600; index < 49_800; index++) {
    const previous = records[index];
    const next = { ...previous, lootSellValue: previous.lootSellValue + 4,
      lootItems: [{ itemId: `drop_${index % 19}`, qty: 2 }, { itemId: "late_rare", qty: 1 }] };
    records[index] = next;
    deltas.push({ previous, next });
  }
  const noReadArray = new Proxy(records, {
    get(target, key, receiver) {
      if (key === Symbol.iterator || typeof key === "string" && /^\d+$/.test(key)) {
        throw new Error("incremental path attempted to traverse full Current encounters");
      }
      return Reflect.get(target, key, receiver);
    }
  });
  assert.equal(noReadArray.length, 50_000);
  const incrementalStart = performance.now();
  const updated = model.applyChanges(deltas, { sessionId: SESSION_ID, encounterCount: noReadArray.length });
  const incrementalMs = performance.now() - incrementalStart;
  assert.deepEqual(updated, { applied: true, changed: true, visibleChanged: true });

  const fullStart = performance.now();
  const reference = oracle(records);
  const fullMs = performance.now() - fullStart;
  assert.deepEqual(model.getSummary(), reference);
  assert.ok(model.getSummary().items.find((item) => item.itemId === "late_rare"));
  console.info(`50k Loot stress: hydrate=${hydrationMs.toFixed(2)}ms, 200 deltas=${incrementalMs.toFixed(2)}ms, full recompute=${fullMs.toFixed(2)}ms`);
});
