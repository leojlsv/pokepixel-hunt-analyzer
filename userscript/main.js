import { openDatabase } from "../data/db.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { createEventPipeline } from "../services/eventPipeline.js";
import {
  canDeleteHunt,
  deleteHuntData
} from "../services/huntDeletion.js";
import {
  computeSessionMetrics,
  refreshSessionMetrics
} from "../domain/sessionMetrics.js";
import { EVENT_TYPES } from "../domain/events.js";
import { createTabLeadership } from "./tab-leadership.js";
import {
  getWebSocketObserverStatus,
  installWebSocketObserver,
  resolvePageWindow
} from "./websocket-observer.js";
import { createCurrentRefreshGate } from "./current-refresh-gate.js";
import { createUi } from "./ui.js";
import { createAudioAlerts } from "./audio-alerts-runtime.js";
import { createCatchGallery } from "./catch-gallery.js";
import { createHistoryDeleteControl } from "./history-delete.js";
import { createClosedHud } from "./closed-hud-runtime.js";

const APP_VERSION = __APP_VERSION__;
const TAB_LOCK_REFRESH_MS = 2_000;
const CURRENT_REFRESH_MS = 1_000;
const EVENT_REFRESH_DELAY_MS = 75;
const STANDBY_RECONCILE_MS = 10_000;
const CATCH_GALLERY_LOAD_LIMIT = 500;
const ROOT_ID = "pokepixel-hunt-analyzer-root";
const CATCH_GALLERY_SECTION_ID = "catch-gallery";
const CATCH_GALLERY_BETA_STYLE_ID = "pha-catch-gallery-beta-style";
const DIAGNOSTICS_GLOBAL = "__POKEPIXEL_HUNT_ANALYZER_DIAGNOSTICS__";
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
let closedHud;
let ui;
let pageWindow;
let updateQueue = Promise.resolve();
let eventRefreshTimer = null;
let cachedSessionId = null;
let cachedEncounters = [];
let cachedAggregateMetrics = null;
let encounterDataRevision = 0;
let cachedEncounterRevision = -1;
let encounterListRevision = 0;
let cachedEncounterListRevision = -1;
let encounterListSnapshotVersion = 0;
let lastEncounterSyncAt = 0;
let lastCurrentRenderAtMs = null;
let lastCurrentRender = null;
let protocolQueueDepth = 0;
let protocolMaxQueueDepth = 0;
let protocolEventsQueued = 0;
let protocolEventsProcessed = 0;
let protocolEventsDroppedStandby = 0;
let lastProtocolQueuedAtMs = null;
let lastProtocolProcessedAtMs = null;
let lastProtocolProcessed = null;
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

function requestCurrentRefresh() {
  if (eventRefreshTimer !== null) return;

  eventRefreshTimer = setTimeout(() => {
    eventRefreshTimer = null;
    loadCurrent().catch((error) => {
      console.error("PokePixel Hunt Analyzer (event refresh):", error);
    });
  }, EVENT_REFRESH_DELAY_MS);
}

