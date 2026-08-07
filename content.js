(() => {
  "use strict";

  const CHANNEL = "POKEPIXEL_CAPTURE_COUNTER_V1";

  const VALID_EVENTS = new Set([
    "counter.increment",
    "hunt.activity",
    "hunt.loot",
    "hunt.pause",
    "protocol.event"
  ]);

  const VALID_KINDS = new Set([
    "seen",
    "captured",
    "failed"
  ]);

  const VALID_QUALITIES = new Set([
    "weak",
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
    "mythical",
    "unknown"
  ]);

  // Fase 2: contratos de evento normalizado (docs/PROTOCOL_AND_ANALYTICS.md §1).
  // Só validação estrutural/tipos aqui — regra de negócio fica em
  // domain/events.js, do lado do background, para não duplicar em dois
  // mundos de JS diferentes.
  const PROTOCOL_EVENT_TYPES = new Set([
    "combat.started",
    "loot.received",
    "capture.failed",
    "capture.success",
    "hunt.stopped",
    "hunt.analyzer_reset"
  ]);

  function finiteNonNegative(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return 0;
    return Math.max(0, number);
  }

  function isFiniteOrNull(value) {
    return value === null || Number.isFinite(value);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const message = event.data;

    if (!message || message.channel !== CHANNEL) return;
    if (!VALID_EVENTS.has(message.event)) return;

    if (message.event === "counter.increment") {
      if (!VALID_KINDS.has(message.kind)) return;

      const quality = VALID_QUALITIES.has(message.quality)
        ? message.quality
        : "unknown";

      chrome.runtime.sendMessage({
        type: "counter.increment",
        kind: message.kind,
        quality,
        isShiny: Boolean(message.isShiny)
      }).catch(() => {});

      return;
    }

    if (message.event === "hunt.loot") {
      chrome.runtime.sendMessage({
        type: "hunt.loot",
        trainerExp: finiteNonNegative(message.trainerExp),
        pokemonExp: finiteNonNegative(message.pokemonExp),
        dollars: finiteNonNegative(message.dollars)
      }).catch(() => {});

      return;
    }

    if (message.event === "hunt.pause") {
      chrome.runtime.sendMessage({
        type: "hunt.pause"
      }).catch(() => {});

      return;
    }

    if (message.event === "hunt.activity") {
      chrome.runtime.sendMessage({
        type: "hunt.activity"
      }).catch(() => {});

      return;
    }

    if (message.event === "protocol.event") {
      if (!PROTOCOL_EVENT_TYPES.has(message.type)) return;
      if (!Number.isInteger(message.socketId) || message.socketId <= 0) return;
      if (!isFiniteOrNull(message.seq)) return;
      if (!isFiniteOrNull(message.ts)) return;
      if (!message.data || typeof message.data !== "object") return;

      chrome.runtime.sendMessage({
        type: "protocol.event",
        eventType: message.type,
        seq: message.seq,
        ts: message.ts,
        socketId: message.socketId,
        data: message.data
      }).catch(() => {});
    }
  });
})();