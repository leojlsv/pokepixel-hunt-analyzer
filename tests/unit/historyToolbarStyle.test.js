import assert from "node:assert/strict";
import test from "node:test";
import { HISTORY_STYLES } from "../../userscript/history-styles.js";
import { MOBILE_STYLES } from "../../userscript/mobile-styles.js";
import { createUiMarkup } from "../../userscript/ui-markup.js";

test("History toolbar aligns counter and actions without legacy button margins", () => {
  assert.match(HISTORY_STYLES, /\.history-toolbar\s*>\s*\.history-more-button\s*\{[^}]*margin:\s*0\s*;[^}]*height:\s*24px\s*;/);
  assert.match(HISTORY_STYLES, /\.history-toolbar\s*>\s*\.section-badge\s*\{\s*height:\s*24px\s*;/);
  assert.match(MOBILE_STYLES, /:host\(\[data-ui-mode="mobile"\]\) \.history-more-button\s*\{[^}]*height:\s*44px/);
  assert.match(MOBILE_STYLES, /:host\(\[data-ui-mode="mobile"\]\) \.history-toolbar > \.section-badge\s*\{\s*height:\s*44px\s*;/);
  const markup = createUiMarkup();
  assert.match(markup, /class="history-toolbar"[\s\S]*?id="history-count"[\s\S]*?id="history-refresh"[\s\S]*?id="history-clear-all"/);
});

test("Remover Tudo uses red destructive styling across interaction states", () => {
  assert.match(HISTORY_STYLES, /\.history-toolbar\s*>\s*\.history-clear-all\s*\{[^}]*border-color:\s*#d76868;[^}]*background:\s*#63272c;[^}]*color:\s*#ffe4e4;/);
  assert.match(HISTORY_STYLES, /\.history-toolbar > \.history-clear-all:hover:not\(:disabled\)/);
  assert.match(MOBILE_STYLES, /:host\(\[data-ui-mode="mobile"\]\) \.history-toolbar > \.history-clear-all:active:not\(:disabled\)/);
  assert.match(HISTORY_STYLES, /\.history-toolbar > \.history-clear-all:focus-visible/);
  assert.match(HISTORY_STYLES, /\.history-toolbar > \.history-clear-all:disabled/);
});
