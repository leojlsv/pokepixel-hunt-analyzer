import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const RUNTIME = await readFile(
  new URL("../../userscript/closed-hud-runtime.js", import.meta.url),
  "utf8"
);

test("HUD configuration moves out of the topbar and sits beside Misc in every UI mode", () => {
  assert.match(RUNTIME, /const MISC_TAB_ID = "alerts-tab"/);
  assert.match(RUNTIME, /settingsButton\.classList\.remove\("alpha-button"\)/);
  assert.match(RUNTIME, /settingsButton\.classList\.add\("tab"\)/);
  assert.match(RUNTIME, /miscTab\.parentElement !== tabs\) tabs\.appendChild\(miscTab\)/);
  assert.match(RUNTIME, /miscTab\.after\(settingsButton\)/);
  assert.match(RUNTIME, /huntTime\.before\(settingsButton\)/);
});

test("HUD opens as an exclusive navigation view instead of inline collapse", () => {
  assert.match(RUNTIME, /const HUD_SETTINGS_ID = "pha-hud-settings"/);
  assert.match(RUNTIME, /function showHudView\(\)/);
  assert.match(RUNTIME, /currentView\.hidden = true/);
  assert.match(RUNTIME, /historyView\.hidden = true/);
  assert.match(RUNTIME, /miscView\.hidden = true/);
  assert.match(RUNTIME, /settings\.hidden = false/);
  assert.match(RUNTIME, /settings\.classList\.add\("pha-hud-exclusive-view"\)/);
  assert.match(RUNTIME, /settingsButton\.classList\.add\("active"\)/);
  assert.match(RUNTIME, /event\.stopImmediatePropagation\(\)/);
  assert.match(RUNTIME, /settingsButton\.addEventListener\("click",[\s\S]*true\);/);
  assert.match(RUNTIME, /function hideHudView\(\)/);
  assert.match(RUNTIME, /tab\.addEventListener\("click", hideHudView\)/);
  assert.match(RUNTIME, /miscTab\.addEventListener\("click", hideHudView\)/);
});

test("header metadata shows only the compact v-prefixed version label", () => {
  assert.match(RUNTIME, /text\.startsWith\("Userscript "\)/);
  assert.match(RUNTIME, /version\.textContent = `v\$\{text\.slice\("Userscript "\.length\)\}`/);
});

test("shared topbar pins minimize to the physical right edge", () => {
  assert.match(
    RUNTIME,
    /\.pha-hud-topbar \{[\s\S]*position:relative;[\s\S]*grid-template-columns:minmax\(0,1fr\);[\s\S]*padding-right:54px;/
  );
  assert.match(
    RUNTIME,
    /\.pha-hud-topbar #pha-close \{[\s\S]*position:absolute;[\s\S]*top:50%;[\s\S]*right:8px;[\s\S]*transform:translateY\(-50%\);[\s\S]*margin:0;/
  );
  assert.match(
    RUNTIME,
    /:host\(\[data-ui-mode="mobile"\]\) \.pha-hud-topbar \{[\s\S]*padding:5px 52px 5px 8px;/
  );
  assert.match(RUNTIME, /function placeOperationalStatus\(\)/);
  assert.match(RUNTIME, /huntTime\.after\(state\)/);
});

test("Mobile merges the existing operational nodes into the Hunt header and restores Desktop", () => {
  assert.match(RUNTIME, /shadow\.host\?\.dataset\.uiMode === "mobile"/);
  assert.match(RUNTIME, /statusRow\.appendChild\(huntTime\)/);
  assert.match(RUNTIME, /statusRow\.appendChild\(state\)/);
  assert.match(RUNTIME, /statusRow\.appendChild\(collapseButton\)/);
  assert.match(RUNTIME, /actions\.appendChild\(collapseButton\)/);
  assert.match(RUNTIME, /tabs\.appendChild\(huntTime\)/);
});

test("Desktop compact width removes the reserved gutter and only migrates the old 430px minimum", () => {
  assert.match(RUNTIME, /const DESKTOP_COMPACT_WIDTH_PX = 415/);
  assert.match(RUNTIME, /const LEGACY_DESKTOP_MIN_WIDTH_PX = 430/);
  assert.match(
    RUNTIME,
    /:host\(\[data-ui-mode="desktop"\]\) \.panel \{[\s\S]*min-width:\$\{DESKTOP_COMPACT_WIDTH_PX\}px !important;[\s\S]*scrollbar-gutter:auto;/
  );
  assert.match(RUNTIME, /function compactLegacyDesktopWidth\(\)/);
  assert.match(RUNTIME, /Number\.parseFloat\(panel\.style\.width\)/);
  assert.match(RUNTIME, /restoredWidth >= LEGACY_DESKTOP_MIN_WIDTH_PX/);
  assert.match(RUNTIME, /restoredWidth <= LEGACY_DESKTOP_MIN_WIDTH_PX \+ 1/);
  assert.match(RUNTIME, /panel\.style\.width = `\$\{DESKTOP_COMPACT_WIDTH_PX\}px`/);
  assert.match(RUNTIME, /normalizeHeaderVersion\(\);\s*compactLegacyDesktopWidth\(\);/);
});

test("UI mode and opacity are staged out of the header and mounted inside Misc", () => {
  assert.match(RUNTIME, /const INTERFACE_SECTION_ID = "pha-interface-settings"/);
  assert.match(RUNTIME, /const INTERFACE_STAGING_ID = "pha-interface-staging"/);
  assert.match(RUNTIME, /function stageInterfaceControls\(\)/);
  assert.match(RUNTIME, /function ensureMiscInterfaceSettings\(\)/);
  assert.match(RUNTIME, /<h3>Interface<\/h3>/);
  assert.match(RUNTIME, /<span>UI Mode<\/span>/);
  assert.match(RUNTIME, /<span>Opacity<\/span>/);
  assert.match(RUNTIME, /modeSlot\.appendChild\(modeSelect\)/);
  assert.match(RUNTIME, /alphaSlot\.appendChild\(alphaButton\)/);
});

test("Mobile header and nav use compact shared hierarchy without a second layout", () => {
  assert.match(RUNTIME, /:host\(\[data-ui-mode="mobile"\]\) \.pha-hud-topbar \{[\s\S]*min-height:46px;[\s\S]*padding:5px 52px 5px 8px;/);
  assert.match(RUNTIME, /:host\(\[data-ui-mode="mobile"\]\) \.tabs \{[\s\S]*min-height:44px;[\s\S]*gap:4px;/);
  assert.match(RUNTIME, /:host\(\[data-ui-mode="mobile"\]\) \.tabs #pha-tab-state \{[\s\S]*font-size:8px;/);
  assert.doesNotMatch(RUNTIME, /grid-template-rows: minmax\(40px, auto\) 30px/);
});

test("Mobile capture summary stays in one four-column row", () => {
  assert.match(
    RUNTIME,
    /:host\(\[data-ui-mode="mobile"\]\) \.capture-strip \{\s*\n\s*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/
  );
  assert.match(
    RUNTIME,
    /:host\(\[data-ui-mode="mobile"\]\) \.capture-strip article \{[\s\S]*min-width:0;[\s\S]*min-height:56px;/
  );
});
