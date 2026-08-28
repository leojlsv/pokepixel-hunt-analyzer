import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createPotionUsageTracker,
  POTION_USAGE_STORAGE_KEY
} from "../../userscript/closed-hud-runtime.js";
import { normalizeInventorySnapshot } from "../../userscript/inventory-state.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function potionSnapshot(itemId, qty) {
  return normalizeInventorySnapshot([
    {
      item_id: itemId,
      name: "Hyper Potion",
      type: "potion",
      qty
    }
  ]);
}

test("Potion usage tracker counts inventory decreases and ignores refills", () => {
  const storage = createMemoryStorage();
  const tracker = createPotionUsageTracker({ storage });

  tracker.reconcile("hunt-1", potionSnapshot("potion_hyper", 100));
  assert.equal(tracker.getUsage("potion_hyper"), 0);

  tracker.reconcile("hunt-1", potionSnapshot("potion_hyper", 97));
  assert.equal(tracker.getUsage("potion_hyper"), 3);

  tracker.reconcile("hunt-1", potionSnapshot("potion_hyper", 120));
  assert.equal(tracker.getUsage("potion_hyper"), 3);

  tracker.reconcile("hunt-1", potionSnapshot("potion_hyper", 118));
  assert.equal(tracker.getUsage("potion_hyper"), 5);
  assert.ok(storage.getItem(POTION_USAGE_STORAGE_KEY));
});

test("Potion usage tracker survives reload and resets on a new Hunt", () => {
  const storage = createMemoryStorage();
  const first = createPotionUsageTracker({ storage });

  first.reconcile("hunt-1", potionSnapshot("potion_hyper", 50));
  first.reconcile("hunt-1", potionSnapshot("potion_hyper", 44));
  assert.equal(first.getUsage("potion_hyper"), 6);

  const reloaded = createPotionUsageTracker({ storage });
  reloaded.reconcile("hunt-1", potionSnapshot("potion_hyper", 42));
  assert.equal(reloaded.getUsage("potion_hyper"), 8);

  reloaded.reconcile("hunt-2", potionSnapshot("potion_hyper", 42));
  assert.equal(reloaded.getUsage("potion_hyper"), 0);
});

test("Potion usage tracker counts an item reaching zero when the API omits it", () => {
  const tracker = createPotionUsageTracker();

  tracker.reconcile("hunt-1", potionSnapshot("potion_hyper", 4));
  tracker.reconcile("hunt-1", normalizeInventorySnapshot([]));

  assert.equal(tracker.getUsage("potion_hyper"), 4);
});
