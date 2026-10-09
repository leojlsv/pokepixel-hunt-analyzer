import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

function installBrowserGlobals(window) {
  class TestObserver { observe() {} disconnect() {} }
  for (const name of [
    "window", "document", "navigator", "localStorage", "Element", "HTMLElement",
    "HTMLInputElement", "HTMLSelectElement", "Node", "Event", "CustomEvent",
    "MutationObserver", "ResizeObserver", "getComputedStyle", "requestAnimationFrame",
    "cancelAnimationFrame"
  ]) {
    const value = name === "MutationObserver" || name === "ResizeObserver"
      ? TestObserver
      : name === "getComputedStyle" ? window.getComputedStyle.bind(window)
        : name === "requestAnimationFrame" ? window.requestAnimationFrame.bind(window)
          : name === "cancelAnimationFrame" ? window.cancelAnimationFrame.bind(window)
            : window[name];
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
}

function nextTask() {
  return new Promise(resolve => setImmediate(resolve));
}

test("semantic navigation opens the Analyzer, selects detail views, and restores the Cards invoker", async () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  installBrowserGlobals(window);
  window.matchMedia = () => ({ matches: false });
  window.localStorage.setItem("pokepixel_hunt_analyzer_ui_v2", JSON.stringify({
    shared: { view: "current", open: false, modeOverride: "desktop" },
    desktop: { panel: null, launcher: null }, mobile: { launcher: null }
  }));

  const { createUi } = await import("../../userscript/ui.js");
  const ui = createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: async () => [],
    onLoadHistorySessionEncounters: async () => []
  });
  const shadow = document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;
  const invoker = document.createElement("button");
  invoker.textContent = "Analyzer";
  document.body.appendChild(invoker);

  try {
    invoker.focus();
    assert.equal(document.activeElement, invoker);
    assert.deepEqual(await ui.navigate("current-captured"), { ok: true });
    assert.equal(shadow.getElementById("pha-panel").hidden, false);
    assert.equal(ui.getActiveView(), "current");
    assert.equal(shadow.activeElement, shadow.querySelector("#captured-section .section-head h3"));

    assert.deepEqual(await ui.navigate("history-attempts"), { ok: true });
    await nextTask();
    assert.equal(ui.getActiveView(), "history");
    assert.equal(ui.getHistoryView(), "attempts");
    assert.equal(shadow.querySelector('[data-history-view="attempts"]').getAttribute("aria-selected"), "true");
    assert.equal(shadow.activeElement, shadow.querySelector('[data-history-view="attempts"]'));

    shadow.getElementById("pha-close").click();
    assert.equal(shadow.getElementById("pha-panel").hidden, true);
    assert.equal(document.activeElement, invoker);
  } finally {
    window.happyDOM.abort();
  }
});

test("Current rendering is deferred while hidden or in History, then hydrated on reveal", async () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  installBrowserGlobals(window);
  window.matchMedia = () => ({ matches: false });
  window.localStorage.setItem("pokepixel_hunt_analyzer_ui_v2", JSON.stringify({
    shared: { view: "current", open: false, modeOverride: "desktop" },
    desktop: { panel: null, launcher: null }, mobile: { launcher: null }
  }));
  const { createUi } = await import("../../userscript/ui.js");
  const ui = createUi({ onSessionAction:()=>{}, onLoadHistorySessions:async()=>[], onLoadHistorySessionEncounters:async()=>[] });
  const shadow = document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;
  const heading = shadow.querySelector(".status-row > span");
  const rarities = Object.fromEntries(["weak","common","uncommon","rare","epic","legendary","mythical"].map(key=>[key,{seen:0,captured:0,failed:0,shinySeen:0,shinyCaptured:0,shinyFailed:0}]));
  const state = activityKind => ({ sessionId:"session", encounterSnapshotVersion:1, metrics:{status:"running", activityKind, rarities, gold:0,expenses:0}, encounters:[] });
  try {
    const before = heading.textContent;
    ui.renderCurrent(state("expedition"));
    assert.equal(heading.textContent, before, "hidden Current must retain its previous DOM");
    assert.equal(ui.needsCurrentTicker(), false);
    await ui.navigate("current-captured");
    assert.equal(heading.textContent, "EXPEDITION", "opening Current flushes the cached snapshot");
    assert.equal(ui.needsCurrentTicker(), true);
    await ui.navigate("history-attempts");
    ui.renderCurrent({ ...state("hunt"), encounterSnapshotVersion:2 });
    assert.equal(heading.textContent, "EXPEDITION", "History leaves Current DOM alone");
    await ui.navigate("current-captured");
    assert.equal(heading.textContent, "Hunt", "returning to Current refreshes immediately");
  } finally { window.happyDOM.abort(); }
});

