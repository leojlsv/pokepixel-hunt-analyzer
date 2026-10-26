import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { sameEncounterCacheImage } from
  "../../userscript/encounter-cache-equivalence.js";

test("Current before-image comparison preserves nonfinite/null/undefined and own-key semantics", () => {
  const row = { encounterId: "x", ivTotal: NaN,
    qualityMultiplier: Infinity,
    captureAtMs: undefined, nested: {
      loot: [{ itemId: "á", qty: -0 }, "Ω", null],
      n: 45n
    } };
  assert.equal(sameEncounterCacheImage(row, structuredClone(row)), true);
  assert.equal(sameEncounterCacheImage(row,
    { ...row, ivTotal: null }), false);
  assert.equal(sameEncounterCacheImage(row,
    { ...row, qualityMultiplier: null }), false);
  assert.equal(sameEncounterCacheImage(row,
    { ...row, captureAtMs: null }), false);
  const { captureAtMs: _discarded, ...withoutUndefined } = row;
  assert.equal(sameEncounterCacheImage(row, withoutUndefined), false);
  assert.equal(sameEncounterCacheImage(row,
    { ...row, nested: { ...row.nested, n: 45 } }), false);
  assert.equal(sameEncounterCacheImage(row,
    { ...row, nested: { loot: [{ itemId: "á", qty: 0 }, "Ω", null], n: 45n } }), false);
});

test("field order does not invalidate exact cache images; unsupported graphs fail closed", () => {
  const foreign = runInNewContext('({ encounterId: "x", ivs: { hp: 31 } })');
  assert.equal(sameEncounterCacheImage(
    foreign, { encounterId: "x", ivs: { hp: 31 } }), true,
  "IndexedDB/source snapshots crossing window/sandbox realms must compare");
  assert.equal(sameEncounterCacheImage(
    { encounterId: "x", quality: "epic", ivs: { hp: 31, atk: 2 } },
    { ivs: { atk: 2, hp: 31 }, quality: "epic", encounterId: "x" }), true);
  assert.equal(sameEncounterCacheImage(
    { a: "e\u0301" }, { a: "é" }), false);
  assert.equal(sameEncounterCacheImage(
    { x: new Date(0) }, { x: new Date(0) }), false);
  assert.equal(sameEncounterCacheImage(
    { x: new Map([["a", 1]]) }, { x: new Map([["a", 1]]) }), false);
  const shared = { x: 1 };
  assert.equal(sameEncounterCacheImage(
    { a: shared, b: shared }, { a: { x: 1 }, b: { x: 1 } }), false);
  const cyclic = { a: 1 };
  cyclic.self = cyclic;
  assert.equal(sameEncounterCacheImage(cyclic, cyclic), false);
  const revoke = Proxy.revocable({ encounterId: "x" }, {});
  revoke.revoke();
  assert.equal(sameEncounterCacheImage(revoke.proxy,
    { encounterId: "x" }), false,
  "revoked object proxies fail closed without disrupting the pipeline");
});
