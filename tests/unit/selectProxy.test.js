import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

import { createSelectProxy } from "../../userscript/select-proxy.js";

test("shared select proxy mirrors selection and preserves the native change contract", async () => {
  const window = new Window();
  globalThis.document = window.document;
  globalThis.Event = window.Event;

  const select = document.createElement("select");
  select.innerHTML = '<option value="a">Alpha</option><option value="b">Beta</option>';
  let changes = 0;
  select.addEventListener("change", () => {
    changes += 1;
  });

  const { proxy, summary, menu } = createSelectProxy({
    select,
    classPrefix: "test-select",
    ariaLabel: "Test select",
    fallbackLabel: "Choose"
  });
  document.body.appendChild(proxy);

  proxy.open = true;
  proxy.dispatchEvent(new window.Event("toggle"));
  menu.querySelectorAll('[role="option"]')[1].click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(select.value, "b");
  assert.equal(summary.textContent, "Beta");
  assert.equal(changes, 1);
  assert.equal(proxy.open, false);
  assert.equal(document.activeElement, summary);
  window.happyDOM.abort();
});

test("shared select proxy preserves option groups and reports when it opens", () => {
  const window = new Window();
  globalThis.document = window.document;
  globalThis.Event = window.Event;

  const select = document.createElement("select");
  select.innerHTML = `
    <option value="">Empty</option>
    <optgroup label="Trackers">
      <option value="shiny">Shiny Tracker</option>
    </optgroup>
  `;
  let openedProxy = null;

  const { proxy, menu } = createSelectProxy({
    select,
    classPrefix: "test-widget",
    ariaLabel: "Test widget",
    fallbackLabel: "Widget",
    onOpen: (currentProxy) => {
      openedProxy = currentProxy;
    }
  });
  document.body.appendChild(proxy);

  proxy.open = true;
  proxy.dispatchEvent(new window.Event("toggle"));

  assert.equal(openedProxy, proxy);
  assert.equal(menu.querySelector(".test-widget-group")?.textContent, "Trackers");
  assert.deepEqual(
    [...menu.querySelectorAll('[role="option"]')].map((option) => option.textContent),
    ["Empty", "Shiny Tracker"]
  );
  window.happyDOM.abort();
});

test("shared select proxy removes its persistent listeners when destroyed", async () => {
  const window = new Window();
  globalThis.document = window.document;
  globalThis.Event = window.Event;

  const select = document.createElement("select");
  select.innerHTML = '<option value="a">Alpha</option><option value="b">Beta</option>';
  const { proxy, summary, destroy } = createSelectProxy({
    select,
    classPrefix: "test-dispose",
    ariaLabel: "Disposable select",
    fallbackLabel: "Choose"
  });
  document.body.appendChild(proxy);

  destroy();
  select.value = "b";
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(summary.textContent, "Alpha");
  window.happyDOM.abort();
});
