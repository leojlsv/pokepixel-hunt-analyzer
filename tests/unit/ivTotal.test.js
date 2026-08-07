import { test } from "node:test";
import assert from "node:assert/strict";

import { sumIvs } from "../../domain/ivTotal.js";

test("sums all 6 IV stats", () => {
  const total = sumIvs({ atk: 3, def: 1, hp: 1, spa: 27, spd: 5, spe: 6 });
  assert.equal(total, 43);
});

test("missing stats contribute 0", () => {
  const total = sumIvs({ atk: 10, def: 5 });
  assert.equal(total, 15);
});

test("non-finite stats contribute 0 instead of NaN", () => {
  const total = sumIvs({ atk: "not-a-number", def: 5, hp: undefined });
  assert.equal(total, 5);
});

test("null/undefined input returns 0", () => {
  assert.equal(sumIvs(null), 0);
  assert.equal(sumIvs(undefined), 0);
});
