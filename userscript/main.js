import { openDatabase } from "../data/db.js";
import { clearAllAnalytics } from "../data/clear-all.js";
import { registerDatabaseWriteGate } from "../data/write-gate.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { createEventPipeline } from "../services/eventPipeline.js";
import {
  canDeleteHunt,
  deleteHuntData
} from "../services/huntDeletion.js";
import {
  computeSessionMetrics,
  refreshSessionMetrics,
  updateSessionMetricsForEncounter
} from "../domain/sessionMetrics.js";
import { EVENT_TYPES } from "../domain/events.js";
import { createTabLeadership } from "./tab-leadership.js";
import {
  getWebSocketObserverStatus,
  installWebSocketObserver,
  resolvePageWindow
} from "./websocket-observer.js";
import { createCurrentRefreshGate } from "./current-refresh-gate.js";
import { sameEncounterCacheImage } from "./encounter-cache-equivalence.js";
import { currentRetentionFootprint } from "./performance-footprint.js";
import { retainLiveActiveKeys } from "./retained-active-keys.js";
import { needsPeriodicCurrentRefresh } from "./current-refresh-policy.js";
import { createUi } from "./ui.js";
import { createAudioAlerts } from "./audio-alerts-runtime.js";
import { createCatchGallery } from "./catch-gallery.js";
import { createHistoryDeleteControl } from "./history-delete.js";
import { createClosedHud, installPrePaintLauncherGuard } from "./closed-hud-runtime.js";
import { createLootItemCatalog } from "./loot-item-catalog.js";
import { installItemsJsonObserver } from "./items-json-observer.js";
import {
  createPublicSummary,
  installPublicSessionControl,
  installPublicSummaryBridge,
  isEmbedMode
} from "./public-summary.js";
import { installPublicUiBridge } from "./public-ui.js";
import {
  latestCaptureAttemptFromRows,
  updateLatestCaptureAttempt
} from "./latest-capture-attempt.js";
import { encounterRecency, latestSpeciesEncounter } from "./hunt-view-model.js";
import {
  createHudEncounterAggregate,
  updateHudEncounterAggregate,
  snapshotHudEncounterAggregate
} from "./hud-encounter-aggregate.js";
import {
  cardPresentationSnapshot,
  createCardPresentationCache,
  updateCardPresentationCache,
  updateLiveActiveKeys
} from "./card-presentation.js";

const APP_VERSION = __APP_VERSION__;
const TAB_LOCK_REFRESH_MS = 2_000;
const CURRENT_REFRESH_MS = 1_000;
const PUBLIC_SUMMARY_READER_GRACE_MS = 3_000;
const EVENT_REFRESH_DELAY_MS = 75;
const STANDBY_RECONCILE_MS = 10_000;
const MAX_PENDING_ENCOUNTER_DELTAS = 512;
const CATCH_GALLERY_LOAD_LIMIT = 500;
const PAGE_API_RATE_LIMIT_FALLBACK_MS = 30_000;
const LAST_MANUAL_CLEAR_KEY = "pokepixel_hunt_analyzer_last_clear_at_ms_v1";
const ROOT_ID = "pokepixel-hunt-analyzer-root";
const CATCH_GALLERY_SECTION_ID = "catch-gallery";
const CATCH_GALLERY_BETA_STYLE_ID = "pha-catch-gallery-beta-style";
const DIAGNOSTICS_GLOBAL = "__POKEPIXEL_HUNT_ANALYZER_DIAGNOSTICS__";
const OBSERVED_EVENT_TYPES = new Set(EVENT_TYPES);
const TERMINAL_LIST_EVENTS = new Set([
  "capture.failed",
  "capture.success"
]);

