import { test } from "node:test";
import assert from "node:assert/strict";

import {
  closedHudConfigForPreset,
  closedHudDisplay,
  closedHudWidgetSize,
  deriveClosedHudState,
  formatHudQuantity,
  normalizeClosedHudConfig
} from "../../userscript/closed-hud.js";
import {
  normalizeInventorySnapshot,
  decrementInventoryItem
} from "../../userscript/inventory-state.js";

test("closed HUD default preset uses a two-slot Rarity Tracker", () => {
  const config = closedHudConfigForPreset("default");

  assert.equal(config.preset, "default");
  assert.deepEqual(
    config.slots.map((slot) => slot.widget),
    ["seen", "seenPerHour", "rarityTracker", "empty"]
  );
  assert.equal(closedHudWidgetSize("rarityTracker"), 2);
  assert.equal(config.slots[2].size, 2);
  assert.equal(config.slots[2].showFailed, false);
  assert.equal(config.slots[2].rarityKeys.length, 7);
});

test("legacy Captured Rarities config migrates to Rarity Tracker", () => {
  const config = normalizeClosedHudConfig({
    preset: "custom",
    slots: [
      { widget: "seen" },
      { widget: "seenPerHour" },
      { widget: "capturedRarities" },
      { widget: "empty" }
    ]
  });

  assert.equal(config.slots[2].widget, "rarityTracker");
  assert.equal(config.slots[2].size, 2);
  assert.equal(config.slots[3].widget, "empty");
});

test("legacy Shiny Captured config migrates to combined Shiny Tracker", () => {
  const config = normalizeClosedHudConfig({
    preset: "custom",
    slots: [
      { widget: "shinyCaptured", shinyMode: "captured" },
      { widget: "seen" },
      { widget: "captured" },
      { widget: "failed" }
    ]
  });

  assert.equal(config.slots[0].widget, "shinyTracker");
  assert.equal(config.slots[0].shinyMode, undefined);
});

test("closed HUD config falls back from unknown widgets without breaking four-slot shape", () => {
  const config = normalizeClosedHudConfig({
    preset: "custom",
    slots: [
      { widget: "seen" },
      { widget: "does-not-exist" }
    ]
  });

  assert.equal(config.preset, "custom");
  assert.equal(config.slots.length, 4);
  assert.equal(config.slots[0].widget, "seen");
  assert.equal(config.slots[1].widget, "seenPerHour");
});

test("two-slot Rarity Tracker normalizes to row start and consumes paired slot", () => {
  const config = normalizeClosedHudConfig({
    preset: "custom",
    slots: [
      { widget: "seen" },
      {
        widget: "rarityTracker",
        size: 2,
        rarityKeys: ["rare", "epic", "legendary", "mythical"],
        showFailed: true
      },
      { widget: "captured" },
      { widget: "failed" }
    ]
  });

  assert.equal(config.slots[0].widget, "rarityTracker");
  assert.equal(config.slots[0].size, 2);
  assert.deepEqual(config.slots[0].rarityKeys, ["rare", "epic", "legendary", "mythical"]);
  assert.equal(config.slots[0].showFailed, true);
  assert.equal(config.slots[1].widget, "empty");
});

test("one-slot Rarity Tracker leaves the paired indicator available", () => {
  const config = normalizeClosedHudConfig({
    preset: "custom",
    slots: [
      {
        widget: "rarityTracker",
        size: 1,
        rarityKeys: ["legendary", "mythical"],
        showFailed: true
      },
      { widget: "profitPerHour" },
      { widget: "seen" },
      { widget: "captured" }
    ]
  });

  assert.equal(config.slots[0].size, 1);
  assert.equal(config.slots[1].widget, "profitPerHour");
});

test("adaptive HUD quantity formatting remains available for non-inventory metrics", () => {
  assert.equal(formatHudQuantity(999), "999");
  assert.equal(formatHudQuantity(2_300), "2.3K");
  assert.equal(formatHudQuantity(52_320), "52K");
  assert.equal(formatHudQuantity(3_164, { micro: true }), "3K");
  assert.equal(formatHudQuantity(3_480_000), "3.5M");
});

test("Seen is abbreviated while Captured remains exact", () => {
  const derived = deriveClosedHudState({ metrics: { seen: 12_345, captured: 12_345 } });

  const seen = closedHudDisplay({ widget: "seen" }, derived, null);
  const captured = closedHudDisplay({ widget: "captured" }, derived, null);

  assert.equal(seen.value, "12K");
  assert.equal(seen.compactValue, undefined);
  assert.equal(captured.value, "12.345");
  assert.equal(captured.compactValue, undefined);
});

