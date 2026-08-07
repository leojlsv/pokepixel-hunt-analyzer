(() => {
  "use strict";

  const CHANNEL = "POKEPIXEL_CAPTURE_COUNTER_V1";

  const VALID_EVENTS = new Set([
    "protocol.event"
  ]);

  // Contratos de evento normalizado (docs/PROTOCOL_AND_ANALYTICS.md §1).
  // Só validação estrutural/tipos aqui — regra de negócio fica em
  // domain/events.js, do lado do background, para não duplicar em dois
  // mundos de JS diferentes. O contador legado foi retirado na Fase 3.
  const PROTOCOL_EVENT_TYPES = new Set([
    "combat.started",
    "loot.received",
    "capture.failed",
    "capture.success",
    "hunt.stopped",
    "hunt.analyzer_reset"
  ]);

  function isFiniteOrNull(value) {
    return value === null || Number.isFinite(value);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const message = event.data;

    if (!message || message.channel !== CHANNEL) return;
    if (!VALID_EVENTS.has(message.event)) return;

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