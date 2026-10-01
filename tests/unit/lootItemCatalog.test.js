import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import {
  createLootItemCatalog,
  createLootItemCatalogReader,
  inventoryItemRarity,
  knownLootItemRarity,
  lootItemCatalogSignature
} from "../../userscript/loot-item-catalog.js";
import { normalizeInventorySnapshot } from "../../userscript/inventory-state.js";

test("Inventory API inventory[] and nested item fields supply canonical name and Rare rarity", () => {
  const snapshot = normalizeInventorySnapshot({
    inventory: [
      {
        item: { id: "map_fragment", name: "Fragmento de Mapa", type: "material", rarity: "Rare" },
        qty: 4
      },
      {
        item: { id: "capsule_ultra", name: "Ultra Ball", type: "capsule" },
        qty: 12
      }
    ]
  }, 123);

  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.items.length, 2);
  assert.equal(snapshot.byId.get("map_fragment").name, "Fragmento de Mapa");
  assert.equal(snapshot.byId.get("map_fragment").rarity, "rare");
  assert.equal(snapshot.byId.get("map_fragment").type, "material");
  assert.equal(snapshot.byId.get("map_fragment").qty, 4);
  assert.equal(snapshot.capsules.length, 1, "nested type still feeds the existing HUD");
  assert.deepEqual(createLootItemCatalog(snapshot).get("map_fragment"), {
    name: "Fragmento de Mapa", rarity: "rare"
  });

  assert.equal(inventoryItemRarity({ rarity: "", item: { rarity: "Rara" } }), "rare");
  assert.equal(knownLootItemRarity("RARE"), "rare");
  assert.equal(knownLootItemRarity("undefined"), "");
});

test("real Inventory API item rarity raro is canonically Rare without opening Bag", () => {
  const response = { inventory: [{
    item_id: "map_fragment", name: "Fragmento de Mapa",
    rarity: "raro", type: "material", category: "material", qty: 7
  }] };
  const snapshot = normalizeInventorySnapshot(response, 100);
  assert.equal(snapshot.byId.get("map_fragment")?.rarity, "rare");
  assert.deepEqual(createLootItemCatalog(snapshot).get("map_fragment"), {
    name: "Fragmento de Mapa", rarity: "rare"
  });
  for (const [actual, expected] of Object.entries({
    fraco: "weak", fraca: "weak", raro: "rare", rara: "rare",
    epico: "epic", "épico": "epic", epica: "epic", "épica": "epic",
    lendario: "legendary", "lendário": "legendary",
    lendaria: "legendary", "lendária": "legendary",
    mitico: "mythical", "mítico": "mythical",
    mitica: "mythical", "mítica": "mythical",
    comum: "common", incomum: "uncommon"
  })) {
    assert.equal(knownLootItemRarity(actual), expected, `game rarity ${actual}`);
    assert.equal(knownLootItemRarity(actual.toUpperCase()), expected, `uppercase game rarity ${actual}`);
  }
  assert.equal(knownLootItemRarity("unknown"), "");
  assert.equal(knownLootItemRarity("some_category"), "");
});

test("Native Bag rarity-rare resolves an API item with missing rarity and stays observed after Bag closes", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    const inventory = normalizeInventorySnapshot({
      data: { inventory: [{ item_id: "map_fragment", name: "Fragmento de Mapa", qty: 4 }] }
    });
    assert.equal(inventory.byId.get("map_fragment").rarity, "");
    assert.equal(createLootItemCatalog(inventory).get("map_fragment").rarity, "");

    const bag = window.document.createElement("div");
    bag.innerHTML = '<button class="inventory-slot rarity-rare" aria-label="Fragmento de Mapa, 4 units"></button>';
    window.document.body.appendChild(bag);
    let catalog = createLootItemCatalog(inventory, window.document);
    assert.deepEqual(catalog.get("map_fragment"), { name: "Fragmento de Mapa", rarity: "rare" });

    bag.remove();
    catalog = createLootItemCatalog(normalizeInventorySnapshot({ inventory: [] }), window.document, catalog);
    assert.deepEqual(catalog.get("map_fragment"), { name: "Fragmento de Mapa", rarity: "rare" },
      "rarity previously observed in the real Bag is retained for sold historical drops");
    assert.equal(lootItemCatalogSignature([{ itemId: "map_fragment" }], catalog).includes("rare"), true);
  } finally {
    window.close();
  }
});

