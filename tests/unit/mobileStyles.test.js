import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MOBILE_STYLES } from "../../userscript/mobile-styles.js";

const RUNTIME_SOURCE = await readFile(
  new URL("../../userscript/closed-hud-runtime.js", import.meta.url),
  "utf8"
);

test("mobile Current keeps core metrics in two columns and final capture summary in four columns", () => {
  assert.match(
    MOBILE_STYLES,
    /\.metric-cards,\s*\n:host\(\[data-ui-mode="mobile"\]\) \.capture-strip \{\s*\n\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/
  );
  assert.match(
    RUNTIME_SOURCE,
    /:host\(\[data-ui-mode="mobile"\]\) \.capture-strip \{\s*\n\s*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/
  );
});

test("mobile Hunt actions expose touch-sized controls", () => {
  assert.match(MOBILE_STYLES, /\.actions button \{\s*\n\s*min-height: 44px/);
  assert.match(MOBILE_STYLES, /\.actions \.collapse-button \{\s*\n\s*width: 44px/);
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
    /\.encounter-section \.rarity-multiselect summary \{\s*\n\s*min-height: 44px;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-check-menu \{[\s\S]*position: absolute;[\s\S]*z-index: 40;[\s\S]*top: calc\(100% \+ 4px\);/
  );
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-check-menu \{[\s\S]*max-height: min\(34dvh, 196px\);/
  );
  assert.doesNotMatch(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-check-menu \{[\s\S]*position: static;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-check-option \{\s*\n\s*min-height: 44px;/
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
    /\.history-subtabs \.tab \{[\s\S]*min-height: 44px;[\s\S]*touch-action: manipulation;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.history-more-button \{[\s\S]*min-height: 44px;[\s\S]*height: 44px;[\s\S]*touch-action: manipulation;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.history-notable-button \{[\s\S]*min-height: 44px;[\s\S]*height: 44px;[\s\S]*touch-action: manipulation;/
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
  assert.match(MOBILE_STYLES, /\.alpha-button \{[\s\S]*height: 44px;[\s\S]*touch-action: manipulation;/);
  assert.match(MOBILE_STYLES, /#pha-close \{[\s\S]*width: 44px;[\s\S]*height: 44px;/);
  assert.match(MOBILE_STYLES, /\.pha-ui-mode-select \{[\s\S]*height: 44px;/);
  assert.match(MOBILE_STYLES, /\.refcode \{[\s\S]*min-height: 44px;[\s\S]*touch-action: manipulation;/);
});

test("M6 Sound Alerts preserves the grid while enlarging touch controls", () => {
  assert.match(MOBILE_STYLES, /\.alert-volume-control \{[\s\S]*min-height: 52px;/);
  assert.match(MOBILE_STYLES, /\.alert-volume-control input\[type="range"\] \{[\s\S]*min-height: 44px;/);
  assert.match(MOBILE_STYLES, /\.alert-grid \{[\s\S]*grid-template-columns: 64px repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(MOBILE_STYLES, /\.alert-choice-pair \{[\s\S]*width: 100%;[\s\S]*gap: 2px;/);
  assert.match(MOBILE_STYLES, /\.alert-fled-heading,[\s\S]*\.alert-choice-pair-fled \{[\s\S]*padding-left: 6px;/);
  assert.match(MOBILE_STYLES, /\.alert-choice \{[\s\S]*min-width: 0;[\s\S]*min-height: 44px;[\s\S]*flex: 1 1 0;[\s\S]*touch-action: manipulation;/);
  assert.match(MOBILE_STYLES, /\.alert-choice input\[type="checkbox"\] \{[\s\S]*width: 18px;[\s\S]*height: 18px;/);
  assert.match(MOBILE_STYLES, /\.custom-audio-actions button \{[\s\S]*min-height: 44px;/);
});

test("M6 Catch Gallery keeps the table and enlarges interactive controls", () => {
  assert.match(MOBILE_STYLES, /\.catch-gallery-filters input,[\s\S]*\.catch-gallery-filters select \{[\s\S]*height: 44px;/);
  assert.match(MOBILE_STYLES, /\.catch-gallery-sort \{[\s\S]*min-height: 44px;[\s\S]*touch-action: manipulation;/);
  assert.match(MOBILE_STYLES, /\.catch-gallery-action,[\s\S]*\.catch-gallery-action\.generate \{[\s\S]*min-width: 0;[\s\S]*height: 44px;/);
  assert.match(MOBILE_STYLES, /\.catch-gallery-page-button \{[\s\S]*height: 44px;/);
  assert.doesNotMatch(MOBILE_STYLES, /\.catch-gallery-card/);
});

test("M6 History delete remains in place with a larger destructive touch target", () => {
  assert.match(MOBILE_STYLES, /\.history-delete-button \{[\s\S]*height: 44px;[\s\S]*touch-action: manipulation;/);
  assert.match(MOBILE_STYLES, /\.history-delete-button:active:not\(:disabled\) \{/);
});

test("landscape may promote only core metrics to four columns", () => {
  assert.match(MOBILE_STYLES, /@media \(orientation: landscape\) and \(min-width: 640px\)/);
  assert.match(
    MOBILE_STYLES,
    /@media[\s\S]*\.metric-cards \{\s*\n\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/
  );
});

test("mobile History lets filter menus overlay the filter block", () => {
  assert.match(
    MOBILE_STYLES,
    /\.history-filter-block \{[\s\S]*position: relative;[\s\S]*z-index: 10;[\s\S]*overflow: visible;/
  );
});

test("mobile Catch Gallery lets its rarity menu overlay the table", () => {
  assert.match(
    MOBILE_STYLES,
    /\.catch-gallery-section,[\s\S]*\.catch-gallery-filters \{[\s\S]*overflow: visible;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.catch-gallery-filters \{[\s\S]*position: relative;[\s\S]*z-index: 10;/
  );
});

test("mobile Attempts reserves visible width for every column including IV", () => {
  assert.match(MOBILE_STYLES, /\.history-attempts-table th:nth-child\(1\),[\s\S]*width: 16%;/);
  assert.match(MOBILE_STYLES, /\.history-attempts-table th:nth-child\(2\),[\s\S]*width: 26%;/);
  assert.match(MOBILE_STYLES, /\.history-attempts-table th:nth-child\(3\),[\s\S]*width: 11%;/);
  assert.match(MOBILE_STYLES, /\.history-attempts-table th:nth-child\(4\),[\s\S]*width: 12%;/);
  assert.match(MOBILE_STYLES, /\.history-attempts-table th:nth-child\(5\),[\s\S]*width: 25%;/);
  assert.match(MOBILE_STYLES, /\.history-attempts-table th:nth-child\(6\),[\s\S]*width: 10%;/);
});
