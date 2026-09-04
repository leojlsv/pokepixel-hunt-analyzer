/**
 * Coordinates protocol events with Hunt/session state, encounter tracking,
 * configuration snapshots and IndexedDB repositories.
 *
 * Tracker state is intentionally kept in memory for the lifetime of the
 * userscript runtime; persisted rows remain the durable source of truth.
 */

import { normalizeEvent, EVENT_TYPES } from "../domain/events.js";
import {
  createTrackerState,
  applyEvent,
  sweepStale
} from "../domain/encounterTracker.js";
import { buildCanonicalConfig } from "../domain/config.js";
import { buildGroupKey } from "../domain/groupKey.js";
import { decideSessionTransition } from "../domain/huntLifecycle.js";
import { buildTerminalAlert } from "../domain/terminalAlert.js";
import { canGenerateCaptureTicket } from "../domain/captureTicket.js";
import { createConfigsRepository } from "../data/configsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createDiagnosticsRepository } from "../data/diagnosticsRepository.js";
import { SCHEMA_VERSION } from "../data/migrations.js";

const KNOWN_EVENT_TYPES = new Set(EVENT_TYPES);
const DIAGNOSTICS_FLUSH_MS = 1_000;
const RECENT_EVENT_LIMIT = 50;
const DEFAULT_DEDUPE_EVENT_LIMIT = 10_000;

function protocolDedupeKey(message) {
  return `${message.socketId}|${message.type}|${message.seq}`;
}

function addPatch(target, patch) {
  for (const [field, amount] of Object.entries(patch)) {
    target[field] = (target[field] || 0) + amount;
  }
}

