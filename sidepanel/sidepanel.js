import { openDatabase } from "../data/db.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { computeCurrentMetrics } from "../domain/sessionMetrics.js";

const RARITY_LABELS = [
  ["weak", "Weak"],
  ["common", "Common"],
  ["uncommon", "Uncommon"],
  ["rare", "Rare"],
  ["epic", "Epic"],
  ["legendary", "Legendary"],
  ["mythical", "Mythical"]
];

const POLL_INTERVAL_MS = 1000;

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0
});

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

function formatPerHour(value) {
  return value === null || value === undefined ? "—" : formatNumber(value);
}

function formatRate(fraction) {
  if (fraction === null || fraction === undefined) return "—";
  return `${(fraction * 100).toFixed(2)}%`;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
  }

  return [minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

function createRarityRows() {
  const body = document.getElementById("rarity-body");

  for (const [key, label] of RARITY_LABELS) {
    const row = document.createElement("tr");
    row.dataset.rarity = key;

    row.innerHTML = `
      <td>
        <span class="rarity-name rarity-${key}">${label}</span>
      </td>
      <td data-field="seen">0</td>
      <td data-field="captured">0</td>
      <td data-field="failed">0</td>
      <td data-field="rate">—</td>
    `;

    body.appendChild(row);
  }
}

function renderRarityRow(key, bucket) {
  const row = document.querySelector(`[data-rarity="${key}"]`);
  if (!row || !bucket) return;

  row.querySelector('[data-field="seen"]').textContent = formatNumber(bucket.seen);
  row.querySelector('[data-field="captured"]').textContent = formatNumber(bucket.captured);
  row.querySelector('[data-field="failed"]').textContent = formatNumber(bucket.failed);
  row.querySelector('[data-field="rate"]').textContent = formatRate(
    bucket.seen ? bucket.captured / bucket.seen : null
  );
}

// Pause/Resume only ever act on a Hunt that already exists (running or
// paused) — with nothing to pause or resume ("waiting": no session yet,
// or one manually ended), the button is disabled and only "New Hunt"
// applies.
function updatePauseResumeButton(status) {
  const button = document.getElementById("pause-resume-button");

  if (status === "running") {
    button.textContent = "Pause";
    button.dataset.action = "pause";
    button.disabled = false;
  } else if (status === "paused") {
    button.textContent = "Resume";
    button.dataset.action = "resume";
    button.disabled = false;
  } else {
    button.textContent = "Resume";
    button.dataset.action = "resume";
    button.disabled = true;
  }
}

function updateEndHuntButton(status) {
  document.getElementById("end-hunt-button").disabled = status === "waiting";
}

function renderMetrics(metrics) {
  document.getElementById("hunt-time").textContent = formatDuration(metrics.activeMs);

  document.getElementById("trainer-exp-hour").textContent =
    formatPerHour(metrics.trainerExpPerHour);
  document.getElementById("trainer-exp-total").textContent = formatNumber(metrics.trainerExp);

  document.getElementById("pokemon-exp-hour").textContent =
    formatPerHour(metrics.pokemonExpPerHour);
  document.getElementById("pokemon-exp-total").textContent = formatNumber(metrics.pokemonExp);

  document.getElementById("dollars-hour").textContent = formatPerHour(metrics.goldPerHour);
  document.getElementById("dollars-total").textContent = formatNumber(metrics.gold);

  const status = document.getElementById("hunt-status");
  status.classList.remove("running", "paused");

  if (metrics.status === "running") {
    status.textContent = "Running";
    status.classList.add("running");
  } else if (metrics.status === "paused") {
    status.textContent = "Paused";
    status.classList.add("paused");
  } else {
    status.textContent = "Waiting";
  }

  document.getElementById("total-seen").textContent = formatNumber(metrics.seen);
  document.getElementById("total-captured").textContent = formatNumber(metrics.captured);
  document.getElementById("total-failed").textContent = formatNumber(metrics.failed);
  document.getElementById("rare-plus-failed").textContent = formatNumber(metrics.rarePlusFailed);

  document.getElementById("seen-rate").textContent = formatRate(metrics.seenToCaptureRate);
  document.getElementById("attempt-rate").textContent = formatRate(metrics.attemptRate);

  document.getElementById("shiny-seen").textContent = formatNumber(metrics.shiny.seen);
  document.getElementById("shiny-captured").textContent = formatNumber(metrics.shiny.captured);
  document.getElementById("shiny-failed").textContent = formatNumber(metrics.shiny.failed);

  for (const [key] of RARITY_LABELS) {
    renderRarityRow(key, metrics.rarities[key]);
  }

  document.getElementById("unknown-warning").hidden = !metrics.hasUnknownQuality;

  updatePauseResumeButton(metrics.status);
  updateEndHuntButton(metrics.status);
}

let db;

async function openDb() {
  db = await openDatabase();

  // A future schema migration (Fase 4/5) would otherwise be blocked by
  // this long-lived Side Panel connection sitting on an older version.
  db.onversionchange = () => {
    db.close();
  };

  return db;
}

async function loadAndRender() {
  const sessionsRepo = createSessionsRepository(db);
  const encountersRepo = createEncountersRepository(db);

  const session = await sessionsRepo.getCurrentReadOnly();
  const encounters = session
    ? await encountersRepo.getBySessionId(session.sessionId)
    : [];

  renderMetrics(computeCurrentMetrics({ session, encounters, now: Date.now() }));
}

function sendAction(type) {
  return chrome.runtime
    .sendMessage({ type })
    .catch((error) => console.error("PokePixel Hunt Analyzer:", error));
}

async function handleAction(type) {
  await sendAction(type);
  await loadAndRender();
}

function wireActions() {
  document
    .getElementById("new-hunt-button")
    .addEventListener("click", () => handleAction("session.new"));

  document
    .getElementById("end-hunt-button")
    .addEventListener("click", () => handleAction("session.end"));

  document
    .getElementById("pause-resume-button")
    .addEventListener("click", (event) => {
      const action = event.currentTarget.dataset.action === "pause"
        ? "session.pause"
        : "session.resume";

      handleAction(action);
    });
}

async function init() {
  createRarityRows();
  wireActions();

  await openDb();
  await loadAndRender();

  // Reatividade: a Side Panel lê IndexedDB direto (não há notificação
  // entre contextos), então recomputa a cada 1s — mesmo padrão do
  // relógio visual da v0.3.0, agora também refazendo a query.
  setInterval(() => {
    loadAndRender().catch((error) => console.error("PokePixel Hunt Analyzer:", error));
  }, POLL_INTERVAL_MS);
}

init().catch((error) => console.error("PokePixel Hunt Analyzer:", error));