test("History subtabs expose roving tab semantics for keyboard navigation", async () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  installBrowserGlobals(window);
  window.matchMedia = () => ({ matches: false });
  const { createUi } = await import("../../userscript/ui.js");
  const ui = createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: async () => [],
    onLoadHistorySessionEncounters: async () => []
  });
  const shadow = document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;

  try {
    await ui.navigate("history-hunts");
    const hunts = shadow.querySelector('[data-history-view="hunts"]');
    hunts.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    assert.equal(ui.getHistoryView(), "pokemon");
    const pokemon = shadow.querySelector('[data-history-view="pokemon"]');
    assert.equal(pokemon.getAttribute("aria-selected"), "true");
    assert.equal(pokemon.tabIndex, 0);
    assert.equal(hunts.tabIndex, -1);
    assert.equal(shadow.activeElement, pokemon);
  } finally {
    window.happyDOM.abort();
  }
});

test("semantic Current navigation expands every persisted collapsed destination", async () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  installBrowserGlobals(window);
  window.matchMedia = () => ({ matches: false });
  window.localStorage.setItem("pokepixel_hunt_analyzer_collapsed_v1", JSON.stringify({
    hunt: true,
    rarity: true,
    captured: true,
    failed: true,
    loot: true
  }));

  const { createUi } = await import("../../userscript/ui.js");
  const ui = createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: async () => [],
    onLoadHistorySessionEncounters: async () => []
  });
  const shadow = document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;

  try {
    const routes = [
      ["current", "hunt", "hunt-section", "hunt-collapsed", "#hunt-section"],
      ["current-rarity", "rarity", "rarity-section", "collapsed", "#rarity-section .section-head h3"],
      ["current-captured", "captured", "captured-section", "collapsed", "#captured-section .section-head h3"],
      ["current-failed", "failed", "failed-section", "collapsed", "#failed-section .section-head h3"],
      ["current-loot", "loot", "loot-section", "collapsed", "#loot-section .section-head h3"]
    ];
    for (const [destination, key, sectionId, collapsedClass, focusSelector] of routes) {
      const section = shadow.getElementById(sectionId);
      const collapse = shadow.querySelector(`[data-collapse="${key}"]`);
      assert.equal(section.classList.contains(collapsedClass), true, `${key} starts collapsed`);
      assert.equal(collapse.getAttribute("aria-expanded"), "false");
      assert.deepEqual(await ui.navigate(destination), { ok: true });
      assert.equal(section.classList.contains(collapsedClass), false, `${key} expands for semantic navigation`);
      assert.equal(collapse.getAttribute("aria-expanded"), "true");
      assert.equal(JSON.parse(window.localStorage.getItem("pokepixel_hunt_analyzer_collapsed_v1"))[key], false);
      assert.equal(shadow.activeElement, shadow.querySelector(focusSelector));
    }
  } finally {
    window.happyDOM.abort();
  }
});

test("closing during pending History navigation preserves returned external focus", async () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  installBrowserGlobals(window);
  window.matchMedia = () => ({ matches: false });
  let resolveHistory;
  const history = new Promise(resolve => { resolveHistory = resolve; });
  const { createUi } = await import("../../userscript/ui.js");
  const ui = createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: () => history,
    onLoadHistorySessionEncounters: async () => []
  });
  const shadow = document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;
  const invoker = document.createElement("button");
  document.body.appendChild(invoker);

  try {
    invoker.focus();
    const pending = ui.navigate("history-attempts");
    await nextTask();
    shadow.getElementById("pha-close").click();
    assert.equal(document.activeElement, invoker);
    resolveHistory([]);
    assert.deepEqual(await pending, { ok: false, reason: "navigation-superseded" });
    assert.equal(shadow.getElementById("pha-panel").hidden, true);
    assert.equal(document.activeElement, invoker, "late History completion cannot focus a hidden Analyzer tab");
  } finally {
    window.happyDOM.abort();
  }
});

test("a newer semantic navigation supersedes a pending History focus", async () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  installBrowserGlobals(window);
  window.matchMedia = () => ({ matches: false });
  let resolveHistory;
  const history = new Promise(resolve => { resolveHistory = resolve; });
  const { createUi } = await import("../../userscript/ui.js");
  const ui = createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: () => history,
    onLoadHistorySessionEncounters: async () => []
  });
  const shadow = document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;

  try {
    const pending = ui.navigate("history-loot");
    await nextTask();
    assert.deepEqual(await ui.navigate("current-captured"), { ok: true });
    const currentTarget = shadow.querySelector("#captured-section .section-head h3");
    assert.equal(shadow.activeElement, currentTarget);
    resolveHistory([]);
    assert.deepEqual(await pending, { ok: false, reason: "navigation-superseded" });
    assert.equal(ui.getActiveView(), "current");
    assert.equal(shadow.activeElement, currentTarget, "older History completion cannot steal focus from the newer route");
  } finally {
    window.happyDOM.abort();
  }
});
