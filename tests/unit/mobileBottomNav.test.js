import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SOURCE = await readFile(
  new URL("../../userscript/mobile-bottom-nav.js", import.meta.url),
  "utf8"
);
const CLOSED_HUD_MOBILE = await readFile(
  new URL("../../userscript/closed-hud-mobile-styles.js", import.meta.url),
  "utf8"
);

test("Mobile bottom navigation mounts only in resolved Mobile mode", () => {
  assert.match(SOURCE, /shadow\.host\?\.dataset\.uiMode !== "mobile"/);
  assert.match(SOURCE, /const miscTab = shadow\.getElementById\(MISC_TAB_ID\)/);
  assert.match(SOURCE, /const hudTab = shadow\.getElementById\(HUD_TAB_ID\)/);
  assert.match(SOURCE, /panel\.lastElementChild !== tabs/);
  assert.match(SOURCE, /panel\.appendChild\(tabs\)/);
});

test("Hunt Time and ACTIVE/STANDBY remain in a compact top status bar", () => {
  assert.match(SOURCE, /statusbar\.id = STATUSBAR_ID/);
  assert.match(SOURCE, /topbar\.after\(statusbar\)/);
  assert.match(SOURCE, /statusbar\.appendChild\(huntTime\)/);
  assert.match(SOURCE, /huntTime\.after\(state\)/);
  assert.match(SOURCE, /\.pha-mobile-statusbar \{[\s\S]*justify-content: flex-end;/);
});

test("Mobile Current History Misc and HUD become a four-item sticky bottom navigation", () => {
  assert.match(SOURCE, /:host\(\[data-ui-mode="mobile"\]\) \.tabs \{[\s\S]*position: sticky;[\s\S]*bottom: 0;[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(SOURCE, /\.tabs \.tab \{[\s\S]*min-height: 44px;/);
  assert.match(SOURCE, /\.tabs \.tab\.active \{/);
  assert.match(CLOSED_HUD_MOBILE, /MOBILE_BOTTOM_NAV_STYLES/);
});