let pipeline;
let sessionsRepository;
let encountersRepository;
let analyticsDatabase;
let lastManualClearAtMs = null;
let audioAlerts;
let catchGallery;
let historyDeleteControl;
let closedHud;
let ui;
let pageWindow;
let lootItemCatalog = new Map();
const readLootItemCatalog = () => lootItemCatalog;
let disposeItemsJsonObserver = null;
let disposePrePaintLauncherGuard = null;
let updateQueue = Promise.resolve();
let eventRefreshTimer = null;
let cachedSessionId = null;
// Presentation-only identity: no raw local UUID crosses the public boundary.
let lastProjectedSessionId = null;
let publicSessionGeneration = 0;
let cachedEncounters = [];
let cachedEncounterIndexes = new Map();
let cachedHudEncounterAggregate = null;
let pendingEncounterDelta = null;
let cachedAggregateMetrics = null;
let cachedLatestCaptureAttempt = null;
let cachedCurrentSessionSpecies = null;
let cachedCurrentSessionSpeciesSnapshotVersion = -1;
let cachedCardPresentation = createCardPresentationCache();
let liveActiveEncounterKeys = new Set();
let encounterDataRevision = 0;
let cachedEncounterRevision = -1;
let encounterListRevision = 0;
let cachedEncounterListRevision = -1;
let encounterListSnapshotVersion = 0;
let lastEncounterSyncAt = 0;
let fullEncounterReloads = 0;
let lastFullEncounterReload = null;
let maxFullEncounterReloadDurationMs = 0;
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
let lastProtocolQueueWaitMs = null;
let maxProtocolQueueWaitMs = 0;
let lastProtocolHandleDurationMs = null;
let maxProtocolHandleDurationMs = 0;
let embedded = false;
let publicSummary = createPublicSummary({ appVersion: APP_VERSION });
let disposePublicSummaryBridge = null;
let disposePublicSessionControl = null;
let disposePublicUiBridge = null;
let lastPublicSummaryReadAtMs = null;
let leadershipEpoch = 0;
let leadershipRefreshInterval = null;
let currentRefreshInterval = null;
let runtimeDisposed = false;
let pageApiRateLimitCount = 0;
let pageApiRateLimitedUntilMs = 0;
let lastPageApiRateLimitAtMs = null;
let resolveReady;
const ready = new Promise((resolve) => {
  resolveReady = resolve;
});

function markEncounterListDirty() {
  encounterDataRevision += 1;
  encounterListRevision += 1;
  pendingEncounterDelta = null;
}

function invalidateEncounterCache() {
  cachedSessionId = null;
  cachedEncounters = [];
  cachedEncounterIndexes = new Map();
  cachedHudEncounterAggregate = null;
  pendingEncounterDelta = null;
  cachedAggregateMetrics = null;
  cachedLatestCaptureAttempt = null;
  cachedCurrentSessionSpecies = null;
  cachedCurrentSessionSpeciesSnapshotVersion = -1;
  cachedCardPresentation = createCardPresentationCache();
  liveActiveEncounterKeys = new Set();
  cachedEncounterRevision = -1;
  cachedEncounterListRevision = -1;
  lastEncounterSyncAt = 0;
  markEncounterListDirty();
}

function restoreManualClearFence() {
  try {
    const stored = Number(localStorage.getItem(LAST_MANUAL_CLEAR_KEY));
    if (Number.isFinite(stored) && stored > 0 && stored <= Date.now()) {
      lastManualClearAtMs = stored;
    }
  } catch {
    // A storage-denied profile can still run; just lacks reload replay fencing.
  }
}

function predatesManualClear(receivedAtMs, eventAtMs) {
  return lastManualClearAtMs !== null && (
    receivedAtMs <= lastManualClearAtMs ||
    (Number.isFinite(eventAtMs) && eventAtMs > 0 &&
      eventAtMs <= lastManualClearAtMs)
  );
}

