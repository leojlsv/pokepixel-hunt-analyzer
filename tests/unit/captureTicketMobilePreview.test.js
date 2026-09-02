import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SOURCE = await readFile(new URL("../../userscript/capture-ticket.js", import.meta.url), "utf8");

test("Capture Ticket preview follows the resolved analyzer UI mode", () => {
  assert.match(SOURCE, /const ANALYZER_ROOT_ID = "pokepixel-hunt-analyzer-root"/);
  assert.match(SOURCE, /host\.dataset\.uiMode = currentUiMode\(\)/);
  assert.match(SOURCE, /:host\(\[data-ui-mode="mobile"\]\)\{height:100dvh\}/);
});

test("Mobile Capture Ticket preview fits safe viewport without changing ticket generation", () => {
  assert.match(SOURCE, /max-width:calc\(100vw - env\(safe-area-inset-left, 0px\) - env\(safe-area-inset-right, 0px\) - 34px\)/);
  assert.match(SOURCE, /max-height:calc\(100dvh - env\(safe-area-inset-top, 0px\) - env\(safe-area-inset-bottom, 0px\) - 86px\)/);
  assert.match(SOURCE, /object-fit:contain/);
  assert.match(SOURCE, /canvas\.width = TICKET_LAYOUT\.canvas\.width/);
  assert.match(SOURCE, /canvas\.height = TICKET_LAYOUT\.canvas\.height/);
});

test("Mobile Capture Ticket preview exposes touch-sized actions", () => {
  assert.match(SOURCE, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(SOURCE, /min-height:44px/);
  assert.match(SOURCE, /touch-action:manipulation/);
  assert.match(SOURCE, /button:active\{background:#3d3e37;border-color:#77776d\}/);
});
