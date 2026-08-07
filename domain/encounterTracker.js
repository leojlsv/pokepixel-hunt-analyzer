/**
 * Pure encounter correlation reducer (docs/PROTOCOL_AND_ANALYTICS.md §6-8).
 *
 * No I/O here — `applyEvent`/`sweepStale` take a normalized event (already
 * run through domain/events.js) plus the tracker's own in-memory state,
 * and return `{ state, effects }`. `effects` are plain instructions
 * (`encounter.create` / `encounter.finalize` / `session.activity` /
 * `session.pause`) that services/eventPipeline.js turns into IndexedDB
 * writes and session-timing calls. This keeps every correlation/reuse/
 * orphan/dedupe rule unit-testable without a database.
 *
 * `encounter.create` effects carry a *draft* row: `sessionId`, `configId`
 * and `groupKey` are not known here (config resolution needs
 * data/configsRepository.js, which is I/O) — eventPipeline fills those in
 * from the draft's `autoCaptureSnapshot` before persisting.
 */

import { sumIvs } from "./ivTotal.js";

// docs/PROTOCOL_AND_ANALYTICS.md §6 "conservative stale timeout" — no
// value is specified there; 30 minutes is this implementation's choice.
export const STALE_TIMEOUT_MS = 30 * 60 * 1000;

function defaultGenerateId() {
  return crypto.randomUUID();
}

export function createTrackerState() {
  return {
    activeByWildMonsterId: new Map(),
    inProgress: new Map(),
    seenKeys: new Set()
  };
}

function dedupeKey(envelope) {
  return `${envelope.socketId}|${envelope.type}|${envelope.seq}`;
}

function cloneState(state) {
  return {
    activeByWildMonsterId: new Map(state.activeByWildMonsterId),
    inProgress: new Map(state.inProgress),
    seenKeys: new Set(state.seenKeys)
  };
}

function noEffect(state) {
  return { state, effects: [] };
}

function draftRow({ encounterId, wildMonsterId, socketId, envelope, enemy, session }) {
  return {
    encounterId,
    wildMonsterId,
    socketId,
    serverSessionId: session ? session.id : null,
    // Transient — consumed and stripped by services/eventPipeline.js.
    autoCaptureSnapshot: session ? session.auto_capture : null,
    speciesId: enemy.species_id,
    speciesName: null,
    level: enemy.level,
    quality: enemy.quality,
    ivTotal: sumIvs(enemy.ivs),
    isShiny: enemy.is_shiny,
    mapId: enemy.map_id,
    zoneId: enemy.zone_id,
    startedAtMs: envelope.ts,
    lootAtMs: null,
    captureAtMs: null,
    cycleMs: null,
    exp: null,
    trainerExp: null,
    pokemonExp: null,
    gold: null,
    lootSellValue: null,
    captureResult: "none",
    capsuleItemId: null,
    capsuleName: null,
    captureChance: null,
    supplyCost: null,
    autoSold: null,
    autoSellValue: null,
    state: "started",
    createdAtMs: envelope.ts,
    updatedAtMs: envelope.ts
  };
}

function orphanRow({ encounterId, wildMonsterId, socketId, envelope, patch }) {
  return {
    encounterId,
    wildMonsterId: wildMonsterId ?? null,
    socketId,
    serverSessionId: null,
    speciesId: null,
    speciesName: null,
    level: null,
    quality: null,
    ivTotal: null,
    isShiny: null,
    mapId: null,
    zoneId: null,
    startedAtMs: null,
    lootAtMs: null,
    captureAtMs: null,
    cycleMs: null,
    exp: null,
    trainerExp: null,
    pokemonExp: null,
    gold: null,
    lootSellValue: null,
    captureResult: "unknown",
    capsuleItemId: null,
    capsuleName: null,
    captureChance: null,
    supplyCost: null,
    autoSold: null,
    autoSellValue: null,
    state: "orphan",
    createdAtMs: envelope.ts,
    updatedAtMs: envelope.ts,
    ...patch
  };
}

function applyCombatStarted(state, envelope, generateId) {
  const { enemy, session } = envelope.data;
  const wildMonsterId = enemy.id;
  const next = cloneState(state);
  const effects = [{ type: "session.activity" }];

  // Wild-id reuse: whatever was previously tracked for this id never got
  // a capture result — it's done, but unresolved.
  if (wildMonsterId && next.activeByWildMonsterId.has(wildMonsterId)) {
    const previousEncounterId = next.activeByWildMonsterId.get(wildMonsterId);

    if (next.inProgress.has(previousEncounterId)) {
      effects.push({
        type: "encounter.finalize",
        encounterId: previousEncounterId,
        patch: { state: "incomplete", updatedAtMs: envelope.ts }
      });
      next.inProgress.delete(previousEncounterId);
    }

    next.activeByWildMonsterId.delete(wildMonsterId);
  }

  const encounterId = generateId();
  const row = draftRow({
    encounterId,
    wildMonsterId,
    socketId: envelope.socketId,
    envelope,
    enemy,
    session
  });

  effects.push({ type: "encounter.create", row });

  if (wildMonsterId) {
    next.activeByWildMonsterId.set(wildMonsterId, encounterId);
    next.inProgress.set(encounterId, row);
  }

  return { state: next, effects };
}

