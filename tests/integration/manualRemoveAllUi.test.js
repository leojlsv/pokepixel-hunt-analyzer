import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { createUi } from "../../userscript/ui.js";

function setup(t, onClearAll) {
  const browser = new Window({ url: "https://pokepixel.nietore.com/play/" });
  browser.localStorage.setItem("pokepixel_hunt_analyzer_ui_v2", JSON.stringify({
    shared: { view: "history", open: true, modeOverride: "mobile" }, desktop: {}, mobile: {}
  }));
  const names = ["window", "document", "localStorage", "Element", "HTMLElement", "HTMLInputElement", "Node", "getComputedStyle", "requestAnimationFrame"];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const name of names) {
    const value = ["getComputedStyle", "requestAnimationFrame"].includes(name)
      ? browser[name].bind(browser)
      : browser[name];
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(() => {
    browser.close();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const ui = createUi({
    onSessionAction() {},
    onLoadHistorySessions: async () => [],
    onLoadHistorySessionEncounters: async () => [],
    onClearAll
  });
  const shadow = browser.document.getElementById("pokepixel-hunt-analyzer-root").shadowRoot;
  return { browser, ui, shadow, button: shadow.getElementById("history-clear-all") };
}

const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

test("Remover Tudo is ACTIVE-only and requires confirmation", async t => {
  let clears = 0;
  const f = setup(t, async () => { clears += 1; });
  let approved = false;
  let confirmation = "";
  f.browser.confirm = message => { confirmation = message; return approved; };
  assert.equal(f.button.disabled, true, "STANDBY cannot clear storage");
  f.ui.setActive(true);
  assert.equal(f.button.disabled, false);

  f.button.click();
  await nextTask();
  assert.equal(clears, 0, "cancelled confirmation leaves data intact");
  assert.match(confirmation, /Hunts, Current/);
  assert.match(confirmation, /Catch Gallery será preservado/);
  assert.match(confirmation, /irreversível/i);

  approved = true;
  f.button.click();
  await nextTask();
  assert.equal(clears, 1);
  assert.equal(f.button.disabled, false);
  assert.match(f.shadow.getElementById("history-clear-all-status").textContent, /Histórico analítico removido.*Catch Gallery preservado/);

  f.ui.setActive(false);
  assert.equal(f.button.disabled, true);
});

test("Remover Tudo stays disabled while executing and reports errors", async t => {
  let rejectDelete;
  let called = 0;
  const f = setup(t, () => {
    called += 1;
    return new Promise((resolve, reject) => { rejectDelete = reject; });
  });
  f.browser.confirm = () => true;
  f.ui.setActive(true);
  f.button.click();
  assert.equal(f.button.disabled, true);
  assert.equal(f.button.textContent, "REMOVENDO…");
  f.button.click();
  assert.equal(called, 1);
  rejectDelete(new Error("leader changed"));
  await nextTask();
  assert.equal(f.button.disabled, false);
  assert.match(f.shadow.getElementById("history-clear-all-status").textContent, /leader changed/);
});
