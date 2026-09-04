const FULL_FRAME_HEADER_BYTES = 35;
const ENTITY_RECORD_BYTES = 16;
const WILD_ENTITY_TYPE = 2;
const TERMINAL_MATCH_WINDOW_MS = 30_000;
const DEFAULT_RUNTIME_RETENTION_MS = 60_000;
const DEFAULT_RUNTIME_ENTRY_LIMIT = 2_048;
const textDecoder = new TextDecoder();

const PASSTHROUGH_TYPES = new Set([
  "combat.started",
  "loot.received",
  "capture.failed",
  "capture.success",
  "hunt.stopped",
  "hunt.analyzer_reset"
]);

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value) {
  return typeof value === "string" && value ? value : null;
}

function decodeBase64Bytes(value) {
  if (typeof value !== "string" || value.length === 0) return null;

  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function uint16be(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

/**
 * Decodes only the stable entity directory from HuntSim `hunt.frame/full`.
 *
 * DEV uses a compact binary visual-state frame. The directory is enough for
 * analytics correlation (slot -> map event/species/level/shiny), but it does
 * not contain the full individual snapshot (IV breakdown, nature, gender or
 * quality multiplier). Those fields are therefore enriched from the terminal
 * capture payload when the server actually exposes them.
 */
export function decodeHuntSimFullFrame(data) {
  if (!data || data.kind !== "full") return null;

  const bytes = decodeBase64Bytes(data.b);
  if (!bytes || bytes.length < FULL_FRAME_HEADER_BYTES) return null;

  const entities = [];
  let offset = FULL_FRAME_HEADER_BYTES;

  while (offset < bytes.length) {
    if (offset + ENTITY_RECORD_BYTES > bytes.length) return null;

    const speciesLength = bytes[offset + 15];
    const speciesStart = offset + ENTITY_RECORD_BYTES;
    const speciesEnd = speciesStart + speciesLength;
    if (speciesEnd > bytes.length) return null;

    const entityType = bytes[offset + 1];
    const speciesId = textDecoder.decode(bytes.subarray(speciesStart, speciesEnd));

    if (entityType === WILD_ENTITY_TYPE && speciesId) {
      entities.push({
        slot: bytes[offset],
        eventId: bytes[offset + 3],
        x: bytes[offset + 4],
        y: bytes[offset + 5],
        hp: uint16be(bytes, offset + 8),
        maxHp: uint16be(bytes, offset + 10),
        level: bytes[offset + 13],
        isShiny: (bytes[offset + 14] & 1) === 1,
        speciesId
      });
    }

    offset = speciesEnd;
  }

  return entities;
}

function syntheticSequence(rawSeq, killSeq, phase = 0) {
  const raw = finite(rawSeq) ?? 0;
  const kill = finite(killSeq) ?? 0;
  const value = raw * 1_000_000 + kill * 10 + phase;
  return Number.isSafeInteger(value) ? value : raw;
}

function splitIntegerTotal(value, count) {
  const total = finite(value);
  if (total === null || !(count > 0)) return Array(count).fill(null);

  const integer = Math.trunc(total);
  const base = Math.trunc(integer / count);
  let remainder = integer - base * count;

  return Array.from({ length: count }, () => {
    if (remainder > 0) {
      remainder -= 1;
      return base + 1;
    }
    if (remainder < 0) {
      remainder += 1;
      return base - 1;
    }
    return base;
  });
}

function cloneSessionContext(session, fallback = {}) {
  if (!session || typeof session !== "object") return fallback;

  return {
    id: stringOrNull(session.id) ?? fallback.id ?? null,
    zoneId: stringOrNull(session.zone_id) ?? fallback.zoneId ?? null,
    mapId: finite(session.map_id) ?? fallback.mapId ?? null,
    autoCapture: session.auto_capture ?? fallback.autoCapture ?? null
  };
}

export function createProtocolAdapter({
  now = Date.now,
  runtimeRetentionMs = DEFAULT_RUNTIME_RETENTION_MS,
  runtimeEntryLimit = DEFAULT_RUNTIME_ENTRY_LIMIT
} = {}) {
  if (!(Number.isFinite(runtimeRetentionMs) && runtimeRetentionMs >= TERMINAL_MATCH_WINDOW_MS)) {
    throw new RangeError("runtimeRetentionMs must cover the terminal match window");
  }
  if (!Number.isSafeInteger(runtimeEntryLimit) || runtimeEntryLimit < 1) {
    throw new RangeError("runtimeEntryLimit must be a positive safe integer");
  }

  let sessionContext = {
    id: null,
    zoneId: null,
    mapId: null,
    autoCapture: null
  };

  const entitiesBySlot = new Map();
  const firstHitAtBySlot = new Map();
  const captureQueueByKillSeq = new Map();
  const killsBySeq = new Map();

  function trimMap(map) {
    while (map.size > runtimeEntryLimit) {
      map.delete(map.keys().next().value);
    }
  }

  function pruneRuntimeState(timestamp = now()) {
    for (const [killSeq, queued] of captureQueueByKillSeq) {
      if (timestamp - queued.retainedAtMs > runtimeRetentionMs) {
        captureQueueByKillSeq.delete(killSeq);
      }
    }
    for (const [killSeq, context] of killsBySeq) {
      if (timestamp - context.retainedAtMs > runtimeRetentionMs) {
        killsBySeq.delete(killSeq);
      }
    }
    trimMap(captureQueueByKillSeq);
    trimMap(killsBySeq);
  }

  function retain(map, key, value) {
    map.delete(key);
    map.set(key, value);
    trimMap(map);
  }

  function clearHuntRuntime() {
    entitiesBySlot.clear();
    firstHitAtBySlot.clear();
    captureQueueByKillSeq.clear();
    killsBySeq.clear();
  }

  function updateSessionFromCombat(payload) {
    const session = payload?.data?.session;
    if (!session || typeof session !== "object") return;
    sessionContext = cloneSessionContext(session, sessionContext);
  }

  function syntheticWildMonsterId(killSeq) {
    const scope = sessionContext.id || sessionContext.zoneId || "unknown";
    return `huntsim:${scope}:${killSeq}`;
  }

  function buildSyntheticCombatStarted(payload, context) {
    return {
      type: "combat.started",
      seq: syntheticSequence(payload.seq, context.killSeq, 1),
      ts: finite(payload.ts),
      data: {
        enemy: {
          id: context.syntheticWildMonsterId,
          species_id: context.speciesId,
          level: context.level,
          quality: null,
          is_shiny: context.isShiny,
          ivs: null,
          map_id: context.mapId,
          zone_id: context.zoneId,
          elements: null,
          gender: null,
          nature: null,
          quality_multiplier: null,
          started_at_ms: context.startedAtMs
        },
        session: sessionContext.id || sessionContext.autoCapture
          ? {
              id: sessionContext.id,
              auto_capture: sessionContext.autoCapture
            }
          : null
      }
    };
  }

  function ensureKillContext(killSeq, payload, { slot = null } = {}) {
    const normalizedKillSeq = finite(killSeq);
    if (normalizedKillSeq === null) return null;

    const existing = killsBySeq.get(normalizedKillSeq);
    if (existing) {
      existing.retainedAtMs = now();
      retain(killsBySeq, normalizedKillSeq, existing);
      return existing;
    }

    const queued = captureQueueByKillSeq.get(normalizedKillSeq) || null;
    const entity = slot !== null ? entitiesBySlot.get(slot) || null : null;
    const ts = finite(payload.ts);

    const context = {
      killSeq: normalizedKillSeq,
      slot,
      eventId: entity?.eventId ?? null,
      speciesId: queued?.speciesId ?? entity?.speciesId ?? null,
      level: queued?.level ?? entity?.level ?? null,
      // Full frames are periodic while map slots respawn. Their shiny bit is
      // useful diagnostically but can be stale for a later individual in the
      // same slot; capture.failed/success is the terminal authority.
      isShiny: null,
      mapId: sessionContext.mapId,
      zoneId: sessionContext.zoneId,
      startedAtMs:
        (slot !== null ? firstHitAtBySlot.get(slot) : null) ??
        ts,
      killedAtMs: ts,
      syntheticWildMonsterId: syntheticWildMonsterId(normalizedKillSeq),
      startedEmitted: false,
      terminalSeen: false,
      lootSeen: false,
      closedSeen: false,
      retainedAtMs: now()
    };

    retain(killsBySeq, normalizedKillSeq, context);
    if (slot !== null) firstHitAtBySlot.delete(slot);
    return context;
  }

  function emitStartIfNeeded(payload, context, output) {
    if (!context || context.startedEmitted) return;
    context.startedEmitted = true;
    output.push(buildSyntheticCombatStarted(payload, context));
  }

  function matchTerminalContext(data, ts) {
    const eventId = finite(data?.event_id);
    const speciesId = stringOrNull(data?.species_id);
    const mapId = finite(data?.map_id);
    const zoneId = stringOrNull(data?.zone_id);

    const candidates = [];
    for (const context of killsBySeq.values()) {
      if (context.terminalSeen) continue;
      if (Number.isFinite(ts) && Number.isFinite(context.killedAtMs)) {
        const age = ts - context.killedAtMs;
        if (age < -1_000 || age > TERMINAL_MATCH_WINDOW_MS) continue;
      }
      if (speciesId && context.speciesId && context.speciesId !== speciesId) continue;
      if (mapId !== null && context.mapId !== null && context.mapId !== mapId) continue;
      if (zoneId && context.zoneId && context.zoneId !== zoneId) continue;
      candidates.push(context);
    }

    const exact = eventId === null
      ? candidates
      : candidates.filter((context) => context.eventId === eventId);
    const pool = exact.length > 0 ? exact : candidates;

    pool.sort((a, b) => (b.killedAtMs ?? 0) - (a.killedAtMs ?? 0));
    return pool[0] || null;
  }

  function adaptCaptureQueue(payload) {
    const output = [];
    const data = payload.data || {};

    if (data.reset === true) {
      captureQueueByKillSeq.clear();
    }

    if (Array.isArray(data.add)) {
      for (const item of data.add) {
        const killSeq = finite(item?.id);
        if (killSeq === null) continue;
        retain(captureQueueByKillSeq, killSeq, {
          speciesId: stringOrNull(item.sp),
          level: finite(item.lv),
          x: finite(item.x),
          y: finite(item.y),
          addedAtMs: finite(payload.ts),
          retainedAtMs: now()
        });
      }
    }

    if (Array.isArray(data.rm)) {
      for (const value of data.rm) {
        const killSeq = finite(value);
        if (killSeq === null) continue;
        captureQueueByKillSeq.delete(killSeq);

        const context = killsBySeq.get(killSeq);
        if (!context) continue;
        context.closedSeen = true;
        context.retainedAtMs = now();

        if (!context.terminalSeen && context.lootSeen) {
          output.push({
            type: "hunt.kill_closed",
            seq: syntheticSequence(payload.seq, killSeq, 3),
            ts: finite(payload.ts),
            data: { wild_monster_id: context.syntheticWildMonsterId }
          });
          killsBySeq.delete(killSeq);
        } else if (context.terminalSeen && context.lootSeen) {
          killsBySeq.delete(killSeq);
        }
      }
    }

    return output;
  }

  function adaptHuntEvents(payload) {
    const output = [];
    const events = Array.isArray(payload.data) ? payload.data : [];
    const ts = finite(payload.ts);

    // Hit can be listed after knockout in the same compact event batch.
    // Record hit timestamps first so the knockout gets the real fight start.
    for (const event of events) {
      if (event?.k !== "hit") continue;
      const slot = finite(event.t);
      if (slot === null || slot <= 1) continue;
      if (!firstHitAtBySlot.has(slot) && ts !== null) {
        firstHitAtBySlot.set(slot, ts);
      }
    }

    for (const event of events) {
      if (event?.k !== "knockout") continue;
      const killSeq = finite(event?.cap?.id);
      const slot = finite(event.t);
      if (killSeq === null) continue;

      const context = ensureKillContext(killSeq, payload, { slot });
      emitStartIfNeeded(payload, context, output);
    }

    return output;
  }

  function adaptAggregatedLoot(payload) {
    const data = payload.data || {};
    const perKill = Array.isArray(data.per_kill) ? data.per_kill : null;
    if (!perKill) return [payload];

    const output = [];
    const splitLoot = splitIntegerTotal(data.loot_sell_value, perKill.length);

    perKill.forEach((kill, index) => {
      const killSeq = finite(kill?.seq);
      if (killSeq === null) return;

      const context = ensureKillContext(killSeq, payload);
      emitStartIfNeeded(payload, context, output);
      if (!context) return;

      output.push({
        type: "loot.received",
        seq: syntheticSequence(payload.seq, killSeq, 2),
        ts: finite(payload.ts),
        data: {
          wild_monster_id: context.syntheticWildMonsterId,
          species_id: context.speciesId,
          exp: finite(kill.exp),
          trainer_exp: finite(kill.trainer_exp),
          pokemon_exp: finite(kill.pokemon_exp),
          gold: finite(kill.gold),
          loot_sell_value:
            finite(kill.loot_sell_value) ?? splitLoot[index]
        }
      });

      context.lootSeen = true;
      context.retainedAtMs = now();

      if (context.closedSeen && !context.terminalSeen) {
        output.push({
          type: "hunt.kill_closed",
          seq: syntheticSequence(payload.seq, killSeq, 3),
          ts: finite(payload.ts),
          data: { wild_monster_id: context.syntheticWildMonsterId }
        });
        killsBySeq.delete(killSeq);
      } else if (context.terminalSeen) {
        killsBySeq.delete(killSeq);
      }
    });

    return output;
  }

  function adaptTerminal(payload) {
    const ts = finite(payload.ts);
    const context = matchTerminalContext(payload.data, ts);
    if (!context) return [payload];

    context.terminalSeen = true;
    context.retainedAtMs = now();

    const canonical = {
      ...payload,
      data: {
        ...payload.data,
        wild_monster_id: context.syntheticWildMonsterId
      }
    };

    if (context.lootSeen && context.closedSeen) {
      killsBySeq.delete(context.killSeq);
    }

    return [canonical];
  }

  function adaptPayload(payload) {
    if (!payload || typeof payload !== "object") return [];

    switch (payload.type) {
      case "combat.started":
        updateSessionFromCombat(payload);
        if (!payload.data?.enemy && payload.data?.session) {
          clearHuntRuntime();
          updateSessionFromCombat(payload);
          return [];
        }
        return [payload];

      case "hunt.analyzer_reset":
        clearHuntRuntime();
        sessionContext = {
          ...sessionContext,
          id: stringOrNull(payload.data?.session_id) ?? sessionContext.id,
          zoneId: stringOrNull(payload.data?.zone_id) ?? sessionContext.zoneId
        };
        return [payload];

      case "hunt.frame": {
        const entities = decodeHuntSimFullFrame(payload.data);
        if (entities) {
          entitiesBySlot.clear();
          for (const entity of entities) entitiesBySlot.set(entity.slot, entity);
        }
        return [];
      }

      case "hunt.capture_queue":
        return adaptCaptureQueue(payload);

      case "hunt.events":
        return adaptHuntEvents(payload);

      case "loot.received":
        return adaptAggregatedLoot(payload);

      case "capture.failed":
      case "capture.success":
        return adaptTerminal(payload);

      case "hunt.kill_reward":
      case "hunt.rewards":
      case "rare.captured":
      case "shiny.captured":
        // Redundant HuntSim projections. The canonical pipeline consumes
        // loot.received and capture.* exactly once.
        return [];

      default:
        return PASSTHROUGH_TYPES.has(payload.type) ? [payload] : [];
    }
  }

  function adapt(payload) {
    pruneRuntimeState();
    const output = adaptPayload(payload);
    pruneRuntimeState();
    return output;
  }

  return {
    adapt,
    snapshot() {
      return {
        sessionContext: { ...sessionContext },
        entitiesBySlot: new Map(entitiesBySlot),
        captureQueueByKillSeq: new Map(captureQueueByKillSeq),
        killsBySeq: new Map(killsBySeq)
      };
    }
  };
}
