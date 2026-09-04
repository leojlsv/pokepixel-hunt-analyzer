import assert from "node:assert/strict";
import test from "node:test";

import {
  UI_STATE_V1_KEY,
  UI_STATE_V2_KEY,
  createUiStateStore,
  loadUiState
} from "../../userscript/ui-state.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    snapshot() {
      return Object.fromEntries(values);
    }
  };
}

test("migrates legacy UI state without deleting v1", () => {
  const legacy = {
    open: true,
    view: "history",
    panel: { left: 120, top: 80, width: 620, height: 500 },
    launcher: { left: 900, top: 700 }
  };
  const storage = createStorage({
    [UI_STATE_V1_KEY]: JSON.stringify(legacy)
  });

  const state = loadUiState(storage);

  assert.deepEqual(state.shared, {
    view: "history",
    open: true,
    modeOverride: "auto"
  });
  assert.deepEqual(state.desktop.panel, legacy.panel);
  assert.deepEqual(state.desktop.launcher, legacy.launcher);
  assert.equal(state.mobile.launcher, null);

  const snapshot = storage.snapshot();
  assert.equal(snapshot[UI_STATE_V1_KEY], JSON.stringify(legacy));
  assert.ok(snapshot[UI_STATE_V2_KEY]);
});

test("keeps desktop and mobile geometry isolated", () => {
  const storage = createStorage();
  const store = createUiStateStore(storage);

  store.patchDesktop({ launcher: { left: 100, top: 200 } });
  store.patchMobile({ launcher: { left: 20, top: 30 } });
  store.patchShared({ modeOverride: "mobile", open: true });

  const state = store.read();
  assert.deepEqual(state.desktop.launcher, { left: 100, top: 200 });
  assert.deepEqual(state.mobile.launcher, { left: 20, top: 30 });
  assert.equal(state.shared.modeOverride, "mobile");
  assert.equal(state.shared.open, true);
});

test("normalizes invalid persisted mode override", () => {
  const storage = createStorage({
    [UI_STATE_V2_KEY]: JSON.stringify({
      shared: { view: "current", open: false, modeOverride: "phone" },
      desktop: {},
      mobile: {}
    })
  });

  assert.equal(loadUiState(storage).shared.modeOverride, "auto");
});
