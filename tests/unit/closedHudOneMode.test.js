import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isOneColumnModeValue } from "../../userscript/closed-hud-one-column.js";

const ONE_COLUMN = await readFile(
  new URL("../../userscript/closed-hud-one-column.js", import.meta.url),
  "utf8"
);
const MOBILE_STYLES = await readFile(
  new URL("../../userscript/closed-hud-mobile-styles.js", import.meta.url),
  "utf8"
);

test("isolated one-column mode recognizes only the 1 value", () => {
  assert.equal(isOneColumnModeValue(1), true);
  assert.equal(isOneColumnModeValue("1"), true);
  assert.equal(isOneColumnModeValue(0), false);
  assert.equal(isOneColumnModeValue(2), false);
  assert.equal(isOneColumnModeValue(null), false);
});

test("one-column mode is injected between current HUD and PX-only without changing base normalizer", () => {
  assert.match(ONE_COLUMN, /option\.textContent = "1 · One column"/);
  assert.match(ONE_COLUMN, /select\.insertBefore\(option, pxOnly\)/);
  assert.match(ONE_COLUMN, /event\.stopImmediatePropagation\(\)/);
  assert.match(ONE_COLUMN, /localStorage\.setItem\(HUD_COLUMNS_STORAGE_KEY, ONE_COLUMN_VALUE\)/);
});

test("one-column mode exposes two stacked row-start widgets and hides paired slots", () => {
  assert.match(MOBILE_STYLES, /data-hud-columns="1"[\s\S]*width: 145px !important/);
  assert.match(MOBILE_STYLES, /grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(MOBILE_STYLES, /\[data-hud-slot="1"\],[\s\S]*\[data-hud-slot="3"\][\s\S]*display: none !important/);
  assert.match(MOBILE_STYLES, /\.pha-hud-slot\.is-wide[\s\S]*grid-column: span 1 !important/);
  assert.match(ONE_COLUMN, /const visible = index === 0 \|\| index === 2/);
  assert.match(ONE_COLUMN, /label\.textContent = index === 0 \? "1" : "2"/);
});

test("one-column mode restores controls from PX-only and blocks two-slot rarity width", () => {
  assert.match(ONE_COLUMN, /slotConfigs\.hidden = false/);
  assert.match(ONE_COLUMN, /control\.disabled = false/);
  assert.match(ONE_COLUMN, /twoSlots\.disabled = true/);
  assert.match(ONE_COLUMN, /if \(width\?\.value === "2"\) width\.value = "1"/);
  assert.match(ONE_COLUMN, /2 stacked widgets · 1 column/);
});

test("Closed HUD form controls receive stable ids for browser form-field validation", () => {
  assert.match(ONE_COLUMN, /return "pha-hud-columns"/);
  assert.match(ONE_COLUMN, /return "pha-hud-preset"/);
  assert.match(ONE_COLUMN, /pha-hud-widget-\$\{field\.dataset\.hudWidget\}/);
  assert.match(ONE_COLUMN, /pha-hud-item-\$\{field\.dataset\.hudItem\}/);
  assert.match(ONE_COLUMN, /pha-hud-rarity-width-\$\{field\.dataset\.hudRarityWidth\}/);
  assert.match(ONE_COLUMN, /pha-hud-rarity-failed-\$\{field\.dataset\.hudRarityFailed\}/);
  assert.match(ONE_COLUMN, /pha-hud-rarity-\$\{field\.dataset\.hudRarityKey\}-\$\{field\.value\}/);
  assert.match(ONE_COLUMN, /root\.querySelectorAll\("input, select, textarea"\)/);
  assert.match(ONE_COLUMN, /field\.id = id/);
  assert.match(ONE_COLUMN, /ensureHudFormFieldIds\(shadow\)/);
});

test("remaining dynamic Analyzer form fields receive ids as they are mounted", () => {
  assert.match(ONE_COLUMN, /\.pha-ui-mode-select/);
  assert.match(ONE_COLUMN, /return "pha-ui-mode"/);
  assert.match(ONE_COLUMN, /\[data-sound-volume\]/);
  assert.match(ONE_COLUMN, /return "pha-sound-volume"/);
  assert.match(ONE_COLUMN, /\.catch-gallery-pokemon-filter/);
  assert.match(ONE_COLUMN, /return "catch-gallery-pokemon-filter"/);
  assert.match(ONE_COLUMN, /\.catch-gallery-rarity-filter/);
  assert.match(ONE_COLUMN, /return "catch-gallery-rarity-filter"/);
  assert.match(ONE_COLUMN, /new MutationObserver/);
  assert.match(ONE_COLUMN, /formFieldObserver\.observe\(shadow, \{ childList: true, subtree: true \}\)/);
});

test("mobile one-column footprint overrides the validated 220px mobile HUD width", () => {
  assert.match(
    MOBILE_STYLES,
    /:host\(\[data-ui-mode="mobile"\]\) #pha-toggle\.pha-custom-hud\[data-hud-columns="1"\] \{[\s\S]*width: 145px !important;[\s\S]*min-width: 145px !important;[\s\S]*max-width: 145px !important;/
  );
});
