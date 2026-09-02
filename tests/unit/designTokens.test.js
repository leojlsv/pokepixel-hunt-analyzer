import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SOURCE = await readFile(
  new URL("../../userscript/styles.js", import.meta.url),
  "utf8"
);

test("core shell colors resolve through Hunt semantic tokens", () => {
  assert.match(SOURCE, /--hunt-surface-canvas: #20211e;/);
  assert.match(SOURCE, /--hunt-surface-control: #30312c;/);
  assert.match(SOURCE, /--hunt-text-primary: #f0eee6;/);
  assert.match(SOURCE, /--hunt-accent-primary: #d7b45d;/);
  assert.match(SOURCE, /--hunt-focus-ring: var\(--hunt-accent-primary\);/);
  assert.match(SOURCE, /--bg: var\(--hunt-surface-canvas\);/);
  assert.match(SOURCE, /--text: var\(--hunt-text-primary\);/);
});

test("operational states and Hunt actions use semantic tokens", () => {
  assert.match(SOURCE, /\.state\.active \{ background: var\(--hunt-state-active-bg\); color: var\(--hunt-state-active-text\); \}/);
  assert.match(SOURCE, /\.state\.standby \{ background: var\(--hunt-state-standby-bg\); color: var\(--hunt-state-standby-text\); \}/);
  assert.match(SOURCE, /#new-hunt \{[\s\S]*var\(--hunt-action-start-bg\)/);
  assert.match(SOURCE, /#pause-resume \{[\s\S]*var\(--hunt-action-pause-bg\)/);
  assert.match(SOURCE, /#end-hunt \{[\s\S]*var\(--hunt-action-end-bg\)/);
});
