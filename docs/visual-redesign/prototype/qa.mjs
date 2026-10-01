/* Optional offline DOM smoke for the prototype. Uses the repository's
 * development-only happy-dom; index.html itself has no runtime dependency. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";

const base = new URL("./", import.meta.url);
const html = await readFile(new URL("index.html", base), "utf8");
const script = await readFile(new URL("app.js", base), "utf8");
const styles = await readFile(new URL("styles.css", base), "utf8");

assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css">/);
assert.match(html, /<script src="\.\/app\.js" defer><\/script>/);
assert.doesNotMatch(html + script + styles, /https?:\/\/|@import|fetch\s*\(|XMLHttpRequest|WebSocket|indexedDB|localStorage/i);
assert.equal((html.match(/class="app-screen"/g) || []).length, 4);
assert.match(
  styles,
  /\.analyzer\[data-mode="mobile"\] \.hunt-actions \.mock-button \{[^}]*min-height:\s*44px\b/,
  "mock Mobile Hunt actions must satisfy the minimum 44px touch target"
);
assert.match(
  styles,
  /\.analyzer\[data-mode="mobile"\] \.record-detail-affordance\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/,
  "Mobile Captured Details affordance must visibly reserve at least a 44x44px target"
);
assert.match(
  styles,
  /\.analyzer\[data-mode="mobile"\] \.inline-action\s*\{[^}]*min-height:\s*44px\b/,
  "mobile Gallery Generate/Copy visual targets must reserve 44px, even as inert mock actions"
);
assert.match(
  styles,
  /\.table-sort-toolbar button\s*\{[^}]*min-height:\s*44px\b/,
  "sort direction control must reserve at least 44px"
);
assert.match(
  styles,
  /\.table-sort-toolbar select\s*\{[^}]*min-height:\s*44px\b/,
  "sort select must reserve at least 44px"
);
assert.match(
  html,
  /data-hud-slot="2" data-widget="rarityTracker" data-size="2"/,
  "HTML itself must show Default's two-slot Rarity Tracker before JS runs"
);
assert.match(
  html,
  /data-hud-slot="3" data-widget="empty" data-size="1" data-consumed="true" hidden/,
  "HTML itself must mark slot 4 as consumed by Default Rarity Tracker"
);

const HUD_PRESET_SNAPSHOTS = Object.freeze({
  default: ["seen", "seenPerHour", "rarityTracker", "empty"],
  leveling: ["trainerXpPerHour", "pokemonXpPerHour", "seen", "seenPerHour"],
  economy: ["dollarPerHour", "profitPerHour", "expenses", "huntTime"],
  capture: ["seen", "captured", "failed", "captureRate"]
});
const HUD_PRESET_NAMES = Object.freeze({
  default: ["Seen", "Seen/h", "Rarity Tracker", "Empty"],
  leveling: ["Trainer XP/h", "Pokémon XP/h", "Seen", "Seen/h"],
  economy: ["Dollar/h", "Profit/h", "Expenses", "Hunt Time"],
  capture: ["Seen", "Captured", "Failed", "Capture Rate"]
});
const HUD_VALUE_SNAPSHOTS = Object.freeze({
  default: ["16,842", "915", "RARITY_TRACKER", ""],
  leveling: ["18.4K", "94.2K", "16,842", "915"],
  economy: ["98.9K", "+97.9K", "18.3K", "18:24:12"],
  capture: ["16,842", "1,409", "15,433", "8.37%"]
});

function linearChannel(channel) {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const chunks = hex.slice(1).match(/.{2}/g).map((chunk) => linearChannel(parseInt(chunk, 16)));
  return chunks[0] * 0.2126 + chunks[1] * 0.7152 + chunks[2] * 0.0722;
}
function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const [label, foreground, background] of [
  ["Primary / canvas", "#f1f5f4", "#151b1d"],
  ["Muted / raised", "#b4c4c3", "#1d2528"],
  ["Secondary / header", "#93aaa9", "#273134"],
  ["Gold / header", "#d7b45d", "#273134"],
  ["Cyan / header", "#80d5e6", "#273134"],
  ["Active / active surface", "#75d6ab", "#1d3b2f"],
  ["Failed / raised", "#f39a97", "#1d2528"]
]) {
  assert.ok(contrast(foreground, background) >= 4.5, label + " falls below 4.5:1");
}

function openMock(query = "") {
  const page = new Window({
    url: "file:///G:/pokepixel-hunt-analyzer/docs/visual-redesign/prototype/index.html" + query
  });
  // The real browser loads app.js by its relative file path; the DOM smoke
  // evaluates exactly those bytes to avoid Happy DOM's remote loader.
  page.document.write(html.replace(/<script src="\.\/app\.js" defer><\/script>/, ""));
  page.eval(script);
  return page;
}

function visibleSections(page) {
  return [...page.document.querySelectorAll(".app-screen")].filter((node) => !node.hidden);
}

const desktop = openMock();
const doc = desktop.document;
const frame = doc.getElementById("prototype");

// M1.1: one semantic table per data set, no mirror/clone, no per-Pokémon
// boxes. The shared 2-band header labels the same 11 captured cells.
const TABLE_COLUMNS = Object.freeze({
  ".rarity-table": ["Rarity", "Seen", "Cap.", "Fail", "Rate"],
  ".captured-table": ["Pokémon", "Gender", "Nature", "Quality", "IV Total", "HP IV", "Atk IV", "sAtk IV", "Def IV", "sDef IV", "SpD IV"],
  ".failed-table": ["Pokémon", "IV", "Pokéball", "Chance", "Fled at"],
  ".history-hunts-table": ["Date", "Dur.", "Seen", "Cap.", "Sh", "Leg", "Myt"],
  ".history-pokemon-table": ["Pokémon", "Lvl", "Seen", "Cap.", "Rate", "XP/Cyc", "$/Cyc"],
  ".history-attempts-table": ["At", "Pokémon", "Result", "Ball", "Chance", "IV"],
  ".gallery-table": ["Pokémon", "Captured", "Quality", "IV", "Actions"]
});
assert.equal(doc.querySelectorAll(".data-table").length, Object.keys(TABLE_COLUMNS).length);
assert.equal(doc.querySelectorAll(".scroll-cue").length, 0, "obsolete horizontal scroll directions must be removed");
assert.doesNotMatch(doc.querySelector(".design-inspector").textContent, /rolagem horizontal explícita/i,
  "inspector must reflect zero horizontal scrolling");
assert.equal(doc.querySelectorAll('[aria-label*="role horizontalmente"], [aria-label*="rolagem horizontal"]').length,
  0, "no live table region may instruct horizontal scrolling");
const tableWrapRule = styles.match(/\.table-scroll\s*\{([^}]*)\}/)?.[1]
  .replace(/\/\*[\s\S]*?\*\//g, "");
assert.ok(tableWrapRule, "table wrapper CSS rule must exist");
assert.match(tableWrapRule, /overflow:\s*visible;/, "table wrappers must not scroll or clip");
assert.doesNotMatch(tableWrapRule, /overflow-x:\s*(?:auto|scroll|hidden)\b/);
assert.match(styles, /\.data-table\[data-presentation="dense"\]\s+tbody tr:not\(\.history-detail\)\s*\{[^}]*border-radius:\s*0;/,
  "continuous table rows must have no per-Pokémon box rounding");
assert.match(styles, /\.data-table\[data-presentation="dense"\]\s+tbody tr:not\(\.history-detail\)\s*\{[^}]*box-shadow:\s*none;/,
  "continuous table rows must not cast per-Pokémon card shadows");
assert.doesNotMatch(styles, /data-presentation="cards"/, "rejected Pokémon card presentation must be absent");
assert.match(styles, /\.data-table\[data-presentation="dense"\]\.captured-table\s+:is\(th,td\):nth-child\(n\+6\)\s*\{[^}]*grid-column:\s*span 5;/,
  "six IV columns must share the visible second data band");
assert.match(styles, /\.data-table\[data-presentation="dense"\]\s+th\[aria-sort="none"\]\s+\.sort-direction\s*\{\s*display:\s*none;/,
  "dense shared headers must suppress unselected sort arrows to avoid wrap/noise in screenshots");
assert.match(styles, /\.data-table\[data-presentation="dense"\]\.failed-table\s+:is\(th,td\):nth-child\(2\)\s*\{\s*grid-column:\s*span 3;/,
  "Failed IV header must have 3 tracks in Mobile320 to avoid the IV label wrapping");
assert.match(styles, /\.data-table\[data-presentation="dense"\]\.captured-table\s+tbody tr\s*\{[^}]*44px[^}]*25px/,
  "compact Captured rows must reserve 44px for Details plus 25px for six visible IVs");
assert.match(styles, /\.filter-disclosure\s*>\s*summary\s*\{[^}]*min-height:\s*36px;/,
  "filters must expose a compact native disclosure instead of an always-expanded toolbar");
assert.match(styles, /\.table-sort-toolbar\s*>\s*summary\s*\{[^}]*min-height:\s*34px;/,
  "sorting must expose a compact native disclosure");
assert.match(styles,
  /\.analyzer\[data-mode="mobile"\] \.table-sort-toolbar > summary\s*\{[^}]*min-height:\s*44px;/,
  "Mobile Sort disclosure summary must reserve a 44px touch target while remaining compact on desktop");
assert.match(styles,
  /\.analyzer\[data-mode="mobile"\] \.rarity-table \.sort-header-button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/,
  "Mobile five-column Rarity header sort buttons must reserve 44 by 44px without expanding Pokémon rows");
assert.match(styles,
  /\.analyzer\[data-mode="mobile"\] \.history-hunts-table \.history-detail-toggle\s*\{[^}]*min-height:\s*44px;/,
  "Mobile History Hunts expander must reserve 44px without increasing Captured Pokémon row height");

for (const [selector, labels] of Object.entries(TABLE_COLUMNS)) {
  const table = doc.querySelector(selector);
  assert.ok(table, selector + " exists");
  assert.equal(table.getAttribute("role"), "table");
  assert.deepEqual(
    [...table.querySelectorAll("thead th")].map((th) => th.textContent.replace(/[↑↓↕]/g, "").trim()),
    labels,
    selector + " preserves all real column labels"
  );
  const rows = [...table.querySelectorAll("tbody > tr")].filter((row) => !row.classList.contains("history-detail"));
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.getAttribute("role"), "row");
    assert.equal(row.querySelector("th[scope=row]")?.getAttribute("role"), "rowheader");
    const cells = [...row.querySelectorAll("td")];
    assert.equal(cells.length + 1, labels.length, selector + " must retain all original fields for every record");
    for (const [index, cell] of cells.entries()) {
      assert.equal(cell.dataset.label, labels[index + 1], selector + " field #" + (index + 2) + " label");
      assert.equal(cell.getAttribute("role"), "cell");
      assert.ok(cell.textContent.trim(), selector + " data must be present, using — for unknown");
    }
  }
}
for (const selector of [".captured-table", ".failed-table"]) {
  for (const row of doc.querySelectorAll(selector + " tbody > tr")) {
    assert.doesNotMatch(row.querySelector("th[scope=row]").textContent, /\b(?:Lv\.?|Level)\s*\d+/i,
      selector + " must not show level in the Pokémon name");
  }
}
assert.deepEqual(
  [...doc.querySelectorAll('[data-filter-group="failed"] [data-filter-rarity] option')]
    .map((option) => option.value),
  ["all", "weak", "common", "uncommon", "rare", "epic", "legendary", "mythical"],
  "Failed rarity filter must include all seven native rarity values, not only Rare+"
);
const historyFilters = doc.querySelector("#screen-history .history-filters");
assert.ok(historyFilters.querySelector(".history-filter-note"),
  "synthetic-only History filters must be visibly explained");
assert.deepEqual(
  [...historyFilters.querySelectorAll("select")].map((select) => select.disabled),
  [false, true, true, true, true, true, true],
  "only Period is implemented in this offline History mock; placeholders must be disabled"
);
for (const row of doc.querySelectorAll(".gallery-table tbody tr")) {
  assert.match(row.children[1].textContent.trim(), /^\d{2}\/\d{2}\s*·\s*\d{2}:\d{2}:\d{2}$/,
    "Gallery captured timestamp must include seconds");
  const mockActions = [...row.children[4].querySelectorAll("button")];
  assert.deepEqual(mockActions.map((button) => button.textContent.trim()), ["Generate", "Copy"]);
  assert.ok(mockActions.every((button) => button.disabled), "Gallery placeholder actions must not imply working upload/copy");
}

assert.equal(doc.querySelectorAll("#screen-current .row-detail").length, 0,
  "there must be no orphaned global Captured detail attached to the whole table");
for (const row of doc.querySelectorAll(".captured-table tbody tr")) {
  const button = row.querySelector('th[scope="row"] .record-detail-toggle');
  assert.ok(button, "every synthetic Captured record must have an independent detail control");
  const detail = doc.getElementById(button.getAttribute("aria-controls"));
  assert.ok(detail && row.contains(detail), "Captured detail must belong to the same table row");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(detail.hidden, true);
  for (const field of [row.dataset.capturedAt, row.dataset.capturedBall, row.dataset.capturedChance]) {
    assert.ok(field && detail.textContent.includes(field), "Captured per-row detail must preserve all three fields");
  }
  button.click();
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(detail.hidden, false);
  button.click();
  assert.equal(detail.hidden, true);
}
assert.ok(doc.querySelector(".history-pokemon-table thead").textContent.includes("Lvl"),
  "History Pokémon level column must remain");
for (const row of doc.querySelectorAll(".captured-table tbody tr")) {
  const total = Number(row.children[4].textContent);
  const sixIVs = [...row.children].slice(5).map((cell) => Number(cell.textContent));
  assert.equal(sixIVs.length, 6);
  assert.equal(sixIVs.reduce((sum, iv) => sum + iv, 0), total, "IV Total must equal six visible IVs");
  assert.equal(total, Number(row.dataset.iv), "IV total must remain the authoritative filter key");
}

for (const [viewport, expectedDense] of [
  ["desktop-415", 6],
  ["desktop-620", 2],
  ["mobile-320", 6],
  ["mobile-390", 6]
]) {
  const preview = openMock("?viewport=" + viewport + "&screen=current");
  const previewDoc = preview.document;
  const denseTables = [...previewDoc.querySelectorAll('.data-table[data-presentation="dense"]')];
  assert.equal(denseTables.length, expectedDense, viewport + " must use continuous two-band rows for narrow tables");
  assert.equal(previewDoc.querySelector(".rarity-table").dataset.presentation, "table",
    viewport + " rarity table must remain a regular dense table with five columns");
  assert.equal(previewDoc.querySelectorAll(".data-table").length, 7, viewport + " must not clone/hide any table");
  const filters = [...previewDoc.querySelectorAll(".filter-disclosure")];
  assert.equal(filters.length, 4, "Captured, Failed, History and Gallery must have collapsible filters");
  assert.ok(filters.every((item) => item.open === (viewport === "desktop-620")),
    viewport + " filter disclosures must default collapsed in every compact frame (320/390/415)");
  assert.match(styles,
    /\.data-table\[data-presentation="dense"\]\.captured-table\s+:is\(th,td\):nth-child\(3\)\s*\{\s*grid-column:\s*span 6;/,
    "Nature must receive 6 tracks to keep Adamant on one line in Mobile320");
  assert.match(styles,
    /\.data-table\[data-presentation="dense"\]\.captured-table\s+:is\(th,td\):nth-child\(4\)\s*\{\s*grid-column:\s*span 4;/,
    "Quality must remain visible in four tracks after Nature expansion");
  for (const table of previewDoc.querySelectorAll(".data-table")) {
    assert.ok(["table", "dense"].includes(table.dataset.presentation));
    const toolbar = table.parentElement.previousElementSibling;
    assert.equal(toolbar.classList.contains("table-sort-toolbar"), true);
    assert.equal(toolbar.tagName, "DETAILS", viewport + " sort must use a native disclosure");
    assert.equal(toolbar.hidden, table.dataset.presentation !== "dense",
      viewport + " sorting must be available in dense mode; wide native tables retain header buttons");
    if (!toolbar.hidden) {
      assert.equal(toolbar.open, false, viewport + " sort disclosure defaults folded for screenshots");
      assert.ok(toolbar.querySelector(":scope > summary"), "sort disclosure must remain keyboard accessible");
    }
    for (const th of table.querySelectorAll("thead th .sort-header-button")) {
      assert.equal(th.tabIndex, table.dataset.presentation === "dense" ? -1 : 0,
        viewport + " must keep full-table buttons keyboard accessible and dense sort in disclosure");
    }
  }
  const captured = previewDoc.querySelector(".captured-table");
  assert.equal(captured.dataset.presentation, "dense");
  assert.equal(captured.querySelectorAll("thead tr > th").length, 11);
  for (const row of captured.querySelectorAll("tbody tr")) {
    assert.equal(row.querySelectorAll(":scope > th, :scope > td").length, 11);
    assert.equal(row.querySelectorAll("td.iv-stat").length, 6, "six IVs stay visible, not stored in Details");
    assert.equal(row.querySelectorAll("td.iv-total").length, 1, "IV Total stays visible next to nature and quality");
  }
  preview.close();
}

const sorting = openMock("?viewport=mobile-320&screen=current");
const sortingDoc = sorting.document;
function sortedRows(table) {
  return [...table.querySelectorAll("tbody > tr:not(.history-detail)")];
}
function sortMockTable(tableSelector, label, descending = false) {
  const table = sortingDoc.querySelector(tableSelector);
  const headerLabels = [...table.querySelectorAll("thead th")]
    .map((th) => th.textContent.replace(/[↑↓↕]/g, "").trim());
  const index = headerLabels.indexOf(label);
  assert.ok(index >= 0, tableSelector + " must support sorting by " + label);
  const toolbar = table.parentElement.previousElementSibling;
  const sortSelect = toolbar.querySelector("select");
  const toggle = toolbar.querySelector(".sort-order-button");
  sortSelect.value = String(index);
  sortSelect.dispatchEvent(new sorting.Event("change", { bubbles: true }));
  if (descending) toggle.click();
  assert.equal(table.querySelectorAll('thead th[aria-sort="ascending"], thead th[aria-sort="descending"]').length, 1,
    "exactly one column must announce the active sort");
  assert.equal(table.querySelectorAll("thead th")[index].getAttribute("aria-sort"),
    descending ? "descending" : "ascending");
  return table;
}

let testTable = sortMockTable(".rarity-table", "Seen");
assert.equal(sortedRows(testTable)[0].querySelector("th[scope=row]").textContent, "Mythical");
assert.equal(sortedRows(testTable).at(-1).querySelector("th[scope=row]").textContent, "Weak");
sortMockTable(".rarity-table", "Seen", true);
assert.equal(sortedRows(testTable)[0].querySelector("th[scope=row]").textContent, "Weak");

testTable = sortMockTable(".captured-table", "IV Total");
assert.deepEqual(sortedRows(testTable).map((row) => row.querySelector(".record-detail-name").textContent.trim()),
  ["Pidgeotto", "Scizor", "Gengar", "✦ Dragonite"]);
assert.deepEqual([...testTable.querySelectorAll("tbody tr")].map((row) => row.dataset.iv),
  ["144", "160", "172", "181"], "sort must preserve filter metadata");
const sortingCapturedFilter = sortingDoc.querySelector('[data-filter-group="captured"]');
sortingCapturedFilter.querySelector("[data-filter-shiny]").value = "yes";
sortingCapturedFilter.dispatchEvent(new sorting.Event("change", { bubbles: true }));
assert.equal(sortingDoc.getElementById("captured-count").textContent, "1 shown");
assert.equal(sortedRows(testTable).filter((row) => !row.hidden)[0].dataset.iv, "181");

testTable = sortMockTable(".failed-table", "Chance", true);
assert.equal(sortedRows(testTable)[0].querySelector("th[scope=row]").textContent, "Heracross");
assert.equal(sortedRows(testTable).at(-1).querySelector("th[scope=row]").textContent, "Zapdos");

testTable = sortMockTable(".history-hunts-table", "Seen");
assert.deepEqual(sortedRows(testTable).map((row) => row.dataset.historyPeriod),
  ["yesterday", "7d", "today"]);
const todayRow = sortedRows(testTable).at(-1);
const huntDetail = sortingDoc.getElementById("history-hunt-detail-01");
assert.equal(todayRow.nextElementSibling, huntDetail, "sorting Hunts must keep expanded detail attached to its row");
const expandButton = todayRow.querySelector(".history-detail-toggle");
assert.equal(expandButton.getAttribute("aria-expanded"), "true");
expandButton.click();
assert.equal(expandButton.getAttribute("aria-expanded"), "false");
assert.equal(huntDetail.hidden, true, "History detail must collapse without removing data");
expandButton.click();
assert.equal(huntDetail.hidden, false, "History detail must reopen after sorting");
sortingDoc.getElementById("history-period").value = "yesterday";
sortingDoc.getElementById("history-period").dispatchEvent(new sorting.Event("change", { bubbles: true }));
assert.equal(todayRow.hidden, true, "History period filtering must survive sorting");
assert.equal(huntDetail.hidden, true, "filtered History detail must never remain orphaned");
assert.equal(sortedRows(testTable).filter((row) => !row.hidden).length, 1);

testTable = sortMockTable(".history-pokemon-table", "Rate");
assert.equal(sortedRows(testTable)[0].querySelector("th[scope=row]").textContent, "Scizor");
testTable = sortMockTable(".history-attempts-table", "Chance");
assert.equal(sortedRows(testTable)[0].querySelector("td[data-label=Pokémon]").textContent, "Zapdos");

testTable = sortMockTable(".gallery-table", "Quality");
assert.equal(sortedRows(testTable)[0].dataset.galleryName, "Zapdos");
sortingDoc.getElementById("gallery-search").value = "mew";
sortingDoc.getElementById("gallery-search").dispatchEvent(new sorting.Event("input", { bubbles: true }));
assert.equal(sortingDoc.getElementById("gallery-count").textContent, "1 shown");
assert.equal(sortedRows(testTable).filter((row) => !row.hidden)[0].dataset.galleryName, "Mew");

sorting.close();

const wideSorting = openMock("?viewport=desktop-620&screen=current");
const wideRarity = wideSorting.document.querySelector(".rarity-table");
assert.equal(wideRarity.dataset.presentation, "table");
assert.equal(wideRarity.parentElement.previousElementSibling.hidden, true);
const wideSeenButton = wideRarity.querySelectorAll("thead th")[1].querySelector("button");
assert.equal(wideSeenButton.tabIndex, 0, "Desktop full table sort must be available with keyboard");
wideSeenButton.click();
assert.equal(wideRarity.querySelectorAll("thead th")[1].getAttribute("aria-sort"), "ascending");
assert.equal(sortedRows(wideRarity)[0].querySelector("th[scope=row]").textContent, "Mythical");
wideSorting.close();

// The seven static By Rarity rows are the fixture of record. Check every
// number shown elsewhere against them, rather than copying expected totals
// into the test. Current's domain contract is Seen = Captured + Failed.
function countFromText(text, label) {
  const value = String(text).trim();
  assert.match(value, /^\d{1,3}(?:,\d{3})*$|^\d+$/, label + " must be a complete non-negative count");
  return Number(value.replaceAll(",", ""));
}
function rateFromText(text, label) {
  const value = String(text).trim();
  assert.match(value, /^\d+(?:\.\d{1,2})?%$/, label + " must be a displayed percentage");
  return Number(value.slice(0, -1));
}
function assertRate(actual, captured, seen, label) {
  const expected = seen > 0 ? (captured / seen) * 100 : 0;
  assert.ok(
    Math.abs(actual - expected) <= 0.005000001,
    label + ": displayed " + actual + "% differs from " + expected.toFixed(4) + "%"
  );
}

const rarityRows = [...doc.querySelectorAll(".rarity-table tbody tr")];
const rarityNames = ["Weak", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical"];
assert.equal(rarityRows.length, rarityNames.length, "all seven rarities must be present");
const rarityFixture = new Map();
const sums = { seen: 0, captured: 0, failed: 0 };
for (const row of rarityRows) {
  const [name, seenCell, capturedCell, failedCell, rateCell] = [...row.querySelectorAll("th, td")];
  const rarity = name.textContent.trim();
  assert.ok(rarityNames.includes(rarity) && !rarityFixture.has(rarity), "invalid/repeated rarity: " + rarity);
  const seen = countFromText(seenCell.textContent, rarity + " Seen");
  const captured = countFromText(capturedCell.textContent, rarity + " Captured");
  const failed = countFromText(failedCell.textContent, rarity + " Failed");
  assert.equal(seen, captured + failed, rarity + " must satisfy Seen = Captured + Failed");
  assertRate(rateFromText(rateCell.textContent, rarity + " Rate"), captured, seen, rarity + " Rate");
  rarityFixture.set(rarity, { seen, captured, failed });
  sums.seen += seen;
  sums.captured += captured;
  sums.failed += failed;
}
assert.deepEqual([...rarityFixture.keys()], rarityNames, "all rarity buckets must have a stable order");
assert.equal(sums.seen, sums.captured + sums.failed, "aggregate Seen = Captured + Failed");

function captureKpi(label) {
  const article = [...doc.querySelectorAll(".capture-grid .capture-kpi")]
    .find((candidate) => candidate.querySelector("span")?.textContent.trim() === label);
  assert.ok(article, label + " KPI must be present");
  return article;
}
for (const [label, expected] of [
  ["Seen", sums.seen],
  ["Captured", sums.captured],
  ["Failed", sums.failed]
]) {
  assert.equal(
    countFromText(captureKpi(label).querySelector("strong").textContent, label + " KPI"),
    expected,
    label + " KPI must equal sum of all rarity buckets"
  );
}
assertRate(
  rateFromText(captureKpi("Capture").querySelector("strong").textContent, "Capture Rate KPI"),
  sums.captured, sums.seen, "Capture Rate KPI"
);
assertRate(
  rateFromText(captureKpi("Captured").querySelector("small").textContent.replace(/\s+Seen$/, ""), "Captured secondary Rate"),
  sums.captured, sums.seen, "Captured secondary Rate"
);

const rarePlus = rarityNames.slice(3).map((name) => rarityFixture.get(name));
const rarePlusFailed = rarePlus.reduce((sum, bucket) => sum + bucket.failed, 0);
const rarePlusCaptured = rarePlus.reduce((sum, bucket) => sum + bucket.captured, 0);
const rarePlusLabel = doc.querySelector(".rarity-table").closest("details").querySelector(".panel-meta .quiet-badge");
assert.match(rarePlusLabel.textContent.trim(), /^Rare\+ Failed [\d,]+$/, "Rare+ heading badge");
assert.equal(
  countFromText(rarePlusLabel.textContent.replace("Rare+ Failed ", ""), "Rare+ heading badge"),
  rarePlusFailed,
  "Rare+ badge must equal Failed for Rare/Epic/Legendary/Mythical"
);
assert.equal(
  countFromText(captureKpi("Failed").querySelector("small").textContent.replace(/\s+Rare\+$/, ""), "Failed KPI Rare+ caption"),
  rarePlusFailed,
  "Failed KPI caption must equal Rare+ badge"
);
const hudRarityWidget = doc.querySelector('#hud-launcher [data-hud-slot="2"]');
assert.equal(hudRarityWidget.dataset.widget, "rarityTracker", "Default slot 3 must be the Rarity Tracker");
assert.equal(hudRarityWidget.dataset.size, "2", "Default Rarity Tracker must span two slots");
assert.equal(hudRarityWidget.classList.contains("hud-widget--wide"), true);
assert.equal(doc.querySelector('#hud-launcher [data-hud-slot="3"]').hidden, true, "Default slot 4 is consumed");
const hudRarityCells = [...hudRarityWidget.querySelectorAll("[data-hud-rarity]")];
assert.equal(hudRarityCells.length, rarityNames.length, "Default Rarity Tracker contains seven captured rarity counts");
let rarityTrackerSum = 0;
let hudRarePlusCaptured = 0;
for (const [index, item] of hudRarityCells.entries()) {
  const key = item.dataset.hudRarity;
  const rarity = rarityNames[index];
  assert.equal(key, rarity.toLowerCase(), "Rarity Tracker order must follow By Rarity");
  const value = countFromText(item.textContent, "HUD " + rarity + " Captured");
  assert.equal(value, rarityFixture.get(rarity).captured, "HUD captured count must come from the rarity fixture");
  rarityTrackerSum += value;
  if (index >= 3) hudRarePlusCaptured += value;
}
assert.equal(rarityTrackerSum, sums.captured, "Default HUD Rarity Tracker captured sum must match captured KPI");
assert.equal(hudRarePlusCaptured, rarePlusCaptured, "Default HUD Rarity Tracker Rare+ sum must match Rare+ fixture");
const hudRareTracker = [...doc.querySelectorAll(".hud-semantics > div")]
  .find((item) => item.querySelector(".micro-label")?.textContent.trim() === "RARITY TRACKER");
assert.ok(hudRareTracker, "HUD rarity tracker must be present");
const hudRareCounts = [...hudRareTracker.querySelectorAll("strong > span")];
assert.equal(hudRareCounts.length, 2, "HUD rarity tracker must include failed and captured");
assert.equal(countFromText(hudRareCounts[0].textContent, "HUD Rare Failed"), rarityFixture.get("Rare").failed);
assert.equal(countFromText(hudRareCounts[1].textContent, "HUD Rare Captured"), rarityFixture.get("Rare").captured);
assert.match(doc.querySelector(".hunt-running").textContent, /\bGengar\b/, "mock target must use a valid Pokémon species");
assert.doesNotMatch(doc.querySelector(".hunt-running").textContent, /Route\s+\d+/i);

assert.equal(frame.dataset.viewport, "desktop-415");
assert.equal(frame.dataset.mode, "desktop");
assert.equal(doc.getElementById("dimension-label").textContent, "415 × 700");
assert.deepEqual(visibleSections(desktop).map((node) => node.id), ["screen-current"]);
assert.equal(doc.querySelectorAll(".app-tab[aria-selected=true]").length, 1);
assert.equal(doc.getElementById("desktop-current").tabIndex, 0);
assert.equal(doc.getElementById("mobile-current").tabIndex, -1);

doc.getElementById("desktop-current").dispatchEvent(new desktop.KeyboardEvent(
  "keydown", { key: "ArrowRight", bubbles: true }
));
assert.deepEqual(visibleSections(desktop).map((node) => node.id), ["screen-history"]);
assert.equal(doc.getElementById("desktop-history").getAttribute("aria-selected"), "true");
doc.getElementById("desktop-misc").click();
assert.deepEqual(visibleSections(desktop).map((node) => node.id), ["screen-misc"]);
doc.getElementById("desktop-hud").click();
assert.deepEqual(visibleSections(desktop).map((node) => node.id), ["screen-hud"]);
doc.querySelector('[data-viewport="desktop-620"].viewport-option').click();
assert.equal(frame.dataset.viewport, "desktop-620");
assert.equal(doc.getElementById("dimension-label").textContent, "620 × 700");

function testHudSnapshot(page, presetName, layout) {
  const pageDoc = page.document;
  const presetSelect = pageDoc.getElementById("hud-preset");
  const layoutSelect = pageDoc.getElementById("hud-layout");
  presetSelect.value = presetName;
  presetSelect.dispatchEvent(new page.Event("change", { bubbles: true }));
  layoutSelect.value = layout;
  layoutSelect.dispatchEvent(new page.Event("change", { bubbles: true }));
  const launcher = pageDoc.getElementById("hud-launcher");
  const widgets = [...launcher.querySelectorAll("[data-hud-slot]")];
  const cards = [...pageDoc.querySelectorAll("[data-slot-config]")];
  const actualSnapshot = widgets.map((element) => element.dataset.widget);
  const expectedSnapshot = HUD_PRESET_SNAPSHOTS[presetName];
  assert.deepEqual(actualSnapshot, expectedSnapshot, presetName + " widget order must match runtime preset");
  assert.deepEqual(
    widgets.map((element) => element.querySelector("[data-hud-value]")?.textContent ||
      (element.querySelector(".hud-rarity-row") ? "RARITY_TRACKER" : "")),
    HUD_VALUE_SNAPSHOTS[presetName],
    presetName + " mock value snapshot must match its canonical widget slots"
  );
  assert.deepEqual(
    cards.map((element) => element.querySelector("[data-slot-name]").textContent),
    HUD_PRESET_NAMES[presetName],
    presetName + " slot catalog names must match runtime labels"
  );
  assert.equal(launcher.dataset.hudLayout, layout);
  assert.match(pageDoc.getElementById("hud-dimensions").textContent, /(?:220|145|52) × 52/);
  assert.deepEqual(
    widgets.filter((element) => !element.hidden).map((element) => Number(element.dataset.hudSlot)),
    layout === "0" ? [] : layout === "1" ? [0, 2] : presetName === "default" ? [0, 1, 2] : [0, 1, 2, 3],
    presetName + " / " + layout + " must expose only its actual layout slots"
  );
  assert.deepEqual(
    cards.filter((element) => !element.hidden).map((element) => Number(element.dataset.slotConfig)),
    layout === "0" ? [] : layout === "1" ? [0, 2] : [0, 1, 2, 3],
    presetName + " / " + layout + " settings must reflect column visibility"
  );
  if (presetName === "default") {
    assert.equal(widgets[2].classList.contains("hud-widget--wide"), true);
    assert.equal(widgets[2].dataset.size, "2");
    assert.equal(widgets[3].dataset.consumed, "true");
    assert.equal(widgets[3].hidden, true);
    assert.equal(cards[3].dataset.consumed, "true");
    assert.equal(widgets[2].querySelectorAll("[data-hud-rarity]").length, 7);
  } else {
    assert.ok(widgets.every((element) => element.dataset.size === "1"));
    assert.ok(widgets.every((element) => element.dataset.consumed === "false"));
  }
  if (layout === "0") {
    assert.match(launcher.getAttribute("aria-label"), /PX Only.*PX/);
    assert.match(styles, /\.hud-launcher\[data-hud-layout="0"\] \.hud-widget-grid \{ display: none; \}/);
    assert.match(styles, /\.hud-launcher\[data-hud-layout="0"\] \{ width: 52px;/);
  }
  if (layout === "1") {
    assert.match(styles, /\.hud-launcher\[data-hud-layout="1"\] \.hud-widget-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    assert.match(styles, /\.hud-launcher\[data-hud-layout="1"\] \.hud-widget--wide \{ grid-column: span 1; \}/);
  }
  if (layout === "2" && presetName === "default") {
    assert.match(styles, /\.hud-widget--wide \{ grid-column: span 2;/);
  }
}

for (const preset of Object.keys(HUD_PRESET_SNAPSHOTS)) {
  for (const layout of ["2", "1", "0"]) {
    testHudSnapshot(desktop, preset, layout);
  }
}
testHudSnapshot(desktop, "capture", "2");
const captureWidgets = [...doc.querySelectorAll("#hud-launcher [data-hud-slot]")];
assert.equal(
  countFromText(captureWidgets[1].querySelector("[data-hud-value]").textContent, "Capture preset Captured"),
  sums.captured,
  "Capture preset must display exact Captured"
);
assert.equal(
  countFromText(captureWidgets[2].querySelector("[data-hud-value]").textContent, "Capture preset Failed"),
  sums.failed,
  "Capture preset must display Failed from fixture"
);
assertRate(
  rateFromText(captureWidgets[3].querySelector("[data-hud-value]").textContent, "Capture preset Rate"),
  sums.captured, sums.seen, "Capture preset Rate"
);

const mobileHud = openMock("?viewport=mobile-320&screen=hud&hudLayout=1&hudPreset=default");
testHudSnapshot(mobileHud, "default", "1");
testHudSnapshot(mobileHud, "default", "0");
testHudSnapshot(mobileHud, "leveling", "2");
mobileHud.close();

doc.getElementById("screen-select").value = "current";
doc.getElementById("screen-select").dispatchEvent(new desktop.Event("change", { bubbles: true }));
const rarityChecks = [...doc.querySelectorAll('[data-filter-group="captured"] [data-rarity-value]')];
for (const check of rarityChecks) check.checked = check.dataset.rarityValue === "legendary";
rarityChecks[0].dispatchEvent(new desktop.Event("change", { bubbles: true }));
const capturedGroup = doc.querySelector('[data-filter-group="captured"]');
capturedGroup.querySelector("[data-filter-shiny]").value = "yes";
capturedGroup.querySelector("[data-filter-quality]").value = "2";
capturedGroup.querySelector("[data-filter-iv]").value = "180";
capturedGroup.dispatchEvent(new desktop.Event("input", { bubbles: true }));
assert.equal(doc.getElementById("captured-count").textContent, "1 shown");
capturedGroup.querySelector("[data-filter-iv]").value = "185";
capturedGroup.dispatchEvent(new desktop.Event("input", { bubbles: true }));
assert.equal(doc.getElementById("captured-count").textContent, "0 shown");
assert.equal(doc.getElementById("captured-empty").hidden, false);
assert.equal(doc.querySelectorAll(".captured-table tbody tr:not([hidden])").length, 0,
  "per-row details must be filtered together with their owning record");
const failedGroup = doc.querySelector('[data-filter-group="failed"]');
failedGroup.querySelector("[data-filter-iv]").value = "1";
failedGroup.dispatchEvent(new desktop.Event("input", { bubbles: true }));
assert.equal(doc.getElementById("failed-count").textContent, "0 shown");

const mobile = openMock("?viewport=mobile-390&screen=history&history=attempts");
const mobileDoc = mobile.document;
assert.equal(mobileDoc.getElementById("prototype").dataset.mode, "mobile");
assert.deepEqual(visibleSections(mobile).map((node) => node.id), ["screen-history"]);
assert.equal(mobileDoc.getElementById("history-attempts").hidden, false);
assert.equal(mobileDoc.getElementById("mobile-history").getAttribute("aria-selected"), "true");
assert.equal(mobileDoc.getElementById("desktop-history").tabIndex, -1);
mobileDoc.getElementById("history-tab-attempts").dispatchEvent(new mobile.KeyboardEvent(
  "keydown", { key: "Home", bubbles: true }
));
assert.equal(mobileDoc.getElementById("history-hunts").hidden, false);
mobileDoc.getElementById("history-period").value = "today";
mobileDoc.getElementById("history-period").dispatchEvent(new mobile.Event("change", { bubbles: true }));
assert.equal(mobileDoc.getElementById("history-total").textContent, "1");

mobileDoc.getElementById("mobile-misc").click();
mobileDoc.getElementById("gallery-search").value = "mew";
mobileDoc.getElementById("gallery-rarity").value = "mythical";
mobileDoc.getElementById("gallery-search").dispatchEvent(new mobile.Event("input", { bubbles: true }));
assert.equal(mobileDoc.getElementById("gallery-count").textContent, "1 shown");
mobileDoc.getElementById("gallery-rarity").value = "legendary";
mobileDoc.getElementById("gallery-rarity").dispatchEvent(new mobile.Event("change", { bubbles: true }));
assert.equal(mobileDoc.getElementById("gallery-count").textContent, "0 shown");
assert.equal(mobileDoc.getElementById("gallery-empty").hidden, false);

mobileDoc.querySelector('[data-viewport="mobile-320"].viewport-option').click();
assert.equal(mobileDoc.getElementById("prototype").dataset.viewport, "mobile-320");
assert.equal(mobileDoc.getElementById("dimension-label").textContent, "320 × 568");

desktop.close();
mobile.close();
console.log("PASS: offline sources, sample semantic contrast >= 4.5:1, 4 views/viewport states, ARIA/keyboard navigation, Current/History/Gallery filters, HUD layout/presets.");
console.log("PASS: domain fixture invariants (7 rarity buckets, Seen = Captured + Failed, KPI totals, Rare+ Failed badge, Default HUD Rarity Tracker, Captured/Seen rates with 0.005pp tolerance, Pokémon target).");
console.log("PASS: four authoritative HUD preset snapshots × layouts 2/1/0, wide Default Rarity Tracker spans slots 3+4, One Column only row-starts 1/3, PX Only no widgets, Mobile mock Hunt actions >=44px.");
console.log("PASS: M1.1 continuous dense tables (no Pokémon cards), shared two-band Captured header + 6 IVs + Total, compact filters/sort disclosures at 320/390/415, all fields and keyboard sorting preserved; screenshot row counts require Edge geometry QA.");
