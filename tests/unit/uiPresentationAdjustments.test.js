import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatRate } from "../../userscript/ui-utils.js";

const [MARKUP, HISTORY_STYLES, HISTORY_VIEW, CURRENT_VIEW] = await Promise.all([
  readFile(new URL("../../userscript/ui-markup.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/history-styles.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/history-view.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/current-view.js", import.meta.url), "utf8")
]);

test("formatRate keeps the existing default and supports precise capture chance", () => {
  assert.equal(formatRate(0.5), "50.00%");
  assert.equal(formatRate(0.00004, 3), "0.004%");
  assert.equal(formatRate(4.1029411764705885e-7, 3), "0.000041%");
  assert.equal(formatRate(0, 3), "0.000%");
});

test("capture chance uses three decimals in Current and History attempt surfaces", () => {
  assert.match(CURRENT_VIEW, /formatRate\(encounter\.captureChance, 3\)/);
  assert.match(HISTORY_VIEW, /formatRate\(encounter\.captureChance, 3\)/);
});

test("History Attempts removes the rarity column while retaining Chance", () => {
  assert.match(MARKUP, /<th>At<\/th><th>Pokémon<\/th><th>Result<\/th><th>Ball<\/th><th>Chance<\/th><th>IV<\/th>/);
  assert.doesNotMatch(MARKUP, /history-attempt-rarity-col/);
  assert.match(HISTORY_VIEW, /if \(index === 1\) cell\.classList\.add\(rarityClass\(encounter\.quality\)\)/);
});

test("collapsed Current sections expose data-driven shiny badges", () => {
  assert.match(MARKUP, /id="rarity-shiny-count"/);
  assert.match(MARKUP, /id="\$\{prefix\}-shiny-count"/);
  assert.match(CURRENT_VIEW, /updateShinyBadge\("captured"/);
  assert.match(CURRENT_VIEW, /updateShinyBadge\("failed"/);
  assert.match(CURRENT_VIEW, /updateShinyBadge\("rarity"/);
});

test("sticky navigation is scoped to Desktop", () => {
  assert.match(HISTORY_STYLES, /:host\(:not\(\[data-ui-mode="mobile"\]\)\) \.topbar \{[\s\S]*position: sticky;[\s\S]*top: 0;/);
  assert.match(HISTORY_STYLES, /:host\(:not\(\[data-ui-mode="mobile"\]\)\) \.tabs \{[\s\S]*position: sticky;[\s\S]*top: 46px;/);
});
