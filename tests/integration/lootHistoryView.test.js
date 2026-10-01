import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

import { createUiMarkup } from "../../userscript/ui-markup.js";
import { createHistoryView } from "../../userscript/history-view.js";
import { normalizeInventorySnapshot } from "../../userscript/inventory-state.js";
import { createLootItemCatalog } from "../../userscript/loot-item-catalog.js";

function chooseItemRarities(window, filter, ...values) {
  const options = [...filter.querySelectorAll("[data-rarity-value]")];
  const all = filter.querySelector("[data-rarity-all]");
  const allSelected = values.includes("*");
  for (const input of options) {
    input.checked = allSelected || values.includes(input.dataset.rarityValue);
  }
  all.checked = allSelected;
  (allSelected ? all : options[0]).dispatchEvent(new window.Event("change", { bubbles: true }));
}

test("History > Loot renders no timestamps, keeps session scope and expands item sources", async () => {
  const previousDocument = globalThis.document;
  const window = new Window({ url: "https://play.pokepixel.example/" });
  globalThis.document = window.document;

  try {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = createUiMarkup();
    document.body.appendChild(host);

    const sessions = [
      { sessionId: "hunt-A", activityKind: "hunt", startedAtMs: Date.now() - 1000, status: "ended" },
      { sessionId: "expedition-B", activityKind: "expedition", startedAtMs: Date.now() - 2000, status: "ended" }
    ];
    const encountersBySession = {
      "hunt-A": [{
        encounterId: "drop-a", speciesId: "pikachu", captureResult: "failed", quality: "common",
        lootAtMs: 1000, gold: 20, lootSellValue: 5,
        lootItems: [{ itemId: "reference_straw", qty: 2 }]
      }],
      "expedition-B": [{
        encounterId: "drop-b", speciesId: "eevee", captureResult: "success", quality: "epic",
        lootAtMs: 2000, gold: 8, lootSellValue: 2,
        lootItems: [{ itemId: "reference_straw", qty: 3 }, { itemId: "unknown_id", qty: 1 }]
      }]
    };
    const catalog = new Map([["reference_straw", { name: "Reference Straw", rarity: "rare" }]]);
    const view = createHistoryView(shadow, {
      loadSessions: async () => sessions,
      loadSessionEncounters: async (sessionId) => encountersBySession[sessionId],
      getLootItemCatalog: () => catalog
    });
    await view.refresh();

    shadow.querySelector('[data-history-view="loot"]').click();
    assert.equal(shadow.querySelector('[data-history-panel="loot"]').hidden, false);
    assert.equal(shadow.querySelector('[data-history-panel="hunts"]').hidden, true);
    assert.equal(shadow.getElementById("history-rarity-label").textContent, "Pokémon Rarity");
    assert.equal(shadow.getElementById("history-loot-gold").textContent, "28");
    assert.equal(shadow.getElementById("history-loot-value").textContent, "7");
    assert.equal(shadow.getElementById("history-loot-total").textContent, "35");
    assert.match(shadow.getElementById("history-count").textContent, /2 item types · 2\/2 sessions matched/);
    assert.deepEqual([...shadow.querySelectorAll(".history-loot-row")].map((row) => row.cells[0].querySelector("span").textContent), [
      "Reference Straw", "unknown_id"
    ]);
    assert.equal(shadow.querySelector(".history-loot-row").cells[1].textContent, "5");
    assert.equal(shadow.querySelector(".history-loot-row").cells[2].textContent, "2");
    assert.equal(shadow.querySelector(".history-loot-row .rarity-rare").textContent, "Reference Straw");
    assert.match(shadow.querySelector(".history-loot-row small").textContent, /Rarity: Rare/);
    assert.match(shadow.querySelectorAll(".history-loot-row")[1].textContent, /Rarity unknown/);
    assert.doesNotMatch(shadow.querySelector('[data-history-panel="loot"]').textContent, /\bAt\b|\bTime\b|\d{2}:\d{2}:\d{2}/);

    const itemRarity = shadow.getElementById("history-loot-rarity");
    assert.deepEqual([...itemRarity.querySelectorAll("[data-rarity-value]")].map((option) => option.dataset.rarityValue), [
      "weak", "common", "uncommon", "rare", "epic", "legendary", "mythical", "none"
    ]);
    const chooseItemRarity = (value) => {
      chooseItemRarities(window, itemRarity, value);
    };
    chooseItemRarity("rare");
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 1);
    assert.equal(shadow.querySelector(".history-loot-row").dataset.itemId, "reference_straw");
    assert.match(shadow.getElementById("history-count").textContent, /1\/2 item types/);
    assert.equal(shadow.getElementById("history-loot-total").textContent, "35", "item rarity does not falsely allocate encounter-level gold");

    chooseItemRarities(window, itemRarity, "rare", "none");
    assert.deepEqual([...shadow.querySelectorAll(".history-loot-row")].map((row) => row.dataset.itemId), [
      "reference_straw", "unknown_id"
    ]);
    assert.equal(shadow.getElementById("history-loot-rarity-label").textContent, "2 selected");
    chooseItemRarity("none");
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 1);
    assert.equal(shadow.querySelector(".history-loot-row").dataset.itemId, "unknown_id");
    chooseItemRarity("epic");
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 0);
    assert.match(shadow.querySelector(".history-loot-empty").textContent, /No item drops match this item rarity/);
    chooseItemRarity("*");

    shadow.querySelector(".history-loot-row").click();
    assert.equal(shadow.querySelectorAll(".history-loot-sources-table tbody tr").length, 2);
    assert.match(shadow.querySelector(".history-loot-sources-table").textContent, /Pikachu/);
    assert.match(shadow.querySelector(".history-loot-sources-table").textContent, /Eevee/);

    catalog.set("unknown_id", { name: "Expedition Token", rarity: "legendary" });
    view.refreshLootCatalog();
    assert.equal(shadow.querySelectorAll(".history-loot-row")[1].cells[0].querySelector("span").textContent, "Expedition Token");
    assert.match(shadow.querySelectorAll(".history-loot-row")[1].textContent, /Rarity: Legendary/);
    assert.equal(shadow.querySelector(".history-loot-row").getAttribute("aria-expanded"), "true", "catalog hydration preserves the expanded row");

    chooseItemRarity("none");
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 0);
    catalog.set("unknown_id", { name: "Expedition Token", rarity: null });
    view.refreshLootCatalog();
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 1, "catalog refresh can repopulate unknown-rarity results without reloading History");
    catalog.set("unknown_id", { name: "Expedition Token", rarity: " Legendary " });
    view.refreshLootCatalog();
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 0);
    chooseItemRarity("legendary");
    assert.equal(shadow.querySelector(".history-loot-row").dataset.itemId, "unknown_id");
    assert.match(shadow.querySelector(".history-loot-row small").textContent, /Rarity: Legendary/);
    chooseItemRarity("*");

    const select = shadow.getElementById("history-loot-session");
    assert.deepEqual([...select.options].map((option) => option.textContent), [
      "All loaded sessions", "Hunt #1", "Expedition #2"
    ]);
    select.value = "expedition-B";
    select.dispatchEvent(new window.Event("change"));
    assert.equal(shadow.getElementById("history-loot-total").textContent, "10");
    assert.equal(shadow.querySelector(".history-loot-row").cells[1].textContent, "3");

    select.value = "*";
    select.dispatchEvent(new window.Event("change"));
    const species = shadow.getElementById("history-species");
    species.value = "pikachu";
    species.dispatchEvent(new window.Event("change"));
    assert.equal(shadow.getElementById("history-loot-total").textContent, "25");
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 1);

    shadow.querySelector('[data-history-view="attempts"]').click();
    assert.equal(shadow.getElementById("history-rarity-label").textContent, "Rarity");
  } finally {
    globalThis.document = previousDocument;
    window.close();
  }
});