test("deriveClosedHudState computes financial rate, ball usage and rarity seen/captured/failed maps", () => {
  const state = deriveClosedHudState({
    metrics: {
      seen: 100,
      captured: 2,
      failed: 98,
      seenPerHour: 500,
      seenToCaptureRate: 0.02,
      trainerExpPerHour: 3_000_000,
      pokemonExpPerHour: 2_500_000,
      goldPerHour: 50_000,
      gold: 20_000,
      expenses: 5_000,
      activeMs: 30 * 60 * 1000,
      rarities: {
        rare: { seen: 33, captured: 1, failed: 2, shinyCaptured: 0 },
        epic: { seen: 9, captured: 0, failed: 1, shinyCaptured: 0 },
        legendary: { seen: 2, captured: 0, failed: 0, shinyCaptured: 0 },
        mythical: { seen: 1, captured: 0, failed: 0, shinyCaptured: 0 },
        common: { seen: 55, captured: 1, failed: 90, shinyCaptured: 1 }
      }
    },
    encounters: [
      { captureResult: "success", capsuleItemId: "capsule_ultra" },
      { captureResult: "failed", capsuleItemId: "capsule_ultra" },
      { captureResult: "failed", capsuleItemId: "capsule_super" },
      { captureResult: "none", capsuleItemId: "capsule_ultra" }
    ]
  });

  assert.equal(state.profitPerHour, 30_000);
  assert.equal(state.totalBallsUsed, 3);
  assert.equal(state.ballUsage.get("capsule_ultra"), 2);
  assert.equal(state.ballUsage.get("capsule_super"), 1);
  assert.equal(state.raritySeen.rare, 33);
  assert.equal(state.rarityCaptured.rare, 1);
  assert.equal(state.rarityFailed.rare, 2);
  assert.equal(state.rarePlusFailed, 3);
  assert.equal(state.shinyCaptured, 1);
});

test("Shiny Tracker always exposes Seen/Captured pair with abbreviated Seen", () => {
  const derived = deriveClosedHudState({
    metrics: {
      shiny: { seen: 12_345, captured: 37, failed: 4 },
      rarities: {}
    }
  });

  const display = closedHudDisplay({ widget: "shinyTracker" }, derived, null);

  assert.equal(display.kind, "shiny");
  assert.equal(display.seenValue, "12K");
  assert.equal(display.capturedValue, "37");
  assert.equal(display.title, "Shiny — Seen: 12.345 · Captured: 37");
  assert.equal(display.value, undefined);
  assert.equal(display.label, undefined);
});

test("Rarity Tracker exposes Seen/Captured and optionally Failed", () => {
  const derived = deriveClosedHudState({
    metrics: {
      rarities: {
        rare: { seen: 12_345, captured: 12, failed: 31 },
        epic: { seen: 987, captured: 4, failed: 9 },
        legendary: { seen: 43, captured: 1, failed: 2 },
        mythical: { seen: 8, captured: 0, failed: 1 }
      }
    }
  });

  const display = closedHudDisplay({
    widget: "rarityTracker",
    size: 1,
    rarityKeys: ["legendary", "mythical"],
    showFailed: true
  }, derived, null);

  assert.equal(display.kind, "rarities");
  assert.equal(display.size, 1);
  assert.equal(display.showFailed, true);
  assert.deepEqual(display.rarities.map((rarity) => rarity.key), ["legendary", "mythical"]);
  assert.deepEqual(
    display.rarities.map(({ seen, captured, failed }) => [seen, captured, failed]),
    [[43, 1, 2], [8, 0, 1]]
  );
  assert.equal(formatHudQuantity(12_345), "12K");
  assert.equal(display.rarities[0].captured, 1);
});

test("inventory snapshot classifies capsules and potions and preserves authoritative quantity", () => {
  const snapshot = normalizeInventorySnapshot([
    {
      item_id: "capsule_ultra",
      name: "Ultra Ball",
      type: "capsule",
      qty: 4562,
      quantity: 4562
    },
    {
      item_id: "potion_hyper",
      name: "Hyper Potion",
      category: "potion",
      qty: 1276
    },
    {
      item_id: "reference_horn",
      name: "Horn",
      type: "collectible",
      qty: 1
    }
  ], 123);

  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.updatedAtMs, 123);
  assert.equal(snapshot.capsules.length, 1);
  assert.equal(snapshot.potions.length, 1);
  assert.equal(snapshot.byId.get("capsule_ultra").qty, 4562);
  assert.equal(snapshot.byId.get("potion_hyper").quantity, 1276);
});

test("local capture reconciliation decrements remaining ball until next inventory snapshot", () => {
  const snapshot = normalizeInventorySnapshot([
    { item_id: "capsule_ultra", name: "Ultra Ball", type: "capsule", qty: 10 }
  ]);

  const next = decrementInventoryItem(snapshot, "capsule_ultra", 1);

  assert.notEqual(next, snapshot);
  assert.equal(next.byId.get("capsule_ultra").qty, 9);
  assert.equal(snapshot.byId.get("capsule_ultra").qty, 10);
});

test("Ball Tracker never rounds authoritative remaining inventory", () => {
  const inventory = normalizeInventorySnapshot([
    { item_id: "capsule_super", name: "Super Ball", type: "capsule", qty: 1953 }
  ]);
  const derived = deriveClosedHudState({
    metrics: {},
    encounters: Array.from({ length: 3506 }, () => ({
      captureResult: "failed",
      capsuleItemId: "capsule_super"
    }))
  });

  const display = closedHudDisplay(
    { widget: "ballTracker", itemId: "capsule_super" },
    derived,
    inventory
  );

  assert.equal(display.label, "Super");
  assert.equal(display.kind, "inventory");
  assert.equal(display.value, "1.953");
  assert.equal(display.secondaryValue, "↓3.506");
  assert.equal(display.compactValue, undefined);
  assert.match(display.title, /1\.953 remaining/);
  assert.match(display.title, /3\.506 used/);
});

test("Potion Tracker keeps remaining inventory exact", () => {
  const inventory = normalizeInventorySnapshot([
    { item_id: "potion_hyper", name: "Hyper Potion", type: "potion", qty: 1276 }
  ]);
  const display = closedHudDisplay(
    { widget: "potionTracker", itemId: "potion_hyper" },
    deriveClosedHudState(),
    inventory
  );

  assert.equal(display.value, "1.276");
  assert.equal(display.secondaryValue, null);
});
