import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { indexedDB } from "fake-indexeddb";
import { CATCH_CHANCE_DECIMALS_KEY } from "../../userscript/catch-chance-preferences.js";
import { RARITIES } from "../../userscript/ui-utils.js";

function installBrowserGlobals(browser) {
  class TestObserver { observe() {} disconnect() {} }
  for (const name of [
    "window", "document", "navigator", "localStorage", "Element", "HTMLElement",
    "HTMLInputElement", "HTMLSelectElement", "Node", "Event", "CustomEvent",
    "MutationObserver", "ResizeObserver", "getComputedStyle", "requestAnimationFrame",
    "cancelAnimationFrame"
  ]) {
    const value = name === "MutationObserver" || name === "ResizeObserver"
      ? TestObserver
      : name === "getComputedStyle" ? browser.getComputedStyle.bind(browser)
        : name === "requestAnimationFrame" ? (callback) => callback()
          : name === "cancelAnimationFrame" ? () => {}
            : browser[name];
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: indexedDB });
}

function sampleMetrics() {
  return {
    status: "running", activeMs: 60_000, startedAtMs: Date.now() - 60_000,
    seen: 2, captured: 1, failed: 1, seenToCaptureRate: 0.5,
    gold: 0, expenses: 0,
    rarities: Object.fromEntries(RARITIES.map(([key]) => [key, {
      seen: key === "legendary" || key === "rare" ? 1 : 0,
      captured: key === "legendary" ? 1 : 0,
      failed: key === "rare" ? 1 : 0,
      shinySeen: 0, shinyCaptured: 0, shinyFailed: 0
    }]))
  };
}

function sampleEncounters() {
  const captureAtMs = Date.now() - 1_000;
  return [
    { encounterId: "captured-1", speciesName: "Zapdos", quality: "legendary",
      captureResult: "success", captureChance: 0.00004, captureAtMs,
      ivTotal: 60, isShiny: false, qualityMultiplier: 1, capsuleName: "Ultra Ball" },
    { encounterId: "failed-1", speciesName: "Abra", quality: "rare",
      captureResult: "failed", captureChance: 0.00004, captureAtMs,
      ivTotal: 15, isShiny: false, capsuleName: "Poke Ball" }
  ];
}

async function mountAnalyzer(mode) {
  const browser = new Window({ url: "https://play.pokepixel.example/" });
  installBrowserGlobals(browser);
  browser.matchMedia = () => ({ matches: mode === "mobile" });
  browser.localStorage.setItem("pokepixel_hunt_analyzer_ui_v2", JSON.stringify({
    shared: { view: "current", open: true, modeOverride: mode },
    desktop: { panel: null, launcher: null }, mobile: { launcher: null }
  }));

  const [{ createUi }, { createClosedHud }, { createAudioAlerts }] = await Promise.all([
    import("../../userscript/ui.js"),
    import("../../userscript/closed-hud-runtime.js"),
    import("../../userscript/audio-alerts-runtime.js")
  ]);
  const encounters = sampleEncounters();
  const ui = createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: async () => [{
      sessionId: "hunt-1", startedAtMs: Date.now() - 60_000, status: "ended"
    }],
    onLoadHistorySessionEncounters: async () => encounters
  });
  const hud = createClosedHud({ pageWindow: {} });
  hud.mount();
  const alerts = createAudioAlerts();
  alerts.mountControls();
  hud.mount();
  const shadow = document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;
  ui.renderCurrent({
    metrics: sampleMetrics(), encounters, sessionId: "hunt-1", encounterSnapshotVersion: 1
  });
  return { browser, ui, hud, shadow };
}

for (const mode of ["desktop", "mobile"]) {
  test(`${mode} updates Catch Chance precision immediately, without touching Capture Rate or history data`, async () => {
    const { browser, ui, hud, shadow } = await mountAnalyzer(mode);
    try {
      const select = shadow.getElementById("pha-catch-chance-decimals");
      assert.ok(select, "Misc > Interface contains the precision selector");
      assert.deepEqual([...select.options].map((option) => option.value),
        ["0", "1", "2", "3", "4", "5", "6"]);
      assert.equal(select.value, "3");
      assert.equal(shadow.host.dataset.catchChanceExtended, "false");
      assert.equal(shadow.querySelector("#failed-body .chance-cell").textContent, "0.004%");
      const capturedRow = shadow.querySelector("#captured-body tr[data-encounter-id]");
      capturedRow.click();
      const detail = () => shadow.querySelector("[data-catch-chance-detail]");
      assert.equal(detail().textContent, "Chance: 0.004%");

      shadow.querySelector('[data-view="history"]').click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      shadow.querySelector('[data-history-view="attempts"]').click();
      const attemptChance = () => shadow.querySelector("#history-attempts-body tr").cells[4].textContent;
      assert.equal(attemptChance(), "0.004%");
      shadow.querySelector("#history-attempts-body tr").click();
      assert.match(shadow.querySelector("#history-attempts-body .history-detail-row").textContent, /Chance: 0\.004%/);

      for (const [digits, expected] of [["0", "<1%"], ["6", "0.004000%"], ["3", "0.004%"]]) {
        select.value = digits;
        select.dispatchEvent(new browser.Event("change", { bubbles: true }));
        assert.equal(browser.localStorage.getItem(CATCH_CHANCE_DECIMALS_KEY), digits);
        assert.equal(select.value, digits);
        assert.equal(shadow.host.dataset.catchChanceExtended, String(Number(digits) >= 4));
        assert.equal(shadow.querySelector("#failed-body .chance-cell").textContent, expected);
        assert.equal(detail().textContent, `Chance: ${expected}`);
        assert.equal(attemptChance(), expected);
        assert.match(shadow.querySelector("#history-attempts-body .history-detail-row").textContent,
          new RegExp(`Chance: ${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
        assert.equal(shadow.getElementById("capture-rate").textContent, "50.00%");
      }
    } finally {
      hud.dispose();
      browser.happyDOM.abort();
    }
  });
}
