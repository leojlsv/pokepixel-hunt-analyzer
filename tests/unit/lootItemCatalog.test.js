import test from "node:test";
import assert from "node:assert/strict";

import {
  createLootItemCatalog,
  inventoryItemRarity,
  knownLootItemRarity,
  lootItemCatalogSignature
} from "../../userscript/loot-item-catalog.js";

test("items.json is the loot metadata authority and normalizes game rarity labels", () => {
  const catalog = createLootItemCatalog([
    { id: "map_fragment", name: "Fragmento de Mapa", rarity: "raro" },
    { id: "reference_tm_disk_piece", name: "TM Disk Piece", rarity: "épico" },
    { id: "reference_ancient", name: "Ancient", rarity: "LENDÁRIO" },
    { id: "reference_common", name: "Common", rarity: "Comum" },
    { id: "boost_shiny_spawn_1h", name: "Incenso Shiny", rarity: "premium" }
  ]);

  assert.deepEqual(catalog.get("map_fragment"), {
    name: "Fragmento de Mapa",
    rarity: "rare"
  });
  assert.equal(catalog.get("reference_tm_disk_piece")?.rarity, "epic");
  assert.equal(catalog.get("reference_ancient")?.rarity, "legendary");
  assert.equal(catalog.get("reference_common")?.rarity, "common");
  assert.equal(catalog.get("boost_shiny_spawn_1h")?.rarity, "",
    "unsupported non-loot tiers stay unclassified");
});

test("loot catalog only accepts the received flat items.json array", () => {
  assert.equal(createLootItemCatalog({
    items: [{ id: "map_fragment", name: "Fragmento de Mapa", rarity: "raro" }]
  }).size, 0);
  assert.equal(createLootItemCatalog({
    ready: true,
    items: [{ item_id: "map_fragment", name: "Fragmento de Mapa", rarity: "rare" }]
  }).size, 0, "Inventory snapshots cannot become a loot rarity fallback");
});

test("catalog keeps missing rarity unknown and never infers from item id or name", () => {
  const catalog = createLootItemCatalog([
    { id: "legendary_fragment_latios", name: "Fragmento do Baú de Latios" },
    { id: "reference_rare_by_name", name: "Rare Looking Item", rarity: "unknown" }
  ]);
  assert.equal(catalog.get("legendary_fragment_latios")?.rarity, "");
  assert.equal(catalog.get("reference_rare_by_name")?.rarity, "");
});

test("malformed items.json entries are bounded to valid ids and names", () => {
  const catalog = createLootItemCatalog([
    null,
    {},
    { id: "   " },
    { id: "reference_valid", name: "   ", rarity: "incomum" },
    { item_id: "legacy_id", name: "Legacy", rarity: "mítico" }
  ]);
  assert.deepEqual([...catalog.entries()], [
    ["reference_valid", { name: "reference_valid", rarity: "uncommon" }],
    ["legacy_id", { name: "Legacy", rarity: "mythical" }]
  ]);
});

test("known rarity aliases cover the labels present in game item metadata", () => {
  for (const [actual, expected] of Object.entries({
    fraco: "weak", fraca: "weak", comum: "common", incomum: "uncommon",
    raro: "rare", rara: "rare", epico: "epic", "épico": "epic",
    epica: "epic", "épica": "epic", lendario: "legendary",
    "lendário": "legendary", lendaria: "legendary", "lendária": "legendary",
    mitico: "mythical", "mítico": "mythical", mitica: "mythical", "mítica": "mythical"
  })) {
    assert.equal(knownLootItemRarity(actual), expected);
    assert.equal(knownLootItemRarity(actual.toUpperCase()), expected);
  }
  assert.equal(knownLootItemRarity("premium"), "");
  assert.equal(knownLootItemRarity("unknown"), "");
});

test("inventory rarity parsing remains available for inventory HUD normalization only", () => {
  assert.equal(inventoryItemRarity({ rarity: "", item: { rarity: "Rara" } }), "rare");
  assert.equal(inventoryItemRarity({ tier: "épico" }), "epic");
});

test("catalog signature changes when items.json metadata changes", () => {
  const items = [{ itemId: "map_fragment" }];
  const before = createLootItemCatalog([
    { id: "map_fragment", name: "Fragmento de Mapa", rarity: "comum" }
  ]);
  const after = createLootItemCatalog([
    { id: "map_fragment", name: "Fragmento de Mapa", rarity: "raro" }
  ]);
  assert.notEqual(lootItemCatalogSignature(items, before), lootItemCatalogSignature(items, after));
});
