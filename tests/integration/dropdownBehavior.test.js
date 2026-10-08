import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const UI_STATE_KEY = "pokepixel_hunt_analyzer_ui_v2";
import { computeSessionMetrics } from "../../domain/sessionMetrics.js";

function installBrowserGlobals(window) {
  class TestMutationObserver {
    observe() {}
    disconnect() {}
  }
  class TestResizeObserver {
    observe() {}
    disconnect() {}
  }

  for (const name of [
    "window",
    "document",
    "navigator",
    "localStorage",
    "MutationObserver",
    "ResizeObserver",
    "Element",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "Node",
    "Event",
    "CustomEvent",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame"
  ]) {
    const value = name === "MutationObserver"
      ? TestMutationObserver
      : name === "ResizeObserver"
        ? TestResizeObserver
      : name === "getComputedStyle"
      ? window.getComputedStyle.bind(window)
      : name === "requestAnimationFrame"
        ? window.requestAnimationFrame.bind(window)
        : name === "cancelAnimationFrame"
          ? window.cancelAnimationFrame.bind(window)
          : window[name];
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true
    });
  }
}

function nextTask() {
  return new Promise((resolve) => setImmediate(resolve));
}

function storeUiMode(window, modeOverride) {
  window.localStorage.setItem(UI_STATE_KEY, JSON.stringify({
    shared: { view: "current", open: true, modeOverride },
    desktop: { panel: null, launcher: null },
    mobile: { launcher: null }
  }));
}

