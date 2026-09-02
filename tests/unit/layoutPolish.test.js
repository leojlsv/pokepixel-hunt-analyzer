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

test("rejected two-row Mobile topbar stylesheet is no longer loaded", () => {
  assert.doesNotMatch(RUNTIME, /MOBILE_TOPBAR_STYLES/);
  assert.doesNotMatch(RUNTIME, /grid-template-rows: minmax\(40px, auto\) 30px/);
});
