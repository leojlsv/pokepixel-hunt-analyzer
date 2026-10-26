import test from "node:test";
import assert from "node:assert/strict";
import { createSegmentedEncounterList } from
  "../../userscript/segmented-encounter-list.js";
import { compareEncounters, sortEncounters } from
  "../../userscript/encounter-list-model.js";

const row = (id, timestamp, extra = {}) => ({
  encounterId: `enc-${id}`, captureAtMs: timestamp,
  qualityMultiplier: id % 7, ivTotal: id % 186,
  captureResult: id % 3 ? "failed" : "success", ...extra
});
const upperBound = (items, value, compare) => {
  let low = 0, high = items.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compare(value, items[mid]) < 0) high = mid;
    else low = mid + 1;
  }
  return low;
};

test("segmented Current list equals canonical comparator over 40k front/mid/tail inserts and splits", () => {
  const sort = { key: "capturedAt", direction: "desc" };
  const compare = (a, b) => compareEncounters(a, b, sort);
  const list = createSegmentedEncounterList(compare, { blockSize: 64 });
  const initial = sortEncounters(Array.from({ length: 12_000 }, (_, i) =>
    row(i, i * 100)), sort);
  list.replaceSorted(initial);
  assert.equal(list.length, initial.length);
  assert.equal(list.get(0), initial[0]);
  assert.equal(list.get(-1), undefined);
  assert.equal(list.get(initial.length), undefined);
  const canonical = [...initial];
  let state = 0x47a9fed3;
  for (let i = 0; i < 40_000; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const choice = state >>> 0;
    // Front, tail, middle and 100-way tied timestamps; no monotone-only toy.
    const time = i % 4 === 0 ? 9_000_000 + i :
      i % 4 === 1 ? -1_000_000 - i :
        i % 4 === 2 ? 1_200_000 + choice % 18_000 : 5_555;
    const candidate = row(12_000 + i, time);
    const expectedIndex = upperBound(canonical, candidate, compare);
    canonical.splice(expectedIndex, 0, candidate);
    assert.equal(list.insert(candidate), expectedIndex,
      "Segmented upper bound must match Array.splice at iteration " + i);
    if (i % 1001 === 0 || i === 39_999) {
      assert.equal(list.length, canonical.length);
      const stats = list.stats();
      assert.equal(stats.length, canonical.length);
      assert.ok(stats.maxBlockLength <= 128,
        "No source segment may grow past 2*blockSize");
      for (let at = 0; at < canonical.length; at += 79) {
        assert.strictEqual(list.get(at), canonical[at],
          "Segmented rank drifted at " + at);
      }
      assert.strictEqual(list.get(canonical.length - 1), canonical.at(-1));
    }
  }
  assert.equal(list.findIndex(item => item.encounterId === "enc-12345"),
    canonical.findIndex(item => item.encounterId === "enc-12345"));
  const index = list.findIndex(item => item.encounterId === "enc-12345");
  const corrected = { ...list.get(index), capsuleName: "Ultra Ball" };
  list.set(index, corrected);
  assert.strictEqual(list.get(index), corrected);
  assert.equal(list.findIndex(item => item.encounterId === "absent"), -1);
  assert.throws(() => list.set(-1, corrected), RangeError);
  assert.throws(() => list.set(list.length, corrected), RangeError);
});

test("replaceSorted resets ranks and respects all Current sort modes and Unicode ties", () => {
  let sort = { key: "capturedAt", direction: "desc" };
  const compare = (a, b) => compareEncounters(a, b, sort);
  const list = createSegmentedEncounterList(compare, { blockSize: 16 });
  const input = [
    row("é", 100, { qualityMultiplier: 2.2, ivTotal: 12 }),
    row("e\u0301", 100, { qualityMultiplier: 2.2, ivTotal: 12 }),
    row("z", 90, { qualityMultiplier: 1.8, ivTotal: 17 }),
    row("x", 101, { qualityMultiplier: null, ivTotal: NaN })
  ];
  for (const key of ["capturedAt", "quality", "iv"]) {
    for (const direction of ["asc", "desc"]) {
      sort = { key, direction };
      const baseline = sortEncounters(input, sort);
      list.replaceSorted(baseline);
      assert.deepEqual(Array.from({ length: list.length }, (_, i) => list.get(i)),
        baseline);
      const newRow = row(`new-${key}-${direction}`, 100,
        { qualityMultiplier: 2.2, ivTotal: 12 });
      const expectedIndex = upperBound(baseline, newRow, compare);
      assert.equal(list.insert(newRow), expectedIndex);
      baseline.splice(expectedIndex, 0, newRow);
      assert.deepEqual(Array.from({ length: list.length }, (_, i) => list.get(i)),
        baseline);
    }
  }
  list.replaceSorted([]);
  assert.equal(list.length, 0);
  assert.equal(list.insert(row("first", 1)), 0);
  assert.equal(list.get(0).encounterId, "enc-first");
  assert.equal(list.stats().blockCount, 1);
});

test("segmented list rejects malformed parameters and has no writable public array", () => {
  assert.throws(() => createSegmentedEncounterList(null), TypeError);
  assert.throws(() => createSegmentedEncounterList((a,b)=>a-b,
    { blockSize: 0 }), TypeError);
  const list = createSegmentedEncounterList((a, b) => a - b);
  assert.throws(() => list.replaceSorted(null), TypeError);
  assert.throws(() => list.findIndex(null), TypeError);
  assert.equal(Object.isFrozen(list), true);
});
