import { test } from "node:test";
import assert from "node:assert/strict";

import { createTabLeadership } from "../../userscript/tab-leadership.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function createMemoryLockManager() {
  let held = false;

  return {
    request(_name, options, callback) {
      assert.equal(options.mode, "exclusive");
      assert.equal(options.ifAvailable, true);

      if (held) return Promise.resolve(callback(null));
      held = true;
      return Promise.resolve(callback({ name: "lock" })).finally(() => {
        held = false;
      });
    }
  };
}

function nextTask() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("acquires an empty lock and refreshes its expiry", () => {
  const storage = createMemoryStorage();
  let now = 1_000;
  const states = [];
  const leadership = createTabLeadership({
    storage,
    key: "lock",
    ttlMs: 6_000,
    tabId: "tab-a",
    lockManager: null,
    now: () => now,
    onChange: (active) => states.push(active)
  });

  assert.equal(leadership.refresh(), true);
  assert.equal(leadership.isActive(), true);
  assert.deepEqual(JSON.parse(storage.getItem("lock")), {
    tabId: "tab-a",
    expiresAt: 7_000
  });
  assert.deepEqual(states, [true]);

  now = 2_000;
  leadership.refresh();
  assert.equal(JSON.parse(storage.getItem("lock")).expiresAt, 8_000);
  assert.deepEqual(states, [true]);
});

test("does not take a live lock owned by another tab", () => {
  const storage = createMemoryStorage();
  storage.setItem("lock", JSON.stringify({ tabId: "tab-a", expiresAt: 7_000 }));

  const leadership = createTabLeadership({
    storage,
    key: "lock",
    ttlMs: 6_000,
    tabId: "tab-b",
    lockManager: null,
    now: () => 2_000
  });

  assert.equal(leadership.refresh(), false);
  assert.equal(leadership.isActive(), false);
  assert.equal(JSON.parse(storage.getItem("lock")).tabId, "tab-a");
});

test("takes over an expired lock", () => {
  const storage = createMemoryStorage();
  storage.setItem("lock", JSON.stringify({ tabId: "tab-a", expiresAt: 7_000 }));

  const leadership = createTabLeadership({
    storage,
    key: "lock",
    ttlMs: 6_000,
    tabId: "tab-b",
    lockManager: null,
    now: () => 7_001
  });

  assert.equal(leadership.refresh(), true);
  assert.deepEqual(JSON.parse(storage.getItem("lock")), {
    tabId: "tab-b",
    expiresAt: 13_001
  });
});

test("release removes only the current tab lock", () => {
  const storage = createMemoryStorage();
  const leadership = createTabLeadership({
    storage,
    key: "lock",
    tabId: "tab-a",
    lockManager: null,
    now: () => 1_000
  });

  leadership.refresh();
  leadership.release();
  assert.equal(storage.getItem("lock"), null);
  assert.equal(leadership.isActive(), false);

  storage.setItem("lock", JSON.stringify({ tabId: "tab-b", expiresAt: 10_000 }));
  leadership.release();
  assert.equal(JSON.parse(storage.getItem("lock")).tabId, "tab-b");
});

test("Web Locks keeps only one tab ACTIVE during simultaneous acquisition", async () => {
  const storage = createMemoryStorage();
  const lockManager = createMemoryLockManager();
  const statesA = [];
  const statesB = [];
  const tabA = createTabLeadership({
    storage,
    key: "lock",
    tabId: "tab-a",
    now: () => 1_000,
    lockManager,
    onChange: (active) => statesA.push(active)
  });
  const tabB = createTabLeadership({
    storage,
    key: "lock",
    tabId: "tab-b",
    now: () => 1_000,
    lockManager,
    onChange: (active) => statesB.push(active)
  });

  tabA.refresh();
  tabB.refresh();
  await nextTask();

  assert.equal(tabA.isActive(), true);
  assert.equal(tabB.isActive(), false);
  assert.deepEqual(statesA, [true]);
  assert.deepEqual(statesB, []);

  tabA.release();
  await nextTask();
  tabB.refresh();
  await nextTask();

  assert.equal(tabA.isActive(), false);
  assert.equal(tabB.isActive(), true);
  tabB.release();
  await nextTask();
});

test("fallback lease immediately drops ACTIVE when ownership was replaced", () => {
  const storage = createMemoryStorage();
  const states = [];
  const leadership = createTabLeadership({
    storage,
    key: "lock",
    tabId: "tab-a",
    now: () => 1_000,
    lockManager: null,
    onChange: (active) => states.push(active)
  });

  leadership.refresh();
  storage.setItem("lock", JSON.stringify({ tabId: "tab-b", expiresAt: 9_000 }));

  assert.equal(leadership.isActive(), false);
  assert.deepEqual(states, [true, false]);
});
