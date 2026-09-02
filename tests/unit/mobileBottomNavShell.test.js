import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SOURCE = await readFile(
  new URL("../../userscript/closed-hud-mobile-styles.js", import.meta.url),
  "utf8"
);

test("Mobile bottom navigation checkpoint renders only an inert visual shell", () => {
  assert.match(
    SOURCE,
    /:host\(\[data-ui-mode="mobile"\]\) \.panel::after \{[\s\S]*min-height: 54px;[\s\S]*flex: 0 0 54px;[\s\S]*order: 999;/
  );
  assert.match(SOURCE, /pointer-events: none;/);
  assert.match(SOURCE, /border-top: 1px solid var\(--border\);/);
  assert.match(SOURCE, /background: var\(--bg-elevated\);/);
});

test("checkpoint does not move or restyle the existing navigation tabs", () => {
  assert.doesNotMatch(SOURCE, /panel\.appendChild\(tabs\)/);
  assert.doesNotMatch(SOURCE, /position: sticky;/);
  assert.doesNotMatch(SOURCE, /\.tabs\s*\{/);
});
