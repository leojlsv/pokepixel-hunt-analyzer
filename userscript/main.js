import { openDatabase } from "../data/db.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { createEventPipeline } from "../services/eventPipeline.js";
import { deleteHuntData } from "../services/huntDeletion.js";
import {
  computeSessionMetrics,
  refreshSessionMetrics
} from "../domain/sessionMetrics.js";
import { EVENT_TYPES } from "../domain/events.js";
import { createTabLeadership } from "./tab-leadership.js";
import {
  installWebSocketObserver,
  resolvePageWindow
} from "./websocket-observer.js";
import { createUi } from "./ui.js";
import { createAudioAlerts } from "./audio-alerts.js";
import { createCatchGallery } from "./catch-gallery.js";
import { createHistoryDeleteControl } from "./history-delete.js";

const APP_VERSION = __APP_VERSION__;
const TAB_LOCK_REFRESH_MS = 2_000;
const CURRENT_REFRESH_MS = 1_000;
const STANDBY_RECONCILE_MS = 10_000;
const CATCH_GALLERY_LOAD_LIMIT = 500;
const ROOT_ID = "pokepixel-hunt-analyzer-root";
const CATCH_GALLERY_SECTION_ID = "catch-gallery";
const CATCH_GALLERY_BETA_STYLE_ID = "pha-catch-gallery-beta-style";
const OBSERVED_EVENT_TYPES = new Set(EVENT_TYPES);
const METRIC_DATA_EVENTS = new Set([
  "loot.received",
  "capture.failed",
  "capture.success"
]);
const TERMINAL_LIST_EVENTS = new Set([
  "capture.failed",
  "capture.success"
]);

let pipeline;
let sessionsRepository;
let encountersRepository;
let audioAlerts;
let catchGallery;
let historyDeleteControl;
let ui;
let updateQueue = Promise.resolve();
let currentLoadPromise = null;
let cachedSessionId = null;
let cachedEncounters = [];
let cachedAggregateMetrics = null;
let encounterDataRevision = 0;
let cachedEncounterRevision = -1;
let encounterListRevision = 0;
let cachedEncounterListRevision = -1;
let encounterListSnapshotVersion = 0;
let lastEncounterSyncAt = 0;
let resolveReady;
const ready = new Promise((resolve) => {
  resolveReady = resolve;
});

function markMetricDataDirty() {
  encounterDataRevision += 1;
}

function markEncounterListDirty() {
  encounterDataRevision += 1;
  encounterListRevision += 1;
}

function invalidateEncounterCache() {
  cachedSessionId = null;
  cachedEncounters = [];
  cachedAggregateMetrics = null;
  cachedEncounterRevision = -1;
  cachedEncounterListRevision = -1;
  lastEncounterSyncAt = 0;
  markEncounterListDirty();
}

function markCatchGalleryBeta() {
  const shadow = document.getElementById(ROOT_ID)?.shadowRoot;
  const heading = shadow?.querySelector(
    `#${CATCH_GALLERY_SECTION_ID} .section-head h3`
  );
  if (!shadow || !heading || heading.querySelector(".catch-gallery-beta-badge")) return;

  if (!shadow.getElementById(CATCH_GALLERY_BETA_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = CATCH_GALLERY_BETA_STYLE_ID;
    style.textContent = `
      .catch-gallery-beta-badge {
        display:inline-flex;
        align-items:center;
        height:14px;
        margin-left:5px;
        padding:0 4px;
        border:1px solid #8a7741;
        border-radius:3px;
        background:#3b3422;
        color:#d8c071;
        font-size:7px;
        font-weight:800;
        letter-spacing:.08em;
        line-height:12px;
        vertical-align:1px;
      }
    `;
    shadow.appendChild(style);
  }

  const badge = document.createElement("span");
  badge.className = "catch-gallery-beta-badge";
  badge.textContent = "BETA";
  badge.title = "Capture Ticket is in beta";
  heading.appendChild(badge);
}

const leadership = createTabLeadership({
  onChange: (isActive) => {
    ui?.setActive(isActive);
    markEncounterListDirty();
  }
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
      const eventResult = await pipeline.handle({
        type: payload.type,
        seq: finiteOrNull(payload.seq),
        ts: finiteOrNull(payload.ts),
        socketId,
        data: payload.data
      });

      if (eventResult?.terminalAlert) {
        void audioAlerts?.handleTerminalAlert(eventResult.terminalAlert);
      }

      if (payload.type === "capture.success") {
        catchGallery?.markDirty();
      }

      if (TERMINAL_LIST_EVENTS.has(payload.type)) {
        markEncounterListDirty();
      } else if (METRIC_DATA_EVENTS.has(payload.type)) {
        markMetricDataDirty();
      }
    })
    .catch((error) => {
      console.error("PokePixel Hunt Analyzer (event pipeline):", error);
    });
}

