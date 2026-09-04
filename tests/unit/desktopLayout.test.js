import assert from "node:assert/strict";
import test from "node:test";

import { STYLES } from "../../userscript/styles.js";

test("Desktop navigation stays in normal flow while panel content scrolls", () => {
  assert.match(STYLES, /\.tabs \{[^}]*position: relative;[^}]*top: auto;/);
  assert.doesNotMatch(STYLES, /\.tabs \{[^}]*position: sticky;/);
});

test("Current native selects use the full filter geometry", () => {
  assert.match(
    STYLES,
    /\.filters select \{[^}]*width: 100%;[^}]*display: block;[^}]*line-height: 15px;/
  );
});

test("Current Shiny keeps native behavior with the Rarity arrow alignment", () => {
  assert.match(
    STYLES,
    /\.shiny-filter-field select \{[^}]*appearance: none;[^}]*padding-right: 22px;/
  );
  assert.match(
    STYLES,
    /\.shiny-filter-field::after \{[^}]*content: "▾";[^}]*right: 7px;[^}]*bottom: 8px;/
  );
});

test("Current filter labels and controls share fixed Desktop rows", () => {
  assert.match(
    STYLES,
    /\.encounter-section \.filters > \.filter-field \{[^}]*height: 41px;[^}]*display: grid;[^}]*grid-template-rows: 11px 27px;/
  );
});
