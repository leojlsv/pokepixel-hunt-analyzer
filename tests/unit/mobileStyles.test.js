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

test("mobile encounter filters are touch-sized and rarity expands inline", () => {
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.filters \{\s*\n\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-multiselect summary \{\s*\n\s*min-height: 42px;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-check-menu \{\s*\n\s*position: static;/
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

test("landscape may promote only core metrics to four columns", () => {
  assert.match(MOBILE_STYLES, /@media \(orientation: landscape\) and \(min-width: 640px\)/);
  assert.match(
    MOBILE_STYLES,
    /@media[\s\S]*\.metric-cards \{\s*\n\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/
  );
});
