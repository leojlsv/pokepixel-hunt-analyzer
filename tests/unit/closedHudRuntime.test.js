import { test } from "node:test";
import assert from "node:assert/strict";

import { splitHudSymbolValue } from "../../userscript/closed-hud-runtime.js";

test("Closed HUD supply symbols are separated from their numeric value", () => {
  assert.deepEqual(splitHudSymbolValue("✓12"), { symbol: "✓", value: "12" });
  assert.deepEqual(splitHudSymbolValue("✕135"), { symbol: "✕", value: "135" });
  assert.deepEqual(splitHudSymbolValue("$19.1K"), { symbol: "$", value: "19.1K" });
  assert.deepEqual(splitHudSymbolValue("↓147"), { symbol: "↓", value: "147" });
  assert.equal(splitHudSymbolValue("8.16%"), null);
  assert.equal(splitHudSymbolValue("1.953"), null);
});
