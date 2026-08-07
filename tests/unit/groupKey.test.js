import { test } from "node:test";
import assert from "node:assert/strict";

import { buildGroupKey } from "../../domain/groupKey.js";

test("builds a deterministic species|level|configId key", () => {
  const key = buildGroupKey({
    speciesId: "kabutops",
    level: 90,
    configId: "abc123"
  });

  assert.equal(key, "kabutops|90|abc123");
});

test("same inputs always produce the same key", () => {
  const input = { speciesId: 12, level: 42, configId: "deadbeef" };

  assert.equal(buildGroupKey(input), buildGroupKey({ ...input }));
});

test("different level produces a different key", () => {
  const a = buildGroupKey({ speciesId: "eevee", level: 10, configId: "x" });
  const b = buildGroupKey({ speciesId: "eevee", level: 11, configId: "x" });

  assert.notEqual(a, b);
});

test("different configId produces a different key", () => {
  const a = buildGroupKey({ speciesId: "eevee", level: 10, configId: "x" });
  const b = buildGroupKey({ speciesId: "eevee", level: 10, configId: "y" });

  assert.notEqual(a, b);
});

test("throws when speciesId is missing", () => {
  assert.throws(
    () => buildGroupKey({ level: 10, configId: "x" }),
    TypeError
  );
});

test("throws when level is missing or not finite", () => {
  assert.throws(
    () => buildGroupKey({ speciesId: "eevee", configId: "x" }),
    TypeError
  );

  assert.throws(
    () =>
      buildGroupKey({ speciesId: "eevee", level: NaN, configId: "x" }),
    TypeError
  );
});

test("throws when configId is missing or empty", () => {
  assert.throws(
    () => buildGroupKey({ speciesId: "eevee", level: 10, configId: "" }),
    TypeError
  );
});

test("level 0 is a valid, distinct level", () => {
  const key = buildGroupKey({ speciesId: "magikarp", level: 0, configId: "x" });

  assert.equal(key, "magikarp|0|x");
});
