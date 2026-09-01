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

test("mobile encounter sections use cards instead of the desktop table viewport", () => {
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.table-wrap \{\s*\n\s*display: none !important;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.mobile-encounter-list \{[\s\S]*display: grid;[\s\S]*overflow: visible;/
  );
  assert.match(MOBILE_STYLES, /\.mobile-encounter-card \{[\s\S]*touch-action: manipulation;/);
});

test("mobile encounter filters and collapse controls are touch-sized", () => {
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.filters \{\s*\n\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.collapse-button \{[\s\S]*inset: 0;[\s\S]*pointer-events: auto;/
  );
  assert.match(
    MOBILE_STYLES,
    /\.encounter-section \.rarity-multiselect summary \{\s*\n\s*min-height: 42px;/
  );
});

test("landscape may promote only core metrics to four columns", () => {
  assert.match(MOBILE_STYLES, /@media \(orientation: landscape\) and \(min-width: 640px\)/);
  assert.match(
    MOBILE_STYLES,
    /@media[\s\S]*\.metric-cards \{\s*\n\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/
  );
});
