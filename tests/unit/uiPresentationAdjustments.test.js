import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatCatchChance, formatRate } from "../../userscript/ui-utils.js";

const [MARKUP, HISTORY_STYLES, HISTORY_VIEW, CURRENT_VIEW] = await Promise.all([
  readFile(new URL("../../userscript/ui-markup.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/history-styles.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/history-view.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/current-view.js", import.meta.url), "utf8")
]);

test("formatRate keeps three decimals without rendering tiny non-zero chance as zero", () => {
  assert.equal(formatRate(0.5), "50.00%");
  assert.equal(formatRate(0.00004, 3), "0.004%");
  assert.equal(formatRate(4.1029411764705885e-7, 3), "<0.001%");
  assert.equal(formatRate(0, 3), "0.000%");
});

test("catch chance precision applies to Current and History capture surfaces", () => {
  assert.match(CURRENT_VIEW, /formatCatchChance\(encounter\.captureChance, getCatchChanceDecimals\(\)\)/);
  assert.match(HISTORY_VIEW, /formatCatchChance\(encounter\.captureChance, getCatchChanceDecimals\(\)\)/);
  assert.equal(formatCatchChance(0.00004, 0), "<1%");
  assert.equal(formatCatchChance(0.00004, 1), "<0.1%");
  assert.equal(formatCatchChance(0.00004, 2), "<0.01%");
  assert.equal(formatCatchChance(0.00004, 3), "0.004%");
  assert.equal(formatCatchChance(0.00004, 4), "0.0040%");
  assert.equal(formatCatchChance(0.00004, 6), "0.004000%");
  assert.equal(formatCatchChance(4.1029411764705885e-7, 6), "0.000041%");
  assert.equal(formatCatchChance(0, 0), "0%");
  assert.equal(formatCatchChance(null, 6), "—");
  assert.equal(formatRate(0.5), "50.00%", "Capture Rate retains existing precision");
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