test("Bag fallback requires an exact native identity; mismatching, ambiguous, or overlapping names fail closed", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    const inventory = normalizeInventorySnapshot([
      { item_id: "map_fragment", name: "Fragmento de Mapa", qty: 1 },
      { item_id: "map", name: "Mapa", qty: 1 },
      { item_id: "duplicate", name: "Ambiguous Item", qty: 1 }
    ]);
    window.document.body.innerHTML = [
      '<button class="inventory-slot rarity-mythical" data-item-id="other" aria-label="Fragmento de Mapa, 1 units"></button>',
      '<button class="inventory-slot rarity-rare" aria-label="Fragmento de Mapa Especial, 1 units"></button>',
      '<button class="inventory-slot rarity-uncommon" aria-label="Mapa Fragmentado, 1 units"></button>',
      '<button class="inventory-slot rarity-rare" aria-label="Ambiguous Item, 1 units"></button>',
      '<button class="inventory-slot rarity-epic" aria-label="Ambiguous Item, 2 units"></button>'
    ].join("");
    let catalog = createLootItemCatalog(inventory, window.document);
    assert.equal(catalog.get("map_fragment").rarity, "");
    assert.equal(catalog.get("map").rarity, "");
    assert.equal(catalog.get("duplicate").rarity, "");

    const byId = window.document.createElement("button");
    byId.className = "inventory-slot rarity-rare";
    byId.dataset.itemId = "map_fragment";
    byId.setAttribute("aria-label", "Unrelated name");
    window.document.body.appendChild(byId);
    catalog = createLootItemCatalog(inventory, window.document);
    assert.equal(catalog.get("map_fragment").rarity, "rare");
    assert.equal(catalog.get("map").rarity, "");
  } finally {
    window.close();
  }
});

test("Authoritative API rarity takes precedence over the visible native Bag fallback", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    window.document.body.innerHTML = '<button class="inventory-slot rarity-common" data-item-id="map_fragment"></button>';
    const snapshot = normalizeInventorySnapshot([
      { item_id: "map_fragment", name: "Fragmento de Mapa", rarity: "rare", qty: 3 }
    ]);
    assert.equal(createLootItemCatalog(snapshot, window.document).get("map_fragment").rarity, "rare");
  } finally {
    window.close();
  }
});

test("detached native Bag in ReactiveWindows.cached resolves map_fragment Rare after Bag closes", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    const snapshot = normalizeInventorySnapshot({ inventory: [
      { item_id: "map_fragment", name: "Fragmento de Mapa", qty: 2 },
      { item_id: "legendary_fragment_latios", name: "Fragmento do Baú de Latios", qty: 3 }
    ] });
    const detached = window.document.createElement("div");
    detached.className = "inventory-window--slots";
    detached.innerHTML = [
      '<div class="pokeidle-panel__body"><div class="inventory-slot-grid">',
      '<button class="inventory-slot rarity-rare" aria-label="Fragmento de Mapa, 2 unidades"></button>',
      '<button class="inventory-slot rarity-epic" aria-label="Fragmento do Baú de Latios, 3 unidades"></button>',
      '</div></div>'
    ].join("");
    const nativeScene = { _panel: { body: detached.querySelector(".pokeidle-panel__body") }, _items: [
      { id: "map_fragment", name: "Fragmento de Mapa" },
      { id: "legendary_fragment_latios", name: "Fragmento do Baú de Latios" }
    ] };
    const pageWindow = {
      PokeIdle: { ReactiveWindows: { cached: () => [nativeScene] } }
    };
    assert.equal(window.document.querySelectorAll("button.inventory-slot").length, 0,
      "the native Bag is detached from the live document");
    const catalog = createLootItemCatalog(snapshot, window.document, null, pageWindow);
    assert.equal(catalog.get("map_fragment")?.rarity, "rare");
    assert.equal(catalog.get("legendary_fragment_latios")?.rarity, "epic",
      "rarity comes from the slot, never from the legendary_fragment prefix");
  } finally {
    window.close();
  }
});

