import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { Window } from "happy-dom";
import { openDatabase, STORE_NAMES } from "../../data/db.js";
import { createRepository } from "../../data/repository.js";

const EMBED_MARKER = "__POKEPIXEL_HUNT_ANALYZER_EMBED__";
const PUBLIC_SUMMARY = "__POKEPIXEL_HUNT_ANALYZER_PUBLIC__";
const PUBLIC_CONTROL = "__POKEPIXEL_HUNT_ANALYZER_CONTROL__";
const DIAGNOSTICS = "__POKEPIXEL_HUNT_ANALYZER_DIAGNOSTICS__";
const LEADERSHIP_KEY = "pokepixel_hunt_analyzer_active_tab";

class SyntheticWebSocket {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(listener);
    this.listeners.set(type, callbacks);
  }

  emitMessage(payload) {
    for (const callback of this.listeners.get("message") || []) {
      callback({ data: JSON.stringify(payload) });
    }
  }
}

async function waitFor(predicate, { timeoutMs = 2_000, intervalMs = 10 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

async function buildRuntimeBundle() {
  const output = await build({
    entryPoints: [fileURLToPath(new URL("../../userscript/main.js", import.meta.url))],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["chrome114", "firefox128"],
    legalComments: "none",
    minify: false,
    sourcemap: false,
    loader: { ".png": "dataurl" },
    define: {
      __APP_VERSION__: JSON.stringify("1.13.0-test"),
      "process.env.NODE_ENV": '"production"'
    }
  });
  return output.outputFiles[0].text;
}

test("standalone runtime publishes the public Cards contract without suppressing Analyzer UI", async () => {
  const window = new Window({ url: "https://pokepixel.nietore.com/play/" });
  const bundle = await buildRuntimeBundle();

  window.unsafeWindow = window;
  window.indexedDB = new IDBFactory();
  window.IDBKeyRange = IDBKeyRange;
  window.setInterval = () => 1;
  window.clearInterval = () => {};

  try {
    window.eval(bundle);

    const api = await waitFor(() => {
      const candidate = window[PUBLIC_SUMMARY];
      return candidate?.getSummary?.().available === true ? candidate : null;
    });
    const root = await waitFor(() => window.document.getElementById("pokepixel-hunt-analyzer-root"));

    assert.ok(api, "standalone initialization must publish the same bounded Current summary contract");
    assert.equal(api.protocol, 1);
    assert.ok(root, "standalone Analyzer UI must still mount");
    assert.equal(typeof window[DIAGNOSTICS], "function", "standalone diagnostics remain available");
    const control = window[PUBLIC_CONTROL];
    assert.equal(control?.protocol, 1);
    assert.equal(Object.isFrozen(control), true);
  } finally {
    window.dispatchEvent(new window.Event("beforeunload"));
    window.close();
  }
});

test("real embed runtime hydrates the public summary without mounting Analyzer UI", async () => {
  const window = new Window({ url: "https://pokepixel.nietore.com/play/" });
  const scheduledIntervals = [];
  const bundle = await buildRuntimeBundle();

  window[EMBED_MARKER] = { protocol: 1 };
  window.unsafeWindow = window;
  window.indexedDB = new IDBFactory();
  window.IDBKeyRange = IDBKeyRange;
  window.setInterval = (callback, delay, ...args) => {
    const handle = scheduledIntervals.length + 1;
    scheduledIntervals.push({ handle, callback, delay, args, cleared: false });
    return handle;
  };
  window.clearInterval = (handle) => {
    const scheduled = scheduledIntervals.find((entry) => entry.handle === handle);
    if (scheduled) scheduled.cleared = true;
  };

  try {
    window.eval(bundle);

    const api = await waitFor(() => {
      const candidate = window[PUBLIC_SUMMARY];
      return candidate?.getSummary?.().available === true ? candidate : null;
    });

    assert.ok(api, "embed initialization must publish an available Current summary");
    const initial = api.getSummary();
    assert.equal(initial.protocol, 1);
    assert.equal(initial.appVersion, "1.13.0-test");
    assert.equal(initial.available, true);
    assert.equal(initial.status, "waiting");
    assert.equal(initial.seen, 0);
    assert.equal(Number.isFinite(initial.capturedAtMs), true);

    assert.equal(window.document.getElementById("pokepixel-hunt-analyzer-root"), null);
    assert.equal(window[DIAGNOSTICS], undefined);
    const control = window[PUBLIC_CONTROL];
    assert.equal(control?.protocol, 1);
    assert.equal(Object.isFrozen(control), true);

    assert.equal((await control.act("reset")).ok, true);
    assert.equal(api.getSummary().status, "paused");
    assert.equal(api.getSummary().seen, 0);
    assert.equal((await control.act("resume")).ok, true);
    assert.equal(api.getSummary().status, "running");
    assert.equal((await control.act("pause")).ok, true);
    assert.equal(api.getSummary().status, "paused");

    const currentRefresh = scheduledIntervals.find((entry) => entry.delay === 1_000);
    assert.ok(currentRefresh, "embed runtime must schedule the 1s Current refresh");
    const capturedAtMs = initial.capturedAtMs;
    await new Promise((resolve) => setTimeout(resolve, 2));
    currentRefresh.callback(...currentRefresh.args);

    const refreshed = await waitFor(() => {
      const summary = api.getSummary();
      return summary.capturedAtMs > capturedAtMs ? summary : null;
    });
    assert.ok(refreshed, "scheduled embed refresh must renew Analyzer-owned source freshness");
    assert.equal(refreshed.available, true);
  } finally {
    window.dispatchEvent(new window.Event("beforeunload"));
    window.close();
  }
});

test("standby embed startup never applies restart recovery to the active tab's running Hunt", async () => {
  const window = new Window({ url: "https://pokepixel.nietore.com/play/" });
  const bundle = await buildRuntimeBundle();
  const indexedDB = new IDBFactory();
  const now = Date.now();

  window[EMBED_MARKER] = { protocol: 1 };
  window.unsafeWindow = window;
  window.indexedDB = indexedDB;
  window.IDBKeyRange = IDBKeyRange;
  window.localStorage.setItem(LEADERSHIP_KEY, JSON.stringify({
    tabId: "already-active-tab",
    expiresAt: now + 60_000
  }));
  window.setInterval = () => 1;
  window.clearInterval = () => {};

  const seedDb = await openDatabase({ indexedDBFactory: indexedDB });
  const sessions = createRepository(seedDb, STORE_NAMES.SESSIONS);
  const meta = createRepository(seedDb, STORE_NAMES.META);
  const session = {
    sessionId: "running-session",
    status: "running",
    locked: false,
    serverSessionId: "server-1",
    zoneId: "zone-1",
    startedAtMs: now - 10_000,
    endedAtMs: null,
    activeStartedAtMs: now - 10_000,
    accumulatedActiveMs: 0,
    lastActivityAtMs: now - 1_000,
    createdAtMs: now - 10_000,
    updatedAtMs: now - 1_000
  };
  await sessions.put(session);
  await meta.put(session.sessionId, "currentSessionId");
  seedDb.close();

  try {
    window.eval(bundle);

    const summary = await waitFor(() => {
      const candidate = window[PUBLIC_SUMMARY]?.getSummary?.();
      return candidate?.available ? candidate : null;
    });

    assert.ok(summary, "standby embed runtime must still hydrate read-only Current state");
    assert.equal(summary.leadershipActive, false);
    assert.equal(summary.status, "running");

    const verifyDb = await openDatabase({ indexedDBFactory: indexedDB });
    const persisted = await createRepository(verifyDb, STORE_NAMES.SESSIONS).get(session.sessionId);
    assert.equal(persisted.status, "running", "STANDBY startup must not pause shared session state");
    assert.equal(persisted.activeStartedAtMs, session.activeStartedAtMs);
    assert.equal(persisted.accumulatedActiveMs, 0);
    verifyDb.close();
  } finally {
    window.dispatchEvent(new window.Event("beforeunload"));
    window.close();
  }
});

test("startup skips recovery if leadership is lost after acquire but before persistence is ready", async () => {
  const window = new Window({ url: "https://pokepixel.nietore.com/play/" });
  const bundle = await buildRuntimeBundle();
  const indexedDB = new IDBFactory();
  const now = Date.now();

  window[EMBED_MARKER] = { protocol: 1 };
  window.unsafeWindow = window;
  window.indexedDB = indexedDB;
  window.IDBKeyRange = IDBKeyRange;
  window.setInterval = () => 1;
  window.clearInterval = () => {};

  const seedDb = await openDatabase({ indexedDBFactory: indexedDB });
  const sessions = createRepository(seedDb, STORE_NAMES.SESSIONS);
  const meta = createRepository(seedDb, STORE_NAMES.META);
  const session = {
    sessionId: "leadership-race-session",
    status: "running",
    locked: false,
    serverSessionId: "server-1",
    zoneId: "zone-1",
    startedAtMs: now - 10_000,
    endedAtMs: null,
    activeStartedAtMs: now - 10_000,
    accumulatedActiveMs: 0,
    lastActivityAtMs: now - 1_000,
    createdAtMs: now - 10_000,
    updatedAtMs: now - 1_000
  };
  await sessions.put(session);
  await meta.put(session.sessionId, "currentSessionId");
  seedDb.close();

  try {
    window.eval(bundle);
    // acquire() has synchronously claimed the fallback lease before its
    // resolved Promise continues initialize(). Simulate another tab taking
    // ownership during the asynchronous database/bootstrap window.
    window.localStorage.setItem(LEADERSHIP_KEY, JSON.stringify({
      tabId: "takeover-tab",
      expiresAt: now + 60_000
    }));

    const summary = await waitFor(() => {
      const candidate = window[PUBLIC_SUMMARY]?.getSummary?.();
      return candidate?.available ? candidate : null;
    });

    assert.ok(summary, "runtime must still hydrate after losing startup leadership");
    assert.equal(summary.leadershipActive, false);
    assert.equal(summary.status, "running");

    const verifyDb = await openDatabase({ indexedDBFactory: indexedDB });
    const persisted = await createRepository(verifyDb, STORE_NAMES.SESSIONS).get(session.sessionId);
    assert.equal(persisted.status, "running");
    assert.equal(persisted.activeStartedAtMs, session.activeStartedAtMs);
    assert.equal(persisted.accumulatedActiveMs, 0);
    verifyDb.close();
  } finally {
    window.dispatchEvent(new window.Event("beforeunload"));
    window.close();
  }
});

test("queued public session control cannot reset after another tab takes leadership", async () => {
  const window = new Window({ url: "https://pokepixel.nietore.com/play/" });
  const indexedDB = new IDBFactory();
  const bundle = await buildRuntimeBundle();
  window[EMBED_MARKER] = { protocol: 1 };
  window.unsafeWindow = window;
  window.indexedDB = indexedDB;
  window.IDBKeyRange = IDBKeyRange;
  window.setInterval = () => 1;
  window.clearInterval = () => {};

  try {
    window.eval(bundle);
    const control = await waitFor(() => {
      const candidate = window[PUBLIC_CONTROL];
      return candidate && window[PUBLIC_SUMMARY]?.getSummary?.().available ? candidate : null;
    });
    assert.ok(control);
    assert.ok(window.localStorage.getItem(LEADERSHIP_KEY));

    const pendingReset = control.act("reset");
    window.localStorage.setItem(LEADERSHIP_KEY, JSON.stringify({
      tabId: "other-tab",
      expiresAt: Date.now() + 60_000
    }));

    const response = await pendingReset;
    assert.equal(response.ok, false);
    assert.equal(response.reason, "action-unavailable");
    const verifyDb = await openDatabase({ indexedDBFactory: indexedDB });
    const sessions = await createRepository(verifyDb, STORE_NAMES.SESSIONS).getAll();
    verifyDb.close();
    assert.equal(sessions.length, 0, "a stale reset must not create or pause a Hunt");
  } finally {
    window.dispatchEvent(new window.Event("beforeunload"));
    window.close();
  }
});

test("queued protocol event is dropped when leadership changes after enqueue", async () => {
  const window = new Window({ url: "https://pokepixel.nietore.com/play/" });
  const indexedDB = new IDBFactory();
  const bundle = await buildRuntimeBundle();
  window[EMBED_MARKER] = { protocol: 1 };
  window.unsafeWindow = window;
  window.WebSocket = SyntheticWebSocket;
  window.indexedDB = indexedDB;
  window.IDBKeyRange = IDBKeyRange;
  window.setInterval = () => 1;
  window.clearInterval = () => {};
  const storage = window.localStorage;
  const originalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
  let armTakeover = false;
  let markTakeover;
  const takeover = new Promise((resolve) => { markTakeover = resolve; });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem(key) {
        const value = storage.getItem(key);
        if (armTakeover && key === LEADERSHIP_KEY) {
          armTakeover = false;
          queueMicrotask(() => {
            storage.setItem(key, JSON.stringify({
              tabId: "other-tab",
              expiresAt: Date.now() + 60_000
            }));
            markTakeover();
          });
        }
        return value;
      },
      setItem: (key, value) => storage.setItem(key, value),
      removeItem: (key) => storage.removeItem(key)
    }
  });

  try {
    window.eval(bundle);
    const api = await waitFor(() => {
      const candidate = window[PUBLIC_SUMMARY];
      return candidate?.getSummary?.().available ? candidate : null;
    });
    assert.ok(api);
    assert.equal(api.getSummary().leadershipActive, true);

    const socket = new window.WebSocket("wss://example.test");
    assert.equal(window.__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__, true);
    armTakeover = true;

    socket.emitMessage({
      type: "combat.started",
      seq: 77,
      ts: Date.now(),
      data: {
        enemy: { id: "wild-77", species_id: "pidgey", level: 5, quality: "common", zone_id: "route-1" },
        session: { id: "server-hunt" }
      }
    });
    await Promise.race([
      takeover,
      new Promise((_, reject) => setTimeout(() => reject(new Error(
        "protocol callback did not read the leadership lease: " + JSON.stringify({
          raw: window.__POKEPIXEL_HUNT_ANALYZER_WS_STATUS__?.parsedMessages,
          canonical: window.__POKEPIXEL_HUNT_ANALYZER_WS_STATUS__?.canonicalPayloads,
          callbacks: window.__POKEPIXEL_HUNT_ANALYZER_WS_STATUS__?.callbackErrors
        })
      )), 1_000))
    ]);
    await new Promise((resolve) => setTimeout(resolve, 25));

    const verifyDb = await openDatabase({ indexedDBFactory: indexedDB });
    const sessions = await createRepository(verifyDb, STORE_NAMES.SESSIONS).getAll();
    const encounters = await createRepository(verifyDb, STORE_NAMES.ENCOUNTERS).getAll();
    verifyDb.close();
    assert.equal(sessions.length, 0, "a stale event must not start a Hunt");
    assert.equal(encounters.length, 0, "a stale event must not persist an encounter");
  } finally {
    window.dispatchEvent(new window.Event("beforeunload"));
    Object.defineProperty(window, "localStorage", originalStorageDescriptor);
    window.close();
  }
});
