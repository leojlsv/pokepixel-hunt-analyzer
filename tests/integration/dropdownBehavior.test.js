import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const UI_STATE_KEY = "pokepixel_hunt_analyzer_ui_v2";

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

async function mountAnalyzer(modeOverride) {
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
    onLoadHistorySessions: async () => [],
    onLoadHistorySessionEncounters: async () => []
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
