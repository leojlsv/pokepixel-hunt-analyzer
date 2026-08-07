(() => {
  "use strict";

  const CHANNEL = "POKEPIXEL_CAPTURE_COUNTER_V1";

  const VALID_EVENTS = new Set([
    "counter.increment",
    "hunt.activity",
    "hunt.loot",
    "hunt.pause"
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

  function finiteNonNegative(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return 0;
    return Math.max(0, number);
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
    }
  });
})();