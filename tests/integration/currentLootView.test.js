import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

import { createCurrentLootView } from "../../userscript/current-loot-view.js";
import { createCurrentView } from "../../userscript/current-view.js";
import { createUiMarkup } from "../../userscript/ui-markup.js";
import { computeSessionMetrics } from "../../domain/sessionMetrics.js";
import { createLootItemCatalog } from "../../userscript/loot-item-catalog.js";

function withShadow() {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    value: window.document, configurable: true, writable: true
  });
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = createUiMarkup();
  document.documentElement.appendChild(host);
  return {
    window, shadow,
    dispose() {
      host.remove();
      if (documentBefore) Object.defineProperty(globalThis, "document", documentBefore);
      else delete globalThis.document;
      window.happyDOM.abort();
    }
  };
}

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

test("Current Loot aggregates only the current session, with rarity filter and no timestamp", () => {
  const ctx = withShadow();
  try {
    const { window, shadow } = ctx;
    assert.equal(shadow.querySelector(".current-loot-help"), null, "Current Loot no longer shows the explanatory note");
    assert.deepEqual(
      [...shadow.querySelectorAll("#view-current > .section")].map((section) => section.id),
      ["rarity-section", "captured-section", "failed-section", "loot-section"],
      "Loot follows both Captured and Failed in Current"
    );
    const catalog = new Map([
      ["reference_straw", { name: "Reference Straw", rarity: "rare" }]
    ]);
    const loot = createCurrentLootView(shadow, { getLootItemCatalog: () => catalog });
    const encounters = [
      {
        encounterId: "a", speciesId: "pikachu", lootAtMs: 1000,
        gold: 20, lootSellValue: 5,
        lootItems: [{ itemId: "reference_straw", qty: 3 }, { itemId: "unknown_id", qty: 1 }]
      },
      {
        encounterId: "b", speciesId: "eevee", lootAtMs: 2000,
        gold: 8, lootSellValue: 2, autoSold: true, autoSellValue: 40,
        lootItems: [{ itemId: "reference_straw", qty: 2 }]
      }
    ];
    loot.render({ sessionId: "hunt-a", lootDataRevision: 1, encounters });
    assert.equal(shadow.getElementById("current-loot-count").textContent, "2 items");
    assert.equal(shadow.getElementById("current-loot-coverage").textContent, "2 loot rewards · current session");
    assert.equal(shadow.getElementById("current-loot-gold").textContent, "28");
    assert.equal(shadow.getElementById("current-loot-value").textContent, "7");
    assert.equal(shadow.getElementById("current-loot-autosell").textContent, "40");
    assert.equal(shadow.getElementById("current-loot-total").textContent, "75");
    assert.deepEqual([...shadow.querySelectorAll(".current-loot-row")].map((row) => row.dataset.itemId), [
      "reference_straw", "unknown_id"
    ]);
    assert.equal(shadow.querySelector(".current-loot-row").cells[1].textContent, "5");
    assert.equal(shadow.querySelector(".current-loot-row").cells[2].textContent, "2");
    assert.match(shadow.querySelector(".current-loot-row").textContent, /Rarity: Rare/);
    assert.match(shadow.querySelectorAll(".current-loot-row")[1].textContent, /Rarity unknown/);
    assert.doesNotMatch(shadow.getElementById("loot-section").textContent, /\bTime\b|\bAt\b|\d{2}:\d{2}:\d{2}/);

    const rarity = shadow.getElementById("current-loot-rarity");
    assert.deepEqual([...rarity.querySelectorAll("[data-rarity-value]")].map((option) => option.dataset.rarityValue), [
      "weak", "common", "uncommon", "rare", "epic", "legendary", "mythical", "none"
    ]);
    chooseItemRarities(window, rarity, "rare");
    assert.equal(shadow.getElementById("current-loot-count").textContent, "1/2 items");
    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 1);
    assert.equal(shadow.getElementById("current-loot-total").textContent, "75", "item filter must not invent price attribution");
    chooseItemRarities(window, rarity, "rare", "none");
    assert.deepEqual([...shadow.querySelectorAll(".current-loot-row")].map((row) => row.dataset.itemId), [
      "reference_straw", "unknown_id"
    ], "multiple item rarities match at once");
    assert.equal(shadow.getElementById("current-loot-rarity-label").textContent, "2 selected");
    chooseItemRarities(window, rarity, "none");
    assert.equal(shadow.querySelector(".current-loot-row").dataset.itemId, "unknown_id");
    chooseItemRarities(window, rarity, "epic");
    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 0);
    assert.match(shadow.querySelector(".current-loot-empty").textContent, /No item drops match this item rarity/);

    chooseItemRarities(window, rarity, "*");
    shadow.querySelector(".current-loot-row").click();
    assert.equal(shadow.querySelectorAll(".current-loot-sources-table tbody tr").length, 2);
    assert.match(shadow.querySelector(".current-loot-sources-table").textContent, /Pikachu/);
    assert.match(shadow.querySelector(".current-loot-sources-table").textContent, /Eevee/);

    const previousRow = shadow.querySelector(".current-loot-row");
    loot.render({
      sessionId: "hunt-a",
      lootDataRevision: 1,
      encounters: [...encounters, { encounterId: "ignored", gold: 999, lootAtMs: 3000 }]
    });
    assert.equal(shadow.querySelector(".current-loot-row"), previousRow,
      "one-second UI refresh must not re-aggregate encounters without a data change");
    assert.equal(shadow.getElementById("current-loot-total").textContent, "75");

    catalog.set("unknown_id", { name: "Expedition Token", rarity: "legendary" });
    loot.refreshCatalog();
    assert.match(shadow.querySelectorAll(".current-loot-row")[1].textContent, /Expedition Token/);
    assert.match(shadow.querySelectorAll(".current-loot-row")[1].textContent, /Rarity: Legendary/);
    assert.equal(shadow.querySelector(".current-loot-row").getAttribute("aria-expanded"), "true");
    chooseItemRarities(window, rarity, "legendary");
    assert.equal(shadow.querySelector(".current-loot-row").dataset.itemId, "unknown_id");
    catalog.set("unknown_id", { name: "Expedition Token", rarity: null });
    loot.refreshCatalog();
    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 0,
      "inventory updates must reclassify active rarity filter");

    loot.render({
      sessionId: "hunt-b",
      lootDataRevision: 2,
      encounters: [{ encounterId: "c", lootAtMs: 3000, gold: 6, lootItems: [{ itemId: "fresh", qty: 3 }] }]
    });
    assert.equal(shadow.getElementById("current-loot-total").textContent, "6");
    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 0, "rarity selection survives switching Hunt sessions");
    chooseItemRarities(window, rarity, "*");
    assert.deepEqual([...shadow.querySelectorAll(".current-loot-row")].map((row) => row.dataset.itemId), ["fresh"]);
    assert.equal(shadow.querySelector(".current-loot-row").getAttribute("aria-expanded"), "false",
      "expanded detail from previous session must be cleared");
    loot.render({ sessionId: null, lootDataRevision: 3, encounters: [] });
    assert.equal(shadow.getElementById("current-loot-total").textContent, "0");
    assert.match(shadow.querySelector(".current-loot-empty").textContent, /No item drops recorded/);
  } finally {
    ctx.dispose();
  }
});

