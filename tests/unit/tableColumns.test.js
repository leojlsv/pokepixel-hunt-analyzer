import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [MARKUP, STYLES, HISTORY_STYLES, HISTORY_VIEW, CURRENT_VIEW, GALLERY] = await Promise.all([
  readFile(new URL("../../userscript/ui-markup.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/styles.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/history-styles.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/history-view.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/current-view.js", import.meta.url), "utf8"),
  readFile(new URL("../../userscript/catch-gallery.js", import.meta.url), "utf8")
]);

test("Current tables declare stable semantic columns", () => {
  assert.match(MARKUP, /class="rarity-table"[\s\S]*class="rarity-name-col"/);
  assert.match(MARKUP, /class="\$\{prefix\}-table"[\s\S]*class="captured-iv-col"/);
  assert.match(MARKUP, /class="\$\{prefix\}-table"[\s\S]*class="failed-time-col"/);
  assert.match(STYLES, /\.captured-iv-col \{ width: 45%; \}/);
  assert.match(STYLES, /\.failed-iv-col \{ width: 10%; \}/);
  assert.match(HISTORY_STYLES, /\.failed-chance-col \{ width: 18%; \}/);
  assert.match(HISTORY_STYLES, /\.failed-time-col \{ width: 24%; \}/);
});

test("Captured distinguishes physical and special attack IVs without changing their values", () => {
  assert.match(MARKUP, /class="iv-atk">Atk<\/span>/);
  assert.match(MARKUP, /class="iv-spatk">sAtk<\/span>/);
  assert.match(CURRENT_VIEW, /const labels = \["hp", "atk", "spatk", "def", "spdef", "speed"\]/);
  assert.match(STYLES, /\.iv-atk \{ color: #e598b7;/);
  assert.match(STYLES, /\.iv-spatk \{ color: #7fb3e8;/);
});

test("all primary History tables use shared proportional colgroups", () => {
  assert.match(MARKUP, /class="history-hunts-table"[\s\S]*class="history-hunt-date-col"/);
  assert.match(MARKUP, /class="history-pokemon-table"[\s\S]*class="history-pokemon-name-col"/);
  assert.match(MARKUP, /class="history-attempts-table"[\s\S]*class="history-attempt-chance-col"/);
  assert.match(HISTORY_STYLES, /\.history-attempt-chance-col \{ width: 14%; \}/);
  assert.match(HISTORY_STYLES, /\.history-attempt-iv-col \{ width: 10%; \}/);
  assert.doesNotMatch(MARKUP, /history-attempt-rarity-col/);
  assert.doesNotMatch(HISTORY_STYLES, /\.history-attempts-table (?:th|td):nth-child\([^)]*\) \{ width:/);
});

test("nested History tables declare their own semantic columns", () => {
  assert.match(HISTORY_VIEW, /addColumnGroup\(table, \[[\s\S]*"history-notable-chance-col"[\s\S]*"history-notable-iv-col"/);
  assert.match(HISTORY_VIEW, /addColumnGroup\(table, \[[\s\S]*"history-pokemon-rarity-name-col"/);
  assert.match(HISTORY_STYLES, /\.history-notable-time-col \{ width: 18%; \}/);
  assert.match(HISTORY_STYLES, /\.history-notable-pokemon-col \{ width: 22%; \}/);
  assert.match(HISTORY_STYLES, /\.history-notable-ball-col \{ width: 20%; \}/);
  assert.match(HISTORY_STYLES, /\.history-notable-chance-col \{ width: 20%; \}/);
  assert.match(HISTORY_STYLES, /\.history-notable-iv-col \{ width: 10%; \}/);
});

test("Catch Gallery protects IV with a semantic column", () => {
  assert.match(GALLERY, /<col class="catch-gallery-iv-col">/);
  assert.match(GALLERY, /\.catch-gallery-iv-col \{ width:12%; \}/);
  assert.doesNotMatch(GALLERY, /\.catch-gallery-table th:nth-child\(4\) \{ width:/);
});
