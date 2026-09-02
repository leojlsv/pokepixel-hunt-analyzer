import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SOURCE = await readFile(
  new URL("../../userscript/closed-hud-mobile-styles.js", import.meta.url),
  "utf8"
);

test("Mobile bottom navigation keeps the validated 54px visual shell", () => {
  assert.match(
    SOURCE,
    /:host\(\[data-ui-mode="mobile"\]\) \.panel::after \{[\s\S]*min-height: 54px;[\s\S]*flex: 0 0 54px;[\s\S]*order: 999;/
  );
  assert.match(SOURCE, /pointer-events: none;/);
  assert.match(SOURCE, /border-top: 1px solid var\(--border\);/);
  assert.match(SOURCE, /background: var\(--bg-elevated\);/);
});

test("checkpoint places the four native view buttons in the shell", () => {
  assert.doesNotMatch(SOURCE, /panel\.appendChild\(tabs\)/);
  assert.doesNotMatch(SOURCE, /position: sticky;/);
  assert.match(SOURCE, /\.tabs > \[data-view="current"\],[\s\S]*\.tabs > \[data-view="history"\],[\s\S]*\.tabs > #alerts-tab,[\s\S]*\.tabs > \.pha-hud-settings-button \{[\s\S]*position: fixed;[\s\S]*bottom: calc\(var\(--pha-safe-bottom\) \+ 5px\);[\s\S]*min-height: 44px;/);
  assert.match(SOURCE, /\.tabs > \[data-view="current"\] \{[\s\S]*left: calc\(var\(--pha-safe-left\) \+ 7px\);/);
  assert.match(SOURCE, /\.tabs > \[data-view="history"\] \{[\s\S]*left: calc\(var\(--pha-safe-left\) \+ 11px/);
  assert.match(SOURCE, /\.tabs > #alerts-tab \{[\s\S]*right: calc\(var\(--pha-safe-right\) \+ 11px/);
  assert.match(SOURCE, /\.tabs > \.pha-hud-settings-button \{[\s\S]*right: calc\(var\(--pha-safe-right\) \+ 7px\);/);
});

test("Mobile collapses the emptied upper nav and styles the merged Hunt header", () => {
  assert.match(SOURCE, /\.tabs \{[\s\S]*min-height: 0;[\s\S]*height: 0;[\s\S]*border: 0;/);
  assert.match(SOURCE, /\.live-card \.status-row \.hunt-time \{[\s\S]*font-size: 12px;/);
  assert.match(SOURCE, /\.live-card \.status-row #pha-tab-state \{[\s\S]*width: 8px;[\s\S]*border-radius: 50%;[\s\S]*font-size: 0;/);
  assert.match(SOURCE, /\.live-card \.status-row \[data-collapse="hunt"\] \{[\s\S]*min-width: 44px;[\s\S]*min-height: 44px;/);
});
