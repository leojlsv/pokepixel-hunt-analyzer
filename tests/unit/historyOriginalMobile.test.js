import assert from "node:assert/strict";
import test from "node:test";

import { HISTORY_STYLES } from "../../userscript/history-styles.js";

test("History keeps the original shared presentation in Mobile", () => {
  assert.doesNotMatch(HISTORY_STYLES, /:host\(\[data-ui-mode="mobile"\]\) \.history-/);
  assert.match(HISTORY_STYLES, /\.history-subtabs \{[\s\S]*display: flex;/);
  assert.match(HISTORY_STYLES, /\.history-filter-grid \{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(HISTORY_STYLES, /\.history-more-button \{[\s\S]*height: 22px;/);
});
