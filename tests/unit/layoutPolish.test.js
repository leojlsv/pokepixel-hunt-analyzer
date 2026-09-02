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
  assert.match(RUNTIME, /miscTab\.after\(settingsButton\)/);
  assert.match(RUNTIME, /huntTime\.before\(settingsButton\)/);
});

test("header metadata shows only the compact v-prefixed version label", () => {
  assert.match(RUNTIME, /text\.startsWith\("Userscript "\)/);
  assert.match(RUNTIME, /version\.textContent = `v\$\{text\.slice\("Userscript "\.length\)\}`/);
});

test("shared topbar keeps only identity and minimize after runtime layout polish", () => {
  assert.match(RUNTIME, /\.pha-hud-topbar \{[\s\S]*grid-template-columns:minmax\(0,1fr\) auto;/);
  assert.match(RUNTIME, /\.pha-hud-topbar #pha-close \{[\s\S]*grid-column:2;/);
  assert.match(RUNTIME, /function placeOperationalStatus\(\)/);
  assert.match(RUNTIME, /huntTime\.after\(state\)/);
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
  assert.match(RUNTIME, /:host\(\[data-ui-mode="mobile"\]\) \.pha-hud-topbar \{[\s\S]*min-height:46px;[\s\S]*padding:5px 8px;/);
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