test("History > Loot shows gold-only rewards and an explicit empty item state", async () => {
  const previousDocument = globalThis.document;
  const window = new Window({ url: "https://play.pokepixel.example/" });
  globalThis.document = window.document;
  try {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = createUiMarkup();
    document.body.appendChild(host);
    const view = createHistoryView(shadow, {
      loadSessions: async () => [{ sessionId: "one", status: "ended", startedAtMs: Date.now() }],
      loadSessionEncounters: async () => [{ encounterId: "gold", lootAtMs: 1500, gold: 30, lootItems: [] }]
    });
    await view.refresh();
    shadow.querySelector('[data-history-view="loot"]').click();
    assert.equal(shadow.getElementById("history-loot-total").textContent, "30");
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 0);
    assert.match(shadow.querySelector(".history-loot-empty").textContent, /No item drops recorded/);
  } finally {
    globalThis.document = previousDocument;
    window.close();
  }
});

test("History > Loot reclassifies a previously unknown map_fragment as Rare from the native Bag", async () => {
  const previousDocument = globalThis.document;
  const window = new Window({ url: "https://play.pokepixel.example/" });
  globalThis.document = window.document;

  try {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = createUiMarkup();
    document.body.appendChild(host);

    const snapshot = normalizeInventorySnapshot({
      items: [{ item_id: "map_fragment", name: "Fragmento de Mapa", qty: 5 }]
    });
    let catalog = new Map();
    const view = createHistoryView(shadow, {
      loadSessions: async () => [{ sessionId: "expedition", status: "ended", startedAtMs: Date.now() }],
      loadSessionEncounters: async () => [{
        encounterId: "map-loot", lootAtMs: 1200, gold: 2,
        speciesId: "pikachu", lootItems: [{ itemId: "map_fragment", qty: 5 }]
      }],
      getLootItemCatalog: () => {
        catalog = createLootItemCatalog(snapshot, window.document, catalog);
        return catalog;
      }
    });
    await view.refresh();
    shadow.querySelector('[data-history-view="loot"]').click();
    const rarity = shadow.getElementById("history-loot-rarity");
    chooseItemRarities(window, rarity, "rare");
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 0);

    const slot = document.createElement("button");
    slot.className = "inventory-slot rarity-rare";
    slot.dataset.itemId = "map_fragment";
    document.body.appendChild(slot);
    view.refreshLootCatalog();
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 1);
    assert.equal(shadow.querySelector(".history-loot-row").dataset.itemId, "map_fragment");
    assert.match(shadow.querySelector(".history-loot-row").textContent, /Rarity: Rare/);
    assert.equal(shadow.getElementById("history-loot-gold").textContent, "2");
    slot.remove();
  } finally {
    globalThis.document = previousDocument;
    window.close();
  }
});

