import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import {
  CURRENT_RARITY_PREFERENCES_KEY,
  readCurrentRarityPreferences,
  saveCurrentRarityPreference
} from "../../userscript/current-rarity-preferences.js";

test("Current rarity selections persist independently, distinguishing All from None", () => {
  const window = new Window({ url: "https://example.test/" });
  try {
    const storage = window.localStorage;
    assert.deepEqual(readCurrentRarityPreferences(storage), { captured: null, failed: null });

    saveCurrentRarityPreference("captured", ["epic", "legendary", "mythical"], storage);
    assert.deepEqual(readCurrentRarityPreferences(storage), {
      captured: ["epic", "legendary", "mythical"], failed: null
    });
    saveCurrentRarityPreference("failed", [], storage);
    assert.deepEqual(readCurrentRarityPreferences(storage), {
      captured: ["epic", "legendary", "mythical"], failed: []
    });
    saveCurrentRarityPreference("captured", null, storage);
    assert.deepEqual(readCurrentRarityPreferences(storage), { captured: null, failed: [] });
    assert.equal(JSON.parse(storage.getItem(CURRENT_RARITY_PREFERENCES_KEY)).captured, null);
  } finally {
    window.happyDOM.abort();
  }
});

test("Current rarity persistence sanitizes malformed, outdated and unavailable storage", () => {
  const window = new Window({ url: "https://example.test/" });
  try {
    const storage = window.localStorage;
    for (const raw of ["not json", "[]", "true", "null", '{"captured":{},"failed":true}']) {
      storage.setItem(CURRENT_RARITY_PREFERENCES_KEY, raw);
      assert.deepEqual(readCurrentRarityPreferences(storage), { captured: null, failed: null });
    }

    storage.setItem(CURRENT_RARITY_PREFERENCES_KEY, JSON.stringify({
      captured: ["mythical", "old-rarity", "mythical", "legendary"],
      failed: ["old-rarity"]
    }));
    assert.deepEqual(readCurrentRarityPreferences(storage), {
      captured: ["mythical", "legendary"], failed: null
    });
    saveCurrentRarityPreference("other-list", ["rare"], storage);
    assert.deepEqual(readCurrentRarityPreferences(storage), {
      captured: ["mythical", "legendary"], failed: null
    });

    const blockedStorage = {
      getItem() { throw new Error("Storage blocked"); },
      setItem() { throw new Error("Storage blocked"); }
    };
    assert.deepEqual(readCurrentRarityPreferences(blockedStorage), { captured: null, failed: null });
    assert.doesNotThrow(() => saveCurrentRarityPreference("captured", ["epic"], blockedStorage));
  } finally {
    window.happyDOM.abort();
  }
});
