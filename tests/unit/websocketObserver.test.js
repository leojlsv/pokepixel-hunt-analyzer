import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decodeMessageData,
  getWebSocketObserverStatus,
  installWebSocketObserver,
  parseProtocolPayload,
  resolvePageWindow,
  summarizeRewardPayload
} from "../../userscript/websocket-observer.js";

const HOOK_FLAG = "__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__";

class FakeWebSocket {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
    }
  }
}

class DelayedBlob extends Blob {
  constructor(parts, delayMs) {
    super(parts);
    this.delayMs = delayMs;
  }

  async text() {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return super.text();
  }
}

async function waitUntil(predicate, timeoutMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("condition was not reached before timeout");
}

test("decodes supported WebSocket message payload types", async () => {
  const json = '{"type":"combat.started","seq":1}';
  const bytes = new TextEncoder().encode(json);

  assert.equal(await decodeMessageData(json), json);
  assert.equal(await decodeMessageData(new Blob([json])), json);
  assert.equal(await decodeMessageData(bytes.buffer), json);
  assert.equal(await decodeMessageData(bytes), json);
});

test("unsupported WebSocket message payload returns null", async () => {
  assert.equal(await decodeMessageData({}), null);
  assert.equal(await decodeMessageData(null), null);
});

test("parses JSON objects and ignores invalid frames", async () => {
  assert.deepEqual(
    await parseProtocolPayload('{"type":"capture.success","seq":42}'),
    { type: "capture.success", seq: 42 }
  );
  assert.equal(await parseProtocolPayload("not json"), null);
  assert.equal(await parseProtocolPayload("null"), null);
  assert.equal(await parseProtocolPayload("42"), null);
});

test("prefers unsafeWindow for the WebSocket hook when available", () => {
  const sandboxWindow = { name: "sandbox" };
  const pageWindow = { name: "page" };

  assert.equal(
    resolvePageWindow({
      unsafeWindowObject: pageWindow,
      windowObject: sandboxWindow
    }),
    pageWindow
  );

  assert.equal(
    resolvePageWindow({ windowObject: sandboxWindow }),
    sandboxWindow
  );
});

test("does not mark HOOKED when WebSocket is unavailable", () => {
  const windowObject = {};

  assert.equal(
    installWebSocketObserver({ onPayload() {}, windowObject }),
    false
  );
  assert.equal(windowObject[HOOK_FLAG], undefined);
  assert.equal(getWebSocketObserverStatus({ windowObject }).hookInstalled, false);
});

test("marks the hook installed only after replacing WebSocket", () => {
  let clock = 100;
  const windowObject = { WebSocket: FakeWebSocket };

  assert.equal(
    installWebSocketObserver({
      onPayload() {},
      windowObject,
      now: () => clock
    }),
    true
  );

  assert.equal(windowObject[HOOK_FLAG], true);
  assert.notEqual(windowObject.WebSocket, FakeWebSocket);

  const status = getWebSocketObserverStatus({ windowObject });
  assert.equal(status.hookInstalled, true);
  assert.equal(status.installedAtMs, 100);
  assert.equal(status.socketsCreated, 0);
  assert.deepEqual(status.rawTypes, {});
  assert.deepEqual(status.rewardSamples, {});
});

test("summarizes reward payloads without exposing string identifiers", () => {
  const summary = summarizeRewardPayload({
    type: "hunt.kill_reward",
    data: {
      session_id: "secret-session",
      kills: [
        {
          seq: 308,
          species_id: "pidgey",
          exp: 798,
          trainer_exp: 900,
          pokemon_exp: 850,
          gold: 1
        }
      ]
    }
  });

  assert.deepEqual(summary.keys, ["kills", "session_id"]);
  assert.equal(summary.arrays.kills.length, 1);
  assert.deepEqual(summary.arrays.kills.items[0].numeric, {
    seq: 308,
    exp: 798,
    trainer_exp: 900,
    pokemon_exp: 850,
    gold: 1
  });
  assert.equal(JSON.stringify(summary).includes("secret-session"), false);
  assert.equal(JSON.stringify(summary).includes("pidgey"), false);
});

test("serializes async message decoding per socket and tracks raw type timing", async () => {
  let clock = 1000;
  const received = [];
  const windowObject = { WebSocket: FakeWebSocket };
  const protocolAdapter = {
    adapt(payload) {
      return [payload];
    }
  };

  installWebSocketObserver({
    onPayload(payload, socketId) {
      received.push([payload.seq, socketId]);
    },
    windowObject,
    protocolAdapter,
    now: () => ++clock
  });

  const socket = new windowObject.WebSocket("wss://example.test");
  socket.emit("message", {
    data: new DelayedBlob(['{"type":"first","seq":1}'], 25)
  });
  socket.emit("message", {
    data: new DelayedBlob(['{"type":"second","seq":2}'], 0)
  });
  socket.emit("message", {
    data: new DelayedBlob(['{"type":"first","seq":3}'], 0)
  });

  await waitUntil(() => received.length === 3);

  assert.deepEqual(received, [[1, 1], [2, 1], [3, 1]]);

  const status = getWebSocketObserverStatus({ windowObject });
  assert.equal(status.messagesReceived, 3);
  assert.equal(status.parsedMessages, 3);
  assert.equal(status.canonicalPayloads, 3);
  assert.equal(status.queueDepth, 0);
  assert.equal(status.maxQueueDepth, 3);
  assert.equal(status.lastPayloadType, "first");
  assert.equal(status.rawTypes.first.count, 2);
  assert.equal(status.rawTypes.second.count, 1);
  assert.ok(status.rawTypes.first.firstAtMs <= status.rawTypes.first.lastAtMs);
  assert.ok(status.rawTypes.second.firstAtMs <= status.rawTypes.second.lastAtMs);
});

test("captures the latest sanitized reward sample", async () => {
  let clock = 2000;
  const windowObject = { WebSocket: FakeWebSocket };
  const protocolAdapter = { adapt() { return []; } };

  installWebSocketObserver({
    onPayload() {},
    windowObject,
    protocolAdapter,
    now: () => ++clock
  });

  const socket = new windowObject.WebSocket("wss://example.test");
  socket.emit("message", {
    data: JSON.stringify({
      type: "hunt.kill_reward",
      seq: 10,
      data: {
        session_id: "hidden",
        kills: [{ seq: 44, exp: 123, gold: 5, species_id: "hidden-species" }]
      }
    })
  });

  await waitUntil(() =>
    getWebSocketObserverStatus({ windowObject }).rewardSamples["hunt.kill_reward"]?.count === 1
  );

  const sample = getWebSocketObserverStatus({ windowObject })
    .rewardSamples["hunt.kill_reward"];
  assert.equal(sample.count, 1);
  assert.equal(sample.latest.arrays.kills.items[0].numeric.exp, 123);
  assert.equal(JSON.stringify(sample).includes("hidden"), false);
});