test("cached native Bag item definitions with explicit rarity can hydrate absent inventory drops", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    const detached = window.document.createElement("div");
    detached.className = "inventory-window--slots";
    detached.innerHTML = '<div class="pokeidle-panel__body"><div class="inventory-slot-grid"></div></div>';
    const pageWindow = {
      SceneManager: { _scene: {
        _panel: { body: detached.querySelector(".pokeidle-panel__body") },
        _items: [{ id: "map_fragment", name: "Fragmento de Mapa", rarity: "RARE" }]
      } }
    };
    const catalog = createLootItemCatalog(normalizeInventorySnapshot([]), window.document, null, pageWindow);
    assert.deepEqual(catalog.get("map_fragment"), { name: "Fragmento de Mapa", rarity: "rare" });
    assert.equal(catalog.has("legendary_fragment_latios"), false,
      "do not guess missing item rarity based on its identifier");
  } finally {
    window.close();
  }
});

test("conflicting cached native definitions cannot be rescued by a later duplicate", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    const root = window.document.createElement("div");
    root.className = "inventory-window--slots";
    root.innerHTML = '<div class="pokeidle-panel__body"><div class="inventory-slot-grid"></div></div>';
    const body = root.querySelector(".pokeidle-panel__body");
    const pageWindow = { PokeIdle: { ReactiveWindows: { cached: () => [
      { _panel: { body }, _items: [{ id: "ambiguous", name: "Ambiguous", rarity: "rare" }] },
      { _panel: { body }, _items: [{ id: "ambiguous", name: "Ambiguous", rarity: "epic" }] },
      { _panel: { body }, _items: [{ id: "ambiguous", name: "Ambiguous", rarity: "rare" }] }
    ] } } };
    const catalog = createLootItemCatalog(normalizeInventorySnapshot([]), window.document, null, pageWindow);
    assert.equal(catalog.get("ambiguous")?.rarity, "");
  } finally {
    window.close();
  }
});

test("duplicate inventory item names never use a name-only Bag rarity to classify two IDs", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    const snapshot = normalizeInventorySnapshot([
      { item_id: "fragment_one", name: "Fragmento", qty: 1 },
      { item_id: "fragment_two", name: "Fragmento", qty: 2 }
    ]);
    window.document.body.innerHTML = '<button class="inventory-slot rarity-rare" aria-label="Fragmento, 2 unidades"></button>';
    let catalog = createLootItemCatalog(snapshot, window.document);
    assert.equal(catalog.get("fragment_one")?.rarity, "");
    assert.equal(catalog.get("fragment_two")?.rarity, "");
    const identified = window.document.createElement("button");
    identified.className = "inventory-slot rarity-epic";
    identified.dataset.itemId = "fragment_two";
    window.document.body.appendChild(identified);
    catalog = createLootItemCatalog(snapshot, window.document);
    assert.equal(catalog.get("fragment_one")?.rarity, "");
    assert.equal(catalog.get("fragment_two")?.rarity, "epic");
  } finally {
    window.close();
  }
});

