import test from "node:test";
import assert from "node:assert/strict";
import { retainLiveActiveKeys } from
  "../../userscript/retained-active-keys.js";

test("large Current source is not iterated when there are no live active targets", () => {
  const source = { [Symbol.iterator]() {
    throw new Error("Must not iterate 100k-row source for empty active set");
  } };
  assert.deepEqual(retainLiveActiveKeys(new Set(), source), new Set());
});

test("live target reconciliation preserves legacy ID String coercion and drops missing keys", () => {
  const source = [
    { encounterId: 123 }, { encounterId: "00001" },
    { encounterId: "é" }, { encounterId: "e\u0301" },
    { encounterId: 0 }, { encounterId: null }
  ];
  const active = new Set(["123", "00001", "é", "e\u0301", "0", "missing"]);
  const result = retainLiveActiveKeys(active, source);
  assert.deepEqual(result, new Set(["123", "00001", "é", "e\u0301"]));
  assert.deepEqual(active, new Set(["123", "00001", "é", "e\u0301", "0", "missing"]),
    "the input live set must remain immutable to callers");
});

test("stops scanning once every active key is verified, without allocating source-wide ID Set", () => {
  let visited = 0;
  const source = {
    *[Symbol.iterator]() {
      yield { encounterId: "target" };
      visited++;
      throw new Error("Should not inspect remaining 100k encounters");
    }
  };
  assert.deepEqual(retainLiveActiveKeys(new Set(["target"]), source), new Set(["target"]));
  assert.equal(visited, 0);
});
