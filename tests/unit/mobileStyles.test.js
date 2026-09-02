import assert from "node:assert/strict";
import test from "node:test";

import { MOBILE_STYLES } from "../../userscript/mobile-styles.js";

test("mobile Current keeps core and capture metrics in two columns by default", () => {
  assert.match(
    MOBILE_STYLES,
    /\.metric-cards,\s*\n:host\(\[data-ui-mode="mobile"\]\) \.capture-strip \{\s*\n\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/
  );
});

test("mobile Hunt actions expose touch-sized controls", () => {
  assert.match(MOBILE_STYLES, /\.actions button \{\s*\n\s*min-height: 42px/);
  assert.match(MOBILE_STYLES, /\.actions \.collapse-button \{\s*\n\s*width: 42px/);
});

test("mobile By Rarity removes horizontal scrolling and uses the full header as collapse target", () => {
  assert.match(
    MOBILE_STYLES,
    /#rarity-section \.table-wrap \{\s*\n\s*max-height: none;\s*\n\s*overflow-x: hidden;/
  );
  assert.match(
    MOBILE_STYLES,
    /#rarity-section \.collapse-button \{[\s\S]*position: absolute;[\s\S]*inset: 0;[\s\S]*pointer-events: auto;/
  );
});

test("mobile Captured and Failed keep the existing table presentation", () => {
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.table-wrap \{\s*\n\s*display: block;/
  );
  assert.doesNotMatch(MOBILE_STYLES, /\.mobile-encounter-card/);
  assert.doesNotMatch(MOBILE_STYLES, /\.mobile-encounter-list/);
});

test("mobile encounter filters are touch-sized, two-column, and rarity floats beside Shiny", () => {
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.filters \{\s*\n\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/
  );
  assert.doesNotMatch(
    MOBILE_STYLES,
    /\.encounter-section \.filter-field:has\(\.rarity-multiselect\) \{[\s\S]*grid-column: 1 \/ -1;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-multiselect summary \{\s*\n\s*min-height: 42px;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-check-menu \{[\s\S]*position: absolute;[\s\S]*z-index: 40;[\s\S]*top: calc\(100% \+ 4px\);/
  );
  assert.doesNotMatch(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-check-menu \{[\s\S]*position: static;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-check-option \{\s*\n\s*min-height: 40px;/
  );
});

test("mobile Captured and Failed use the full section header as collapse target", () => {
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.collapse-button \{[\s\S]*inset: 0;[\s\S]*pointer-events: auto;/
  );
});

test("mobile History improves button hit targets without replacing the original layout", () => {
  assert.match(
    MOBILE_STYLES,
    /\.history-subtabs \.tab \{[\s\S]*min-height: 36px;[\s\S]*touch-action: manipulation;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.history-more-button \{[\s\S]*min-height: 40px;[\s\S]*height: 40px;[\s\S]*touch-action: manipulation;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.history-notable-button \{[\s\S]*min-height: 38px;[\s\S]*height: 38px;[\s\S]*touch-action: manipulation;/
  );
  assert.doesNotMatch(
    MOBILE_STYLES,
    /\.history-subtabs \{[\s\S]*grid-template-columns:/
  );
  assert.doesNotMatch(
    MOBILE_STYLES,
    /\.history-filter-grid \{[\s\S]*grid-template-columns:/
  );
});

test("mobile History rows and buttons provide pressed feedback", () => {
  assert.match(MOBILE_STYLES, /\.history-subtabs \.tab:active \{/);
  assert.match(MOBILE_STYLES, /\.history-more-button:active \{/);
  assert.match(MOBILE_STYLES, /\.history-notable-button:active:not\(:disabled\) \{/);
  assert.match(
    MOBILE_STYLES,
    /\.history-hunt-row:active > td,[\s\S]*\.history-pokemon-row:active > td,[\s\S]*\.history-attempt-row:active > td \{[\s\S]*background: #30312c;/
  );
});

test("M6 mobile global secondary controls are touch-sized", () => {
  assert.match(MOBILE_STYLES, /\.alpha-button \{[\s\S]*height: 36px;[\s\S]*touch-action: manipulation;/);
  assert.match(MOBILE_STYLES, /#pha-close \{[\s\S]*width: 40px;[\s\S]*height: 40px;/);
  assert.match(MOBILE_STYLES, /\.pha-ui-mode-select \{[\s\S]*height: 30px;/);
  assert.match(MOBILE_STYLES, /\.refcode \{[\s\S]*min-height: 30px;[\s\S]*touch-action: manipulation;/);
});

test("M6 Sound Alerts preserves the grid while enlarging touch controls", () => {
  assert.match(MOBILE_STYLES, /\.alert-grid \{[\s\S]*grid-template-columns: minmax\(64px, \.8fr\) repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(MOBILE_STYLES, /\.alert-choice \{[\s\S]*min-height: 38px;[\s\S]*touch-action: manipulation;/);
  assert.match(MOBILE_STYLES, /\.alert-choice input\[type="checkbox"\] \{[\s\S]*width: 18px;[\s\S]*height: 18px;/);
  assert.match(MOBILE_STYLES, /\.custom-audio-actions button \{[\s\S]*min-height: 38px;/);
});

test("M6 Catch Gallery keeps the table and enlarges interactive controls", () => {
  assert.match(MOBILE_STYLES, /\.catch-gallery-filters input,[\s\S]*\.catch-gallery-filters select \{[\s\S]*height: 42px;/);
  assert.match(MOBILE_STYLES, /\.catch-gallery-sort \{[\s\S]*min-height: 40px;[\s\S]*touch-action: manipulation;/);
  assert.match(MOBILE_STYLES, /\.catch-gallery-action,[\s\S]*\.catch-gallery-action\.generate \{[\s\S]*height: 40px;[\s\S]*min-width: 0;/);
  assert.match(MOBILE_STYLES, /\.catch-gallery-page-button \{[\s\S]*height: 40px;/);
  assert.doesNotMatch(MOBILE_STYLES, /\.catch-gallery-card/);
});

test("M6 History delete remains in place with a larger destructive touch target", () => {
  assert.match(MOBILE_STYLES, /\.history-delete-button \{[\s\S]*height: 40px;[\s\S]*touch-action: manipulation;/);
  assert.match(MOBILE_STYLES, /\.history-delete-button:active:not\(:disabled\) \{/);
});

test("landscape may promote only core metrics to four columns", () => {
  assert.match(MOBILE_STYLES, /@media \(orientation: landscape\) and \(min-width: 640px\)/);
  assert.match(
    MOBILE_STYLES,
    /@media[\s\S]*\.metric-cards \{\s*\n\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/
  );
});