test("conflicting native definitions reject stale prior rarity and a matching Bag slot", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    const root = window.document.createElement("div");
    root.className = "inventory-window--slots";
    root.innerHTML = [
      '<div class="pokeidle-panel__body"><div class="inventory-slot-grid">',
      '<button class="inventory-slot rarity-rare" data-item-id="map_fragment"></button>',
      '</div></div>'
    ].join("");
    const body = root.querySelector(".pokeidle-panel__body");
    const pageWindow = { PokeIdle: { ReactiveWindows: { cached: () => [
      { _panel: { body }, _items: [{ id: "map_fragment", name: "Fragmento de Mapa", rarity: "rare" }] },
      { _panel: { body }, _items: [{ id: "map_fragment", name: "Fragmento de Mapa", rarity: "epic" }] }
    ] } } };
    const item = { item_id: "map_fragment", name: "Fragmento de Mapa", qty: 1 };
    const previous = new Map([["map_fragment", { name: "Fragmento de Mapa", rarity: "rare" }]]);
    const disputed = createLootItemCatalog(normalizeInventorySnapshot([item]), window.document, previous, pageWindow);
    assert.equal(disputed.get("map_fragment")?.rarity, "",
      "unresolved native conflict cannot be recovered from a stale prior value or the slot");
    const authoritative = createLootItemCatalog(normalizeInventorySnapshot([
      { ...item, rarity: "rare" }
    ]), window.document, previous, pageWindow);
    assert.equal(authoritative.get("map_fragment")?.rarity, "rare",
      "direct Inventory API evidence can resolve a native conflict");
  } finally {
    window.close();
  }
});

test("Pokémon slots and internally conflicting native slot rarities fail closed", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    window.document.body.innerHTML = [
      '<button class="inventory-slot inventory-slot--pokemon rarity-rare" data-item-id="item_one"></button>',
      '<button class="inventory-slot rarity-rare rarity-mythical" data-item-id="item_two"></button>',
      '<button class="inventory-slot rarity-rare" data-rarity="epic" data-item-id="item_three"></button>'
    ].join("");
    const catalog = createLootItemCatalog(normalizeInventorySnapshot([
      { item_id: "item_one", name: "Item One" },
      { item_id: "item_two", name: "Item Two" },
      { item_id: "item_three", name: "Item Three" }
    ]), window.document);
    for (const itemId of ["item_one", "item_two", "item_three"]) {
      assert.equal(catalog.get(itemId)?.rarity, "", `${itemId} must not be classified`);
    }
  } finally {
    window.close();
  }
});

test("conflicting identified slots cannot be overridden by a name-only native slot", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    window.document.body.innerHTML = [
      '<button class="inventory-slot rarity-rare" data-item-id="map_fragment"></button>',
      '<button class="inventory-slot rarity-epic" data-item-id="map_fragment"></button>',
      '<button class="inventory-slot rarity-rare" aria-label="Fragmento de Mapa, 1 unidades"></button>'
    ].join("");
    const previous = new Map([["map_fragment", { name: "Fragmento de Mapa", rarity: "rare" }]]);
    const catalog = createLootItemCatalog(normalizeInventorySnapshot([
      { item_id: "map_fragment", name: "Fragmento de Mapa", qty: 1 }
    ]), window.document, previous);
    assert.equal(catalog.get("map_fragment")?.rarity, "");
    assert.equal(createLootItemCatalog(normalizeInventorySnapshot([
      { item_id: "map_fragment", name: "Fragmento de Mapa", rarity: "rare", qty: 1 }
    ]), window.document, previous).get("map_fragment")?.rarity, "rare",
    "direct Inventory API rarity is authoritative even when native slots disagree");
  } finally {
    window.close();
  }
});

test("conflicting name-only slots cannot resurrect a previous rarity", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    window.document.body.innerHTML = [
      '<button class="inventory-slot rarity-rare" aria-label="Fragmento de Mapa, 2 unidades"></button>',
      '<button class="inventory-slot rarity-epic" aria-label="Fragmento de Mapa, 2 unidades"></button>'
    ].join("");
    const snapshot = normalizeInventorySnapshot([
      { item_id: "map_fragment", name: "Fragmento de Mapa", qty: 2 }
    ]);
    const previous = new Map([["map_fragment", { name: "Fragmento de Mapa", rarity: "rare" }]]);
    const catalog = createLootItemCatalog(snapshot, window.document, previous);
    assert.equal(catalog.get("map_fragment")?.rarity, "");
  } finally {
    window.close();
  }
});

