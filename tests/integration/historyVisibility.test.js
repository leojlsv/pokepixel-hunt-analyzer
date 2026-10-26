import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { createUi } from "../../userscript/ui.js";
import { UI_STATE_V2_KEY } from "../../userscript/ui-state.js";

function setup(t, shared = { view: "history", open: false, modeOverride: "mobile" }) {
  const browser = new Window({ url: "https://pokepixel.nietore.com/play/" });
  browser.localStorage.setItem(UI_STATE_V2_KEY, JSON.stringify({ shared, desktop: {}, mobile: {} }));
  const globals = ["window", "document", "localStorage", "Element", "HTMLElement", "HTMLInputElement", "Node", "getComputedStyle", "requestAnimationFrame"];
  const descriptors = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of globals) {
    const value = key === "getComputedStyle" || key === "requestAnimationFrame"
      ? browser[key].bind(browser)
      : browser[key];
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(() => {
    browser.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const reads = { sessions: 0, encounters: 0 };
  const ui = createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: async () => { reads.sessions += 1; return []; },
    onLoadHistorySessionEncounters: async () => { reads.encounters += 1; return []; },
    getLootItemCatalog: () => new Map()
  });
  return { browser, root: browser.document.getElementById("pokepixel-hunt-analyzer-root"), reads, ui };
}

test("restored History stays unloaded while its panel is closed and hydrates on first open", async t => {
  const { root, reads } = setup(t);
  const panel = root.shadowRoot.getElementById("pha-panel");
  assert.equal(panel.hidden, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(reads.sessions, 0, "an invisible restored History must not initiate database reads");

  root.shadowRoot.getElementById("pha-toggle").click();
  assert.equal(panel.hidden, false);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(reads.sessions, 1, "opening History starts its first load");

  root.shadowRoot.getElementById("pha-close").click();
  root.shadowRoot.getElementById("pha-toggle").click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(reads.sessions, 1, "reopening a fresh History reuses the loaded page");
});

test("restored Current stays closed and does not hydrate History", async t => {
  const { reads, root } = setup(t, { view: "current", open: false, modeOverride: "mobile" });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(reads.sessions, 0);
  assert.equal(root.shadowRoot.getElementById("pha-panel").hidden, true);
});

test("navigating to Current from closed History does not fetch a hidden History page", async t => {
  const { ui, root, reads } = setup(t);
  assert.equal(root.shadowRoot.getElementById("pha-panel").hidden, true);
  assert.deepEqual(await ui.navigate("current"), { ok: true });
  assert.equal(root.shadowRoot.getElementById("pha-panel").hidden, false);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(reads.sessions, 0);
});

test("retention invalidation reloads visible History without reading it while hidden", async t => {
  const { ui, root, reads } = setup(t, {
    view: "history", open: true, modeOverride: "mobile"
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(reads.sessions, 1);

  ui.resetHistoryAfterClear();
  await ui.refreshHistoryIfVisible();
  assert.equal(reads.sessions, 2, "visible History must not remain falsely empty after pruning");

  root.shadowRoot.getElementById("pha-close").click();
  ui.resetHistoryAfterClear();
  await ui.refreshHistoryIfVisible();
  assert.equal(reads.sessions, 2, "retention cannot reintroduce hidden History reads");

  root.shadowRoot.getElementById("pha-toggle").click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(reads.sessions, 3, "opening the panel hydrates the invalidated cache");
});