test("Rare map_fragment enters Current rarity filter when items.json arrives, without a new loot event", () => {
  const ctx = withShadow();
  try {
    const { window, shadow } = ctx;
    let catalog = new Map();
    const getLootItemCatalog = () => catalog;
    const current = createCurrentLootView(shadow, { getLootItemCatalog });
    const state = {
      sessionId: "expedition-map",
      lootDataRevision: 6,
      encounters: [{
        encounterId: "map-drop", speciesId: "pikachu", lootAtMs: 1_000,
        lootItems: [{ itemId: "map_fragment", qty: 2 }]
      }]
    };
    current.render(state);
    const filter = shadow.getElementById("current-loot-rarity");
    chooseItemRarities(window, filter, "rare");
    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 0);
    assert.equal(shadow.getElementById("current-loot-count").textContent, "0/1 items");

    catalog = createLootItemCatalog([
      { id: "map_fragment", name: "Fragmento de Mapa", rarity: "raro" }
    ]);
    current.refreshCatalog();

    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 1);
    assert.equal(shadow.querySelector(".current-loot-row").dataset.itemId, "map_fragment");
    assert.match(shadow.querySelector(".current-loot-row").textContent, /Fragmento de Mapa/);
    assert.match(shadow.querySelector(".current-loot-row").textContent, /Rarity: Rare/);
    assert.ok(shadow.querySelector(".current-loot-row .rarity-rare"));
    assert.equal(shadow.getElementById("current-loot-count").textContent, "1/1 items");

    current.render(state);
    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 1);
    assert.equal(shadow.getElementById("current-loot-total").textContent, "0");
  } finally {
    ctx.dispose();
  }
});

test("an already-recorded map_fragment becomes Rare after items.json is observed", () => {
  const ctx = withShadow();
  try {
    const { window, shadow } = ctx;
    let catalog = new Map();
    const readCatalog = () => catalog;
    const current = createCurrentLootView(shadow, { getLootItemCatalog: readCatalog });
    const state = {
      sessionId: "existing-hunt",
      lootDataRevision: 4,
      encounters: [{ encounterId: "old-drop", speciesId: "pikachu", lootAtMs: 2_000,
        lootItems: [{ itemId: "map_fragment", qty: 4 }] }]
    };
    current.render(state);
    const rarity = shadow.getElementById("current-loot-rarity");
    chooseItemRarities(window, rarity, "rare");
    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 0);

    catalog = createLootItemCatalog([
      { id: "map_fragment", name: "Fragmento de Mapa", rarity: "raro" }
    ]);
    current.refreshCatalog();
    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 1);
    assert.equal(shadow.querySelector(".current-loot-row").dataset.itemId, "map_fragment");
    assert.match(shadow.querySelector(".current-loot-row").textContent, /Fragmento de Mapa/);
    assert.match(shadow.querySelector(".current-loot-row").textContent, /Rarity: Rare/);
    assert.equal(window.document.querySelectorAll("button.inventory-slot").length, 0);
  } finally {
    ctx.dispose();
  }
});

