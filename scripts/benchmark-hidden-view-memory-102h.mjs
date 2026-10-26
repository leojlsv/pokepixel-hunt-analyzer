/**
 * TEST ONLY. Non-destructive Current-view reference-retention benchmark.
 *
 * Synthetic 102h Hunt, real Current/History UI modules, Happy DOM and Node.
 * Nothing opens/edits a user's IndexedDB or connects to PokePixel.
 * Observed process heap is diagnostic (not game/Chrome FPS or peak heap).
 *
 * node --expose-gc scripts/benchmark-hidden-view-memory-102h.mjs 24480 91800
 */
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createUi, HIDDEN_VIEW_CACHE_IDLE_MS } from "../userscript/ui.js";
import { computeSessionMetrics } from "../domain/sessionMetrics.js";
import { UI_STATE_V2_KEY } from "../userscript/ui-state.js";

const counts = process.argv.slice(2).length
  ? process.argv.slice(2).map(Number) : [24480, 91800];
assert.ok(counts.length <= 2 && counts.every(n => [24480, 91800].includes(n)),
  "Choose 24480 and/or 91800 synthetic Current encounter rows");

const now = 102 * 3600_000;
const toMs = value => Number(value.toFixed(3));
const toMiB = value => Number((value / 1024 / 1024).toFixed(2));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const session = {
  sessionId: "102h-synthetic-retention",
  status: "running", activityKind: "hunt", startedAtMs: 0,
  activeStartedAtMs: 0, accumulatedActiveMs: 0
};

function installGlobals(browser) {
  const names = ["window", "document", "localStorage", "Element",
    "HTMLElement", "HTMLInputElement", "Node", "getComputedStyle",
    "requestAnimationFrame"];
  const original = new Map();
  for (const name of names) {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    const value = ["getComputedStyle", "requestAnimationFrame"].includes(name)
      ? browser[name].bind(browser) : browser[name];
    Object.defineProperty(globalThis, name, {
      value, configurable: true, writable: true
    });
  }
  return () => {
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
}

async function measure(count) {
  const browser = new Window({url: "https://synthetic-hidden-view.invalid/"});
  const restore = installGlobals(browser);
  browser.localStorage.setItem(UI_STATE_V2_KEY, JSON.stringify({
    shared: {view: "current", open: true, modeOverride: "mobile"},
    desktop: {}, mobile: {}
  }));
  const row = i => ({
    sessionId: session.sessionId,
    encounterId: "synthetic-" + String(i).padStart(6, "0"),
    captureResult: i % 11 === 0 ? "success" : "failed",
    captureAtMs: Math.floor(now * i / count),
    updatedAtMs: Math.floor(now * i / count),
    speciesId: "pidgey", speciesName: "Pidgey",
    quality: "common", ivTotal: i % 187,
    gold: i % 7, lootAtMs: Math.floor(now * i / count),
    lootItems: i % 4 === 0 ? [{itemId: "shard", qty: 1}] : []
  });
  // Keep the complete source array alive throughout, as the current V3 main
  // runtime does. Any heap decrease therefore comes from view duplicates,
  // NOT from discarding the canonical main source or stored history.
  const sourceRows = Array.from({length: count}, (_, i) => row(i));
  const sourceState = {
    sessionId: session.sessionId, encounters: sourceRows,
    encounterSnapshotVersion: 1, lootDataRevision: 1,
    metrics: computeSessionMetrics({session, encounters: sourceRows, now}),
    currentSessionSpecies: sourceRows.at(-1)
  };
  const ui = createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: async () => [],
    onLoadHistorySessionEncounters: async () => [],
    getLootItemCatalog: () => new Map(),
    onRequestCurrentRefresh: () => ui.renderCurrent(sourceState)
  });
  const shadow = document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;
  let report;
  try {
    const startup = performance.now();
    ui.renderCurrent(sourceState);
    await pause(65);
    global.gc?.();
    const populated = ui.retentionSnapshot();
    const processHeapWarmMiB = toMiB(process.memoryUsage().heapUsed);
    assert.equal(populated.current.captured.cachedRows +
      populated.current.failed.cachedRows, count);
    assert.equal(populated.current.loot.contributionRows, count);
    assert.ok(populated.current.captured.renderedRows <= 100 &&
      populated.current.failed.renderedRows <= 100);

    shadow.getElementById("pha-close").click();
    const beforeSuspend = performance.now();
    ui.maybeReleaseHiddenViews(Date.now() + HIDDEN_VIEW_CACHE_IDLE_MS + 5000);
    const suspendMs = toMs(performance.now() - beforeSuspend);
    global.gc?.();
    const cold = ui.retentionSnapshot();
    const processHeapColdMiB = toMiB(process.memoryUsage().heapUsed);
    assert.equal(cold.currentSuspended, true);
    assert.equal(cold.pendingCurrentRows, 0);
    assert.equal(cold.current.captured.cachedRows + cold.current.failed.cachedRows, 0);
    assert.equal(cold.current.captured.sortedRows + cold.current.failed.sortedRows, 0);
    assert.equal(cold.current.loot.contributionRows, 0);
    assert.equal(sourceRows.length, count, "canonical source must remain unchanged");
    assert.equal(sourceRows.at(-1).encounterId,
      "synthetic-" + String(count - 1).padStart(6, "0"));

    // Reopen from the SAME source/version without creating another Hunt.
    const beforeReopen = performance.now();
    shadow.getElementById("pha-toggle").click();
    await pause(65);
    const reopenMs = toMs(performance.now() - beforeReopen);
    const reopened = ui.retentionSnapshot();
    assert.equal(reopened.current.captured.cachedRows +
      reopened.current.failed.cachedRows, count);
    assert.equal(reopened.current.loot.contributionRows, count);
    assert.ok(reopened.current.failed.renderedRows <= 100 &&
      reopened.current.captured.renderedRows <= 100);
    assert.equal(sourceRows.length, count);

    report = {
      status: "pass", experiment: "non-destructive-hidden-view-cold-release",
      engine: "node-happy-dom", synthetic: true, logicalHuntHours: 102,
      sourceRowsRetainedThroughout: count,
      viewReferenceEntriesBefore: populated.current.captured.cachedRows +
        populated.current.failed.cachedRows +
        populated.current.captured.sortedRows +
        populated.current.failed.sortedRows +
        populated.current.loot.contributionRows,
      viewReferenceEntriesCold: cold.current.captured.cachedRows +
        cold.current.failed.cachedRows +
        cold.current.captured.sortedRows +
        cold.current.failed.sortedRows +
        cold.current.loot.contributionRows,
      initialViewWallMs: toMs(beforeSuspend - startup),
      coldSuspendMs: suspendMs, reopenWallMs: reopenMs,
      processHeapWarmMiB, processHeapColdMiB,
      visibleDomBefore: populated.current.captured.renderedRows +
        populated.current.failed.renderedRows,
      visibleDomAfterWake: reopened.current.captured.renderedRows +
        reopened.current.failed.renderedRows,
      noPersistenceOrNetwork: true,
      caveat: "Real UI logic but synthetic Happy DOM: Node heap includes the canonical source and unrelated objects; GC timing is indicative, not a Chrome/game FPS or memory SLO. No IndexedDB writes/reads or player state; only in-memory view maps were released. Current main source remains O(N), and reopen must rehydrate."
    };
  } finally {
    browser.happyDOM.abort();
    restore();
  }
  return report;
}

const results = [];
for (const count of counts) results.push(await measure(count));
process.stdout.write(JSON.stringify(results, null, 2) + "\n");
