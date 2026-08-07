import { test } from "node:test";
import assert from "node:assert/strict";

import { stableStringify } from "../../domain/canonicalJson.js";

test("same keys in different order produce the same string", () => {
  const a = { b: 1, a: 2, c: 3 };
  const b = { c: 3, a: 2, b: 1 };

  assert.equal(stableStringify(a), stableStringify(b));
});

test("nested objects are sorted recursively", () => {
  const a = { outer: { z: 1, y: 2 }, first: true };
  const b = { first: true, outer: { y: 2, z: 1 } };

  assert.equal(stableStringify(a), stableStringify(b));
});

test("arrays preserve element order", () => {
  const value = { list: [3, 1, 2] };

  assert.equal(stableStringify(value), '{"list":[3,1,2]}');
});

test("different values produce different strings", () => {
  const a = { minQuality: "rare" };
  const b = { minQuality: "epic" };

  assert.notEqual(stableStringify(a), stableStringify(b));
});

test("null is preserved and distinct from omitted/undefined keys", () => {
  const withNull = { a: null };
  const withUndefined = { a: undefined };

  assert.equal(stableStringify(withNull), '{"a":null}');
  assert.equal(stableStringify(withUndefined), "{}");
  assert.notEqual(
    stableStringify(withNull),
    stableStringify(withUndefined)
  );
});

test("throws for non-serializable top-level values", () => {
  assert.throws(() => stableStringify(() => {}), TypeError);
});
