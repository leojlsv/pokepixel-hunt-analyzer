import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { createUi, HIDDEN_VIEW_CACHE_IDLE_MS } from
  "../../userscript/ui.js";
import { computeSessionMetrics } from "../../domain/sessionMetrics.js";
import { compactClosedHudState } from "../../userscript/closed-hud.js";
import { UI_STATE_V2_KEY } from "../../userscript/ui-state.js";

const SESSION_ID = "non-destructive-long-hunt";
const session = () => ({
  sessionId: SESSION_ID, status: "running", activityKind: "hunt",
  startedAtMs: 0, activeStartedAtMs: 0,
  accumulatedActiveMs: 0, potionsUsed: 0, potionsCost: 0
});
const encounter = index => ({
  sessionId: SESSION_ID, encounterId: "e-" + String(index).padStart(6, "0"),
  captureResult: index % 11 === 0 ? "success" : "failed",
  captureAtMs: index + 1000, updatedAtMs: index + 1000,
  speciesId: "pidgey", speciesName: "Pidgey", quality: "common",
  qualityMultiplier: 1, ivTotal: index % 187,
  ivs: {hp: 10, atk: 20, spa: 10, def: 20, spd: 20, spe: 20},
  gold: 1, lootAtMs: index + 999,
  lootItems: index % 5 ? [] : [{itemId: "shard", qty: 1}]
});

function state(rows, version = 1) {
  return {
    sessionId: SESSION_ID, encounters: rows,
    encounterSnapshotVersion: version, lootDataRevision: version,
    metrics: computeSessionMetrics({session: session(), encounters: rows, now: 1_000_000}),
    currentSessionSpecies: rows.at(-1) || null
  };
}

function createFixture(t, {
  view = "current", open = true, loadSessions = async () => [],
  loadEncounters = async () => [], onResume = () => {}
} = {}) {
  const browser = new Window({url: "https://memory-fixture.invalid/"});
  const original = new Map();
  const names = ["window", "document", "localStorage", "Element",
    "HTMLElement", "HTMLInputElement", "Node", "getComputedStyle",
    "requestAnimationFrame"];
  for (const name of names) {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    const value = ["getComputedStyle", "requestAnimationFrame"].includes(name)
      ? browser[name].bind(browser) : browser[name];
    Object.defineProperty(globalThis, name, {
      configurable: true, writable: true, value
    });
  }
  browser.localStorage.setItem(UI_STATE_V2_KEY, JSON.stringify({
    shared: {view, open, modeOverride: "mobile"},
    desktop: {}, mobile: {}
  }));
  t.after(() => {
    browser.close();
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const ui = createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: loadSessions,
    onLoadHistorySessionEncounters: loadEncounters,
    getLootItemCatalog: () => new Map([["shard", {name: "Shard", rarity: "rare"}]]),
    onRequestCurrentRefresh: onResume
  });
  const shadow = browser.document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;
  return {ui, browser, shadow};
}

