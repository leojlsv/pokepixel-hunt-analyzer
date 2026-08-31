import { createProtocolAdapter } from "./protocol-adapter.js";

const HOOK_FLAG = "__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__";
const STATUS_FLAG = "__POKEPIXEL_HUNT_ANALYZER_WS_STATUS__";
const textDecoder = new TextDecoder();

export async function decodeMessageData(data) {
  if (typeof data === "string") return data;
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer) return textDecoder.decode(data);
  if (ArrayBuffer.isView(data)) {
    return textDecoder.decode(new Uint8Array(
      data.buffer,
      data.byteOffset,
      data.byteLength
    ));
  }
  return null;
}

export async function parseProtocolPayload(data) {
  try {
    const text = await decodeMessageData(data);
    if (!text) return null;
    const payload = JSON.parse(text);
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export function resolvePageWindow({
  unsafeWindowObject = null,
  windowObject = null
} = {}) {
  return unsafeWindowObject || windowObject;
}

function createObserverStatus(now) {
  return {
    hookInstalled: false,
    installedAtMs: null,
    socketsCreated: 0,
    openSockets: 0,
    messagesReceived: 0,
    parsedMessages: 0,
    observerParseErrors: 0,
    adapterErrors: 0,
    callbackErrors: 0,
    canonicalPayloads: 0,
    queueDepth: 0,
    maxQueueDepth: 0,
    lastSocketId: null,
    lastMessageAtMs: null,
    lastPayloadAtMs: null,
    lastPayloadType: null,
    rawTypes: Object.create(null),
    now
  };
}

function cloneRawTypes(rawTypes) {
  return Object.fromEntries(
    Object.entries(rawTypes || {}).map(([type, value]) => [type, { ...value }])
  );
}

export function getWebSocketObserverStatus({ windowObject = window } = {}) {
  const status = windowObject?.[STATUS_FLAG];
  if (!status || typeof status !== "object") {
    return {
      hookInstalled: Boolean(windowObject?.[HOOK_FLAG]),
      installedAtMs: null,
      socketsCreated: 0,
      openSockets: 0,
      messagesReceived: 0,
      parsedMessages: 0,
      observerParseErrors: 0,
      adapterErrors: 0,
      callbackErrors: 0,
      canonicalPayloads: 0,
      queueDepth: 0,
      maxQueueDepth: 0,
      lastSocketId: null,
      lastMessageAtMs: null,
      lastPayloadAtMs: null,
      lastPayloadType: null,
      rawTypes: {}
    };
  }

  const { now: _now, rawTypes, ...snapshot } = status;
  return { ...snapshot, rawTypes: cloneRawTypes(rawTypes) };
}

export function installWebSocketObserver({
  onPayload,
  windowObject = window,
  protocolAdapter = createProtocolAdapter(),
  now = Date.now
}) {
  if (typeof onPayload !== "function") {
    throw new TypeError("installWebSocketObserver requires onPayload");
  }

  if (!protocolAdapter || typeof protocolAdapter.adapt !== "function") {
    throw new TypeError("installWebSocketObserver requires a protocol adapter");
  }

  if (windowObject[HOOK_FLAG]) return false;

  // Never mark the observer as installed before we have a real constructor to
  // proxy. The old order could leave HOOKED=true with no hook installed.
  const NativeWebSocket = windowObject.WebSocket;
  if (typeof NativeWebSocket !== "function") return false;

  const status = createObserverStatus(now);
  let nextSocketId = 1;

  const WebSocketProxy = new Proxy(NativeWebSocket, {
    construct(target, args, newTarget) {
      const socket = Reflect.construct(target, args, newTarget);
      const socketId = nextSocketId;
      nextSocketId += 1;

      status.socketsCreated += 1;
      status.openSockets += 1;
      status.lastSocketId = socketId;

      let socketQueue = Promise.resolve();

      socket.addEventListener("message", (event) => {
        status.messagesReceived += 1;
        status.lastMessageAtMs = now();
        status.lastSocketId = socketId;
        status.queueDepth += 1;
        status.maxQueueDepth = Math.max(status.maxQueueDepth, status.queueDepth);

        // Decode/adapt messages strictly in arrival order per socket. Blob
        // decoding is asynchronous and previously allowed a later frame to
        // overtake an earlier one before correlation reached the pipeline.
        socketQueue = socketQueue
          .then(async () => {
            const payload = await parseProtocolPayload(event.data);
            if (!payload) {
              status.observerParseErrors += 1;
              return;
            }

            status.parsedMessages += 1;
            const payloadAtMs = now();
            status.lastPayloadAtMs = payloadAtMs;
            status.lastPayloadType = typeof payload.type === "string"
              ? payload.type
              : null;

            if (status.lastPayloadType) {
              const rawType = status.rawTypes[status.lastPayloadType] || {
                count: 0,
                firstAtMs: payloadAtMs,
                lastAtMs: null
              };
              rawType.count += 1;
              rawType.lastAtMs = payloadAtMs;
              status.rawTypes[status.lastPayloadType] = rawType;
            }

            let canonicalPayloads;
            try {
              canonicalPayloads = protocolAdapter.adapt(payload);
            } catch (error) {
              status.adapterErrors += 1;
              console.error("PokePixel Hunt Analyzer (protocol adapter):", error);
              return;
            }

            for (const canonicalPayload of canonicalPayloads) {
              status.canonicalPayloads += 1;
              try {
                onPayload(canonicalPayload, socketId);
              } catch (error) {
                status.callbackErrors += 1;
                console.error("PokePixel Hunt Analyzer (WebSocket callback):", error);
              }
            }
          })
          .catch((error) => {
            status.observerParseErrors += 1;
            console.error("PokePixel Hunt Analyzer (WebSocket observer):", error);
          })
          .finally(() => {
            status.queueDepth = Math.max(0, status.queueDepth - 1);
          });
      });

      socket.addEventListener("close", () => {
        status.openSockets = Math.max(0, status.openSockets - 1);
      });

      return socket;
    }
  });

  // Assignment itself can fail in unusual sandbox/page environments. Only
  // publish HOOKED after the page constructor was successfully replaced.
  try {
    windowObject.WebSocket = WebSocketProxy;
  } catch {
    return false;
  }

  if (windowObject.WebSocket !== WebSocketProxy) return false;

  status.hookInstalled = true;
  status.installedAtMs = now();

  Object.defineProperty(windowObject, STATUS_FLAG, {
    value: status,
    configurable: false,
    enumerable: false,
    writable: false
  });

  Object.defineProperty(windowObject, HOOK_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  return true;
}
