import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { indexedDB } from "fake-indexeddb";
import { PALETTES, PALETTE_STORAGE_KEY } from "../../userscript/palette-theme.js";

function installBrowserGlobals(window) {
  class TestObserver { observe() {} disconnect() {} }
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: indexedDB });
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

async function mountPaletteUi(mode, stored) {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  installBrowserGlobals(window);
  window.matchMedia = () => ({ matches: mode === "mobile" });
  window.localStorage.setItem("pokepixel_hunt_analyzer_ui_v2", JSON.stringify({
    shared: { view: "current", open: true, modeOverride: mode },
    desktop: { panel: null, launcher: null }, mobile: { launcher: null }
  }));
  if (stored !== undefined) window.localStorage.setItem(PALETTE_STORAGE_KEY, stored);

  const [{ createUi }, { createClosedHud }, { createAudioAlerts }] = await Promise.all([
    import("../../userscript/ui.js"),
    import("../../userscript/closed-hud-runtime.js"),
    import("../../userscript/audio-alerts-runtime.js")
  ]);
  const makeUi = () => createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: async () => [],
    onLoadHistorySessionEncounters: async () => []
  });
  makeUi();
  const hud = createClosedHud({ pageWindow: {} });
  hud.mount();
  const alerts = createAudioAlerts();
  alerts.mountControls();
  hud.mount();
  return { window, hud, makeUi, getShadow: () => window.document.getElementById("pokepixel-hunt-analyzer-root")?.shadowRoot };
}

for (const mode of ["desktop", "mobile"]) {
  test(`${mode} shows the exact approved choices and changes the theme without reloading`, async () => {
    const { window, hud, makeUi, getShadow } = await mountPaletteUi(mode);
    try {
      const shadow = getShadow();
      assert.equal(shadow.host.dataset.phaPalette, "obsidian");
      assert.ok(shadow.querySelector("style").textContent.includes(':host([data-pha-palette="obsidian"])'));
      const select = shadow.getElementById("pha-palette-select");
      assert.ok(select, "Misc > Interface palette selector exists");
      assert.equal(select.closest("#pha-interface-settings") !== null, true);
      assert.equal(select.getAttribute("aria-label"), "Paleta de cores do Analyzer");
      assert.deepEqual([...select.options].map(({ value }) => value), Object.keys(PALETTES));
      assert.equal(select.value, "obsidian");
      select.value = "copper";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
      assert.equal(shadow.host.dataset.phaPalette, "copper");
      assert.equal(window.localStorage.getItem(PALETTE_STORAGE_KEY), "copper");
      assert.equal(select.value, "copper");
      assert.equal(getShadow(), shadow, "palette selection does not remount the interface");
      makeUi();
      assert.equal(getShadow().host.dataset.phaPalette, "copper", "new UI mount restores the stored choice");
    } finally {
      hud.dispose();
      window.happyDOM.abort();
    }
  });
}

test("retired or invalid saved themes initialize with Obsidiana", async () => {
  const { window, hud, getShadow } = await mountPaletteUi("desktop", "green");
  try {
    const shadow = getShadow();
    assert.equal(shadow.host.dataset.phaPalette, "obsidian");
    assert.equal(shadow.getElementById("pha-palette-select").value, "obsidian");
    assert.equal(window.localStorage.getItem(PALETTE_STORAGE_KEY), "obsidian", "discarded saved theme migrates to the default");
  } finally {
    hud.dispose();
    window.happyDOM.abort();
  }
});

test("a previously saved approved theme initializes both the host and the Misc selector", async () => {
  const { window, hud, getShadow } = await mountPaletteUi("desktop", "amethyst");
  try {
    const shadow = getShadow();
    assert.equal(shadow.host.dataset.phaPalette, "amethyst");
    assert.equal(shadow.getElementById("pha-palette-select").value, "amethyst");
  } finally {
    hud.dispose();
    window.happyDOM.abort();
  }
});
