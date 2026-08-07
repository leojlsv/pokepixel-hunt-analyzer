import { openDatabase } from "./data/db.js";
import { createEventPipeline } from "./services/eventPipeline.js";

const STATE_KEY = "counterState";

const RARITIES = [
  "weak",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical",
  "unknown"
];

const VALID_KINDS = new Set([
  "seen",
  "captured",
  "failed"
]);

let updateQueue = Promise.resolve();

// Fase 2: pipeline de eventos normalizados (IndexedDB), independente do
// contador legado acima. Aberto sob demanda e reaproveitado enquanto este
// service worker estiver vivo — nunca bloqueia/atrasa os handlers legados.
let eventPipelinePromise = null;

function getEventPipeline() {
  if (!eventPipelinePromise) {
    eventPipelinePromise = openDatabase().then((db) => createEventPipeline(db));
  }

  return eventPipelinePromise;
}

function emptyBucket() {
  return {
    seen: 0,
    captured: 0,
    failed: 0
  };
}

function createEmptyHuntState() {
  return {
    running: false,
    startedAt: null,
    accumulatedMs: 0,

    trainerExp: 0,
    pokemonExp: 0,
    dollars: 0,
    lootEvents: 0,

    // Reservado para evolução futura.
    // Não é usado para segmentar a Hunt nesta versão.
    config: {
      key: null,
      speciesId: null,
      level: null,
      expRate: null,
      captureConfig: null
    }
  };
}

/**
 * Preparado para uma futura segmentação por configuração:
 * species + level + expRate + captureConfig.
 *
 * Não usar como identificador único de encontro.
 */
function buildConfigKey({
  speciesId = null,
  level = null,
  expRate = null,
  captureConfig = null
} = {}) {
  return [
    speciesId ?? "*",
    level ?? "*",
    expRate ?? "*",
    captureConfig ?? "*"
  ].join("|");
}

function createInitialState() {
  const rarities = {};

  for (const rarity of RARITIES) {
    rarities[rarity] = emptyBucket();
  }

  return {
    version: 2,
    sessionStartedAt: Date.now(),

    totals: emptyBucket(),
    rarities,
    shiny: emptyBucket(),

    hunt: createEmptyHuntState()
  };
}

function normalizeCounter(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.trunc(number));
}

function normalizeAmount(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;
  return Math.max(0, number);
}

function normalizeState(state) {
  const normalized = createInitialState();

  if (!state || typeof state !== "object") {
    return normalized;
  }

  if (Number.isFinite(state.sessionStartedAt)) {
    normalized.sessionStartedAt = state.sessionStartedAt;
  } else if (Number.isFinite(state.startedAt)) {
    // Compatibilidade com v0.2.x.
    normalized.sessionStartedAt = state.startedAt;
  }

  for (const kind of VALID_KINDS) {
    normalized.totals[kind] =
      normalizeCounter(state?.totals?.[kind]);

    normalized.shiny[kind] =
      normalizeCounter(state?.shiny?.[kind]);
  }

  for (const rarity of RARITIES) {
    for (const kind of VALID_KINDS) {
      normalized.rarities[rarity][kind] =
        normalizeCounter(state?.rarities?.[rarity]?.[kind]);
    }
  }

  const hunt = state.hunt;

  if (hunt && typeof hunt === "object") {
    normalized.hunt.running =
      Boolean(hunt.running);

    normalized.hunt.startedAt =
      Number.isFinite(hunt.startedAt)
        ? hunt.startedAt
        : null;

    normalized.hunt.accumulatedMs =
      normalizeAmount(hunt.accumulatedMs);

    normalized.hunt.trainerExp =
      normalizeAmount(hunt.trainerExp);

    normalized.hunt.pokemonExp =
      normalizeAmount(hunt.pokemonExp);

    normalized.hunt.dollars =
      normalizeAmount(hunt.dollars);

    normalized.hunt.lootEvents =
      normalizeCounter(hunt.lootEvents);

    const config = hunt.config;

    if (config && typeof config === "object") {
      normalized.hunt.config = {
        key:
          typeof config.key === "string"
            ? config.key
            : null,

        speciesId:
          typeof config.speciesId === "string"
            ? config.speciesId
            : null,

        level:
          Number.isFinite(config.level)
            ? config.level
            : null,

        expRate:
          config.expRate ?? null,

        captureConfig:
          config.captureConfig ?? null
      };
    }
  }

  // Corrige estado inconsistente.
  if (
    normalized.hunt.running &&
    !Number.isFinite(normalized.hunt.startedAt)
  ) {
    normalized.hunt.startedAt = Date.now();
  }

  return normalized;
}

async function getState() {
  const result =
    await chrome.storage.session.get(STATE_KEY);

  return normalizeState(result[STATE_KEY]);
}

async function setState(state) {
  await chrome.storage.session.set({
    [STATE_KEY]: state
  });
}

function startOrResumeHunt(state, now = Date.now()) {
  if (state.hunt.running) return;

  state.hunt.running = true;
  state.hunt.startedAt = now;
}

function pauseHunt(state, now = Date.now()) {
  if (!state.hunt.running) return;

  const startedAt = state.hunt.startedAt;

  if (Number.isFinite(startedAt)) {
    state.hunt.accumulatedMs +=
      Math.max(0, now - startedAt);
  }

  state.hunt.running = false;
  state.hunt.startedAt = null;
}

function rarePlusFailed(state) {
  return (
    state.rarities.rare.failed +
    state.rarities.epic.failed +
    state.rarities.legendary.failed +
    state.rarities.mythical.failed
  );
}

async function updateBadge(state) {
  const value = rarePlusFailed(state);

  await chrome.action.setBadgeText({
    text: value > 0
      ? String(value)
      : ""
  });

  await chrome.action.setBadgeBackgroundColor({
    color: "#b23a48"
  });
}