test("History > Loot classifies historical map_fragment with API rarity raro and no Bag slot", async () => {
  const previousDocument = globalThis.document;
  const window = new Window({ url: "https://play.pokepixel.example/" });
  globalThis.document = window.document;
  try {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = createUiMarkup();
    document.body.appendChild(host);

    const snapshot = normalizeInventorySnapshot({ inventory: [{
      item_id: "map_fragment", name: "Fragmento de Mapa", rarity: "raro",
      type: "material", category: "material", qty: 2
    }] });
    const view = createHistoryView(shadow, {
      loadSessions: async () => [{ sessionId: "archived-expedition", status: "ended", startedAtMs: Date.now() }],
      loadSessionEncounters: async () => [{
        encounterId: "archived-drop", lootAtMs: 1_200,
        speciesId: "pikachu", gold: 3,
        lootItems: [{ itemId: "map_fragment", qty: 2 }]
      }],
      getLootItemCatalog: () => createLootItemCatalog(snapshot)
    });
    await view.refresh();
    shadow.querySelector('[data-history-view="loot"]').click();
    const rarity = shadow.getElementById("history-loot-rarity");
    chooseItemRarities(window, rarity, "rare");
    assert.equal(shadow.querySelectorAll(".history-loot-row").length, 1);
    assert.equal(shadow.querySelector(".history-loot-row").dataset.itemId, "map_fragment");
    assert.match(shadow.querySelector(".history-loot-row").textContent, /Rarity: Rare/);
    assert.equal(shadow.getElementById("history-loot-gold").textContent, "3");
    assert.equal(window.document.querySelectorAll("button.inventory-slot").length, 0);
  } finally {
    globalThis.document = previousDocument;
    window.close();
  }
});