test("throwing cached scenes and native slot getters do not block valid inventory rarity", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    const root = window.document.createElement("div");
    root.className = "inventory-window--slots";
    root.innerHTML = '<div class="pokeidle-panel__body"><div class="inventory-slot-grid"></div></div>';
    const body = root.querySelector(".pokeidle-panel__body");
    const brokenScene = { get _panel() { throw new Error("scene was disposed"); } };
    const brokenItems = { _panel: { body }, get _items() { throw new Error("items were disposed"); } };
    const validScene = { _panel: { body }, _items: [
      { id: "map_fragment", name: "Fragmento de Mapa", rarity: "rare" },
      { get item_id() { throw new Error("item was disposed"); } }
    ] };
    const pageWindow = { PokeIdle: { ReactiveWindows: { cached: () => [brokenScene, brokenItems, validScene] } } };
    assert.doesNotThrow(() => createLootItemCatalog(normalizeInventorySnapshot([
      { item_id: "safe", name: "Safe", rarity: "common" }
    ]), window.document, null, pageWindow));
    const catalog = createLootItemCatalog(normalizeInventorySnapshot([]), window.document, null, pageWindow);
    assert.equal(catalog.get("map_fragment")?.rarity, "rare");
  } finally {
    window.close();
  }
});

test("Bag slot evidence is indexed once per catalog refresh, not once per item", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    const items = Array.from({ length: 200 }, (_, i) => ({
      item_id: `bounded_item_${i}`, name: `Bounded Item ${i}`, qty: 1
    }));
    let ariaReads = 0;
    for (let i = 0; i < 200; i += 1) {
      const slot = window.document.createElement("button");
      slot.className = "inventory-slot rarity-common";
      slot.setAttribute("aria-label", `Bounded Item ${i}, 1 units`);
      const get = slot.getAttribute.bind(slot);
      slot.getAttribute = (name) => {
        if (name === "aria-label") ariaReads += 1;
        return get(name);
      };
      window.document.body.appendChild(slot);
    }
    const catalog = createLootItemCatalog(normalizeInventorySnapshot(items), window.document);
    assert.equal(catalog.size, 200);
    assert.equal(catalog.get("bounded_item_199")?.rarity, "common");
    assert.ok(ariaReads <= 200, `expected <=200 slot aria reads, received ${ariaReads}`);
  } finally {
    window.close();
  }
});

test("catalog reader skips normal 1s ticks and refreshes on inventory updates or native cache interval", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  try {
    let clock = 10_000;
    let calls = 0;
    let snapshot = normalizeInventorySnapshot([
      { item_id: "map_fragment", name: "Fragmento de Mapa", qty: 1 }
    ], 123);
    const pageWindow = { PokeIdle: { ReactiveWindows: { cached: () => {
      calls += 1;
      return [];
    } } } };
    const reader = createLootItemCatalogReader({
      getSnapshot: () => snapshot,
      getPageDocument: () => window.document,
      getPageWindow: () => pageWindow,
      now: () => clock,
      refreshIntervalMs: 2_500
    });
    const first = reader();
    assert.equal(calls, 1);
    clock += 1_000;
    assert.equal(reader(), first);
    assert.equal(calls, 1);
    clock += 1_500;
    assert.equal(reader().get("map_fragment")?.rarity, "");
    assert.equal(calls, 2);
    snapshot = normalizeInventorySnapshot([
      { item_id: "map_fragment", name: "Fragmento de Mapa", rarity: "rare", qty: 2 }
    ], 124);
    assert.equal(reader().get("map_fragment")?.rarity, "rare");
    assert.equal(calls, 3, "fresh native inventory overrides throttling");
  } finally {
    window.close();
  }
});
