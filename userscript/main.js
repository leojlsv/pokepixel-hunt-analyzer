import { openDatabase } from "../data/db.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { createEventPipeline } from "../services/eventPipeline.js";
import { computeSessionMetrics } from "../domain/sessionMetrics.js";
import { EVENT_TYPES } from "../domain/events.js";
import { createUi } from "./ui.js";

const APP_VERSION = __APP_VERSION__;
const TAB_LOCK_KEY = "pokepixel_hunt_analyzer_active_tab";
const TAB_LOCK_TTL_MS = 6_000;
const TAB_LOCK_REFRESH_MS = 2_000;
const CURRENT_REFRESH_MS = 1_000;
const OBSERVED_EVENT_TYPES = new Set(EVENT_TYPES);
const TAB_ID = crypto.randomUUID();
const textDecoder = new TextDecoder();

let pipeline;
let sessionsRepository;
let encountersRepository;
let ui;
let active = false;
let nextSocketId = 1;
let updateQueue = Promise.resolve();
let resolveReady;
const ready = new Promise((resolve) => {
  resolveReady = resolve;
});

function readTabLock() {
  try {
    return JSON.parse(localStorage.getItem(TAB_LOCK_KEY) || "null");
  } catch {
    return null;
  }
}

function writeTabLock() {
  localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({
    tabId: TAB_ID,
    expiresAt: Date.now() + TAB_LOCK_TTL_MS
  }));
}

function setActive(next) {
  if (active === next) return;
  active = next;
  ui?.setActive(active);
}

function refreshLeadership() {
  const lock = readTabLock();
  if (!lock || lock.tabId === TAB_ID || lock.expiresAt <= Date.now()) {
    writeTabLock();
    setActive(true);
    return;
  }
  setActive(false);
}

function releaseLeadership() {
  const lock = readTabLock();
  if (lock?.tabId === TAB_ID) localStorage.removeItem(TAB_LOCK_KEY);
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function decodeMessageData(data) {
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

function enqueueProtocolEvent(payload, socketId) {
  if (!active || !payload || typeof payload !== "object") return;
  if (!OBSERVED_EVENT_TYPES.has(payload.type)) return;

  updateQueue = updateQueue
    .then(async () => {
      await ready;
      await pipeline.handle({
        type: payload.type,
        seq: finiteOrNull(payload.seq),
        ts: finiteOrNull(payload.ts),
        socketId,
        data: payload.data
      });

      if (ui?.getActiveView() === "current") {
        await loadCurrent();
      }
    })
    .catch((error) => {
      console.error("PokePixel Hunt Analyzer (event pipeline):", error);
    });
}

async function handleSocketMessage(data, socketId) {
  try {
    const text = await decodeMessageData(data);
    if (!text) return;
    enqueueProtocolEvent(JSON.parse(text), socketId);
  } catch {
    // Non-JSON and undecodable frames are intentionally ignored.
  }
}

function installWebSocketObserver() {
  const hookFlag = "__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__";
  if (window[hookFlag]) return;

  Object.defineProperty(window, hookFlag, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket !== "function") return;

  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(target, args) {
      const socket = Reflect.construct(target, args, target);
      const socketId = nextSocketId;
      nextSocketId += 1;
      socket.addEventListener("message", (event) => {
        void handleSocketMessage(event.data, socketId);
      });
      return socket;
    }
  });
}

async function loadCurrent() {
  if (!sessionsRepository || !encountersRepository || !ui) return;

  const session = await sessionsRepository.getCurrentReadOnly();
  const encounters = session
    ? await encountersRepository.getBySessionId(session.sessionId)
    : [];
  const metrics = computeSessionMetrics({
    session,
    encounters,
    now: Date.now()
  });

  ui.renderCurrent({ metrics, encounters });
}

async function handleSessionAction(action) {
  if (!active) return;

  updateQueue = updateQueue
    .then(async () => {
      await ready;
      switch (action) {
        case "new":
          await sessionsRepository.forceNewSession();
          break;
        case "pause":
          await sessionsRepository.pauseManual();
          break;
        case "resume":
          await sessionsRepository.resumeManual();
          break;
        case "end":
          await sessionsRepository.endManual();
          break;
        default:
          return;
      }
      await loadCurrent();
    })
    .catch((error) => {
      console.error("PokePixel Hunt Analyzer (session action):", error);
    });

  await updateQueue;
}

function mountUiWhenReady() {
  const mount = () => {
    ui = createUi({
      onSessionAction: (action) => void handleSessionAction(action),
      onLoadCompare: () => encountersRepository.getAll()
    });
    ui.setActive(active);
  };

  if (document.documentElement) {
    mount();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.documentElement) return;
    observer.disconnect();
    mount();
  });
  observer.observe(document, { childList: true, subtree: true });
}

async function initialize() {
  installWebSocketObserver();
  refreshLeadership();

  const database = await openDatabase();
  sessionsRepository = createSessionsRepository(database);
  encountersRepository = createEncountersRepository(database);
  pipeline = createEventPipeline(database, { appVersion: APP_VERSION });
  await pipeline.recoverOnStartup();

  mountUiWhenReady();
  resolveReady();

  if (document.documentElement) await loadCurrent();

  setInterval(refreshLeadership, TAB_LOCK_REFRESH_MS);
  setInterval(() => {
    if (ui?.getActiveView() === "current") {
      loadCurrent().catch((error) => {
        console.error("PokePixel Hunt Analyzer (Current refresh):", error);
      });
    }
  }, CURRENT_REFRESH_MS);
}

window.addEventListener("beforeunload", releaseLeadership);

initialize().catch((error) => {
  console.error("PokePixel Hunt Analyzer userscript:", error);
});
