import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { Window } from "happy-dom";
import { openDatabase, STORE_NAMES } from "../../data/db.js";

async function bundleRuntime() {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("../../userscript/main.js", import.meta.url))],
    bundle: true, write: false, format: "iife", platform: "browser",
    loader: { ".png": "dataurl" },
    define: { __APP_VERSION__: '"1.15.6"', "process.env.NODE_ENV": '"production"' }
  });
  return result.outputFiles[0].text;
}

async function waitFor(predicate, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return null;
}

async function counts(factory) {
  const db = await openDatabase({ indexedDBFactory: factory });
  try {
    const result = {};
    for (const name of Object.values(STORE_NAMES)) {
      const request = db.transaction(name).objectStore(name).count();
      result[name] = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return result;
  } finally { db.close(); }
}

async function seedOldAnalytics(factory) {
  const db = await openDatabase({ indexedDBFactory: factory });
  try {
    const tx = db.transaction(Object.values(STORE_NAMES), "readwrite");
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    tx.objectStore(STORE_NAMES.ENCOUNTERS).put({
      encounterId: "old-20-days", sessionId: "current",
      startedAtMs: Date.now() - 20 * 86_400_000,
      createdAtMs: Date.now() - 20 * 86_400_000,
      captureResult: "failed", speciesName: "Old Pidgey", quality: "common"
    });
    tx.objectStore(STORE_NAMES.ENCOUNTERS).put({
      encounterId: "legend-ticket", sessionId: "current",
      startedAtMs: Date.now() - 20 * 86_400_000,
      captureAtMs: 1_600_000_000_000,
      captureTicketAtMs: 1_600_000_000_000,
      captureResult: "success", speciesName: "Lugia", quality: "legendary",
      qualityMultiplier: 1.88, ivTotal: 182, capturedByName: "Rhyxus",
      isShiny: false, lootItems: [{ itemId: "should-be-removed", qty: 99 }]
    });
    tx.objectStore(STORE_NAMES.SESSIONS).put({
      sessionId: "current", status: "paused", locked: true,
      startedAtMs: Date.now() - 20 * 86_400_000,
      accumulatedActiveMs: 600_000, activeStartedAtMs: null
    });
    tx.objectStore(STORE_NAMES.CONFIGS).put({ configId: "config1" });
    tx.objectStore(STORE_NAMES.META).put("current", "currentSessionId");
    await done;
  } finally { db.close(); }
}

class RuntimeSocket {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  emit(data) {
    for (const callback of this.listeners.get("message") || []) callback({ data });
  }
}

test("1.15.6 retains old data until the owner clicks Remover Tudo; late Blob cannot restore it", async () => {
  const factory = new IDBFactory();
  await seedOldAnalytics(factory);
  const browser = new Window({ url: "https://pokepixel.nietore.com/play/" });
  browser.unsafeWindow = browser;
  browser.indexedDB = factory;
  browser.IDBKeyRange = IDBKeyRange;
  browser.WebSocket = RuntimeSocket;
  browser.setInterval = () => 1;
  browser.clearInterval = () => {};
  browser.MutationObserver = class { observe() {} disconnect() {} };
  browser.localStorage.setItem("pokepixel_hunt_analyzer_ui_v2", JSON.stringify({
    shared: { view: "history", open: true, modeOverride: "mobile" },
    desktop: {}, mobile: {}
  }));
  browser.confirm = () => true;
  try {
    browser.eval(await bundleRuntime());
    const button = await waitFor(() => {
      const element = browser.document.getElementById("pokepixel-hunt-analyzer-root")
        ?.shadowRoot?.getElementById("history-clear-all");
      return element && !element.disabled ? element : null;
    });
    assert.ok(button, "the published 1.15.6 UI must be mounted and ACTIVE");
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.deepEqual(await counts(factory), { encounters: 2, sessions: 1, configs: 1, meta: 1 },
      "20-day analytics must remain without any user action");

    const socket = new browser.WebSocket("wss://synthetic.invalid");
    class DelayedBlob extends browser.Blob {
      async text() {
        await new Promise(resolve => setTimeout(resolve, 150));
        return super.text();
      }
    }
    socket.emit(new DelayedBlob([JSON.stringify({
      type: "capture.failed", seq: 5, ts: Date.now() - 20_000,
      data: { wild_monster_id: "old-event", species_id: "pidgey" }
    })]));
    button.click();
    assert.ok(await waitFor(() => button.textContent === "Remover Tudo"
      && button.getRootNode().getElementById("history-clear-all-status")
        ?.textContent.includes("Catch Gallery: 1 captura(s) preservada(s)")),
    "the operation must report confirmation only after the IDB commit");
    await new Promise(resolve => setTimeout(resolve, 210));
    assert.deepEqual(await counts(factory), { encounters: 1, sessions: 0, configs: 0, meta: 0 });
    const db = await openDatabase({ indexedDBFactory: factory });
    try {
      const ticketRequest = db.transaction(STORE_NAMES.ENCOUNTERS).objectStore(STORE_NAMES.ENCOUNTERS).get("legend-ticket");
      const ticket = await new Promise((resolve, reject) => {
        ticketRequest.onsuccess = () => resolve(ticketRequest.result);
        ticketRequest.onerror = () => reject(ticketRequest.error);
      });
      assert.equal(ticket.speciesName, "Lugia");
      assert.equal(ticket.sessionId, undefined, "archived Gallery records cannot appear in Current/History");
      assert.equal(ticket.lootItems, undefined, "unrelated analytics must not be retained with Gallery tickets");
    } finally { db.close(); }
    const shadow = button.getRootNode();
    const galleryTab = shadow.getElementById("alerts-tab");
    assert.ok(galleryTab, "the published 1.15.6 Catch Gallery tab must remain available");
    galleryTab.click();
    assert.ok(await waitFor(() => shadow.querySelectorAll("#catch-gallery tbody tr").length === 1),
      "the preserved ticket must remain visible in Catch Gallery after the wipe");
    assert.match(shadow.querySelector("#catch-gallery tbody")?.textContent || "", /Lugia/);
    assert.equal(typeof browser.localStorage.getItem("pokepixel_hunt_analyzer_last_clear_at_ms_v1"), "string");
    assert.ok(browser.localStorage.getItem("pokepixel_hunt_analyzer_ui_v2"), "UI preferences survive removal");
  } finally {
    browser.dispatchEvent(new browser.Event("beforeunload"));
    browser.close();
  }
});