test("Current Loot uses items.json rarity and never infers rarity from the item id", () => {
  const ctx = withShadow();
  try {
    const { window, shadow } = ctx;
    let catalog = new Map();
    const current = createCurrentLootView(shadow, {
      getLootItemCatalog: () => catalog
    });
    const state = {
      sessionId: "expedition-cached",
      lootDataRevision: 10,
      encounters: [{ encounterId: "loot-cached", lootAtMs: 1_000, lootItems: [
        { itemId: "map_fragment", qty: 2 },
        { itemId: "legendary_fragment_latios", qty: 1 }
      ] }]
    };
    const filter = shadow.getElementById("current-loot-rarity");
    current.render(state);
    chooseItemRarities(window, filter, "rare");
    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 0);

    catalog = createLootItemCatalog([
      { id: "map_fragment", name: "Fragmento de Mapa", rarity: "raro" },
      { id: "legendary_fragment_latios", name: "Fragmento do Baú de Latios", rarity: "épico" }
    ]);
    current.refreshCatalog();
    assert.deepEqual([...shadow.querySelectorAll(".current-loot-row")].map((row) => row.dataset.itemId),
      ["map_fragment"]);
    assert.match(shadow.querySelector(".current-loot-row").textContent, /Rarity: Rare/);
    chooseItemRarities(window, filter, "epic");
    assert.deepEqual([...shadow.querySelectorAll(".current-loot-row")].map((row) => row.dataset.itemId),
      ["legendary_fragment_latios"], "rarity is taken from items.json, not its ID");
    chooseItemRarities(window, filter, "legendary");
    assert.equal(shadow.querySelectorAll(".current-loot-row").length, 0,
      "legendary in the item ID never implies the Legendary rarity");
  } finally {
    ctx.dispose();
  }
});

test("Current view repaints Loot when a reward changes but Captured list revision does not", () => {
  const ctx = withShadow();
  const before = new Map();
  for (const name of ["localStorage", "HTMLInputElement", "requestAnimationFrame"]) {
    before.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: name === "requestAnimationFrame"
        ? ctx.window.requestAnimationFrame.bind(ctx.window)
        : ctx.window[name]
    });
  }

  try {
    const { shadow } = ctx;
    const view = createCurrentView(shadow, {
      getLootItemCatalog: () => new Map([["drop", { name: "Actual Drop", rarity: "common" }]])
    });
    const session = {
      sessionId: "expedition-1",
      activityKind: "expedition",
      status: "running",
      startedAtMs: 1000,
      activeAnchorAtMs: 1000,
      accumulatedActiveMs: 0
    };
    const beforeLoot = {
      encounterId: "expedition-encounter",
      sessionId: "expedition-1",
      speciesId: "pikachu",
      quality: "common",
      captureResult: "none",
      startedAtMs: 1000
    };
    const afterLoot = {
      ...beforeLoot,
      lootAtMs: 2000,
      gold: 9,
      lootSellValue: 4,
      lootItems: [{ itemId: "drop", qty: 2 }]
    };
    view.render({
      metrics: computeSessionMetrics({ session, encounters: [beforeLoot], now: 2000 }),
      encounters: [beforeLoot],
      sessionId: session.sessionId,
      encounterSnapshotVersion: 1,
      lootDataRevision: 1
    });
    assert.equal(shadow.getElementById("current-loot-total").textContent, "0");

    view.render({
      metrics: computeSessionMetrics({ session, encounters: [afterLoot], now: 3000 }),
      encounters: [afterLoot],
      sessionId: session.sessionId,
      encounterSnapshotVersion: 1,
      lootDataRevision: 2
    });
    assert.equal(shadow.getElementById("current-loot-total").textContent, "13");
    assert.equal(shadow.querySelector(".current-loot-row").cells[0].querySelector("span").textContent, "Actual Drop");
    assert.equal(shadow.querySelector('[data-history-panel="loot"]').hidden, true);
    assert.equal(shadow.getElementById("current-loot-count").textContent, "1 item");
    assert.equal(shadow.getElementById("captured-count").textContent, "0 Pokémons");
  } finally {
    for (const [name, descriptor] of before) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    ctx.dispose();
  }
});
