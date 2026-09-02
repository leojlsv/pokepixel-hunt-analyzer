import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const STYLES = await readFile(new URL("../../userscript/mobile-topbar-styles.js", import.meta.url), "utf8");
const RUNTIME = await readFile(new URL("../../userscript/closed-hud-runtime.js", import.meta.url), "utf8");

test("Mobile topbar uses two rows instead of compressing every control into one line", () => {
  assert.match(STYLES, /grid-template-rows:\s*minmax\(40px, auto\) 30px/);
  assert.match(STYLES, /\.brand\s*\{\s*display:\s*contents/);
  assert.match(STYLES, /\.brand > strong[\s\S]*grid-row:\s*1/);
  assert.match(STYLES, /\.brand-meta[\s\S]*grid-row:\s*2/);
  assert.match(STYLES, /#pha-tab-state[\s\S]*grid-row:\s*2/);
});

test("Mobile topbar keeps HUD, alpha and minimize on the primary row", () => {
  assert.match(STYLES, /#pha-hud-settings-button[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*1/);
  assert.match(STYLES, /#pha-alpha[\s\S]*grid-column:\s*3[\s\S]*grid-row:\s*1/);
  assert.match(STYLES, /#pha-close[\s\S]*grid-column:\s*4[\s\S]*grid-row:\s*1/);
});

test("Mobile topbar metadata cannot overlap controls when width is constrained", () => {
  assert.match(STYLES, /\.brand-meta[\s\S]*grid-column:\s*1 \/ 4/);
  assert.match(STYLES, /\.brand-meta[\s\S]*overflow:\s*hidden/);
  assert.match(STYLES, /\.brand-meta > span[\s\S]*text-overflow:\s*ellipsis/);
  assert.match(STYLES, /\.refcode,[\s\S]*\.pha-ui-mode-select[\s\S]*flex:\s*0 0 auto/);
});

test("Closed HUD runtime installs the Mobile topbar fix with its existing polish styles", () => {
  assert.match(RUNTIME, /import \{ MOBILE_TOPBAR_STYLES \} from "\.\/mobile-topbar-styles\.js"/);
  assert.match(RUNTIME, /\$\{MOBILE_TOPBAR_STYLES\}/);
});
