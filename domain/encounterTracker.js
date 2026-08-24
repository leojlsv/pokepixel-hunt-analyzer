/**
 * Pure encounter correlation reducer (docs/PROTOCOL_AND_ANALYTICS.md §6-8).
 *
 * No I/O here — `applyEvent`/`sweepStale` take a normalized event (already
 * run through domain/events.js) plus the tracker's own in-memory state,
 * and return `{ state, effects }`. `effects` are plain instructions
 * (`encounter.create` / `encounter.finalize` / `session.activity` /
 * `session.pause` / `session.potion_used`) that services/eventPipeline.js
 * turns into IndexedDB writes and session-timing calls. This keeps every
 * correlation/reuse/orphan/dedupe rule unit-testable without a database.
 *
 * `session.potion_used` (from `loot.received`'s auto-potion-used variant,
 * §3) never touches an encounter — it's a trainer-wide expense, not
 * attached to any one wild encounter.
 *
 * `encounter.create` effects carry a *draft* row: `sessionId`, `configId`
 * and `groupKey` are not known here (config resolution needs
 * data/configsRepository.js, which is I/O) — eventPipeline fills those in
 * from the draft's `autoCaptureSnapshot` before persisting.
 */

import { sumIvs, IV_STATS } from "./ivTotal.js";

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
    autoCaptureSnapshot: session ? session.auto_capture : null,
    speciesId: enemy.species_id,
    speciesName: null,
    level: enemy.level,
    quality: enemy.quality,
    ivTotal: sumIvs(enemy.ivs),
    isShiny: enemy.is_shiny,
    mapId: enemy.map_id,
    zoneId: enemy.zone_id,
    elements: enemy.elements,
    gender: enemy.gender,
    nature: enemy.nature,
    ivs: enemy.ivs,
    qualityMultiplier: enemy.quality_multiplier,
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
    capturedByName: null,
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
    elements: null,
    gender: null,
    nature: null,
    ivs: null,
    qualityMultiplier: null,
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
    capturedByName: null,
    supplyCost: null,
    autoSold: null,
    autoSellValue: null,
    state: "orphan",
    createdAtMs: envelope.ts,
    updatedAtMs: envelope.ts,
    ...patch
  };
}

function sameIvs(a, b) {
  if (!a || !b) return a === b;
  return IV_STATS.every((stat) => a[stat] === b[stat]);
}

function sameIndividual(existing, enemy) {
  return (
    existing.speciesId === enemy.species_id &&
    existing.level === enemy.level &&
    existing.quality === enemy.quality &&
    existing.gender === enemy.gender &&
    existing.nature === enemy.nature &&
    existing.qualityMultiplier === enemy.quality_multiplier &&
    sameIvs(existing.ivs, enemy.ivs)
  );
}

function applyCombatStarted(state, envelope, generateId) {
  const { enemy, session } = envelope.data;
  const wildMonsterId = enemy.id;
  const next = cloneState(state);
  const effects = [{ type: "session.activity" }];

  if (wildMonsterId && next.activeByWildMonsterId.has(wildMonsterId)) {
    const previousEncounterId = next.activeByWildMonsterId.get(wildMonsterId);
    const previous = next.inProgress.get(previousEncounterId);

    if (previous && sameIndividual(previous, enemy)) {
      const touched = { ...previous, updatedAtMs: envelope.ts };
      next.inProgress.set(previousEncounterId, touched);
      effects.push({
        type: "encounter.update",
        encounterId: previousEncounterId,
        patch: { updatedAtMs: envelope.ts }
      });

      return { state: next, effects };
    }

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

  if (!wildMonsterId && data.auto_potion_used) {
    return {
      state,
      effects: [
        { type: "session.activity" },
        { type: "session.potion_used", cost: data.supply_cost }
      ]
    };
  }

  const next = cloneState(state);
  const effects = [{ type: "session.activity" }];

  const encounterId = wildMonsterId
    ? next.activeByWildMonsterId.get(wildMonsterId)
    : undefined;
  const existing = encounterId ? next.inProgress.get(encounterId) : undefined;

  if (!existing) {
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
    shared.capturedByName = data.captured_by_name;
    shared.autoSold = data.auto_sold;
    shared.autoSellValue = data.auto_sell_value;
  }

  if (!existing) {
    const orphanId = crypto.randomUUID();

    const orphanEnrichment =
      resultType === "failed"
        ? {
            quality: data.quality,
            level: data.level,
            ivTotal: data.iv_total,
            isShiny: data.is_shiny
          }
        : {};

    const row = orphanRow({
      encounterId: orphanId,
      wildMonsterId,
      socketId: envelope.socketId,
      envelope,
      patch: {
        speciesId: data.species_id,
        speciesName: data.species_name,
        ...orphanEnrichment,
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
