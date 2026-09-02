import assert from "node:assert/strict";
import test from "node:test";

import { HISTORY_STYLES } from "../../userscript/history-styles.js";

test("Mobile History keeps three fixed touch-friendly subtabs", () => {
  assert.match(
    HISTORY_STYLES,
    /:host\(\[data-ui-mode="mobile"\]\) \.history-subtabs \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/
  );
  assert.match(
    HISTORY_STYLES,
    /:host\(\[data-ui-mode="mobile"\]\) \.history-subtabs \.tab \{[\s\S]*min-height: 42px;/
  );
});

test("Mobile History filters use two columns and touch-sized controls", () => {
  assert.match(
    HISTORY_STYLES,
    /\.history-filter-grid,[\s\S]*\.history-filter-grid-advanced \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(
    HISTORY_STYLES,
    /\.history-filter-grid select \{[\s\S]*min-height: 42px;/
  );
  assert.match(
    HISTORY_STYLES,
    /\.history-more-button \{[\s\S]*min-height: 42px;/
  );
});

test("Mobile History presents Hunts, Pokemon and Attempts as two-column touch cards", () => {
  assert.match(
    HISTORY_STYLES,
    /\.history-hunt-row,[\s\S]*\.history-pokemon-row,[\s\S]*\.history-attempt-row \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*touch-action: manipulation;/
  );
  assert.match(HISTORY_STYLES, /\.history-hunt-row > td:nth-child\(7\)::before \{ content: "Mythical"; \}/);
  assert.match(HISTORY_STYLES, /\.history-pokemon-row > td:nth-child\(7\)::before \{ content: "\$\/Cycle"; \}/);
  assert.match(HISTORY_STYLES, /\.history-attempt-row > td:nth-child\(6\)::before \{ content: "IV"; \}/);
});

test("Mobile expanded History details remain readable without horizontal overflow", () => {
  assert.match(
    HISTORY_STYLES,
    /\.history-detail-grid \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(
    HISTORY_STYLES,
    /\.history-fled-line \{[\s\S]*flex-wrap: wrap;[\s\S]*white-space: normal;/
  );
  assert.match(
    HISTORY_STYLES,
    /\.history-notable-list \{[\s\S]*overflow-x: hidden;/
  );
});

test("Mobile notable and Pokemon rarity detail tables remain compact fixed-layout tables", () => {
  assert.match(
    HISTORY_STYLES,
    /\.history-notable-list table,[\s\S]*\.history-pokemon-rarity-table \{[\s\S]*display: table;[\s\S]*table-layout: fixed;/
  );
});