async function incrementCounter(message) {
  if (!VALID_KINDS.has(message.kind)) return;

  const quality =
    RARITIES.includes(message.quality)
      ? message.quality
      : "unknown";

  const state = await getState();

  // combat.started ("seen") é também fallback de início/retomada.
  if (message.kind === "seen") {
    startOrResumeHunt(state);
  }

  state.totals[message.kind] += 1;
  state.rarities[quality][message.kind] += 1;

  if (message.isShiny) {
    state.shiny[message.kind] += 1;
  }

  await setState(state);
  await updateBadge(state);
}

async function registerHuntActivity() {
  const state = await getState();

  startOrResumeHunt(state);

  await setState(state);
}

async function registerLoot(message) {
  const state = await getState();

  // Protege importações/ordens incompletas:
  // loot também pode iniciar/retomar o relógio.
  startOrResumeHunt(state);

  state.hunt.trainerExp +=
    normalizeAmount(message.trainerExp);

  state.hunt.pokemonExp +=
    normalizeAmount(message.pokemonExp);

  state.hunt.dollars +=
    normalizeAmount(message.dollars);

  state.hunt.lootEvents += 1;

  await setState(state);
}

async function registerPause() {
  const state = await getState();

  pauseHunt(state);

  await setState(state);
}

async function resetState() {
  const state = createInitialState();

  await setState(state);
  await updateBadge(state);
}

function isPokePixelSender(sender) {
  const url =
    sender?.url ||
    sender?.tab?.url ||
    "";

  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "pokepixel.nietore.com"
    );
  } catch {
    return false;
  }
}

async function configureSidePanel() {
  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
}

chrome.runtime.onInstalled.addListener(() => {
  updateQueue = updateQueue
    .then(async () => {
      await configureSidePanel();

      const state = await getState();

      await setState(state);
      await updateBadge(state);
    })
    .catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  updateQueue = updateQueue
    .then(async () => {
      await configureSidePanel();

      const state = await getState();

      await updateBadge(state);
    })
    .catch(console.error);

  // Fase 2, independente da fila do contador legado acima: recupera a
  // sessão local (docs/ARCHITECTURE.md §7 "Browser restart recovery") —
  // só roda em reinício real do navegador, nunca a cada wake do service
  // worker. Uma falha aqui não deve afetar o contador legado.
  getEventPipeline()
    .then((pipeline) => pipeline.recoverOnStartup())
    .catch((error) => {
      console.error(
        "PokePixel Hunt Analyzer (session recovery):",
        error
      );
    });
});

configureSidePanel().catch(console.error);

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (
      !message ||
      typeof message !== "object"
    ) {
      return false;
    }

    const pageMessageTypes = new Set([
      "counter.increment",
      "hunt.activity",
      "hunt.loot",
      "hunt.pause",
      "protocol.event"
    ]);

    if (
      pageMessageTypes.has(message.type) &&
      !isPokePixelSender(sender)
    ) {
      sendResponse({
        ok: false,
        error: "invalid_sender"
      });

      return false;
    }

    if (message.type === "counter.increment") {
      updateQueue = updateQueue
        .then(() => incrementCounter(message))
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error(
            "PokePixel Capture Counter:",
            error
          );

          sendResponse({
            ok: false,
            error: "increment_failed"
          });
        });

      return true;
    }

    if (message.type === "hunt.activity") {
      updateQueue = updateQueue
        .then(() => registerHuntActivity())
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error(
            "PokePixel Capture Counter:",
            error
          );

          sendResponse({
            ok: false,
            error: "hunt_activity_failed"
          });
        });

      return true;
    }

    if (message.type === "hunt.loot") {
      updateQueue = updateQueue
        .then(() => registerLoot(message))
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error(
            "PokePixel Capture Counter:",
            error
          );

          sendResponse({
            ok: false,
            error: "hunt_loot_failed"
          });
        });

      return true;
    }

    if (message.type === "hunt.pause") {
      updateQueue = updateQueue
        .then(() => registerPause())
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error(
            "PokePixel Capture Counter:",
            error
          );

          sendResponse({
            ok: false,
            error: "hunt_pause_failed"
          });
        });

      return true;
    }

    if (message.type === "counter.reset") {
      updateQueue = updateQueue
        .then(() => resetState())
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error(
            "PokePixel Capture Counter:",
            error
          );

          sendResponse({
            ok: false,
            error: "reset_failed"
          });
        });

      return true;
    }

    if (message.type === "counter.get") {
      updateQueue = updateQueue
        .then(() => getState())
        .then((state) => {
          sendResponse({
            ok: true,
            state
          });
        })
        .catch((error) => {
          console.error(
            "PokePixel Capture Counter:",
            error
          );

          sendResponse({
            ok: false,
            error: "get_failed"
          });
        });

      return true;
    }

    if (message.type === "protocol.event") {
      // Pipeline novo (Fase 2), isolado do contador legado acima: um erro
      // aqui nunca deve impedir sendResponse nem afetar os handlers legados
      // (docs/DEVELOPMENT.md §1 "Analytics failures must fail closed").
      updateQueue = updateQueue
        .then(async () => {
          const pipeline = await getEventPipeline();

          await pipeline.handle({
            type: message.eventType,
            seq: message.seq,
            ts: message.ts,
            socketId: message.socketId,
            data: message.data
          });
        })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error(
            "PokePixel Hunt Analyzer (event pipeline):",
            error
          );

          sendResponse({
            ok: false,
            error: "protocol_event_failed"
          });
        });

      return true;
    }

    return false;
  }
);

// Mantido propositalmente para deixar a futura chave preparada
// e evitar que sua definição seja removida em refactors automáticos.
void buildConfigKey;