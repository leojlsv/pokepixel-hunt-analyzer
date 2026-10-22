import assert from "node:assert/strict";
import test from "node:test";
import {
  CATCH_CHANCE_DECIMALS_KEY,
  normalizeCatchChanceDecimals,
  readCatchChanceDecimals,
  saveCatchChanceDecimals
} from "../../userscript/catch-chance-preferences.js";

test("Catch Chance decimals default to three and reject invalid stored values", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  assert.equal(readCatchChanceDecimals(storage), 3);
  for (const invalid of ["", " ", "-1", "7", "1.5", "NaN", "foo"]) {
    values.set(CATCH_CHANCE_DECIMALS_KEY, invalid);
    assert.equal(readCatchChanceDecimals(storage), 3, `invalid stored ${invalid}`);
  }
  assert.equal(normalizeCatchChanceDecimals(null), 3);
  assert.equal(normalizeCatchChanceDecimals(undefined), 3);
  assert.equal(normalizeCatchChanceDecimals(0), 0);
  assert.equal(normalizeCatchChanceDecimals(6), 6);

  assert.equal(saveCatchChanceDecimals("0", storage), 0);
  assert.equal(readCatchChanceDecimals(storage), 0);
  assert.equal(saveCatchChanceDecimals("6", storage), 6);
  assert.equal(readCatchChanceDecimals(storage), 6);
  assert.equal(storage.getItem(CATCH_CHANCE_DECIMALS_KEY), "6");
});

test("Catch Chance preference is usable when localStorage is blocked", () => {
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); }
  };
  assert.equal(readCatchChanceDecimals(blocked), 3);
  assert.equal(saveCatchChanceDecimals(5, blocked), 5);
});