function recordEncounterChanges(rows, { listChanged = false, transitions = null } = {}) {
  const previousRevision = encounterDataRevision;
  const latestSpeciesWasCurrent = listChanged
    && cachedCurrentSessionSpeciesSnapshotVersion === encounterListSnapshotVersion;
  let latestSpeciesNeedsRebuild = false;
  encounterDataRevision += 1;
  if (listChanged) encounterListRevision += 1;
  liveActiveEncounterKeys = updateLiveActiveKeys(liveActiveEncounterKeys, rows);

  if (
    !cachedSessionId ||
    cachedEncounterRevision !== previousRevision ||
    !cachedHudEncounterAggregate ||
    !cachedAggregateMetrics ||
    rows.some((row) => row.sessionId !== cachedSessionId)
  ) {
    pendingEncounterDelta = null;
    return;
  }

  // Cross-check the authoritative transaction before-image against the local
  // projection before applying any incremental contribution. A stale cache
  // must be rehydrated instead of silently double-counting a corrected row.
  const byId = Array.isArray(transitions)
    ? new Map(transitions.map((entry) => [entry.after?.encounterId, entry]))
    : null;
  if (byId && (byId.size !== rows.length || rows.some((row) => {
    const transition = byId.get(row.encounterId);
    if (!transition || transition.after?.encounterId !== row.encounterId) return true;
    const index = cachedEncounterIndexes.get(row.encounterId);
    const cached = index === undefined ? null : cachedEncounters[index];
    return !sameEncounterCacheImage(cached, transition.before);
  }))) {
    pendingEncounterDelta = null;
    return;
  }

  if (!pendingEncounterDelta) {
    pendingEncounterDelta = {
      fromRevision: previousRevision,
      toRevision: encounterDataRevision,
      fromListVersion: encounterListSnapshotVersion,
      toListVersion: encounterListSnapshotVersion,
      changes: new Map()
    };
  }

  for (const row of rows) {
    const index = cachedEncounterIndexes.get(row.encounterId);
    const previous = byId
      ? byId.get(row.encounterId).before
      : index === undefined ? null : cachedEncounters[index];

    if (latestSpeciesWasCurrent && !latestSpeciesNeedsRebuild) {
      const latest = cachedCurrentSessionSpecies;
      const isLatestCorrection = previous?.encounterId === latest?.encounterId;
      const rowHasSpecies = Boolean(row?.speciesId || row?.speciesName);
      if (isLatestCorrection && (!rowHasSpecies || encounterRecency(row) < encounterRecency(previous))) {
        latestSpeciesNeedsRebuild = true;
      } else if (rowHasSpecies) {
        const nextAt = encounterRecency(row);
        const latestAt = latest ? encounterRecency(latest) : Number.NEGATIVE_INFINITY;
        const rowIndex = index === undefined ? cachedEncounters.length : index;
        const latestIndex = latest ? (cachedEncounterIndexes.get(latest.encounterId) ?? -1) : -1;
        if (!latest || isLatestCorrection || nextAt > latestAt || (nextAt === latestAt && rowIndex >= latestIndex)) {
          cachedCurrentSessionSpecies = row;
        }
      }
    }

    updateHudEncounterAggregate(cachedHudEncounterAggregate, previous, row);
    if (pendingEncounterDelta && pendingEncounterDelta.changes.size <= MAX_PENDING_ENCOUNTER_DELTAS) {
      const original = pendingEncounterDelta.changes.get(row.encounterId);
      pendingEncounterDelta.changes.set(row.encounterId, {
        previous: original ? original.previous : previous,
        next: row
      });
    }

    cachedAggregateMetrics = updateSessionMetricsForEncounter(
      cachedAggregateMetrics,
      previous,
      row
    );

    if (index === undefined) {
      cachedEncounterIndexes.set(row.encounterId, cachedEncounters.length);
      cachedEncounters.push(row);
    } else {
      cachedEncounters[index] = row;
    }
    cachedLatestCaptureAttempt = updateLatestCaptureAttempt(cachedLatestCaptureAttempt, row);
  }
  cachedCardPresentation = updateCardPresentationCache(cachedCardPresentation, rows);

  cachedEncounterRevision = encounterDataRevision;
  if (listChanged) {
    cachedEncounterListRevision = encounterListRevision;
    encounterListSnapshotVersion += 1;
    if (latestSpeciesWasCurrent && !latestSpeciesNeedsRebuild) {
      cachedCurrentSessionSpeciesSnapshotVersion = encounterListSnapshotVersion;
    }
  }
  if (pendingEncounterDelta) {
    pendingEncounterDelta.toRevision = encounterDataRevision;
    pendingEncounterDelta.toListVersion = encounterListSnapshotVersion;
    if (pendingEncounterDelta.changes.size > MAX_PENDING_ENCOUNTER_DELTAS) {
      pendingEncounterDelta = null;
    }
  }
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
    leadershipEpoch += 1;
    ui?.setActive(isActive);
    markEncounterListDirty();
    if (isActive) void closedHud?.refreshInventory("leadership");
  }
});

