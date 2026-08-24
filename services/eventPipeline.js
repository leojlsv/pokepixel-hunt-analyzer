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
import { createConfigsRepository } from "../data/configsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createDiagnosticsRepository } from "../data/diagnosticsRepository.js";
import { SCHEMA_VERSION } from "../data/migrations.js";

const KNOWN_EVENT_TYPES = new Set(EVENT_TYPES);

function protocolDedupeKey(message) {
  return `${message.socketId}|${message.type}|${message.seq}`;
}

export function createEventPipeline(db, { now = Date.now, appVersion = null } = {}) {
  const sessionsRepo = createSessionsRepository(db, { now });
  const encountersRepo = createEncountersRepository(db);
  const configsRepo = createConfigsRepository(db, { now });
  const diagnosticsRepo = createDiagnosticsRepository(db);

  // Keep the complete runtime dedupe history here as one append-only Set.
  // The domain reducer remains independently dedupe-safe for unit callers,
  // but the production pipeline clears its per-state copy after each event.
  // This preserves exact socketId|type|seq semantics without cloning an
  // ever-growing Set once or twice for every protocol event.
  const seenEventKeys = new Set();

  // Diagnostics are best-effort and must never break analytics processing.
  function bumpDiagnostics(patch) {
    return diagnosticsRepo.increment(patch).catch(() => {});
  }

  let trackerState = createTrackerState();

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

  async function applyEffects(effects) {
    let sessionId;

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
          await encountersRepo.create(row);
          break;
        }

        case "encounter.update":
        case "encounter.finalize":
          await encountersRepo.update(effect.encounterId, effect.patch);
          break;

        default:
          break;
      }
    }
  }

  /**
   * Handles one observed protocol envelope.
   *
   * Invalid/unsupported events are ignored without throwing. Genuine
   * persistence failures still reject so the runtime can report them.
   */
  async function handle(message) {
    await bumpDiagnostics({ eventsReceived: 1 });

    const normalized = normalizeEvent(message.type, message.data);

    if (!normalized) {
      // A known type rejected by its normalizer is a parse error; an unknown
      // type is an expected ignore.
      await bumpDiagnostics(
        KNOWN_EVENT_TYPES.has(message.type) ? { parseErrors: 1 } : { eventsIgnored: 1 }
      );

      return { ok: false, reason: "ignored" };
    }

    const dedupeKey = protocolDedupeKey(message);
    if (seenEventKeys.has(dedupeKey)) {
      await bumpDiagnostics({ duplicateEvents: 1 });
      return { ok: true, duplicate: true };
    }
    seenEventKeys.add(dedupeKey);

    const envelope = {
      type: message.type,
      seq: message.seq,
      ts: message.ts,
      socketId: message.socketId,
      data: normalized
    };

    // Production dedupe is handled by the append-only registry above. Keep
    // the reducer's own Set empty between events so its immutable state
    // cloning remains O(active encounters), not O(total events in the Hunt).
    trackerState = { ...trackerState, seenKeys: new Set() };

    const swept = sweepStale(trackerState, now());
    trackerState = swept.state;
    await applyEffects(swept.effects);

    const terminalAlert = buildTerminalAlert(envelope, trackerState);
    const result = applyEvent(trackerState, envelope);
    trackerState = { ...result.state, seenKeys: new Set() };
    await applyEffects(result.effects);

    const orphansCreated = result.effects.filter(
      (effect) => effect.type === "encounter.create" && effect.row.state === "orphan"
    ).length;

    if (orphansCreated > 0) {
      await bumpDiagnostics({ orphanEvents: orphansCreated });
    }

    return { ok: true, terminalAlert };
  }

  async function getDiagnosticsSnapshot() {
    const counters = await diagnosticsRepo.getCounters();

    return {
      ...counters,
      activeEncounters: trackerState.inProgress.size,
      dbVersion: SCHEMA_VERSION,
      appVersion
    };
  }

  return {
    handle,
    recoverOnStartup: sessionsRepo.recoverOnStartup,
    getDiagnosticsSnapshot
  };
}
