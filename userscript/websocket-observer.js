import { createProtocolAdapter } from "./protocol-adapter.js";

const HOOK_FLAG = "__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__";
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

export function installWebSocketObserver({
  onPayload,
  windowObject = window,
  protocolAdapter = createProtocolAdapter()
}) {
  if (typeof onPayload !== "function") {
    throw new TypeError("installWebSocketObserver requires onPayload");
  }

  if (!protocolAdapter || typeof protocolAdapter.adapt !== "function") {
    throw new TypeError("installWebSocketObserver requires a protocol adapter");
  }

  if (windowObject[HOOK_FLAG]) return false;

  Object.defineProperty(windowObject, HOOK_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  const NativeWebSocket = windowObject.WebSocket;
  if (typeof NativeWebSocket !== "function") return false;

  let nextSocketId = 1;
  windowObject.WebSocket = new Proxy(NativeWebSocket, {
    construct(target, args) {
      const socket = Reflect.construct(target, args, target);
      const socketId = nextSocketId;
      nextSocketId += 1;

      socket.addEventListener("message", (event) => {
        void parseProtocolPayload(event.data).then((payload) => {
          if (!payload) return;
          const canonicalPayloads = protocolAdapter.adapt(payload);
          for (const canonicalPayload of canonicalPayloads) {
            onPayload(canonicalPayload, socketId);
          }
        });
      });

      return socket;
    }
  });

  return true;
}