function stillOwnsLeadership(epoch) {
  return leadership.isActive() && leadershipEpoch === epoch;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function notePageApiRateLimit({ retryAfterMs = null } = {}) {
  const now = Date.now();
  const requestedDelay = Number(retryAfterMs);
  const delayMs = Math.max(
    PAGE_API_RATE_LIMIT_FALLBACK_MS,
    Number.isFinite(requestedDelay) && requestedDelay >= 0 ? requestedDelay : 0
  );
  pageApiRateLimitCount += 1;
  lastPageApiRateLimitAtMs = now;
  pageApiRateLimitedUntilMs = Math.max(pageApiRateLimitedUntilMs, now + delayMs);
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

function enqueueProtocolEvent(payload, socketId, receivedAtMs = Date.now()) {
  if (!payload || typeof payload !== "object") return;
  if (!OBSERVED_EVENT_TYPES.has(payload.type)) return;
  // Discard frames that arrived before a confirmed manual wipe but finished
  // asynchronous Blob decoding afterward. Timestamped replays from before the
  // wipe also stay rejected across reloads; no automatic age filter exists.
  const eventAtMs = Number(payload.ts);
  if (predatesManualClear(receivedAtMs, eventAtMs)) return;

  if (!leadership.isActive()) {
    protocolEventsDroppedStandby += 1;
    return;
  }
  const queuedLeadershipEpoch = leadershipEpoch;

  protocolEventsQueued += 1;
  protocolQueueDepth += 1;
  protocolMaxQueueDepth = Math.max(protocolMaxQueueDepth, protocolQueueDepth);
  const queuedAtMs = Date.now();
  const queuedAtMonotonicMs = performance.now();
  lastProtocolQueuedAtMs = queuedAtMs;

  updateQueue = updateQueue
    .then(async () => {
      await ready;
      if (!stillOwnsLeadership(queuedLeadershipEpoch)) {
        protocolEventsDroppedStandby += 1;
        return;
      }
      // Decoding may finish while a queued manual wipe is still committing.
      // The first fence was checked BEFORE joining updateQueue; recheck AFTER
      // the wipe has finished and BEFORE allowing this event to persist.
      if (predatesManualClear(receivedAtMs, eventAtMs)) return;
      lastProtocolQueueWaitMs = Math.max(0, performance.now() - queuedAtMonotonicMs);
      maxProtocolQueueWaitMs = Math.max(maxProtocolQueueWaitMs, lastProtocolQueueWaitMs);
      const startedAt = performance.now();
      let eventResult;
      try {
        eventResult = await pipeline.handle({
          type: payload.type,
          seq: finiteOrNull(payload.seq),
          ts: finiteOrNull(payload.ts),
          socketId,
          protocolGeneration: payload.protocolGeneration,
          data: payload.data
        });
      } finally {
        lastProtocolHandleDurationMs = Math.max(0, performance.now() - startedAt);
        maxProtocolHandleDurationMs = Math.max(maxProtocolHandleDurationMs, lastProtocolHandleDurationMs);
      }

      protocolEventsProcessed += 1;
      lastProtocolProcessedAtMs = Date.now();
      lastProtocolProcessed = {
        type: payload.type,
        seq: finiteOrNull(payload.seq),
        socketId
      };

      // No persistence changed for duplicates or rejected events. Invalidating
      // a terminal/loot revision here can force a full-Hunt IndexedDB read.
      if (eventResult?.ok !== true || eventResult.duplicate === true) return;

      if (eventResult?.terminalAlert) {
        void audioAlerts?.handleTerminalAlert(eventResult.terminalAlert);
      }

      if (payload.type === "capture.success") {
        catchGallery?.markDirty();
      }

      if (eventResult?.changedEncounters?.length > 0) {
        recordEncounterChanges(eventResult.changedEncounters, {
          listChanged: TERMINAL_LIST_EVENTS.has(payload.type),
          transitions: eventResult.encounterTransitions
        });
      } else if (TERMINAL_LIST_EVENTS.has(payload.type)) {
        markEncounterListDirty();
      }

      requestCurrentRefresh();
    })
    .catch((error) => {
      // A protocol envelope may have written an earlier independent effect
      // before a later IndexedDB transaction failed. Re-read the authoritative
      // store even though this envelope did not commit a complete projection.
      markEncounterListDirty();
      requestCurrentRefresh();
      console.error("PokePixel Hunt Analyzer (event pipeline):", error);
    })
    .finally(() => {
      protocolQueueDepth = Math.max(0, protocolQueueDepth - 1);
    });
}

async function performCurrentLoad() {
  if (!sessionsRepository || !encountersRepository) return;

  const now = Date.now();
  const session = await sessionsRepository.getCurrentReadOnly();
  const sessionId = session?.sessionId ?? null;
  if (lastProjectedSessionId !== sessionId) {
    lastProjectedSessionId = sessionId;
    publicSessionGeneration += 1;
  }
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
    const reloadReason = sessionChanged ? "session-change"
      : cachedEncounterRevision !== revisionAtStart ? "revision-mismatch"
        : "standby-reconcile";
    const reloadStartedAt = performance.now();
    cachedEncounters = session
      ? await encountersRepository.getBySessionId(sessionId)
      : [];
    cachedHudEncounterAggregate = createHudEncounterAggregate(cachedEncounters);
    cachedEncounterIndexes = new Map(
      cachedEncounters.map((encounter, index) => [encounter.encounterId, index])
    );
    cachedLatestCaptureAttempt = latestCaptureAttemptFromRows(cachedEncounters);
    liveActiveEncounterKeys = retainLiveActiveKeys(liveActiveEncounterKeys, cachedEncounters);
    cachedCardPresentation = createCardPresentationCache(cachedEncounters, { activeKeys: liveActiveEncounterKeys });

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
    const durationMs = Math.max(0, performance.now() - reloadStartedAt);
    fullEncounterReloads += 1;
    maxFullEncounterReloadDurationMs = Math.max(maxFullEncounterReloadDurationMs, durationMs);
    lastFullEncounterReload = {
      reason: reloadReason,
      encounterCount: cachedEncounters.length,
      durationMs,
      completedAtMs: Date.now()
    };
  }

  // Match CURRENT's headline invalidation: terminal/list/session changes,
  // not every loot-only metric patch or the 1s timer.
  if (cachedCurrentSessionSpeciesSnapshotVersion !== encounterListSnapshotVersion) {
    cachedCurrentSessionSpecies = latestSpeciesEncounter(cachedEncounters);
    cachedCurrentSessionSpeciesSnapshotVersion = encounterListSnapshotVersion;
  }

  const metrics = refreshSessionMetrics(cachedAggregateMetrics, session, now);
  const encounterDelta = !shouldReloadEncounters && pendingEncounterDelta
    && pendingEncounterDelta.toRevision === revisionAtStart
    && pendingEncounterDelta.toListVersion === encounterListSnapshotVersion
    ? {
        fromRevision: pendingEncounterDelta.fromRevision,
        toRevision: pendingEncounterDelta.toRevision,
        fromListVersion: pendingEncounterDelta.fromListVersion,
        toListVersion: pendingEncounterDelta.toListVersion,
        changes: [...pendingEncounterDelta.changes.values()]
      }
    : null;
  const currentState = {
    sessionId,
    measuredAtMs: now,
    sessionGeneration: sessionId == null ? null : publicSessionGeneration,
    endedAtMs: Number.isFinite(session?.endedAtMs) ? session.endedAtMs : null,
    encounterSnapshotVersion: encounterListSnapshotVersion,
    lootDataRevision: cachedEncounterRevision,
    encounterDelta,
    hudEncounterDerived: snapshotHudEncounterAggregate(cachedHudEncounterAggregate),
    metrics,
    encounters: cachedEncounters,
    currentSessionSpecies: cachedCurrentSessionSpecies,
    latestCaptureAttempt: cachedLatestCaptureAttempt,
    cardPresentation: cardPresentationSnapshot(cachedCardPresentation)
  };

  publicSummary = createPublicSummary({
    appVersion: APP_VERSION,
    leadershipActive: leadership.isActive(),
    currentState
  });
  ui?.renderCurrent(currentState);
  closedHud?.render(currentState);
  if (pendingEncounterDelta?.toRevision === revisionAtStart) pendingEncounterDelta = null;

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
      lastQueueWaitMs: lastProtocolQueueWaitMs,
      maxQueueWaitMs: maxProtocolQueueWaitMs,
      lastHandleDurationMs: lastProtocolHandleDurationMs,
      maxHandleDurationMs: maxProtocolHandleDurationMs,
      currentRefresh: currentRefreshGate.snapshot(),
      uiCache: ui?.retentionSnapshot?.() ?? null,
      currentCache: {
        cachedSessionId,
        encounterDataRevision,
        cachedEncounterRevision,
        encounterListRevision,
        cachedEncounterListRevision,
        encounterCount: cachedEncounters.length,
        lastEncounterSyncAt,
        fullEncounterReloads,
        retained: currentRetentionFootprint({
          encounters: cachedEncounters,
          indexes: cachedEncounterIndexes,
          cardPresentation: cachedCardPresentation,
          liveKeys: liveActiveEncounterKeys,
          pendingChanges: pendingEncounterDelta,
          pageWindow
        }),
        maxFullEncounterReloadDurationMs,
        lastFullEncounterReload: lastFullEncounterReload ? { ...lastFullEncounterReload } : null
      },
      apiRateLimit: {
        observed429: pageApiRateLimitCount,
        lastObservedAtMs: lastPageApiRateLimitAtMs,
        limitedUntilMs: pageApiRateLimitedUntilMs || null
      },
      inventory: closedHud?.getInventoryDiagnostics?.() ?? null,
      currentRender: lastCurrentRender
        ? { atMs: lastCurrentRenderAtMs, ...lastCurrentRender }
        : null
    },
    session: session
      ? {
          sessionId: session.sessionId,
          status: session.status,
          locked: Boolean(session.locked),
          activityKind: session.activityKind ?? "hunt",
          activityInstanceId: session.activityInstanceId ?? null,
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
  }
}

