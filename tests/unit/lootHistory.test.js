import test from "node:test";
import assert from "node:assert/strict";

import { aggregateLootHistory } from "../../userscript/loot-history-model.js";

const bundles = [
  {
    session: { sessionId: "hunt-1", activityKind: "hunt" },
    encounters: [
      {
        encounterId: "1", speciesId: "pikachu", lootAtMs: 100,
        quality: "common", captureResult: "failed",
        gold: 25, lootSellValue: 12,
        lootItems: [
          { itemId: "reference_straw", qty: 2 },
          { itemId: "reference_straw", qty: 3 },
          { itemId: "rare_dust", qty: 1 }
        ]
      },
      {
        encounterId: "2", speciesId: "eevee", lootAtMs: 110,
        quality: "epic", captureResult: "success",
        gold: 10, lootSellValue: 5, autoSold: true, autoSellValue: 90,
        lootItems: [{ itemId: "reference_straw", qty: 1 }]
      }
    ]
  },
  {
    session: { sessionId: "expedition-1", activityKind: "expedition" },
    encounters: [
      {
        encounterId: "3", speciesId: "pikachu", lootAtMs: 120,
        gold: 5, lootSellValue: 0,
        lootItems: [
          { itemId: "reference_straw", qty: 4 },
          { itemId: "expedition_fragment", qty: 5 }
        ]
      },
      {
        encounterId: "4", speciesId: "pikachu", gold: 2,
        autoSold: false, autoSellValue: 200, lootItems: []
      }
    ]
  }
];

test("Loot History groups each item and counts distinct encounter drops without pricing items", () => {
  const summary = aggregateLootHistory(bundles);

  assert.deepEqual(summary.totals, {
    directGold: 42,
    lootSellValue: 17,
    autoSellValue: 90,
    total: 149
  });
  assert.equal(summary.matchedSessions, 2);
  assert.equal(summary.matchedEncounters, 4);
  assert.equal(summary.lootedEncounters, 3);
  assert.deepEqual(summary.items.map(({ itemId, qty, drops }) => ({ itemId, qty, drops })), [
    { itemId: "reference_straw", qty: 10, drops: 3 },
    { itemId: "expedition_fragment", qty: 5, drops: 1 },
    { itemId: "rare_dust", qty: 1, drops: 1 }
  ]);
  assert.deepEqual(summary.items[0].sources.map(({ speciesId, qty, drops }) => ({ speciesId, qty, drops })), [
    { speciesId: "pikachu", qty: 9, drops: 2 },
    { speciesId: "eevee", qty: 1, drops: 1 }
  ]);
  assert.equal("price" in summary.items[0], false);
  assert.equal("atMs" in summary.items[0], false);
});

test("Loot History session and Pokémon filters scope items and financial totals together", () => {
  const summary = aggregateLootHistory(bundles, {
    sessionId: "hunt-1",
    matchesEncounter: (encounter) => encounter.speciesId === "pikachu"
  });
  assert.deepEqual(summary.totals, {
    directGold: 25,
    lootSellValue: 12,
    autoSellValue: 0,
    total: 37
  });
  assert.equal(summary.matchedSessions, 1);
  assert.equal(summary.matchedEncounters, 1);
  assert.deepEqual(summary.items.map(({ itemId, qty, drops }) => ({ itemId, qty, drops })), [
    { itemId: "reference_straw", qty: 5, drops: 1 },
    { itemId: "rare_dust", qty: 1, drops: 1 }
  ]);
});

test("Loot History keeps trustworthy gold-only rewards and ignores invalid item quantities", () => {
  const summary = aggregateLootHistory([{
    session: { sessionId: "gold-only" },
    encounters: [
      {
        lootAtMs: 10, gold: 17, lootSellValue: 0, autoSellValue: 500,
        lootItems: [{ itemId: "bad", qty: -1 }, { itemId: "bad", qty: 1.5 }]
      },
      {
        lootAtMs: 20, gold: 3, lootSellValue: 7,
        lootItems: [{ item_id: "legacy_drop", qty: 2 }, { itemId: "", qty: 100 }]
      }
    ]
  }]);
  assert.deepEqual(summary.totals, {
    directGold: 20,
    lootSellValue: 7,
    autoSellValue: 0,
    total: 27
  });
  assert.deepEqual(summary.items.map(({ itemId, qty }) => ({ itemId, qty })), [
    { itemId: "legacy_drop", qty: 2 }
  ]);
  assert.equal(summary.lootedEncounters, 2);
  assert.equal(aggregateLootHistory(bundles, { sessionId: "unknown" }).matchedSessions, 0);
});