const idleTime = () => Date.now() + HIDDEN_VIEW_CACHE_IDLE_MS + 10_000;
const frame = () => new Promise(resolve => setTimeout(resolve, 45));
async function waitFor(predicate, {maxWaitMs = 5000} = {}) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > maxWaitMs) {
      throw new Error("Timed out waiting for disposable Current/History UI state");
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

test("120s hidden Current evicts 5k duplicated list/Loot references, then same-version resume rehydrates only 100 DOM rows", async t => {
  let resumes = 0;
  const rows = Array.from({length: 5000}, (_, i) => encounter(i));
  let snapshot = state(rows, 7);
  let ui;
  const fixture = createFixture(t, {
    onResume: () => { resumes++; ui.renderCurrent(snapshot); }
  });
  ui = fixture.ui;
  const {shadow} = fixture;
  ui.renderCurrent(snapshot);
  await waitFor(() => ui.retentionSnapshot().current.failed.renderedRows > 0);
  const before = ui.retentionSnapshot();
  assert.equal(before.current.captured.cachedRows + before.current.failed.cachedRows, 5000);
  assert.equal(before.current.loot.contributionRows, 5000);
  assert.ok(before.current.failed.renderedRows > 0 && before.current.failed.renderedRows <= 100);

  // Rarity preferences and UI controls survive; the large per-row Maps do not.
  shadow.getElementById("captured-shiny").value = "no";
  shadow.getElementById("captured-shiny").dispatchEvent(new fixture.browser.Event("change"));
  shadow.getElementById("pha-close").click();
  ui.maybeReleaseHiddenViews(Date.now() + HIDDEN_VIEW_CACHE_IDLE_MS - 5_000);
  assert.equal(ui.retentionSnapshot().currentSuspended, false,
    "short panel switches must not force a reload");
  ui.maybeReleaseHiddenViews(idleTime());
  const cold = ui.retentionSnapshot();
  assert.equal(cold.currentSuspended, true);
  assert.equal(cold.pendingCurrentRows, 0);
  assert.equal(cold.current.captured.cachedRows + cold.current.failed.cachedRows, 0);
  assert.equal(cold.current.captured.sortedRows + cold.current.failed.sortedRows, 0);
  assert.equal(cold.current.loot.contributionRows, 0);
  assert.equal(cold.current.captured.renderedRows + cold.current.failed.renderedRows, 0);
  assert.equal(shadow.getElementById("failed-body").childElementCount, 0);
  assert.equal(shadow.getElementById("captured-shiny").value, "no");

  // A hidden public/event state update must not bring the 5k-source array
  // back into UI retention while still suspended.
  const corrected = [...rows.slice(0, -1), {...rows.at(-1), gold: 999}];
  snapshot = state(corrected, 8);
  ui.renderCurrent(snapshot);
  assert.equal(ui.retentionSnapshot().pendingCurrentRows, 0);
  assert.equal(ui.retentionSnapshot().current.failed.cachedRows, 0);

  shadow.getElementById("pha-toggle").click();
  await waitFor(() => resumes === 1 &&
    ui.retentionSnapshot().current.failed.renderedRows > 0);
  const warm = ui.retentionSnapshot();
  assert.equal(resumes, 1, "wake requests a new source reconciliation");
  assert.equal(warm.currentSuspended, false);
  assert.equal(warm.current.captured.cachedRows + warm.current.failed.cachedRows, 5000);
  assert.ok(warm.current.failed.renderedRows > 0 && warm.current.failed.renderedRows <= 100,
    "waking must not replay 5,000 events one by one and append all DOM rows");
  assert.equal(warm.current.loot.contributionRows, 5000);
  assert.equal(shadow.getElementById("dollars-total").textContent, "5.998",
    "wake must publish the latest corrected source, not an old hidden frame");
  assert.equal(shadow.getElementById("captured-shiny").value, "no");
  assert.equal(rows.length, 5000, "source encounters were never deleted or truncated");
});

test("hidden History releases full loaded page bundles; reopening reloads without clearing filters or source", async t => {
  const now = Date.now();
  const old = {sessionId: "history-older", status: "ended",
    startedAtMs: now - 1000, endedAtMs: now, accumulatedActiveMs: 25000};
  const persisted = Array.from({length: 31}, (_, i) =>
    ({...encounter(i), sessionId: old.sessionId}));
  let sessionReads = 0, encounterReads = 0;
  const {ui, shadow, browser} = createFixture(t, {
    view: "history", open: true,
    loadSessions: async () => {sessionReads++; return [old];},
    loadEncounters: async sid => {
      encounterReads++;
      assert.equal(sid, old.sessionId);
      return persisted;
    }
  });
  await waitFor(() => ui.retentionSnapshot().history.cachedEncounterRows === 31);
  assert.equal(ui.retentionSnapshot().history.cachedEncounterRows, 31);
  assert.equal(sessionReads, 1);
  shadow.getElementById("history-result").value = "failed";
  shadow.getElementById("history-result").dispatchEvent(new browser.Event("change"));
  shadow.getElementById("pha-close").click();
  ui.maybeReleaseHiddenViews(idleTime());
  const cold = ui.retentionSnapshot();
  assert.equal(cold.history.cachedSessions, 0);
  assert.equal(cold.history.cachedEncounterRows, 0);
  assert.equal(cold.historySuspended, true);
  assert.equal(sessionReads, 1, "suspending must not perform an IDB history read");
  shadow.getElementById("pha-toggle").click();
  await waitFor(() => sessionReads === 2 &&
    ui.retentionSnapshot().history.cachedEncounterRows === 31);
  assert.equal(sessionReads, 2);
  assert.equal(encounterReads, 2);
  assert.equal(ui.retentionSnapshot().history.cachedEncounterRows, 31);
  assert.equal(shadow.getElementById("history-result").value, "failed",
    "cold History release must preserve the active filter");
  assert.equal(persisted.length, 31);
});

test("precomputed HUD compaction drops the full Current row array but legacy fallback stays available", () => {
  const rows = Array.from({length: 10000}, (_, i) => encounter(i));
  const metrics = state(rows).metrics;
  const derived = {highestIv: 186, totalBallsUsed: 300, ballStats: []};
  const source = {sessionId: SESSION_ID, encounters: rows, metrics, hudEncounterDerived: derived};
  const lean = compactClosedHudState(source);
  assert.notEqual(lean, source);
  assert.equal(source.encounters.length, 10000);
  assert.deepEqual(lean.encounters, []);
  assert.equal(lean.metrics, metrics);
  assert.equal(lean.hudEncounterDerived, derived);
  const fallback = {sessionId: SESSION_ID, encounters: rows, metrics};
  assert.equal(compactClosedHudState(fallback), fallback);
});

test("cold Current wake defers an older in-flight render until the requested full source refresh settles", async t => {
  const rows = Array.from({length: 120}, (_, i) => encounter(i));
  const oldState = state(rows, 5);
  const freshState = state([...rows, encounter(120)], 6);
  let wakeStarted = 0;
  let finishWake = null;
  const {ui, shadow} = createFixture(t, {
    onResume: () => {
      wakeStarted++;
      return new Promise(resolve => { finishWake = resolve; });
    }
  });
  ui.renderCurrent(oldState);
  await frame();
  assert.equal(shadow.getElementById("failed-count").textContent, "109 Pokémons");
  shadow.getElementById("pha-close").click();
  ui.maybeReleaseHiddenViews(idleTime());
  assert.equal(ui.retentionSnapshot().currentSuspended, true);
  shadow.getElementById("pha-toggle").click();
  await Promise.resolve();
  assert.equal(wakeStarted, 1);
  assert.equal(shadow.getElementById("failed-body").childElementCount, 0);
  ui.renderCurrent(oldState);
  ui.renderCurrent(freshState);
  assert.equal(shadow.getElementById("failed-body").childElementCount, 0,
    "an obsolete load must not display stale rows during the cold wake fence");
  finishWake();
  await frame();
  assert.equal(shadow.getElementById("failed-count").textContent, "110 Pokémons");
  assert.equal(ui.retentionSnapshot().current.failed.cachedRows, 110);
});

test("History's pre-suspension async page cannot repopulate a later empty view", async t => {
  let finishOldPage;
  let requests = 0;
  const oldSession = {sessionId: "old-page", status: "ended",
    startedAtMs: Date.now() - 1000, endedAtMs: Date.now()};
  const {ui, shadow} = createFixture(t, {
    view: "history", open: true,
    loadSessions: () => {
      requests++;
      if (requests === 1) return new Promise(resolve => { finishOldPage = resolve; });
      return Promise.resolve([]);
    }
  });
  await Promise.resolve();
  assert.equal(requests, 1);
  shadow.getElementById("pha-close").click();
  ui.maybeReleaseHiddenViews(idleTime());
  assert.equal(ui.retentionSnapshot().history.cachedSessions, 0);
  assert.equal(ui.retentionSnapshot().historySuspended, true);
  finishOldPage([oldSession]);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(ui.retentionSnapshot().history.cachedSessions, 0,
    "old History generation must not publish stale rows after suspension");
  shadow.getElementById("pha-toggle").click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(requests, 2);
  assert.equal(ui.retentionSnapshot().history.cachedSessions, 0);
});

test("Misc-owner hiding Current can trigger memory release even without switchView", async t => {
  const rows = Array.from({length: 100}, (_, i) => encounter(i));
  let wakes = 0;
  const {ui, shadow} = createFixture(t, {onResume: () => {wakes++;}});
  ui.renderCurrent(state(rows, 4));
  await frame();
  shadow.getElementById("view-current").hidden = true;
  ui.maybeReleaseHiddenViews(idleTime());
  assert.equal(ui.retentionSnapshot().currentSuspended, true);
  assert.equal(ui.needsCurrentTicker(), false,
    "Current refresh must stop when another UI owner hides the view");
  shadow.getElementById("view-current").hidden = false;
  ui.maybeReleaseHiddenViews(Date.now());
  await Promise.resolve();
  assert.equal(wakes, 1);
});

test("Misc's synchronous History parking never starts hidden 20-session hydration", async t => {
  let historyReads = 0;
  const {ui, shadow} = createFixture(t, {
    view: "current", open: true,
    loadSessions: async () => { historyReads++; return []; }
  });
  // The real Misc handler first parks Current by clicking History, then
  // hides History in the SAME JavaScript task before its own view appears.
  shadow.querySelector('[data-view="history"]').click();
  shadow.getElementById("view-history").hidden = true;
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(historyReads, 0,
    "opening Misc must not fetch 20 full History Hunts offscreen");
  assert.equal(ui.needsCurrentTicker(), false);

  // A genuine History navigation must still hydrate.
  shadow.getElementById("view-history").hidden = false;
  await ui.navigate("history-hunts");
  assert.equal(historyReads, 1);
});

test("superseded cold-wake Promise cannot flush a newer wake before its own full reconciliation", async t => {
  const baseRows = Array.from({length: 120}, (_, i) => encounter(i));
  const pending = [];
  const {ui, shadow} = createFixture(t, {
    onResume: () => new Promise(resolve => { pending.push(resolve); })
  });
  ui.renderCurrent(state(baseRows, 1));
  await frame();
  shadow.getElementById("pha-close").click();
  ui.maybeReleaseHiddenViews(idleTime());
  shadow.getElementById("pha-toggle").click();
  await Promise.resolve();
  assert.equal(pending.length, 1);

  // A second hidden cold cycle invalidates the first wake generation.
  shadow.getElementById("pha-close").click();
  ui.maybeReleaseHiddenViews(idleTime());
  shadow.getElementById("pha-toggle").click();
  await Promise.resolve();
  assert.equal(pending.length, 2);
  const latest = state([...baseRows, encounter(120)], 2);
  ui.renderCurrent(latest);
  pending[0]();
  await Promise.resolve();
  assert.equal(shadow.getElementById("failed-body").childElementCount, 0,
    "old resolved wake must not permit publication before current gate finishes");
  pending[1]();
  await frame();
  assert.equal(shadow.getElementById("failed-count").textContent, "110 Pokémons");
});

test("failed cold wake presents an unavailable retrying state instead of stale counts beside empty tables", async t => {
  const rows = Array.from({length: 120}, (_, i) => encounter(i));
  const {ui, shadow} = createFixture(t, {
    onResume: async () => { throw new Error("isolated disposable source unavailable"); }
  });
  ui.renderCurrent(state(rows, 7));
  await frame();
  assert.equal(shadow.getElementById("failed-count").textContent, "109 Pokémons");
  assert.notEqual(shadow.getElementById("dollars-total").textContent, "—");
  assert.notEqual(shadow.getElementById("current-loot-total").textContent, "—");
  shadow.getElementById("pha-close").click();
  ui.maybeReleaseHiddenViews(idleTime());
  const oldError = console.error;
  console.error = () => {};
  try {
    shadow.getElementById("pha-toggle").click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(shadow.querySelector(".status-row > span").textContent,
      /Current unavailable/);
    assert.equal(shadow.getElementById("failed-body").childElementCount, 0);
    assert.equal(shadow.getElementById("failed-count").textContent, "—");
    assert.equal(shadow.getElementById("seen").textContent, "—");
    assert.equal(shadow.getElementById("dollars-total").textContent, "—");
    assert.equal(shadow.getElementById("trainer-exp-total").textContent, "—");
    assert.equal(shadow.getElementById("hunt-time").textContent, "—");
    assert.equal(shadow.getElementById("current-loot-total").textContent, "—");
    assert.equal(shadow.getElementById("current-loot-coverage").textContent, "—");
    assert.equal(shadow.querySelector('#rarity-body [data-field="seen"]').textContent, "—");
    assert.equal(shadow.getElementById("pause-resume").disabled, true);
    assert.equal(shadow.getElementById("end-hunt").disabled, true);
    assert.equal(ui.retentionSnapshot().pendingCurrentRows, 0);
    // A regular later Current load still repaints the authoritative data.
    ui.renderCurrent(state(rows, 8));
    assert.equal(shadow.getElementById("failed-count").textContent, "109 Pokémons");
    assert.notEqual(shadow.getElementById("dollars-total").textContent, "—");
    assert.equal(shadow.getElementById("pause-resume").disabled, false);
  } finally {
    console.error = oldError;
  }
});