export function createEventPipeline(
  db,
  {
    now = Date.now,
    appVersion = null,
    dedupeEventLimit = DEFAULT_DEDUPE_EVENT_LIMIT
  } = {}
) {
  if (!Number.isSafeInteger(dedupeEventLimit) || dedupeEventLimit < 1) {
    throw new RangeError("dedupeEventLimit must be a positive safe integer");
  }

  const sessionsRepo = createSessionsRepository(db, { now });
  const encountersRepo = createEncountersRepository(db);
  const configsRepo = createConfigsRepository(db, { now });
  const diagnosticsRepo = createDiagnosticsRepository(db);

  // Bound production dedupe memory while preserving exact
  // socketId|type|seq semantics for the most recent protocol window.
  const seenEventKeys = new Set();
  const seenEventQueue = [];

  function rememberEventKey(key) {
    seenEventKeys.add(key);
    seenEventQueue.push(key);

    if (seenEventQueue.length > dedupeEventLimit) {
      seenEventKeys.delete(seenEventQueue.shift());
    }
  }

  // Diagnostics must never sit in front of encounter persistence. Counters are
  // accumulated in memory and flushed as a best-effort background batch.
  let pendingDiagnostics = {};
  let diagnosticsFlushTimer = null;
  let diagnosticsFlushPromise = Promise.resolve();

  function scheduleDiagnosticsFlush() {
    if (diagnosticsFlushTimer !== null) return;

    diagnosticsFlushTimer = setTimeout(() => {
      diagnosticsFlushTimer = null;
      void flushDiagnostics();
    }, DIAGNOSTICS_FLUSH_MS);
    diagnosticsFlushTimer?.unref?.();
  }

  function bumpDiagnostics(patch) {
    addPatch(pendingDiagnostics, patch);
    scheduleDiagnosticsFlush();
  }

  function flushDiagnostics() {
    if (diagnosticsFlushTimer !== null) {
      clearTimeout(diagnosticsFlushTimer);
      diagnosticsFlushTimer = null;
    }

    const patch = pendingDiagnostics;
    pendingDiagnostics = {};
    if (Object.keys(patch).length === 0) return diagnosticsFlushPromise;

    diagnosticsFlushPromise = diagnosticsFlushPromise
      .then(() => diagnosticsRepo.increment(patch))
      .catch(() => {});

    return diagnosticsFlushPromise;
  }

  async function drainDiagnostics() {
    // A flush can race with new increments. Drain until no in-memory patch is
    // left so a requested snapshot remains exact for tests/support tooling.
    while (Object.keys(pendingDiagnostics).length > 0) {
      await flushDiagnostics();
    }
    await diagnosticsFlushPromise;
  }

  let trackerState = createTrackerState();
  let lastReceivedEvent = null;
  let lastAcceptedEvent = null;
  const recentEvents = [];

  function runtimeEvent(message, outcome) {
    return {
      atMs: now(),
      type: message?.type ?? null,
      seq: message?.seq ?? null,
      socketId: message?.socketId ?? null,
      protocolTs: message?.ts ?? null,
      outcome
    };
  }

  function recordRuntimeEvent(message, outcome) {
    const entry = runtimeEvent(message, outcome);
    lastReceivedEvent = entry;
    if (outcome === "accepted") lastAcceptedEvent = entry;
    recentEvents.push(entry);
    if (recentEvents.length > RECENT_EVENT_LIMIT) recentEvents.shift();
  }

  // No reliable protocol EXP-rate field is confirmed, so configuration
  // snapshots keep the existing "unknown" default.
  async function resolveConfigId(autoCaptureSnapshot) {
    const canonicalConfig = buildCanonicalConfig({
      captureConfig: autoCaptureSnapshot,
      captureConfigSource: autoCaptureSnapshot ? "protocol" : "unknown"
    });

    const configRow = await configsRepo.getOrCreate(canonicalConfig);
    return configRow.configId;
  }

  // Only combat.started-derived rows carry autoCaptureSnapshot. Orphans do
  // not have enough configuration context to produce a reliable group key.
  async function finishRowForPersistence(row, sessionId) {
    const hasAutoCapture = Object.prototype.hasOwnProperty.call(
      row,
      "autoCaptureSnapshot"
    );
    const { autoCaptureSnapshot, ...rest } = row;

    if (!hasAutoCapture) {
      return { ...rest, sessionId, configId: null, groupKey: null };
    }

    const configId = await resolveConfigId(autoCaptureSnapshot);

    let groupKey = null;
    try {
      groupKey = buildGroupKey({
        speciesId: rest.speciesId,
        level: rest.level,
        configId
      });
    } catch {
      // Persist useful encounter data even when malformed identity fields
      // prevent grouping.
      groupKey = null;
    }

    return { ...rest, sessionId, configId, groupKey };
  }

  // combat.started is the event that carries the server session/zone context
  // used to decide automatic Hunt boundaries.
  async function resolveSessionForCombatStarted(row) {
    const session = await sessionsRepo.getOrStartCurrent();

    // Manual Pause/End locks the Hunt. Only explicit Resume/New Hunt should
    // allow automatic boundary handling to resume.
    if (session.locked) {
      return session;
    }

    const decision = decideSessionTransition(
      { serverSessionId: session.serverSessionId, zoneId: session.zoneId },
      { serverSessionId: row.serverSessionId, zoneId: row.zoneId }
    );

    if (decision.action === "new_hunt") {
      await sessionsRepo.forceNewSession();
    }

    if (decision.action === "none") {
      return session;
    }

    return sessionsRepo.adoptServerContext({
      serverSessionId: row.serverSessionId,
      zoneId: row.zoneId
    });
  }

  async function persistFinalizedEncounter(effect) {
    const updated = await encountersRepo.update(effect.encounterId, effect.patch);

    // `captureTicketAtMs` is deliberately derived here, after the complete
    // persisted row exists. The sparse v3 index then contains only encounters
    // that can actually generate a ticket; ordinary successes never enter it.
    if (
      canGenerateCaptureTicket(updated) &&
      updated.captureTicketAtMs !== updated.captureAtMs
    ) {
      return encountersRepo.update(effect.encounterId, {
        captureTicketAtMs: updated.captureAtMs
      });
    }

    return updated;
  }

  async function applyEffects(effects) {
    let sessionId;
    const changedEncounters = new Map();

    async function currentSessionId() {
      if (sessionId === undefined) {
        const session = await sessionsRepo.getOrStartCurrent();
        sessionId = session.sessionId;
      }
      return sessionId;
    }

    // Resolve a combat boundary before applying this batch so its activity
    // and encounter effects land on the correct session.
    const combatStartedCreate = effects.find(
      (effect) =>
        effect.type === "encounter.create" &&
        Object.prototype.hasOwnProperty.call(effect.row, "autoCaptureSnapshot")
    );

    if (combatStartedCreate) {
      const session = await resolveSessionForCombatStarted(combatStartedCreate.row);
      sessionId = session.sessionId;
    }

    for (const effect of effects) {
      switch (effect.type) {
        case "session.activity":
          await sessionsRepo.touchActivityAutomatic();
          break;

        case "session.pause":
          await sessionsRepo.pauseAutomatic();
          break;

        case "session.potion_used":
          await sessionsRepo.recordPotionUsed(effect.cost);
          break;

        case "encounter.create": {
          const resolvedSessionId = await currentSessionId();
          const row = await finishRowForPersistence(effect.row, resolvedSessionId);
          const created = await encountersRepo.create(row);
          changedEncounters.set(created.encounterId, created);
          break;
        }

        case "encounter.update": {
          const updated = await encountersRepo.update(effect.encounterId, effect.patch);
          changedEncounters.set(updated.encounterId, updated);
          break;
        }

        case "encounter.finalize": {
          const finalized = await persistFinalizedEncounter(effect);
          changedEncounters.set(finalized.encounterId, finalized);
          break;
        }

        default:
          break;
      }
    }

    return changedEncounters;
  }

  /**
   * Handles one observed protocol envelope.
   *
   * Invalid/unsupported events are ignored without throwing. Genuine
   * persistence failures still reject so the runtime can report them.
   */
  async function handle(message) {
    bumpDiagnostics({ eventsReceived: 1 });

    const normalized = normalizeEvent(message.type, message.data);

    if (!normalized) {
      // A known type rejected by its normalizer is a parse error; an unknown
      // type is an expected ignore.
      bumpDiagnostics(
        KNOWN_EVENT_TYPES.has(message.type) ? { parseErrors: 1 } : { eventsIgnored: 1 }
      );
      recordRuntimeEvent(message, "ignored");

      return { ok: false, reason: "ignored" };
    }

    const dedupeKey = protocolDedupeKey(message);
    if (seenEventKeys.has(dedupeKey)) {
      bumpDiagnostics({ duplicateEvents: 1 });
      recordRuntimeEvent(message, "duplicate");
      return { ok: true, duplicate: true };
    }
    rememberEventKey(dedupeKey);

    const envelope = {
      type: message.type,
      seq: message.seq,
      ts: message.ts,
      socketId: message.socketId,
      data: normalized
    };

    // Production dedupe is handled by the bounded registry above. Keep
    // the reducer's own Set empty between events so its immutable state
    // cloning remains O(active encounters), not O(total events in the Hunt).
    trackerState = { ...trackerState, seenKeys: new Set() };

    const swept = sweepStale(trackerState, now());
    trackerState = swept.state;
    const changedEncounters = await applyEffects(swept.effects);

    const terminalAlert = buildTerminalAlert(envelope, trackerState);
    const result = applyEvent(trackerState, envelope);
    trackerState = { ...result.state, seenKeys: new Set() };
    const resultChanges = await applyEffects(result.effects);
    for (const [encounterId, row] of resultChanges) {
      changedEncounters.set(encounterId, row);
    }

    const orphansCreated = result.effects.filter(
      (effect) => effect.type === "encounter.create" && effect.row.state === "orphan"
    ).length;

    if (orphansCreated > 0) {
      bumpDiagnostics({ orphanEvents: orphansCreated });
    }

    recordRuntimeEvent(message, "accepted");
    return {
      ok: true,
      terminalAlert,
      changedEncounters: [...changedEncounters.values()]
    };
  }

  async function getDiagnosticsSnapshot() {
    await drainDiagnostics();
    const counters = await diagnosticsRepo.getCounters();

    return {
      ...counters,
      activeEncounters: trackerState.inProgress.size,
      dedupeRegistrySize: seenEventKeys.size,
      lastReceivedEvent: lastReceivedEvent ? { ...lastReceivedEvent } : null,
      lastAcceptedEvent: lastAcceptedEvent ? { ...lastAcceptedEvent } : null,
      recentEvents: recentEvents.map((entry) => ({ ...entry })),
      dbVersion: SCHEMA_VERSION,
      appVersion
    };
  }

  return {
    handle,
    recoverOnStartup: sessionsRepo.recoverOnStartup,
    getDiagnosticsSnapshot,
    flushDiagnostics
  };
}
