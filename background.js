/**
 * Service worker. Routes `protocol.event` (the only thing `hook.js`/
 * `content.js` still send — the legacy v0.3.0 counter pipeline was
 * retired in Fase 3, docs/DEVELOPMENT.md §2) into the event pipeline, and
 * a small set of Side Panel action messages (`session.*`) that mutate
 * session state. Reads for the Side Panel's Current view go directly
 * through its own IndexedDB connection (sidepanel/sidepanel.js) — this
 * file only handles writes, keeping every mutation serialized through
 * `updateQueue`.
 */

import { openDatabase } from "./data/db.js";
import { createEventPipeline } from "./services/eventPipeline.js";
import { createSessionsRepository } from "./data/sessionsRepository.js";
import { createEncountersRepository } from "./data/encountersRepository.js";
import { createDiagnosticsRepository } from "./data/diagnosticsRepository.js";
import { computeSessionMetrics } from "./domain/sessionMetrics.js";

let updateQueue = Promise.resolve();

// Single shared connection for this service worker's lifetime — reused by
// the event pipeline, the badge refresh, and every session/settings action
// below instead of opening a new one each time.
let dbPromise = null;

// A rejected Promise is still a truthy value, so without resetting it here
// a transient openDatabase() failure (e.g. onblocked for a moment during an
// extension update, while an older Side Panel connection hasn't closed yet)
// would otherwise be cached as broken for the rest of this service worker's
// lifetime — every later message failing instantly without ever retrying.
function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}

let eventPipelinePromise = null;

function getEventPipeline() {
  if (!eventPipelinePromise) {
    eventPipelinePromise = getDb()
      .then((db) => createEventPipeline(db, { appVersion: chrome.runtime.getManifest().version }))
      .catch((error) => {
        eventPipelinePromise = null;
        throw error;
      });
  }

  return eventPipelinePromise;
}

// Diagnostics must never affect the game (docs/DEVELOPMENT.md §1) — every
// call site below is best-effort, swallowed with .catch(() => {}).
async function recordDbError() {
  const db = await getDb();
  await createDiagnosticsRepository(db).increment({ dbErrors: 1 });
}

// Toolbar badge derives from v1 session/encounter data (docs/DEVELOPMENT.md
// §2) — no separate counter to keep in sync anymore.
async function refreshBadge() {
  const db = await getDb();
  const sessionsRepo = createSessionsRepository(db);
  const encountersRepo = createEncountersRepository(db);

  const session = await sessionsRepo.getCurrentReadOnly();
  const encounters = session
    ? await encountersRepo.getBySessionId(session.sessionId)
    : [];

  const metrics = computeSessionMetrics({ session, encounters, now: Date.now() });

  await chrome.action.setBadgeText({
    text: metrics.rarePlusFailed > 0 ? String(metrics.rarePlusFailed) : ""
  });

  await chrome.action.setBadgeBackgroundColor({ color: "#b23a48" });
}

function isPokePixelSender(sender) {
  const url =
    sender?.url ||
    sender?.tab?.url ||
    "";

  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "pokepixel.nietore.com"
    );
  } catch {
    return false;
  }
}

async function configureSidePanel() {
  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
}

chrome.runtime.onInstalled.addListener(() => {
  updateQueue = updateQueue
    .then(() => configureSidePanel())
    .catch(console.error);

  refreshBadge().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  updateQueue = updateQueue
    .then(() => configureSidePanel())
    .catch(console.error);

  refreshBadge().catch(console.error);

  // Independente da fila acima: recupera a sessão local
  // (docs/ARCHITECTURE.md §7 "Browser restart recovery") — só roda em
  // reinício real do navegador, nunca a cada wake do service worker.
  getEventPipeline()
    .then((pipeline) => pipeline.recoverOnStartup())
    .catch((error) => {
      console.error(
        "PokePixel Hunt Analyzer (session recovery):",
        error
      );
    });
});

configureSidePanel().catch(console.error);

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (
      !message ||
      typeof message !== "object"
    ) {
      return false;
    }

    const pageMessageTypes = new Set(["protocol.event"]);

    if (
      pageMessageTypes.has(message.type) &&
      !isPokePixelSender(sender)
    ) {
      sendResponse({
        ok: false,
        error: "invalid_sender"
      });

      return false;
    }

    if (message.type === "protocol.event") {
      // Um erro aqui nunca deve impedir sendResponse
      // (docs/DEVELOPMENT.md §1 "Analytics failures must fail closed").
      updateQueue = updateQueue
        .then(async () => {
          const pipeline = await getEventPipeline();

          await pipeline.handle({
            type: message.eventType,
            seq: message.seq,
            ts: message.ts,
            socketId: message.socketId,
            data: message.data
          });

          await refreshBadge();
        })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error(
            "PokePixel Hunt Analyzer (event pipeline):",
            error
          );

          recordDbError().catch(() => {});

          sendResponse({
            ok: false,
            error: "protocol_event_failed"
          });
        });

      return true;
    }

    if (message.type === "session.new") {
      updateQueue = updateQueue
        .then(async () => {
          const db = await getDb();
          await createSessionsRepository(db).forceNewSession();
          await refreshBadge();
        })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error("PokePixel Hunt Analyzer (session.new):", error);
          recordDbError().catch(() => {});
          sendResponse({ ok: false, error: "session_new_failed" });
        });

      return true;
    }

    if (message.type === "session.pause") {
      // Manual: locks the session so no automatic signal can resume it
      // until "Resume" or "New Hunt" (data/sessionsRepository.js).
      updateQueue = updateQueue
        .then(async () => {
          const db = await getDb();
          await createSessionsRepository(db).pauseManual();
        })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error("PokePixel Hunt Analyzer (session.pause):", error);
          recordDbError().catch(() => {});
          sendResponse({ ok: false, error: "session_pause_failed" });
        });

      return true;
    }

    if (message.type === "session.resume") {
      updateQueue = updateQueue
        .then(async () => {
          const db = await getDb();
          await createSessionsRepository(db).resumeManual();
        })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error("PokePixel Hunt Analyzer (session.resume):", error);
          recordDbError().catch(() => {});
          sendResponse({ ok: false, error: "session_resume_failed" });
        });

      return true;
    }

    if (message.type === "session.end") {
      // Manual: locks the session so no automatic signal can start a new
      // one until "New Hunt" (data/sessionsRepository.js).
      updateQueue = updateQueue
        .then(async () => {
          const db = await getDb();
          await createSessionsRepository(db).endManual();
          await refreshBadge();
        })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error("PokePixel Hunt Analyzer (session.end):", error);
          recordDbError().catch(() => {});
          sendResponse({ ok: false, error: "session_end_failed" });
        });

      return true;
    }

    return false;
  }
);