function applyLootReceived(state, envelope) {
  const data = envelope.data;
  const wildMonsterId = data.wild_monster_id;
  const next = cloneState(state);
  const effects = [{ type: "session.activity" }];

  const encounterId = wildMonsterId
    ? next.activeByWildMonsterId.get(wildMonsterId)
    : undefined;
  const existing = encounterId ? next.inProgress.get(encounterId) : undefined;

  if (!existing) {
    // Loot with no active correlated encounter (docs §7 orphan). Still
    // register it so a capture result for the same wild id can attach
    // instead of creating yet another orphan.
    const orphanId = crypto.randomUUID();

    const row = orphanRow({
      encounterId: orphanId,
      wildMonsterId,
      socketId: envelope.socketId,
      envelope,
      patch: {
        speciesId: data.species_id,
        lootAtMs: envelope.ts,
        exp: data.exp,
        trainerExp: data.trainer_exp,
        pokemonExp: data.pokemon_exp,
        gold: data.gold,
        lootSellValue: data.loot_sell_value,
        captureResult: "none"
      }
    });

    effects.push({ type: "encounter.create", row });

    if (wildMonsterId) {
      next.activeByWildMonsterId.set(wildMonsterId, orphanId);
      next.inProgress.set(orphanId, row);
    }

    return { state: next, effects };
  }

  const patch = {
    lootAtMs: envelope.ts,
    cycleMs: Number.isFinite(existing.startedAtMs)
      ? envelope.ts - existing.startedAtMs
      : null,
    exp: data.exp,
    trainerExp: data.trainer_exp,
    pokemonExp: data.pokemon_exp,
    gold: data.gold,
    lootSellValue: data.loot_sell_value,
    state: existing.state === "orphan" ? "orphan" : "looted",
    updatedAtMs: envelope.ts
  };

  effects.push({ type: "encounter.update", encounterId, patch });
  next.inProgress.set(encounterId, { ...existing, ...patch });

  return { state: next, effects };
}

function applyCaptureResult(state, envelope, resultType) {
  const data = envelope.data;
  const wildMonsterId = data.wild_monster_id;
  const next = cloneState(state);
  const effects = [];

  const encounterId = wildMonsterId
    ? next.activeByWildMonsterId.get(wildMonsterId)
    : undefined;
  const existing = encounterId ? next.inProgress.get(encounterId) : undefined;

  const shared = {
    captureAtMs: envelope.ts,
    captureResult: resultType,
    capsuleItemId: data.capsule_item_id,
    capsuleName: data.capsule_name,
    captureChance: data.chance,
    supplyCost: data.supply_cost,
    updatedAtMs: envelope.ts
  };

  if (resultType === "success") {
    shared.autoSold = data.auto_sold;
    shared.autoSellValue = data.auto_sell_value;
    // Deliberately NOT copying creature.level/creature.quality/
    // creature.ivs into level/quality/ivTotal — docs/PROTOCOL_AND_ANALYTICS.md
    // §5 forbids overwriting the target level (and empirically, quality
    // is already stable from combat.started — see tests/fixtures README).
  }

  if (!existing) {
    const orphanId = crypto.randomUUID();

    const row = orphanRow({
      encounterId: orphanId,
      wildMonsterId,
      socketId: envelope.socketId,
      envelope,
      patch: {
        speciesId: data.species_id,
        speciesName: data.species_name,
        ...shared,
        state: "orphan"
      }
    });

    effects.push({ type: "encounter.create", row });
    return { state: next, effects };
  }

  const patch = {
    speciesName: data.species_name ?? existing.speciesName,
    ...shared,
    state: existing.state === "orphan" ? "orphan" : resultType
  };

  effects.push({ type: "encounter.finalize", encounterId, patch });
  next.inProgress.delete(encounterId);

  if (wildMonsterId) {
    next.activeByWildMonsterId.delete(wildMonsterId);
  }

  return { state: next, effects };
}

/**
 * @param state       createTrackerState() (or a previous applyEvent result)
 * @param envelope    { type, socketId, seq, ts, data } — `data` is the
 *                    already-normalized payload (domain/events.js
 *                    normalizeEvent result; must not be null)
 * @param generateId  injectable for deterministic tests; defaults to
 *                    crypto.randomUUID (docs/ARCHITECTURE.md §5)
 */
export function applyEvent(state, envelope, generateId = defaultGenerateId) {
  const key = dedupeKey(envelope);

  if (state.seenKeys.has(key)) {
    return noEffect(state);
  }

  const seenKeys = new Set(state.seenKeys);
  seenKeys.add(key);
  const stateWithKey = { ...state, seenKeys };

  switch (envelope.type) {
    case "combat.started":
      return applyCombatStarted(stateWithKey, envelope, generateId);

    case "loot.received":
      return applyLootReceived(stateWithKey, envelope);

    case "capture.failed":
      return applyCaptureResult(stateWithKey, envelope, "failed");

    case "capture.success":
      return applyCaptureResult(stateWithKey, envelope, "success");

    case "hunt.stopped":
      return { state: stateWithKey, effects: [{ type: "session.pause" }] };

    case "hunt.analyzer_reset":
      return { state: stateWithKey, effects: [{ type: "session.activity" }] };

    default:
      return noEffect(stateWithKey);
  }
}

/**
 * Finalizes in-progress encounters that have not been touched for longer
 * than STALE_TIMEOUT_MS — covers the "no capture event" case (a hunt
 * abandoned or the player fleeing) without an explicit protocol signal.
 */
export function sweepStale(state, now) {
  const stale = [];

  for (const [encounterId, record] of state.inProgress) {
    if (now - record.updatedAtMs > STALE_TIMEOUT_MS) {
      stale.push([encounterId, record]);
    }
  }

  if (stale.length === 0) return noEffect(state);

  const next = cloneState(state);
  const effects = [];

  for (const [encounterId, record] of stale) {
    effects.push({
      type: "encounter.finalize",
      encounterId,
      patch: { state: "incomplete", updatedAtMs: now }
    });

    next.inProgress.delete(encounterId);

    if (record.wildMonsterId) {
      next.activeByWildMonsterId.delete(record.wildMonsterId);
    }
  }

  return { state: next, effects };
}
