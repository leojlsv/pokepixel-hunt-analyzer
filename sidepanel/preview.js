/**
 * Visual preview — no chrome.* APIs, no IndexedDB. Deterministic mock
 * data shaped exactly like domain/sessionMetrics.js's computeCurrentMetrics()
 * output, so this file's rendering logic mirrors sidepanel.js's (kept as a
 * separate, self-contained copy — same convention as before Fase 3).
 */

const RARITY_LABELS = [
  ["weak", "Weak"],
  ["common", "Common"],
  ["uncommon", "Uncommon"],
  ["rare", "Rare"],
  ["epic", "Epic"],
  ["legendary", "Legendary"],
  ["mythical", "Mythical"]
];

const MOCK_SESSION_STARTED_AT = Date.now() - (4 * 60 + 56) * 1000;

const MOCK_BASE = {
  status: "running",
  trainerExp: 185673,
  pokemonExp: 278510,
  gold: 7962,
  seen: 2622,
  captured: 97,
  failed: 2525,
  rarities: {
    weak: { seen: 430, captured: 18, failed: 412 },
    common: { seen: 1180, captured: 49, failed: 1131 },
    uncommon: { seen: 585, captured: 21, failed: 564 },
    rare: { seen: 320, captured: 7, failed: 313 },
    epic: { seen: 82, captured: 2, failed: 80 },
    legendary: { seen: 20, captured: 0, failed: 20 },
    mythical: { seen: 5, captured: 0, failed: 5 },
    unknown: { seen: 0, captured: 0, failed: 0 }
  },
  shiny: { seen: 3, captured: 1, failed: 2 }
};

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

function perHour(amount, elapsedMs) {
  return elapsedMs > 0 ? amount / (elapsedMs / 3600000) : null;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function computeMockMetrics(now) {
  const elapsedMs = Math.max(0, now - MOCK_SESSION_STARTED_AT);
  const rarities = MOCK_BASE.rarities;

  return {
    status: MOCK_BASE.status,
    activeMs: elapsedMs,
    trainerExp: MOCK_BASE.trainerExp,
    trainerExpPerHour: perHour(MOCK_BASE.trainerExp, elapsedMs),
    pokemonExp: MOCK_BASE.pokemonExp,
    pokemonExpPerHour: perHour(MOCK_BASE.pokemonExp, elapsedMs),
    gold: MOCK_BASE.gold,
    goldPerHour: perHour(MOCK_BASE.gold, elapsedMs),
    seen: MOCK_BASE.seen,
    captured: MOCK_BASE.captured,
    failed: MOCK_BASE.failed,
    seenToCaptureRate: rate(MOCK_BASE.captured, MOCK_BASE.seen),
    attemptRate: rate(MOCK_BASE.captured, MOCK_BASE.captured + MOCK_BASE.failed),
    rarePlusFailed:
      rarities.rare.failed +
      rarities.epic.failed +
      rarities.legendary.failed +
      rarities.mythical.failed,
    rarities,
    shiny: MOCK_BASE.shiny,
    hasUnknownQuality: false
  };
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

function updatePauseResumeButton(status) {
  const button = document.getElementById("pause-resume-button");
  button.textContent = status === "running" ? "Pause" : "Resume";
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
  status.className = "status-badge running";
  status.textContent = "Running";

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
}

function previewOnly() {
  alert("Preview: nenhum dado real foi alterado.");
}

createRarityRows();
renderMetrics(computeMockMetrics(Date.now()));

for (const id of ["new-hunt-button", "end-hunt-button", "pause-resume-button"]) {
  document.getElementById(id).addEventListener("click", previewOnly);
}

setInterval(() => {
  renderMetrics(computeMockMetrics(Date.now()));
}, 1000);
