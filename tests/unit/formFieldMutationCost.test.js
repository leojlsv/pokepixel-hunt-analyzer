import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { bindOneColumnMode, disposeOneColumnMode } from "../../userscript/closed-hud-one-column.js";

test("dynamic form-field IDs scan only inserted subtrees, not the entire Analyzer on every mutation", t => {
  const browser = new Window();
  const globals = ["window", "document", "localStorage", "MutationObserver", "Event"];
  const previous = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const observers = [];
  class SpyObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  for (const name of globals) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: name === "MutationObserver" ? SpyObserver : browser[name]
    });
  }
  t.after(() => {
    browser.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  const host = browser.document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <button id="pha-toggle"></button>
    <section id="pha-hud-settings">
      <label>Columns<select data-hud-zero-mode><option value="2">2</option><option value="0">0</option></select></label>
    </section>`;
  assert.equal(bindOneColumnMode(shadow), true);
  assert.equal(observers.length, 1);

  let entireShadowScans = 0;
  const querySelectorAll = shadow.querySelectorAll.bind(shadow);
  shadow.querySelectorAll = (selector) => {
    if (selector === "input, select, textarea") entireShadowScans += 1;
    return querySelectorAll(selector);
  };
  const insertion = browser.document.createElement("div");
  insertion.innerHTML = `<input class="catch-gallery-pokemon-filter"><div><select class="catch-gallery-rarity-filter"></select></div>`;
  shadow.appendChild(insertion);
  observers[0].callback([{ addedNodes: [insertion] }]);
  assert.equal(insertion.querySelector("input").id, "catch-gallery-pokemon-filter");
  assert.equal(insertion.querySelector("select").id, "catch-gallery-rarity-filter");

  const direct = browser.document.createElement("select");
  direct.className = "pha-ui-mode-select";
  shadow.appendChild(direct);
  observers[0].callback([{ addedNodes: [direct] }]);
  assert.equal(direct.id, "pha-ui-mode");
  assert.equal(entireShadowScans, 0);
  disposeOneColumnMode(shadow);
  assert.equal(observers[0].disconnected, true);
});
