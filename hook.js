(() => {
  "use strict";

  const HOOK_FLAG = "__POKEPIXEL_CAPTURE_COUNTER_HOOKED__";
  const CHANNEL = "POKEPIXEL_CAPTURE_COUNTER_V1";

  if (window[HOOK_FLAG]) return;

  Object.defineProperty(window, HOOK_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket !== "function") return;

  const VALID_QUALITIES = new Set([
    "weak",
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
    "mythical"
  ]);

  function normalizeQuality(value) {
    if (typeof value !== "string") return "unknown";

    const normalized = value.trim().toLowerCase();
    return VALID_QUALITIES.has(normalized)
      ? normalized
      : "unknown";
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function finiteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function emit(message) {
    window.postMessage(
      {
        channel: CHANNEL,
        ...message
      },
      window.location.origin
    );
  }

  // --- Fase 2: contratos de evento normalizado (docs/PROTOCOL_AND_ANALYTICS.md §2-5) ---
  // Emitidos em paralelo aos eventos legados acima, sem alterar nenhum deles.
  // Só extrai os campos documentados; validação/normalização estrita
  // acontece no lado do domain (background), não aqui.

  const PROTOCOL_EVENT_TYPES = new Set([
    "combat.started",
    "loot.received",
    "capture.failed",
    "capture.success",
    "hunt.stopped",
    "hunt.analyzer_reset"
  ]);

  function extractCombatStarted(data) {
    const enemy = data.enemy;
    if (!enemy || typeof enemy !== "object") return null;

    const session = data.session;

    return {
      enemy: {
        id: enemy.id,
        species_id: enemy.species_id,
        level: enemy.level,
        quality: enemy.quality,
        is_shiny: enemy.is_shiny,
        ivs: enemy.ivs,
        map_id: enemy.map_id,
        zone_id: enemy.zone_id
      },
      session:
        session && typeof session === "object"
          ? {
              id: session.id,
              auto_capture: session.auto_capture
            }
          : undefined
    };
  }

  function extractLootReceived(data) {
    return {
      wild_monster_id: data.wild_monster_id,
      species_id: data.species_id,
      exp: data.exp,
      trainer_exp: data.trainer_exp,
      pokemon_exp: data.pokemon_exp,
      gold: data.gold,
      loot_sell_value: data.loot_sell_value
    };
  }

  function extractCaptureFailed(data) {
    return {
      wild_monster_id: data.wild_monster_id,
      species_id: data.species_id,
      species_name: data.species_name,
      level: data.level,
      quality: data.quality,
      iv_total: data.iv_total,
      is_shiny: data.is_shiny,
      capsule_item_id: data.capsule_item_id,
      capsule_name: data.capsule_name,
      chance: data.chance,
      supply_cost: data.supply_cost
    };
  }

  function extractCaptureSuccess(data) {
    const creature = data.creature;

    return {
      wild_monster_id: data.wild_monster_id,
      species_id: data.species_id,
      species_name: data.species_name,
      capsule_item_id: data.capsule_item_id,
      capsule_name: data.capsule_name,
      chance: data.chance,
      supply_cost: data.supply_cost,
      auto_sold: data.auto_sold,
      auto_sell_value: data.auto_sell_value,
      // creature.level/creature.species_id são intencionalmente omitidos:
      // nunca usar o nível da criatura capturada como target level.
      creature:
        creature && typeof creature === "object"
          ? {
              quality: creature.quality,
              is_shiny: creature.is_shiny,
              ivs: creature.ivs
            }
          : undefined
    };
  }

  function extractProtocolEventData(type, data) {
    switch (type) {
      case "combat.started":
        return extractCombatStarted(data);
      case "loot.received":
        return extractLootReceived(data);
      case "capture.failed":
        return extractCaptureFailed(data);
      case "capture.success":
        return extractCaptureSuccess(data);
      case "hunt.stopped":
      case "hunt.analyzer_reset":
        // Só importam como sinal (pausa/atividade) — sem payload útil.
        return {};
      default:
        return null;
    }
  }

  function emitProtocolEvent(type, data, seq, ts, socketId) {
    if (!PROTOCOL_EVENT_TYPES.has(type)) return;

    const extracted = extractProtocolEventData(type, data);
    if (extracted === null) return;

    emit({
      event: "protocol.event",
      type,
      seq: finiteOrNull(seq),
      ts: finiteOrNull(ts),
      socketId,
      data: extracted
    });
  }

  function processPayload(payload, socketId) {
    if (!payload || typeof payload !== "object") return;

    const type = payload.type;
    const data = payload.data;

    if (!type || !data || typeof data !== "object") return;

    emitProtocolEvent(type, data, payload.seq, payload.ts, socketId);

    switch (type) {
      case "combat.started": {
        const enemy = data.enemy;

        if (!enemy || typeof enemy !== "object") return;

        emit({
          event: "counter.increment",
          kind: "seen",
          quality: normalizeQuality(enemy.quality),
          isShiny: Boolean(enemy.is_shiny)
        });

        // Também funciona como fallback de início/retomada da Hunt.
        emit({
          event: "hunt.activity"
        });

        break;
      }

      case "capture.success": {
        const creature = data.creature;

        if (!creature || typeof creature !== "object") return;

        emit({
          event: "counter.increment",
          kind: "captured",
          quality: normalizeQuality(creature.quality),
          isShiny: Boolean(creature.is_shiny)
        });

        break;
      }

      case "capture.failed": {
        emit({
          event: "counter.increment",
          kind: "failed",
          quality: normalizeQuality(data.quality),
          isShiny: Boolean(data.is_shiny)
        });

        break;
      }

      case "loot.received": {
        emit({
          event: "hunt.loot",
          trainerExp: finiteNumber(data.trainer_exp),
          pokemonExp: finiteNumber(data.pokemon_exp),
          dollars: finiteNumber(data.gold)
        });

        break;
      }

      case "hunt.analyzer_reset": {
        // Não zera nossos números automaticamente.
        // Apenas indica que há atividade de Hunt.
        emit({
          event: "hunt.activity"
        });

        break;
      }

      case "hunt.stopped": {
        emit({
          event: "hunt.pause"
        });

        break;
      }

      default:
        break;
    }
  }

  function processText(text, socketId) {
    if (typeof text !== "string" || text.length === 0) return;

    try {
      processPayload(JSON.parse(text), socketId);
    } catch {
      // Frames que não forem JSON são ignorados.
    }
  }

  function processMessageData(data, socketId) {
    if (typeof data === "string") {
      processText(data, socketId);
      return;
    }

    if (data instanceof Blob) {
      data.text()
        .then((text) => processText(text, socketId))
        .catch(() => {});
      return;
    }

    if (data instanceof ArrayBuffer) {
      try {
        processText(new TextDecoder().decode(data), socketId);
      } catch {
        // Binário não decodificável é ignorado.
      }
      return;
    }

    if (ArrayBuffer.isView(data)) {
      try {
        processText(
          new TextDecoder().decode(
            new Uint8Array(
              data.buffer,
              data.byteOffset,
              data.byteLength
            )
          ),
          socketId
        );
      } catch {
        // Binário não decodificável é ignorado.
      }
    }
  }

  // Fase 2: socketId local por instância de WebSocket observada — usado
  // só para dedupe/correlação (docs/PROTOCOL_AND_ANALYTICS.md §8), nunca
  // persistido entre reloads.
  let nextSocketId = 1;

  function observeSocket(socket) {
    const socketId = nextSocketId;
    nextSocketId += 1;

    socket.addEventListener("message", (event) => {
      processMessageData(event.data, socketId);
    });
  }

  const WebSocketProxy = new Proxy(NativeWebSocket, {
    construct(target, args) {
      const socket = Reflect.construct(target, args, target);
      observeSocket(socket);
      return socket;
    }
  });

  window.WebSocket = WebSocketProxy;
})();