function appendGallerySelect(shadow) {
  const select = document.createElement("select");
  select.className = "catch-gallery-rarity-filter";
  select.setAttribute("aria-label", "Filter Catch Gallery by rarity");
  for (const [value, label] of [["*", "All rarities"], ["rare", "Rare"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
  shadow.appendChild(select);
}

function openProxy(proxy) {
  proxy.open = true;
  proxy.dispatchEvent(new Event("toggle"));
  return [...proxy.querySelectorAll('[role="option"]')];
}

async function chooseDifferentOption(proxy) {
  const select = proxy.querySelector("select");
  const originalValue = select.value;
  const options = openProxy(proxy);
  const target = options.find((option) => {
    const nativeOption = [...select.options].find(
      (candidate) => candidate.textContent === option.textContent
    );
    return nativeOption && nativeOption.value !== originalValue;
  });

  assert.ok(target, `expected a second option for ${proxy.className}`);
  target.click();
  await nextTask();

  assert.notEqual(select.value, originalValue);
  assert.equal(proxy.open, false);
  assert.equal(proxy.querySelector("summary").textContent, select.selectedOptions[0].textContent);
  assert.equal(proxy.getRootNode().activeElement, proxy.querySelector("summary"));
}

async function mountAnalyzer(modeOverride, {
  loadHistorySessions = async () => [],
  loadHistorySessionEncounters = async () => []
} = {}) {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  installBrowserGlobals(window);
  storeUiMode(window, modeOverride);
  window.matchMedia = () => ({ matches: modeOverride === "mobile" });

  const [{ createUi }, { createClosedHud }] = await Promise.all([
    import("../../userscript/ui.js"),
    import("../../userscript/closed-hud-runtime.js")
  ]);
  const ui = createUi({
    onSessionAction: () => {},
    onLoadHistorySessions: loadHistorySessions,
    onLoadHistorySessionEncounters: loadHistorySessionEncounters
  });
  const shadow = document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;
  appendGallerySelect(shadow);

  const pageWindow = {
    PokeIdle: {
      Api: {
        getInventory: async () => ({
          items: [
            { item_id: "capsule_basic", name: "Basic Ball", type: "capsule", qty: 10 },
            { item_id: "capsule_super", name: "Super Ball", type: "capsule", qty: 5 }
          ]
        })
      },
      Auth: {
        isAuthenticated: () => true
      },
      Bus: {
        on: () => {},
        off: () => {}
      }
    }
  };
  const closedHud = createClosedHud({ pageWindow });
  closedHud.mount();
  await nextTask();

  return { window, ui, shadow, closedHud };
}

test("Mobile dropdown families open, expose options and update their native selects", async () => {
  const { window, shadow, closedHud } = await mountAnalyzer("mobile");

  try {
    const firstWidget = shadow.querySelector('[data-hud-widget="0"]');
    firstWidget.value = "ballTracker";
    firstWidget.dispatchEvent(new window.Event("change", { bubbles: true }));
    await nextTask();

    const uiModeProxy = shadow.querySelector(".pha-ui-mode-proxy");
    assert.ok(uiModeProxy);
    assert.equal(openProxy(uiModeProxy).length, 3);
    uiModeProxy.open = false;

    for (const selector of [
      ".pha-hud-width-proxy",
      ".pha-hud-item-proxy",
      ".pha-current-select-proxy",
      ".pha-history-select-proxy",
      ".pha-gallery-select-proxy",
      ".pha-hud-preset-proxy",
      ".pha-hud-widget-proxy",
      ".pha-hud-columns-proxy"
    ]) {
      const proxy = shadow.querySelector(selector);
      assert.ok(proxy, `missing ${selector}`);
      assert.equal(proxy.dataset.uiMode, "mobile");
      assert.equal(proxy.querySelector('[role="listbox"]') !== null, true);
      await chooseDifferentOption(proxy);
    }

    const historyProxies = [...shadow.querySelectorAll(".pha-history-select-proxy")];
    assert.ok(historyProxies.length > 1);
    const lootSessionProxy = shadow.getElementById("history-loot-session").closest(".pha-history-select-proxy");
    assert.ok(lootSessionProxy, "Loot session control must use the 44px History Mobile select proxy");
    assert.equal(lootSessionProxy.dataset.uiMode, "mobile");
    for (const id of ["history-loot-rarity", "current-loot-rarity"]) {
      const filter = shadow.getElementById(id);
      assert.equal(filter.tagName, "DETAILS", `${id} uses the Captured/Failed multi-checkbox control`);
      assert.equal(filter.querySelectorAll('input[type="checkbox"]').length, 9,
        "All, seven item rarities and No rarity can be selected together");
      assert.equal(filter.querySelectorAll("select").length, 0);
      filter.open = true;
      const rare = filter.querySelector('[data-rarity-value="rare"]');
      rare.checked = false;
      rare.dispatchEvent(new window.Event("change", { bubbles: true }));
      assert.equal(filter.open, true, "checking a second rarity keeps the menu open");
      assert.equal(filter.querySelector("[data-rarity-all]").checked, false);
      filter.open = false;
    }
    historyProxies[0].open = true;
    historyProxies[0].dispatchEvent(new window.Event("toggle"));
    historyProxies[1].open = true;
    historyProxies[1].dispatchEvent(new window.Event("toggle"));
    assert.equal(historyProxies[0].open, false);
    assert.equal(historyProxies[1].open, true);
  } finally {
    closedHud.dispose();
    window.happyDOM.abort();
  }
});

test("Desktop keeps UI Mode native and restores native selects outside proxy details", async () => {
  const { window, shadow, closedHud } = await mountAnalyzer("desktop");

  try {
    const uiMode = shadow.querySelector(".pha-ui-mode-select");
    assert.ok(uiMode);
    assert.equal(uiMode.closest("details"), null);
    assert.equal(shadow.querySelector(".pha-ui-mode-proxy"), null);

    for (const selector of [
      ".pha-hud-columns-proxy",
      ".pha-hud-widget-proxy",
      ".pha-hud-preset-proxy",
      ".pha-hud-width-proxy",
      ".pha-current-select-proxy",
      ".pha-history-select-proxy",
      ".pha-gallery-select-proxy"
    ]) {
      const proxy = shadow.querySelector(selector);
      assert.ok(proxy, `missing ${selector}`);
      assert.equal(proxy.dataset.uiMode, "desktop");
      assert.equal(proxy.querySelector("select"), null);
      assert.equal(proxy.previousElementSibling?.tagName, "SELECT");
    }
    assert.equal(shadow.getElementById("history-loot-session").closest("details"), null);
    for (const id of ["history-loot-rarity", "current-loot-rarity"]) {
      const filter = shadow.getElementById(id);
      assert.equal(filter.tagName, "DETAILS");
      assert.equal(filter.querySelectorAll("select").length, 0);
      assert.equal(filter.closest(".pha-history-select-proxy, .pha-current-select-proxy"), null);
    }
  } finally {
    closedHud.dispose();
    window.happyDOM.abort();
  }
});

test("History navigation preserves loaded pages until Current data changes or user requests Refresh", async () => {
  const sessions = Array.from({ length: 21 }, (_, i) => ({
    sessionId: `stored-${i}`, status: "ended", startedAtMs: Date.now() - i,
    accumulatedActiveMs: 1000
  }));
  let historyReads = 0;
  const { window, ui, shadow, closedHud } = await mountAnalyzer("desktop", {
    loadHistorySessions: async (options) => {
      historyReads += 1;
      return options.beforeSessionId ? [sessions[20]] : sessions;
    }
  });
  try {
    shadow.querySelector('[data-view="history"]').click();
    await nextTask();
    assert.equal(historyReads, 1);
    assert.equal(shadow.querySelectorAll(".history-hunt-row").length, 20);
    shadow.getElementById("history-load-more").click();
    await nextTask();
    assert.equal(historyReads, 2);
    assert.equal(shadow.querySelectorAll(".history-hunt-row").length, 21);
    shadow.querySelector('[data-view="current"]').click();
    shadow.querySelector('[data-view="history"]').click();
    await nextTask();
    assert.equal(historyReads, 2, "tab switching does not silently reset the loaded 21-session list");
    assert.equal(shadow.querySelectorAll(".history-hunt-row").length, 21);

    const metrics = computeSessionMetrics({
      session: { sessionId: "ongoing", status: "running", startedAtMs: Date.now(), activeStartedAtMs: Date.now() },
      encounters: []
    });
    ui.renderCurrent({ sessionId: "ongoing", lootDataRevision: 1, metrics, encounters: [] });
    ui.renderCurrent({ sessionId: "ongoing", lootDataRevision: 2, metrics, encounters: [] });
    assert.match(shadow.getElementById("history-refresh").textContent, /Refresh •/,
      "an open History displays a visible freshness cue when Current changes");
    assert.equal(shadow.getElementById("history-load-more").hidden, true,
      "stale History pages cannot be mixed with new Load More results");
    shadow.querySelector('[data-view="current"]').click();
    shadow.querySelector('[data-view="history"]').click();
    await nextTask();
    assert.equal(historyReads, 3, "a changed Current encounter revision invalidates History");

    ui.renderCurrent({ sessionId: "ongoing", lootDataRevision: 2,
      metrics: { ...metrics, status: "paused" }, encounters: [] });
    shadow.querySelector('[data-view="current"]').click();
    shadow.querySelector('[data-view="history"]').click();
    await nextTask();
    assert.equal(historyReads, 4, "an automatic session status change also invalidates History");

    shadow.getElementById("history-refresh").click();
    await nextTask();
    assert.equal(historyReads, 5, "the user can explicitly request a fresh History read");
  } finally {
    closedHud.dispose();
    window.happyDOM.abort();
  }
});

test("disposing the analyzer releases listeners from every shared select proxy", async () => {
  const { window, shadow, closedHud } = await mountAnalyzer("mobile");
  const proxy = shadow.querySelector(".pha-history-select-proxy");
  const select = proxy.querySelector("select");
  const summary = proxy.querySelector("summary");
  const originalLabel = summary.textContent;
  const nextOption = [...select.options].find((option) => option.textContent !== originalLabel);

  assert.ok(nextOption);
  closedHud.dispose();
  select.value = nextOption.value;
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  await nextTask();

  assert.equal(summary.textContent, originalLabel);
  window.happyDOM.abort();
});
