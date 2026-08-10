/**
 * Orchestrates the Phase 2 event pipeline. The only module in this phase
 * that performs real IndexedDB I/O — everything it calls
 * (domain/events.js, domain/encounterTracker.js, domain/config.js,
 * domain/groupKey.js) is pure and already unit-tested on its own.
 *
 * `createEventPipeline(db)` returns a `handle(message)` that
 * services/background.js's `protocol.event` listener calls for every
 * observed protocol message. The in-memory encounter-tracker state lives
 * for the lifetime of this module instance (i.e. until the MV3 service
 * worker is suspended) — see the plan's "Risks" section for why that's an
 * accepted limitation, not a correctness bug.
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
import { createConfigsRepository } from "../data/configsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createDiagnosticsRepository } from "../data/diagnosticsRepository.js";
import { SCHEMA_VERSION } from "../data/migrations.js";

const KNOWN_EVENT_TYPES = new Set(EVENT_TYPES);

export function createEventPipeline(db, { now = Date.now, appVersion = null } = {}) {
  const sessionsRepo = createSessionsRepository(db, { now });
  const encountersRepo = createEncountersRepository(db);
  const configsRepo = createConfigsRepository(db, { now });
  const diagnosticsRepo = createDiagnosticsRepository(db);

  // Diagnostics must never affect the game (docs/DEVELOPMENT.md §1:
  // "Analytics failures must fail closed") — every call is best-effort.
  function bumpDiagnostics(patch) {
    return diagnosticsRepo.increment(patch).catch(() => {});
  }

  let trackerState = createTrackerState();

  // No manual EXP rate input exists — expRateLabel is omitted and falls
  // back to domain/config.js's "unknown" default (docs/ARCHITECTURE.md §6:
  // "EXP rate remains manual/unknown until a reliable protocol field is
  // confirmed").
  async function resolveConfigId(autoCaptureSnapshot) {
    const canonicalConfig = buildCanonicalConfig({
      captureConfig: autoCaptureSnapshot,
      captureConfigSource: autoCaptureSnapshot ? "protocol" : "unknown"
    });

    const configRow = await configsRepo.getOrCreate(canonicalConfig);
    return configRow.configId;
  }

  // Only `encounter.create` rows carry `autoCaptureSnapshot` (set by
  // domain/encounterTracker.js's draftRow, i.e. only for combat.started
  // -originated encounters). Orphan rows never have it — they can't be
  // grouped without the config combat.started would have supplied.
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
      // speciesId/level missing on a malformed payload — persist what we
      // have instead of failing the whole encounter (fail closed).
      groupKey = null;
    }

    return { ...rest, sessionId, configId, groupKey };
  }

  // Automatic Hunt lifecycle boundary decision (docs/ARCHITECTURE.md §7,
  // domain/huntLifecycle.js) — only a combat.started-originated
  // encounter.create row carries both serverSessionId and zoneId, which is
  // why it's the sole trigger for this check.
  async function resolveSessionForCombatStarted(row) {
    const session = await sessionsRepo.getOrStartCurrent();

    // A manual Pause/End Hunt freezes the session — only a manual
    // Resume/New Hunt (background.js) may change it. Automatic boundary
    // detection stays out of the way entirely while locked.
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

    // Resolve the boundary decision before anything else in this batch
    // touches "current" — a combat.started's own session.activity effect
    // (processed first, below) must land on the correct — possibly
    // just-started — session, not a stale one about to be ended.
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
   * @param message  { type, seq, ts, socketId, data } — `data` is the RAW
   *                 protocol payload; normalization happens here.
   * @returns        { ok: true } once persisted, or { ok: false, reason }
   *                 for an unrecognized/malformed event — never throws for
   *                 a bad *event*; a genuine IndexedDB failure still
   *                 rejects so the caller can fail closed.
   */
  async function handle(message) {
    await bumpDiagnostics({ eventsReceived: 1 });

    const normalized = normalizeEvent(message.type, message.data);

    if (!normalized) {
      // Known event type but the normalizer rejected the payload (missing/
      // malformed data) is a parse error; a type we don't model at all is
      // an expected, deliberate ignore — not a bug (docs/DEVELOPMENT.md §9).
      await bumpDiagnostics(
        KNOWN_EVENT_TYPES.has(message.type) ? { parseErrors: 1 } : { eventsIgnored: 1 }
      );

      return { ok: false, reason: "ignored" };
    }

    const envelope = {
      type: message.type,
      seq: message.seq,
      ts: message.ts,
      socketId: message.socketId,
      data: normalized
    };

    const swept = sweepStale(trackerState, now());
    trackerState = swept.state;
    await applyEffects(swept.effects);

    const result = applyEvent(trackerState, envelope);
    trackerState = result.state;
    await applyEffects(result.effects);

    // Once normalized, the only way applyEvent() produces zero effects is
    // its own exact socketId|type|seq dedupe (domain/encounterTracker.js) —
    // every other known event type always emits at least one effect.
    if (result.effects.length === 0) {
      await bumpDiagnostics({ duplicateEvents: 1 });
    } else {
      const orphansCreated = result.effects.filter(
        (effect) => effect.type === "encounter.create" && effect.row.state === "orphan"
      ).length;

      if (orphansCreated > 0) {
        await bumpDiagnostics({ orphanEvents: orphansCreated });
      }
    }

    return { ok: true };
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
