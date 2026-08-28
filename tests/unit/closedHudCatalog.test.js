import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CLOSED_HUD_WIDGETS,
  closedHudDisplay,
  deriveClosedHudState,
  formatHudMetric
} from "../../userscript/closed-hud.js";
import { normalizeInventorySnapshot } from "../../userscript/inventory-state.js";

test("closed HUD catalog exposes the approved non-redundant widgets", () => {
  const ids = new Set(CLOSED_HUD_WIDGETS.map((widget) => widget.id));

  for (const id of [
    "seen",
    "seenPerHour",
    "huntTime",
    "captured",
    "failed",
    "captureRate",
    "rarityTracker",
    "shinyTracker",
    "rarePlusAttempts",
    "rarePlusCaptured",
    "rarePlusFailed",
    "highestIv",
    "trainerXpPerHour",
    "pokemonXpPerHour",
    "dollar",
    "dollarPerHour",
    "profit",
    "profitPerHour",
    "expenses",
    "totalBallsUsed",
    "ballTracker",
    "ballSuccess",
    "ballFailed",
    "ballCaptureRate",
    "ballCost",
    "potionTracker"
  ]) {
    assert.equal(ids.has(id), true, `missing ${id}`);
  }

  assert.equal(ids.has("shinySeen"), false);
  assert.equal(ids.has("shinyCaptured"), false);
  assert.equal(ids.has("capturedRarities"), false);
});

test("deriveClosedHudState aggregates economy, Rare+, IV and per-ball metrics", () => {
  const derived = deriveClosedHudState({
    metrics: {
      gold: 48_900,
      goldPerHour: 61_800,
      expenses: 3_300,
      activeMs: 45 * 60 * 1000,
      rarities: {
        rare: { captured: 1, failed: 2 },
        epic: { captured: 1, failed: 1 },
        legendary: { captured: 1, failed: 0 },
        mythical: { captured: 0, failed: 1 }
      }
    },
    encounters: [
      {
        captureResult: "success",
        capsuleItemId: "capsule_ultra",
        supplyCost: 100,
        ivTotal: 176
      },
      {
        captureResult: "failed",
        capsuleItemId: "capsule_ultra",
        supplyCost: 100,
        ivTotal: 160
      },
      {
        captureResult: "failed",
        capsuleItemId: "capsule_super",
        supplyCost: 50,
        ivTotal: null
      }
    ]
  });

  assert.equal(derived.dollar, 48_900);
  assert.equal(derived.profit, 45_600);
  assert.equal(derived.profitPerHour, 60_800);
  assert.equal(derived.rarePlusCaptured, 3);
  assert.equal(derived.rarePlusFailed, 4);
  assert.equal(derived.rarePlusAttempts, 7);
  assert.equal(derived.highestIv, 176);
  assert.equal(derived.totalBallsUsed, 3);
  assert.deepEqual(derived.ballStats.get("capsule_ultra"), {
    used: 2,
    success: 1,
    failed: 1,
    cost: 200
  });
});

test("approved economy formatting remains compact and signed", () => {
  const derived = deriveClosedHudState({
    metrics: {
      gold: 48_900,
      goldPerHour: 61_800,
      expenses: 3_300,
      activeMs: 45 * 60 * 1000
    }
  });

  assert.equal(formatHudMetric(3_010_000), "3.01M");
  assert.equal(closedHudDisplay({ widget: "dollar" }, derived, null).value, "48.9K");
  assert.equal(closedHudDisplay({ widget: "dollarPerHour" }, derived, null).value, "61.8K");
  assert.equal(closedHudDisplay({ widget: "profit" }, derived, null).value, "+45.6K");
});

test("per-ball widgets use the selected capsule and share the same attempt base", () => {
  const inventory = normalizeInventorySnapshot([
    { item_id: "capsule_ultra", name: "Ultra Ball", type: "capsule", qty: 1_953 }
  ]);
  const derived = deriveClosedHudState({
    encounters: [
      { captureResult: "success", capsuleItemId: "capsule_ultra", supplyCost: 100 },
      { captureResult: "failed", capsuleItemId: "capsule_ultra", supplyCost: 100 }
    ]
  });
  const slot = { itemId: "capsule_ultra" };

  assert.equal(closedHudDisplay({ ...slot, widget: "ballTracker" }, derived, inventory).secondaryValue, "↓2");
  assert.equal(closedHudDisplay({ ...slot, widget: "ballSuccess" }, derived, inventory).value, "✓1");
  assert.equal(closedHudDisplay({ ...slot, widget: "ballFailed" }, derived, inventory).value, "✕1");
  assert.equal(closedHudDisplay({ ...slot, widget: "ballCaptureRate" }, derived, inventory).value, "50.00%");
  assert.equal(closedHudDisplay({ ...slot, widget: "ballCost" }, derived, inventory).value, "$200");
});

test("Potion Tracker renders per-item used count when runtime usage is supplied", () => {
  const inventory = normalizeInventorySnapshot([
    { item_id: "potion_hyper", name: "Hyper Potion", type: "potion", qty: 1_500 }
  ]);
  const derived = deriveClosedHudState();
  derived.potionUsage = new Map([["potion_hyper", 3]]);

  const display = closedHudDisplay(
    { widget: "potionTracker", itemId: "potion_hyper" },
    derived,
    inventory
  );

  assert.equal(display.value, "1.500");
  assert.equal(display.secondaryValue, "↓3");
});
