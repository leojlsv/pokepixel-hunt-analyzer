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

  function emit(message) {
    window.postMessage(
      {
        channel: CHANNEL,
        ...message
      },
      window.location.origin
    );
  }

  function processPayload(payload) {
    if (!payload || typeof payload !== "object") return;

    const type = payload.type;
    const data = payload.data;

    if (!type || !data || typeof data !== "object") return;

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

  function processText(text) {
    if (typeof text !== "string" || text.length === 0) return;

    try {
      processPayload(JSON.parse(text));
    } catch {
      // Frames que não forem JSON são ignorados.
    }
  }

  function processMessageData(data) {
    if (typeof data === "string") {
      processText(data);
      return;
    }

    if (data instanceof Blob) {
      data.text()
        .then(processText)
        .catch(() => {});
      return;
    }

    if (data instanceof ArrayBuffer) {
      try {
        processText(new TextDecoder().decode(data));
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
          )
        );
      } catch {
        // Binário não decodificável é ignorado.
      }
    }
  }

  function observeSocket(socket) {
    socket.addEventListener("message", (event) => {
      processMessageData(event.data);
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