function enqueueProtocolEvent(payload, socketId) {
  if (!payload || typeof payload !== "object") return;
  if (!OBSERVED_EVENT_TYPES.has(payload.type)) return;

  if (!leadership.isActive()) {
    protocolEventsDroppedStandby += 1;
    return;
  }

  protocolEventsQueued += 1;
  protocolQueueDepth += 1;
  protocolMaxQueueDepth = Math.max(protocolMaxQueueDepth, protocolQueueDepth);
  lastProtocolQueuedAtMs = Date.now();

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

      protocolEventsProcessed += 1;
      lastProtocolProcessedAtMs = Date.now();
      lastProtocolProcessed = {
        type: payload.type,
        seq: finiteOrNull(payload.seq),
        socketId
      };

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

      // Keep the 1s timer as a safety net, but do not make the HUD wait for
      // it after a persisted event. Coalescing avoids repeated IndexedDB reads
      // during compact HuntSim batches.
      requestCurrentRefresh();
    })
    .catch((error) => {
      console.error("PokePixel Hunt Analyzer (event pipeline):", error);
    })
    .finally(() => {
      protocolQueueDepth = Math.max(0, protocolQueueDepth - 1);
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
  const currentState = {
    sessionId,
    encounterSnapshotVersion: encounterListSnapshotVersion,
    metrics,
    encounters: cachedEncounters
  };

  ui.renderCurrent(currentState);
  closedHud?.render(currentState);

  lastCurrentRenderAtMs = Date.now();
  lastCurrentRender = {
    sessionId,
    encounterCount: cachedEncounters.length,
    seen: metrics?.seen ?? null,
    captured: metrics?.captured ?? null,
    failed: metrics?.failed ?? null,
    encounterSnapshotVersion: encounterListSnapshotVersion
  };
}

const currentRefreshGate = createCurrentRefreshGate(performCurrentLoad);

function loadCurrent() {
  return currentRefreshGate.run();
}

async function buildDiagnosticsSnapshot() {
  const session = sessionsRepository
    ? await sessionsRepository.getCurrentReadOnly()
    : null;
  const pipelineDiagnostics = pipeline
    ? await pipeline.getDiagnosticsSnapshot()
    : null;

  return {
    appVersion: APP_VERSION,
    capturedAtMs: Date.now(),
    websocket: getWebSocketObserverStatus({ windowObject: pageWindow }),
    runtime: {
      leadershipActive: leadership.isActive(),
      queueDepth: protocolQueueDepth,
      maxQueueDepth: protocolMaxQueueDepth,
      eventsQueued: protocolEventsQueued,
      eventsProcessed: protocolEventsProcessed,
      eventsDroppedStandby: protocolEventsDroppedStandby,
      lastQueuedAtMs: lastProtocolQueuedAtMs,
      lastProcessedAtMs: lastProtocolProcessedAtMs,
      lastProcessedEvent: lastProtocolProcessed ? { ...lastProtocolProcessed } : null,
      currentRefresh: currentRefreshGate.snapshot(),
      currentCache: {
        cachedSessionId,
        encounterDataRevision,
        cachedEncounterRevision,
        encounterListRevision,
        cachedEncounterListRevision,
        encounterCount: cachedEncounters.length,
        lastEncounterSyncAt
      },
      currentRender: lastCurrentRender
        ? { atMs: lastCurrentRenderAtMs, ...lastCurrentRender }
        : null
    },
    session: session
      ? {
          sessionId: session.sessionId,
          status: session.status,
          locked: Boolean(session.locked),
          serverSessionId: session.serverSessionId ?? null,
          zoneId: session.zoneId ?? null,
          startedAtMs: session.startedAtMs ?? null,
          lastActivityAtMs: session.lastActivityAtMs ?? null
        }
      : null,
    pipeline: pipelineDiagnostics
  };
}

function installDiagnosticsBridge() {
  if (!pageWindow) return;

  try {
    Object.defineProperty(pageWindow, DIAGNOSTICS_GLOBAL, {
      value: buildDiagnosticsSnapshot,
      configurable: true,
      enumerable: false,
      writable: false
    });
  } catch {
    // Support diagnostics must never interfere with analytics startup.
  }
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

      await loadCurrent();
      historyDeleteControl?.refresh();
    })
    .catch((error) => {
      console.error("PokePixel Hunt Analyzer (session action):", error);
    });

  await updateQueue;
}

async function canDeleteHistorySession(sessionId) {
  await ready;
  const currentSession = await sessionsRepository.getCurrentReadOnly();
  return canDeleteHunt({ sessionId, currentSession });
}

async function handleHistorySessionDelete(sessionId) {
  if (!leadership.isActive()) {
    throw new Error("Hunt deletion is available only on the ACTIVE tab");
  }

  const task = updateQueue.then(async () => {
    await ready;
    await loadCurrent();

    const { deletingCurrent } = await deleteHuntData({
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
    closedHud?.dispose();
    ui = createUi({
      onSessionAction: (action) => void handleSessionAction(action),
      onLoadHistorySessions: (options) => sessionsRepository.getPage(options),
      onLoadHistorySessionEncounters: (sessionId) =>
        encountersRepository.getBySessionId(sessionId)
    });
    closedHud = createClosedHud({ pageWindow });
    closedHud.mount();
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
  pageWindow = resolvePageWindow({
    unsafeWindowObject:
      typeof unsafeWindow !== "undefined" ? unsafeWindow : null,
    windowObject: window
  });

  installWebSocketObserver({
    onPayload: enqueueProtocolEvent,
    windowObject: pageWindow
  });
  leadership.refresh();
  installDiagnosticsBridge();

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
    onDeleteSession: handleHistorySessionDelete,
    canDeleteSession: canDeleteHistorySession
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
  closedHud?.dispose();
  if (eventRefreshTimer !== null) clearTimeout(eventRefreshTimer);
  void pipeline?.flushDiagnostics();
  leadership.release();
});

initialize().catch((error) => {
  console.error("PokePixel Hunt Analyzer userscript:", error);
});
