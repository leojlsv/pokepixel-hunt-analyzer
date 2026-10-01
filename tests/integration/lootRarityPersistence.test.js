import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

import { createUiMarkup } from "../../userscript/ui-markup.js";
import { createCurrentLootView } from "../../userscript/current-loot-view.js";
import { createHistoryView } from "../../userscript/history-view.js";
import {
  LOOT_RARITY_FILTER_STORAGE_KEY,
  readLootRarityPreferences,
  saveLootRarityPreference
} from "../../userscript/loot-rarity-filter.js";

const encounters = [
  { encounterId: "rare", speciesId: "pikachu", lootAtMs: 100, gold: 3, lootItems: [{ itemId: "r", qty: 1 }] },
  { encounterId: "epic", speciesId: "eevee", lootAtMs: 200, gold: 5, lootItems: [{ itemId: "e", qty: 1 }] },
  { encounterId: "unknown", speciesId: "pikachu", lootAtMs: 300, gold: 7, lootItems: [{ itemId: "u", qty: 1 }] }
];
const catalog = new Map([
  ["r", { name: "Rare drop", rarity: "rare" }],
  ["e", { name: "Epic drop", rarity: "epic" }]
]);

function selectRarities(window, shadow, id, values) {
  const root = shadow.getElementById(id);
  const all = root.querySelector("[data-rarity-all]");
  const options = [...root.querySelectorAll("[data-rarity-value]")];
  const selectAll = values === null;
  for (const input of options) {
    input.checked = selectAll || values.includes(input.dataset.rarityValue);
  }
  all.checked = selectAll;
  (selectAll ? all : options[0]).dispatchEvent(new window.Event("change", { bubbles: true }));
}

function selected(shadow, id) {
  return [...shadow.querySelectorAll(`#${id} [data-rarity-value]`)]
    .filter((input) => input.checked).map((input) => input.dataset.rarityValue);
}

async function mountViews(window) {
  const host = window.document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = createUiMarkup();
  window.document.body.appendChild(host);
  const current = createCurrentLootView(shadow, { getLootItemCatalog: () => catalog });
  const history = createHistoryView(shadow, {
    loadSessions: async () => [{ sessionId: "hunt-a", startedAtMs: Date.now(), status: "ended" }],
    loadSessionEncounters: async () => encounters,
    getLootItemCatalog: () => catalog
  });
  current.render({ sessionId: "hunt-a", lootDataRevision: 1, encounters });
  await history.refresh();
  shadow.querySelector('[data-history-view="loot"]').click();
  return { host, shadow, current, history };
}

test("Current and History Item Rarity multi-selections survive Hunt changes, History refresh, and UI recreation", async () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  const previous = new Map();
  for (const name of ["document", "localStorage"]) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
  }
  try {
    const first = await mountViews(window);
    assert.equal(first.shadow.getElementById("current-loot-rarity-label").textContent, "All (*)");
    assert.equal(first.shadow.getElementById("history-loot-rarity-label").textContent, "All (*)");

    selectRarities(window, first.shadow, "current-loot-rarity", ["rare", "none"]);
    selectRarities(window, first.shadow, "history-loot-rarity", ["epic"]);
    assert.equal(first.shadow.getElementById("current-loot-rarity-label").textContent, "2 selected");
    assert.equal(first.shadow.getElementById("history-loot-rarity-label").textContent, "Epic");
    assert.deepEqual([...first.shadow.querySelectorAll(".current-loot-row")].map((row) => row.dataset.itemId).sort(), ["r", "u"]);
    assert.deepEqual([...first.shadow.querySelectorAll(".history-loot-row")].map((row) => row.dataset.itemId), ["e"]);
    assert.equal(first.shadow.getElementById("current-loot-total").textContent, "15");
    assert.equal(first.shadow.getElementById("history-loot-total").textContent, "15");
    assert.deepEqual(JSON.parse(window.localStorage.getItem(LOOT_RARITY_FILTER_STORAGE_KEY)), {
      current: ["rare", "none"], history: ["epic"]
    });

    first.current.render({ sessionId: "hunt-b", lootDataRevision: 2, encounters });
    await first.history.refresh();
    assert.equal(first.shadow.querySelectorAll(".current-loot-row").length, 2);
    assert.equal(first.shadow.querySelectorAll(".history-loot-row").length, 1);
    selectRarities(window, first.shadow, "history-loot-rarity", []);
    assert.equal(first.shadow.getElementById("history-loot-rarity-label").textContent, "None");
    assert.equal(first.shadow.querySelectorAll(".history-loot-row").length, 0);
    assert.deepEqual(readLootRarityPreferences(window.localStorage), {
      current: ["rare", "none"], history: []
    });

    first.host.remove();
    const second = await mountViews(window);
    assert.deepEqual(selected(second.shadow, "current-loot-rarity"), ["rare", "none"]);
    assert.deepEqual(selected(second.shadow, "history-loot-rarity"), []);
    assert.equal(second.shadow.querySelectorAll(".current-loot-row").length, 2);
    assert.equal(second.shadow.querySelectorAll(".history-loot-row").length, 0);
    selectRarities(window, second.shadow, "history-loot-rarity", null);
    assert.equal(second.shadow.querySelectorAll(".history-loot-row").length, 3);
    assert.deepEqual(readLootRarityPreferences(window.localStorage), {
      current: ["rare", "none"], history: null
    });
    second.host.remove();
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    window.happyDOM.abort();
  }
});

test("Item Rarity preference storage rejects malformed and obsolete data without turning it into None", () => {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value)
  };
  assert.deepEqual(readLootRarityPreferences(storage), { current: null, history: null });
  saveLootRarityPreference("current", ["none", "rare", "rare"], storage);
  saveLootRarityPreference("history", [], storage);
  assert.deepEqual(readLootRarityPreferences(storage), { current: ["none", "rare"], history: [] });
  data.set(LOOT_RARITY_FILTER_STORAGE_KEY, JSON.stringify({ current: ["obsolete"], history: ["epic"] }));
  assert.deepEqual(readLootRarityPreferences(storage), { current: null, history: ["epic"] });
  const denied = { getItem: () => { throw new Error("Storage blocked"); }, setItem: () => { throw new Error("Storage blocked"); } };
  assert.deepEqual(readLootRarityPreferences(denied), { current: null, history: null });
  assert.doesNotThrow(() => saveLootRarityPreference("current", ["rare"], denied));
});
