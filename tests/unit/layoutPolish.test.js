import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const RUNTIME = await readFile(
  new URL("../../userscript/closed-hud-runtime.js", import.meta.url),
  "utf8"
);

test("HUD configuration remains beside Misc in every UI mode", () => {
  assert.match(RUNTIME, /const MISC_TAB_ID = "alerts-tab"/);
  assert.match(RUNTIME, /settingsButton\.classList\.remove\("alpha-button"\)/);
  assert.match(RUNTIME, /settingsButton\.classList\.add\("tab"\)/);
  assert.match(RUNTIME, /miscTab\.after\(settingsButton\)/);
  assert.match(RUNTIME, /huntTime\.before\(settingsButton\)/);
});

test("header metadata shows only the compact v-prefixed version label", () => {
  assert.match(RUNTIME, /text\.startsWith\("Userscript "\)/);
  assert.match(RUNTIME, /version\.textContent = `v\$\{text\.slice\("Userscript "\.length\)\}`/);
});

test("minimize is pinned to the far-right edge in shared and Mobile headers", () => {
  assert.match(
    RUNTIME,
    /\.pha-hud-topbar #pha-close \{[\s\S]*position:absolute;[\s\S]*right:10px;[\s\S]*transform:translateY\(-50%\);/
  );
  assert.match(
    RUNTIME,
    /:host\(\[data-ui-mode="mobile"\]\) \.pha-hud-topbar #pha-close \{[\s\S]*right:8px;[\s\S]*width:36px;[\s\S]*height:36px;/
  );
});

test("Desktop panel compacts old minimum width instead of stretching content", () => {
  assert.match(RUNTIME, /const DESKTOP_COMPACT_WIDTH_PX = 400/);
  assert.match(RUNTIME, /const DESKTOP_COMPACT_WIDTH_STORAGE_KEY = "pokepixel_hunt_analyzer_desktop_compact_width_v1"/);
  assert.match(RUNTIME, /function compactDesktopPanelOnce\(\)/);
  assert.match(RUNTIME, /width > DESKTOP_COMPACT_WIDTH_PX && width <= 431/);
  assert.match(RUNTIME, /scrollbar-gutter:auto/);
});

test("UI mode and opacity are staged out of the header and mounted inside Misc", () => {
  assert.match(RUNTIME, /const INTERFACE_SECTION_ID = "pha-interface-settings"/);
  assert.match(RUNTIME, /function stageInterfaceControls\(\)/);
  assert.match(RUNTIME, /function ensureMiscInterfaceSettings\(\)/);
  assert.match(RUNTIME, /<h3>Interface<\/h3>/);
  assert.match(RUNTIME, /<span>UI Mode<\/span>/);
  assert.match(RUNTIME, /<span>Opacity<\/span>/);
  assert.match(RUNTIME, /modeSlot\.appendChild\(modeSelect\)/);
  assert.match(RUNTIME, /alphaSlot\.appendChild\(alphaButton\)/);
});

test("HUD is an exclusive view rather than an inline collapsing section", () => {
  assert.match(RUNTIME, /function showHudView\(\)/);
  assert.match(RUNTIME, /historyTab\?\.click\(\)/);
  assert.match(RUNTIME, /getElementById\("view-current"\)\?\.setAttribute\("hidden", ""\)/);
  assert.match(RUNTIME, /getElementById\("view-history"\)\?\.setAttribute\("hidden", ""\)/);
  assert.match(RUNTIME, /getElementById\("view-alerts"\)\?\.setAttribute\("hidden", ""\)/);
  assert.match(RUNTIME, /settings\.classList\.add\("pha-hud-exclusive-view"\)/);
  assert.match(RUNTIME, /event\.stopImmediatePropagation\(\)/);
  assert.match(RUNTIME, /querySelectorAll\('\[data-view\], #alerts-tab'\)/);
});

test("closed HUD exposes persistent 0, 1 and 2 column modes", () => {
  assert.match(RUNTIME, /const HUD_COLUMNS_STORAGE_KEY = "pokepixel_hunt_analyzer_closed_hud_columns_v1"/);
  assert.match(RUNTIME, /const HUD_COLUMN_WIDTHS = Object\.freeze\(\{ 0: 52, 1: 140, 2: 220 \}\)/);
  assert.match(RUNTIME, /<option value="0">0 · PX only<\/option>/);
  assert.match(RUNTIME, /<option value="1">1 column<\/option>/);
  assert.match(RUNTIME, /<option value="2">2 columns<\/option>/);
  assert.match(RUNTIME, /launcher\.dataset\.hudColumns = String\(hudColumns\)/);
});

test("one-column HUD limits active rows and blocks incompatible two-slot width", () => {
  assert.match(RUNTIME, /hudColumns === 1 && \(index === 0 \|\| index === 2\)/);
  assert.match(RUNTIME, /option\.disabled = hudColumns === 1 && active && option\.value === "2"/);
  assert.match(RUNTIME, /widthSelect\.value === "2"\) widthSelect\.value = "1"/);
  assert.match(RUNTIME, /classList\.remove\("is-wide", "is-consumed"\)/);
});

test("zero-column HUD keeps only PX and disables widget presets", () => {
  assert.match(RUNTIME, /data-hud-columns="0"\]\s*\.pha-hud-grid \{\s*\n\s*display:none !important;/);
  assert.match(RUNTIME, /preset\.disabled = hudColumns === 0/);
  assert.match(RUNTIME, /reset\.disabled = hudColumns === 0/);
});

test("Mobile capture summary stays in one four-column row", () => {
  assert.match(
    RUNTIME,
    /:host\(\[data-ui-mode="mobile"\]\) \.capture-strip \{\s*\n\s*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/
  );
  assert.doesNotMatch(RUNTIME, /grid-template-rows: minmax\(40px, auto\) 30px/);
});
