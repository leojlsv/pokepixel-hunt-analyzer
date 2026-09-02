import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SOURCE = await readFile(
  new URL("../../userscript/styles.js", import.meta.url),
  "utf8"
);

test("interactive Analyzer controls expose a shared visible keyboard focus", () => {
  assert.match(SOURCE, /button:focus-visible,/);
  assert.match(SOURCE, /select:focus-visible,/);
  assert.match(SOURCE, /input:focus-visible,/);
  assert.match(SOURCE, /\[tabindex="0"\]:focus-visible,/);
  assert.match(SOURCE, /th\.sortable:focus-visible \{[\s\S]*outline: 2px solid var\(--hunt-focus-ring\);[\s\S]*outline-offset: 2px;/);
  assert.doesNotMatch(SOURCE, /outline:\s*none/);
});
