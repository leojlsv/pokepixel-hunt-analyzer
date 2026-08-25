/**
 * Pure encounter correlation reducer (docs/PROTOCOL_AND_ANALYTICS.md §6-8).
 *
 * No I/O here — `applyEvent`/`sweepStale` take a normalized event (already
 * run through domain/events.js) plus the tracker's own in-memory state,
 * and return `{ state, effects }`. `effects` are plain instructions
 * (`encounter.create` / `encounter.finalize` / `session.activity` /
 * `session.pause` / `session.potion_used`) that services/eventPipeline.js
 * turns into IndexedDB writes and session-timing calls.
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

function isTerminalCaptureResult(value) {
  return value === "success" || value === "failed";
}

function isMissing(value) {
  return value === null || value === undefined;
}

function addFallback(patch, key, current, fallback) {
  if (isMissing(current) && !isMissing(fallback)) {
    patch[key] = fallback;
  }
}

function ivTotalOrNull(ivs) {
  return ivs ? sumIvs(ivs) : null;
}

function draftRow({ encounterId, wildMonsterId, socketId, envelope, enemy, session }) {
  const startedAtMs = Number.isFinite(enemy.started_at_ms)
    ? enemy.started_at_ms
    : envelope.ts;

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
    ivTotal: ivTotalOrNull(enemy.ivs),
    isShiny: enemy.is_shiny,
    mapId: enemy.map_id,
    zoneId: enemy.zone_id,
    elements: enemy.elements,
    gender: enemy.gender,
    nature: enemy.nature,
    ivs: enemy.ivs,
    qualityMultiplier: enemy.quality_multiplier,
    startedAtMs,
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

    // A terminal result can legitimately arrive before its loot in HuntSim.
    // If the server reuses an ID before that late loot appears, never mutate
    // the already-finalized encounter into a new/incomplete individual.
    if (previous && isTerminalCaptureResult(previous.captureResult)) {
      next.inProgress.delete(previousEncounterId);
      next.activeByWildMonsterId.delete(wildMonsterId);
    } else if (previous && sameIndividual(previous, enemy)) {
      const touched = { ...previous, updatedAtMs: envelope.ts };
      next.inProgress.set(previousEncounterId, touched);
      effects.push({
        type: "encounter.update",
        encounterId: previousEncounterId,
        patch: { updatedAtMs: envelope.ts }
      });

      return { state: next, effects };
    } else {
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

  const terminalAlreadySeen = isTerminalCaptureResult(existing.captureResult);
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
    state:
      existing.state === "orphan"
        ? "orphan"
        : terminalAlreadySeen
          ? existing.state
          : "looted",
    updatedAtMs: envelope.ts
  };

  effects.push({ type: "encounter.update", encounterId, patch });

  if (terminalAlreadySeen) {
    next.inProgress.delete(encounterId);
    if (wildMonsterId) next.activeByWildMonsterId.delete(wildMonsterId);
  } else {
    next.inProgress.set(encounterId, { ...existing, ...patch });
  }

  return { state: next, effects };
}

function captureEnrichment(existing, data, resultType) {
  const patch = {};

  if (resultType === "failed") {
    addFallback(patch, "level", existing?.level, data.level);
    addFallback(patch, "quality", existing?.quality, data.quality);
    addFallback(patch, "ivTotal", existing?.ivTotal, data.iv_total);

    // Terminal capture payload is the authoritative shiny result. This also
    // protects HuntSim from a stale full-frame shiny bit after slot respawn.
    if (typeof data.is_shiny === "boolean") {
      patch.isShiny = data.is_shiny;
    }

    return patch;
  }

  const creature = data.creature;
  if (!creature) return patch;

  addFallback(patch, "quality", existing?.quality, creature.quality);
  addFallback(patch, "ivTotal", existing?.ivTotal, ivTotalOrNull(creature.ivs));
  addFallback(patch, "elements", existing?.elements, creature.elements);
  addFallback(patch, "gender", existing?.gender, creature.gender);
  addFallback(patch, "nature", existing?.nature, creature.nature);
  addFallback(patch, "ivs", existing?.ivs, creature.ivs);
  addFallback(
    patch,
    "qualityMultiplier",
    existing?.qualityMultiplier,
    creature.quality_multiplier
  );

  if (typeof creature.is_shiny === "boolean") {
    patch.isShiny = creature.is_shiny;
  }

  return patch;
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
    // Keep the legacy invariant for orphan successes: a captured creature can
    // be level-rebased and is not a substitute for a missing target snapshot.
    // HuntSim's normal path creates a synthetic encounter before terminal data.
    const enrichment = resultType === "failed"
      ? captureEnrichment(null, data, resultType)
      : {};

    const row = orphanRow({
      encounterId: orphanId,
      wildMonsterId,
      socketId: envelope.socketId,
      envelope,
      patch: {
        speciesId: data.species_id,
        speciesName: data.species_name,
        ...enrichment,
        ...shared,
        state: "orphan"
      }
    });

    effects.push({ type: "encounter.create", row });
    return { state: next, effects };
  }

  const patch = {
    speciesName: data.species_name ?? existing.speciesName,
    ...captureEnrichment(existing, data, resultType),
    ...shared,
    state: existing.state === "orphan" ? "orphan" : resultType
  };

  effects.push({ type: "encounter.finalize", encounterId, patch });

  // PROD normally sends loot before capture, while HuntSim DEV sends capture
  // before loot for many encounters. Keep a terminal encounter correlated in
  // memory only until its late loot arrives; persistence is already finalized.
  if (Number.isFinite(existing.lootAtMs)) {
    next.inProgress.delete(encounterId);
    if (wildMonsterId) next.activeByWildMonsterId.delete(wildMonsterId);
  } else {
    next.inProgress.set(encounterId, { ...existing, ...patch });
  }

  return { state: next, effects };
}

function applyKillClosed(state, envelope) {
  const wildMonsterId = envelope.data.wild_monster_id;
  const next = cloneState(state);

  const encounterId = wildMonsterId
    ? next.activeByWildMonsterId.get(wildMonsterId)
    : undefined;
  const existing = encounterId ? next.inProgress.get(encounterId) : undefined;
  if (!existing) return noEffect(next);

  const stateValue = isTerminalCaptureResult(existing.captureResult)
    ? existing.state
    : existing.state === "looted"
      ? "looted"
      : "incomplete";

  next.inProgress.delete(encounterId);
  if (wildMonsterId) next.activeByWildMonsterId.delete(wildMonsterId);

  return {
    state: next,
    effects: [
      {
        type: "encounter.finalize",
        encounterId,
        patch: { state: stateValue, updatedAtMs: envelope.ts }
      }
    ]
  };
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

    case "hunt.kill_closed":
      return applyKillClosed(stateWithKey, envelope);

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
    const stateValue = isTerminalCaptureResult(record.captureResult)
      ? record.state
      : "incomplete";

    effects.push({
      type: "encounter.finalize",
      encounterId,
      patch: { state: stateValue, updatedAtMs: now }
    });

    next.inProgress.delete(encounterId);

    if (record.wildMonsterId) {
      next.activeByWildMonsterId.delete(record.wildMonsterId);
    }
  }

  return { state: next, effects };
}
