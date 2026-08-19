import { openDatabase } from "../data/db.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { createEventPipeline } from "../services/eventPipeline.js";
import { computeSessionMetrics } from "../domain/sessionMetrics.js";
import { EVENT_TYPES } from "../domain/events.js";
import { createTabLeadership } from "./tab-leadership.js";
import { installWebSocketObserver } from "./websocket-observer.js";
import { createUi } from "./ui.js";

const APP_VERSION = __APP_VERSION__;
const TAB_LOCK_REFRESH_MS = 2_000;
const CURRENT_REFRESH_MS = 1_000;
const OBSERVED_EVENT_TYPES = new Set(EVENT_TYPES);

let pipeline;
let sessionsRepository;
let encountersRepository;
let ui;
let updateQueue = Promise.resolve();
let resolveReady;
const ready = new Promise((resolve) => {
  resolveReady = resolve;
});

const leadership = createTabLeadership({
  onChange: (isActive) => ui?.setActive(isActive)
});

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function enqueueProtocolEvent(payload, socketId) {
  if (!leadership.isActive() || !payload || typeof payload !== "object") return;
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
  if (!leadership.isActive()) return;

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
    ui.setActive(leadership.isActive());
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

function scheduleRefreshes() {
  setInterval(() => leadership.refresh(), TAB_LOCK_REFRESH_MS);
  setInterval(() => {
    if (ui?.getActiveView() !== "current") return;
    loadCurrent().catch((error) => {
      console.error("PokePixel Hunt Analyzer (Current refresh):", error);
    });
  }, CURRENT_REFRESH_MS);
}

async function initialize() {
  installWebSocketObserver({ onPayload: enqueueProtocolEvent });
  leadership.refresh();

  const database = await openDatabase();
  sessionsRepository = createSessionsRepository(database);
  encountersRepository = createEncountersRepository(database);
  pipeline = createEventPipeline(database, { appVersion: APP_VERSION });
  await pipeline.recoverOnStartup();

  mountUiWhenReady();
  resolveReady();

  if (document.documentElement) await loadCurrent();
  scheduleRefreshes();
}

window.addEventListener("beforeunload", () => leadership.release());

initialize().catch((error) => {
  console.error("PokePixel Hunt Analyzer userscript:", error);
});
