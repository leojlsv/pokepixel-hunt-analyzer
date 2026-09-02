import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeHudColumns } from "../../userscript/closed-hud-runtime.js";

const RUNTIME = await readFile(
  new URL("../../userscript/closed-hud-runtime.js", import.meta.url),
  "utf8"
);

test("Closed HUD columns persist independently and default to the current two-column layout", () => {
  assert.equal(normalizeHudColumns(null), 2);
  assert.equal(normalizeHudColumns(""), 2);
  assert.equal(normalizeHudColumns("0"), 0);
  assert.equal(normalizeHudColumns("1"), 1);
  assert.equal(normalizeHudColumns("2"), 2);
  assert.equal(normalizeHudColumns("invalid"), 2);

  assert.match(RUNTIME, /const HUD_COLUMNS_STORAGE_KEY = "pokepixel_hunt_analyzer_closed_hud_columns_v1"/);
  assert.match(RUNTIME, /const DEFAULT_HUD_COLUMNS = 2/);
  assert.match(RUNTIME, /localStorage\.setItem\(HUD_COLUMNS_STORAGE_KEY, String\(normalizeHudColumns\(columns\)\)\)/);
});

test("0 columns renders only the PX launcher mark and disables HUD configuration controls", () => {
  assert.match(RUNTIME, /data-hud-columns="0"[\s\S]*width:52px !important/);
  assert.match(RUNTIME, /data-hud-columns="0"[\s\S]*\.pha-hud-grid \{[\s\S]*display:none !important/);
  assert.match(RUNTIME, /presetSelect\.disabled = hudColumns === 0/);
  assert.match(RUNTIME, /resetButton\.disabled = hudColumns === 0/);
  assert.match(RUNTIME, /"PX icon only"/);
});

test("1 column exposes only two independent widget slots and blocks two-slot rarity width", () => {
  assert.match(RUNTIME, /data-hud-columns="1"[\s\S]*width:145px !important/);
  assert.match(RUNTIME, /\[data-hud-slot="2"\][\s\S]*\[data-hud-slot="3"\][\s\S]*display:none !important/);
  assert.match(RUNTIME, /const activeSlots = hudColumns === 2 \? 4 : hudColumns === 1 \? 2 : 0/);
  assert.match(RUNTIME, /twoSlotOption\.disabled = hudColumns < 2/);
  assert.match(RUNTIME, /hudColumns === 1 && widthSelect\.value === "2"/);
  assert.match(RUNTIME, /widthSelect\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.match(RUNTIME, /scheduleHudColumnConstraints\(\)/);
});

test("2 columns remains the four-unit layout and column changes request viewport reclamping", () => {
  assert.match(RUNTIME, /"2 · 4 units"/);
  assert.match(RUNTIME, /"2 columns · 4 layout units"/);
  assert.match(RUNTIME, /requestLauncherClamp\(\)/);
  assert.match(RUNTIME, /window\.dispatchEvent\(new Event\("resize"\)\)/);
});