async function handleSessionAction(action) {
  if (!leadership.isActive()) return false;
  const queuedLeadershipEpoch = leadershipEpoch;
  let succeeded = false;

  updateQueue = updateQueue
    .then(async () => {
      await ready;
      if (!stillOwnsLeadership(queuedLeadershipEpoch)) return;
      let result = null;
      switch (action) {
        case "new":
        case "reset-running":
          result = await sessionsRepository.forceNewSession();
          invalidateEncounterCache();
          break;
        case "reset":
          result = await sessionsRepository.forceNewSession({ startPaused: true });
          invalidateEncounterCache();
          break;
        case "pause":
          result = await sessionsRepository.pauseManual();
          break;
        case "resume":
          result = await sessionsRepository.resumeManual();
          break;
        case "end":
          result = await sessionsRepository.endManual();
          break;
        default:
          return;
      }
      if (!result) return;

      await loadCurrent();
      ui?.markHistoryDirty();
      historyDeleteControl?.refresh();
      succeeded = true;
    })
    .catch((error) => {
      console.error("PokePixel Hunt Analyzer (session action):", error);
    });

  await updateQueue;
  return succeeded;
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
  const queuedLeadershipEpoch = leadershipEpoch;

  const task = updateQueue.then(async () => {
    await ready;
    if (!stillOwnsLeadership(queuedLeadershipEpoch)) {
      throw new Error("Hunt deletion is available only on the ACTIVE tab");
    }
    await loadCurrent();
    if (!stillOwnsLeadership(queuedLeadershipEpoch)) {
      throw new Error("Hunt deletion is available only on the ACTIVE tab");
    }

    const { deletingCurrent } = await deleteHuntData({
      sessionId,
      sessionsRepository,
      encountersRepository
    });

    ui?.markHistoryDirty();
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

function handleRemoveAllAnalytics() {
  if (!leadership.isActive()) return Promise.reject(new Error("Somente a instância ACTIVE pode remover os dados"));
  const queuedLeadershipEpoch = leadershipEpoch;
  const task = updateQueue.then(async () => {
    await ready;
    if (!stillOwnsLeadership(queuedLeadershipEpoch)) {
      throw new Error("A liderança mudou antes da remoção");
    }
    // All queued protocol writes commit before this wipe. Drain diagnostics
    // so no previously scheduled meta write can recreate cleared counters.
    await pipeline.flushDiagnostics();
    if (!stillOwnsLeadership(queuedLeadershipEpoch)) {
      throw new Error("A liderança mudou antes da remoção");
    }
    const removalResult = await clearAllAnalytics(analyticsDatabase);
    lastManualClearAtMs = Date.now();
    try { localStorage.setItem(LAST_MANUAL_CLEAR_KEY, String(lastManualClearAtMs)); } catch {}
    // Replace correlations/dedupe so delayed effects cannot target encounters
    // that were just deleted from the local IndexedDB database.
    pipeline = createEventPipeline(analyticsDatabase, { appVersion: APP_VERSION });
    invalidateEncounterCache();
    catchGallery?.resetAfterClear();
    ui?.resetHistoryAfterClear();
    // Once the delete commits, a view refresh failure must not misreport the
    // irreversible operation as uncommitted.
    try {
      await loadCurrent();
      await ui?.refreshHistoryIfVisible();
    } catch (error) {
      console.error("PokePixel Hunt Analyzer (post-remove refresh):", error);
    }
    return removalResult;
  });
  updateQueue = task.catch(() => {});
  return task;
}

function mountUiWhenReady() {
  const mount = () => {
    catchGallery?.dispose();
    historyDeleteControl?.dispose();
    closedHud?.dispose();
    disposePublicUiBridge?.();
    ui = createUi({
      onSessionAction: (action) => void handleSessionAction(action),
      onLoadHistorySessions: (options) => sessionsRepository.getPage(options),
      onLoadHistorySessionEncounters: (sessionId) =>
        encountersRepository.getBySessionId(sessionId),
      getLootItemCatalog: readLootItemCatalog,
      onClearAll: handleRemoveAllAnalytics,
      onRequestCurrentRefresh: () => {
        // Returning from a long-hidden Current requires a fresh full source
        // read, even if the ACTIVE cooperating revision did not advance:
        // legacy same-origin writers may have changed its IDB rows.
        // Preserve the tracker/owner/live-active Card keys; do NOT call
        // invalidateEncounterCache(), which clears unrelated live authority.
        markEncounterListDirty();
        return loadCurrent();
      }
    });
    disposePublicUiBridge = installPublicUiBridge({
      pageWindow,
      appVersion: APP_VERSION,
      navigate: (destination) => ui?.navigate(destination) || { ok: false, reason: "navigation-unavailable" }
    });
    closedHud = createClosedHud({
      pageWindow,
      isInventoryActive: () => leadership.isActive(),
      getApiRateLimitUntil: () => pageApiRateLimitedUntilMs
    });
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

function scheduleLeadershipRefresh() {
  if (runtimeDisposed || leadershipRefreshInterval !== null) return;
  leadershipRefreshInterval = setInterval(() => leadership.refresh(), TAB_LOCK_REFRESH_MS);
}

function scheduleRefreshes() {
  if (runtimeDisposed || currentRefreshInterval !== null) return;
  currentRefreshInterval = setInterval(() => {
    const now = Date.now();
    if (!embedded) closedHud?.tick(now);
    ui?.maybeReleaseHiddenViews?.(now);
    if (!needsPeriodicCurrentRefresh({
      currentVisible: ui?.needsCurrentTicker?.() === true,
      lastFullReadAtMs: lastPublicSummaryReadAtMs,
      now,
      graceMs: PUBLIC_SUMMARY_READER_GRACE_MS
    })) return;
    loadCurrent().catch((error) => {
      console.error("PokePixel Hunt Analyzer (Current refresh):", error);
    });
  }, CURRENT_REFRESH_MS);
}

async function initialize() {
  restoreManualClearFence();
  pageWindow = resolvePageWindow({
    unsafeWindowObject:
      typeof unsafeWindow !== "undefined" ? unsafeWindow : null,
    windowObject: window
  });
  disposeItemsJsonObserver = installItemsJsonObserver({
    windowObject: pageWindow,
    onItems: (payload) => {
      lootItemCatalog = createLootItemCatalog(payload);
      ui?.refreshLootCatalog();
    },
    onRateLimited: notePageApiRateLimit
  });
  embedded = isEmbedMode(pageWindow);
  if (!embedded) disposePrePaintLauncherGuard = installPrePaintLauncherGuard();
  disposePublicSummaryBridge = installPublicSummaryBridge({
    pageWindow,
    appVersion: APP_VERSION,
    getSummary: () => publicSummary,
    onRead: () => { lastPublicSummaryReadAtMs = Date.now(); }
  });
  disposePublicSessionControl = installPublicSessionControl({
    pageWindow,
    performAction: handleSessionAction
  });

  installWebSocketObserver({
    onPayload: enqueueProtocolEvent,
    windowObject: pageWindow
  });
  const startupLeadershipActive = await leadership.acquire();
  scheduleLeadershipRefresh();
  if (!embedded) installDiagnosticsBridge();

  let database;
  try {
    database = await openDatabase();
  } catch (error) {
    if (error?.name !== "VersionError") throw error;
    // QA retention previously upgraded some profiles to v4. Reopen that
    // existing schema unchanged; never delete/recreate the IndexedDB just to
    // get v1.15.6 running again.
    database = await openDatabase({ version: null });
  }
  analyticsDatabase = database;
  registerDatabaseWriteGate(database, () => leadership.isActive());
  sessionsRepository = createSessionsRepository(database);
  encountersRepository = createEncountersRepository(database);
  pipeline = createEventPipeline(database, { appVersion: APP_VERSION });
  if (!embedded) {
    audioAlerts = createAudioAlerts();
    catchGallery = createCatchGallery({
      loadEncounters: () =>
        encountersRepository.getRecentCaptureTickets(CATCH_GALLERY_LOAD_LIMIT)
    });
    historyDeleteControl = createHistoryDeleteControl({
      onDeleteSession: handleHistorySessionDelete,
      canDeleteSession: canDeleteHistorySession
    });
  }
  if (startupLeadershipActive && leadership.refresh() && leadership.isActive()) {
    await pipeline.recoverOnStartup();
  }

  if (!embedded) mountUiWhenReady();
  resolveReady();

  if (document.documentElement) await loadCurrent();
  scheduleRefreshes();
}

function disposeRuntime() {
  if (runtimeDisposed) return;
  runtimeDisposed = true;
  resolveReady?.();
  catchGallery?.dispose();
  historyDeleteControl?.dispose();
  closedHud?.dispose();
  disposePrePaintLauncherGuard?.();
  disposePrePaintLauncherGuard = null;
  disposePublicSummaryBridge?.();
  disposePublicSessionControl?.();
  disposePublicUiBridge?.();
  disposeItemsJsonObserver?.();
  if (eventRefreshTimer !== null) clearTimeout(eventRefreshTimer);
  if (leadershipRefreshInterval !== null) clearInterval(leadershipRefreshInterval);
  if (currentRefreshInterval !== null) clearInterval(currentRefreshInterval);
  eventRefreshTimer = null;
  leadershipRefreshInterval = null;
  currentRefreshInterval = null;
  try {
    if (pageWindow?.[DIAGNOSTICS_GLOBAL] === buildDiagnosticsSnapshot) {
      delete pageWindow[DIAGNOSTICS_GLOBAL];
    }
  } catch {
  }
  void pipeline?.flushDiagnostics();
  leadership.release();
}

window.addEventListener("beforeunload", disposeRuntime, { once: true });

initialize().catch((error) => {
  disposeRuntime();
  console.error("PokePixel Hunt Analyzer userscript:", error);
});
