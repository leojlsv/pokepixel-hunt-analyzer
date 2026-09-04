import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SOURCE = await readFile(
  new URL("../../userscript/closed-hud-mobile-styles.js", import.meta.url),
  "utf8"
);

test("Mobile uses the native tablist as a 54px bottom navigation", () => {
  assert.match(
    SOURCE,
    /:host\(\[data-ui-mode="mobile"\]\) \.tabs \{[\s\S]*min-height: 54px;[\s\S]*flex: 0 0 54px;[\s\S]*order: 999;[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/
  );
  assert.match(SOURCE, /border-top: 1px solid var\(--border\);/);
  assert.match(SOURCE, /background: var\(--bg-elevated\);/);
  assert.doesNotMatch(SOURCE, /\.panel::after/);
});

test("the four native view buttons share the structural bottom grid", () => {
  assert.doesNotMatch(SOURCE, /panel\.appendChild\(tabs\)/);
  assert.doesNotMatch(SOURCE, /position: sticky;/);
  assert.match(SOURCE, /\.tabs > \[data-view="current"\],[\s\S]*\.tabs > \[data-view="history"\],[\s\S]*\.tabs > #alerts-tab,[\s\S]*\.tabs > \.pha-hud-settings-button \{[\s\S]*position: static;[\s\S]*width: auto;[\s\S]*min-width: 0;[\s\S]*min-height: 44px;/);
  assert.doesNotMatch(SOURCE, /position: fixed;/);
  assert.doesNotMatch(SOURCE, /100vw[\s\S]*\/ 4/);
});

test("Mobile styles the merged Hunt header independently from navigation", () => {
  assert.match(SOURCE, /\.live-card \.status-row \.hunt-time \{[\s\S]*font-size: 12px;/);
  assert.match(SOURCE, /\.live-card \.status-row #pha-tab-state \{[\s\S]*width: 8px;[\s\S]*border-radius: 50%;[\s\S]*font-size: 0;/);
  assert.match(SOURCE, /\.live-card \.status-row \[data-collapse="hunt"\] \{[\s\S]*min-width: 44px;[\s\S]*min-height: 44px;/);
});