async function performCurrentLoad() {
  if (!sessionsRepository || !encountersRepository || !ui) return;

  const now = Date.now();
  const session = await sessionsRepository.getCurrentReadOnly();
  const sessionId = session?.sessionId ?? null;
  const sessionChanged = cachedSessionId !== sessionId;
  const revisionAtStart = encounterDataRevision;
  const listRevisionAtStart = encounterListRevision;
  const standbyNeedsReconcile = !leadership.isActive() &&
    now - lastEncounterSyncAt >= STANDBY_RECONCILE_MS;

  const shouldReloadEncounters =
    sessionChanged ||
    cachedEncounterRevision !== revisionAtStart ||
    standbyNeedsReconcile;

  if (shouldReloadEncounters) {
    cachedEncounters = session
      ? await encountersRepository.getBySessionId(sessionId)
      : [];

    const listSnapshotChanged =
      sessionChanged ||
      cachedEncounterListRevision !== listRevisionAtStart ||
      standbyNeedsReconcile;

    cachedSessionId = sessionId;
    cachedEncounterRevision = revisionAtStart;
    cachedEncounterListRevision = listRevisionAtStart;
    if (listSnapshotChanged) encounterListSnapshotVersion += 1;
    lastEncounterSyncAt = now;

    cachedAggregateMetrics = computeSessionMetrics({
      session,
      encounters: cachedEncounters,
      now
    });
  }

  const metrics = refreshSessionMetrics(cachedAggregateMetrics, session, now);

  ui.renderCurrent({
    sessionId,
    encounterSnapshotVersion: encounterListSnapshotVersion,
    metrics,
    encounters: cachedEncounters
  });
}

function loadCurrent() {
  if (currentLoadPromise) return currentLoadPromise;

  currentLoadPromise = performCurrentLoad()
    .finally(() => {
      currentLoadPromise = null;
    });
  return currentLoadPromise;
}

async function handleSessionAction(action) {
  if (!leadership.isActive()) return;

  updateQueue = updateQueue
    .then(async () => {
      await ready;
      switch (action) {
        case "new":
          await sessionsRepository.forceNewSession();
          invalidateEncounterCache();
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

      if (currentLoadPromise) await currentLoadPromise;
      await loadCurrent();
    })
    .catch((error) => {
      console.error("PokePixel Hunt Analyzer (session action):", error);
    });

  await updateQueue;
}

async function handleHistorySessionDelete(sessionId) {
  if (!leadership.isActive()) {
    throw new Error("Hunt deletion is available only on the ACTIVE tab");
  }

  const task = updateQueue.then(async () => {
    await ready;
    if (currentLoadPromise) await currentLoadPromise;

    const current = await sessionsRepository.getCurrentReadOnly();
    const deletingCurrent = current?.sessionId === sessionId;

    await deleteHuntData({
      sessionId,
      sessionsRepository,
      encountersRepository
    });

    catchGallery?.markDirty();
    if (deletingCurrent) {
      invalidateEncounterCache();
      await loadCurrent();
    }
  });

  updateQueue = task.catch((error) => {
    console.error("PokePixel Hunt Analyzer (History delete):", error);
  });

  return task;
}

function mountUiWhenReady() {
  const mount = () => {
    catchGallery?.dispose();
    historyDeleteControl?.dispose();
    ui = createUi({
      onSessionAction: (action) => void handleSessionAction(action),
      onLoadHistorySessions: (options) => sessionsRepository.getPage(options),
      onLoadHistorySessionEncounters: (sessionId) =>
        encountersRepository.getBySessionId(sessionId)
    });
    audioAlerts?.mountControls();
    catchGallery?.mountControls();
    markCatchGalleryBeta();
    historyDeleteControl?.mount();
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
  const pageWindow = resolvePageWindow({
    unsafeWindowObject:
      typeof unsafeWindow !== "undefined" ? unsafeWindow : null,
    windowObject: window
  });

  installWebSocketObserver({
    onPayload: enqueueProtocolEvent,
    windowObject: pageWindow
  });
  leadership.refresh();

  const database = await openDatabase();
  sessionsRepository = createSessionsRepository(database);
  encountersRepository = createEncountersRepository(database);
  pipeline = createEventPipeline(database, { appVersion: APP_VERSION });
  audioAlerts = createAudioAlerts();
  catchGallery = createCatchGallery({
    loadEncounters: () =>
      encountersRepository.getRecentCaptureTickets(CATCH_GALLERY_LOAD_LIMIT)
  });
  historyDeleteControl = createHistoryDeleteControl({
    onDeleteSession: handleHistorySessionDelete
  });
  await pipeline.recoverOnStartup();

  mountUiWhenReady();
  resolveReady();

  if (document.documentElement) await loadCurrent();
  scheduleRefreshes();
}

window.addEventListener("beforeunload", () => {
  catchGallery?.dispose();
  historyDeleteControl?.dispose();
  leadership.release();
});

initialize().catch((error) => {
  console.error("PokePixel Hunt Analyzer userscript:", error);
});
