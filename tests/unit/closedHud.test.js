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

test("closed HUD default preset fills four layout units", () => {
  const config = closedHudConfigForPreset("default");

  assert.equal(config.preset, "default");
  assert.deepEqual(
    config.slots.map((slot) => slot.widget),
    ["seen", "seenPerHour", "capturedRarities", "empty"]
  );
  assert.equal(closedHudWidgetSize("capturedRarities"), 2);
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

test("wide widgets normalize to the beginning of their row and consume the paired slot", () => {
  const config = normalizeClosedHudConfig({
    preset: "custom",
    slots: [
      { widget: "seen" },
      { widget: "seenPerHour" },
      { widget: "captured" },
      { widget: "capturedRarities" }
    ]
  });

  assert.deepEqual(
    config.slots.map((slot) => slot.widget),
    ["seen", "seenPerHour", "capturedRarities", "empty"]
  );
});

test("adaptive HUD quantity formatting keeps large values compact", () => {
  assert.equal(formatHudQuantity(999), "999");
  assert.equal(formatHudQuantity(2_300), "2.3K");
  assert.equal(formatHudQuantity(52_320), "52K");
  assert.equal(formatHudQuantity(3_164, { micro: true }), "3K");
  assert.equal(formatHudQuantity(3_480_000), "3.5M");
});

test("deriveClosedHudState computes profit per hour and per-ball usage", () => {
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
        rare: { captured: 1, failed: 2, shinyCaptured: 0 },
        epic: { captured: 0, failed: 1, shinyCaptured: 0 },
        legendary: { captured: 0, failed: 0, shinyCaptured: 0 },
        mythical: { captured: 0, failed: 0, shinyCaptured: 0 },
        common: { captured: 1, failed: 90, shinyCaptured: 1 }
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
  assert.equal(state.rarePlusFailed, 3);
  assert.equal(state.shinyCaptured, 1);
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

test("Ball Tracker exposes full, compact and micro representations", () => {
  const inventory = normalizeInventorySnapshot([
    { item_id: "capsule_super", name: "Super Ball", type: "capsule", qty: 2300 }
  ]);
  const derived = deriveClosedHudState({
    metrics: {},
    encounters: Array.from({ length: 3164 }, () => ({
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
  assert.match(display.value, /2\.300/);
  assert.match(display.value, /↓3\.164/);
  assert.equal(display.compactValue, "2.3K · ↓3.2K");
  assert.equal(display.microValue, "2K/↓3K");
  assert.match(display.title, /2\.300 remaining/);
});
