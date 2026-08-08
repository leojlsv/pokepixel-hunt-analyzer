import { openDatabase, STORE_NAMES } from "../data/db.js";
import { createRepository } from "../data/repository.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { computeSessionMetrics } from "../domain/sessionMetrics.js";
import { computeGroupMetrics } from "../domain/groupMetrics.js";
import { computeRarityBreakdown } from "../domain/rarityBreakdown.js";
import { buildJsonBackup } from "../domain/export.js";

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
const HISTORY_PAGE_SIZE = 20;

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short"
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

function formatIvTotal(value) {
  return Number.isFinite(value) ? `${value}/186` : "—";
}

function fillRow(row, values) {
  for (const value of values) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
  }
}

// ============================================================
// Tabs
// ============================================================

const VIEWS = ["current", "history", "compare"];
let activeView = "current";

function switchView(view) {
  activeView = view;

  for (const name of VIEWS) {
    document.getElementById(`view-${name}`).hidden = name !== view;
  }

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  if (view === "history") {
    loadHistoryList({ reset: true }).catch((error) =>
      console.error("PokePixel Hunt Analyzer:", error)
    );
  } else if (view === "compare") {
    loadCompare().catch((error) => console.error("PokePixel Hunt Analyzer:", error));
  }
}

function wireTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
}

// ============================================================
// Current
// ============================================================

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

  // A future schema migration (Fase 5) would otherwise be blocked by this
  // long-lived Side Panel connection sitting on an older version.
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

  renderMetrics(computeSessionMetrics({ session, encounters, now: Date.now() }));
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

// ============================================================
// History (docs/DEVELOPMENT.md §6: "history and filters")
// ============================================================

let historyFilterAfter = -Infinity;
let historyFilterBefore = Infinity;
let historyPageBefore = Infinity;
let historySessionsById = new Map();

async function loadHistoryList({ reset = false } = {}) {
  if (reset) {
    historyPageBefore = historyFilterBefore;
    historySessionsById = new Map();
    document.getElementById("history-body").replaceChildren();
  }

  const sessionsRepo = createSessionsRepository(db);
  const encountersRepo = createEncountersRepository(db);

  const page = await sessionsRepo.getPage({
    limit: HISTORY_PAGE_SIZE,
    before: historyPageBefore,
    after: historyFilterAfter
  });

  const body = document.getElementById("history-body");

  for (const session of page) {
    historySessionsById.set(session.sessionId, session);

    const encounters = await encountersRepo.getBySessionId(session.sessionId);
    const metrics = computeSessionMetrics({ session, encounters, now: Date.now() });

    const row = document.createElement("tr");
    row.dataset.sessionId = session.sessionId;

    fillRow(row, [
      dateTimeFormatter.format(new Date(session.startedAtMs)),
      formatDuration(metrics.activeMs),
      formatNumber(metrics.seen),
      formatNumber(metrics.captured),
      formatNumber(metrics.failed),
      "→"
    ]);

    row.addEventListener("click", () => {
      showHistoryDetail(session.sessionId).catch((error) =>
        console.error("PokePixel Hunt Analyzer:", error)
      );
    });

    body.appendChild(row);
  }

  if (page.length > 0) {
    historyPageBefore = page[page.length - 1].startedAtMs;
  }

  document.getElementById("history-empty").hidden = historySessionsById.size > 0;
  document.getElementById("history-load-more").hidden = page.length < HISTORY_PAGE_SIZE;
}

function renderHistorySummary(metrics) {
  const container = document.getElementById("history-detail-summary");
  container.replaceChildren();

  const entries = [
    ["Duração", formatDuration(metrics.activeMs)],
    ["Seen", formatNumber(metrics.seen)],
    ["Captured", formatNumber(metrics.captured)],
    ["Failed", formatNumber(metrics.failed)],
    ["EXP/h Treinador", formatPerHour(metrics.trainerExpPerHour)],
    ["EXP/h Pokémon", formatPerHour(metrics.pokemonExpPerHour)],
    ["Dólar/h", formatPerHour(metrics.goldPerHour)]
  ];

  for (const [label, value] of entries) {
    const div = document.createElement("div");

    const span = document.createElement("span");
    span.textContent = label;

    const strong = document.createElement("strong");
    strong.textContent = value;

    div.append(span, strong);
    container.appendChild(div);
  }
}

function renderHistoryEncounters(encounters) {
  const body = document.getElementById("history-detail-encounters");
  body.replaceChildren();

  const sorted = encounters
    .slice()
    .sort((a, b) => (b.startedAtMs ?? 0) - (a.startedAtMs ?? 0));

  for (const encounter of sorted) {
    const row = document.createElement("tr");

    fillRow(row, [
      encounter.speciesName || encounter.speciesId || "—",
      encounter.level ?? "—",
      encounter.quality ?? "—",
      Array.isArray(encounter.elements) && encounter.elements.length
        ? encounter.elements.join("/")
        : "—",
      encounter.gender ?? "—",
      formatIvTotal(encounter.ivTotal),
      encounter.isShiny ? "✓" : "—",
      encounter.captureResult && encounter.captureResult !== "none"
        ? encounter.captureResult
        : "—"
    ]);

    body.appendChild(row);
  }
}

async function showHistoryDetail(sessionId) {
  const session = historySessionsById.get(sessionId);
  if (!session) return;

  const encountersRepo = createEncountersRepository(db);
  const encounters = await encountersRepo.getBySessionId(sessionId);
  const metrics = computeSessionMetrics({ session, encounters, now: Date.now() });

  document.getElementById("history-list-panel").hidden = true;
  const detailPanel = document.getElementById("history-detail-panel");
  detailPanel.hidden = false;
  detailPanel.dataset.sessionId = sessionId;

  renderHistorySummary(metrics);
  renderHistoryEncounters(encounters);
}

function backToHistoryList() {
  document.getElementById("history-detail-panel").hidden = true;
  document.getElementById("history-list-panel").hidden = false;
}

async function deleteCurrentHistoryDetail() {
  const sessionId = document.getElementById("history-detail-panel").dataset.sessionId;
  if (!sessionId) return;

  const confirmed = window.confirm(
    "Apagar esta sessão e todos os encontros dela? Essa ação não pode ser desfeita."
  );
  if (!confirmed) return;

  const encountersRepo = createEncountersRepository(db);
  const sessionsRepo = createSessionsRepository(db);

  // Encounters first — see data/sessionsRepository.js deleteSession() for why.
  await encountersRepo.deleteBySessionId(sessionId);
  await sessionsRepo.deleteSession(sessionId);

  historySessionsById.delete(sessionId);
  backToHistoryList();
  await loadHistoryList({ reset: true });
}

async function exportJsonBackup() {
  const sessionsRaw = createRepository(db, STORE_NAMES.SESSIONS);
  const configsRaw = createRepository(db, STORE_NAMES.CONFIGS);
  const encountersRepo = createEncountersRepository(db);

  const [sessions, configs, encounters] = await Promise.all([
    sessionsRaw.getAll(),
    configsRaw.getAll(),
    encountersRepo.getAll()
  ]);

  const backup = buildJsonBackup({
    appVersion: chrome.runtime.getManifest().version,
    sessions,
    configs,
    encounters
  });

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `pokepixel-hunt-analyzer-backup-${Date.now()}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

function wireHistory() {
  document.getElementById("history-filter-apply").addEventListener("click", () => {
    const fromValue = document.getElementById("history-filter-from").value;
    const toValue = document.getElementById("history-filter-to").value;

    historyFilterAfter = fromValue ? new Date(fromValue).getTime() : -Infinity;
    // Inclusive of the whole "to" day.
    historyFilterBefore = toValue
      ? new Date(toValue).getTime() + 24 * 60 * 60 * 1000
      : Infinity;

    loadHistoryList({ reset: true }).catch((error) =>
      console.error("PokePixel Hunt Analyzer:", error)
    );
  });

  document.getElementById("history-filter-clear").addEventListener("click", () => {
    document.getElementById("history-filter-from").value = "";
    document.getElementById("history-filter-to").value = "";
    historyFilterAfter = -Infinity;
    historyFilterBefore = Infinity;

    loadHistoryList({ reset: true }).catch((error) =>
      console.error("PokePixel Hunt Analyzer:", error)
    );
  });

  document.getElementById("history-load-more").addEventListener("click", () => {
    loadHistoryList().catch((error) => console.error("PokePixel Hunt Analyzer:", error));
  });

  document.getElementById("history-back-button").addEventListener("click", backToHistoryList);

  document
    .getElementById("history-delete-button")
    .addEventListener("click", () => {
      deleteCurrentHistoryDetail().catch((error) =>
        console.error("PokePixel Hunt Analyzer:", error)
      );
    });

  document.getElementById("export-json-button").addEventListener("click", () => {
    exportJsonBackup().catch((error) => console.error("PokePixel Hunt Analyzer:", error));
  });
}

// ============================================================
// Compare (docs/DEVELOPMENT.md §2: "aggregates by species + level + config")
// ============================================================

const COMPARE_THEMES = {
  cycle: {
    label: "Agrupado por espécie + nível + config",
    headers: ["Pokémon", "Nv", "Seen", "Cap.", "Fail", "EXP/Cycle h", "$/Cycle h"]
  },
  rarity: {
    label: "Agrupado por raridade",
    headers: ["Rarity", "Seen", "Cap.", "Fail", "Rate"]
  }
};

let compareEncounters = [];
let compareTheme = "cycle";
const compareFilters = { species: "*", capsule: "*", element: "*" };

// NOTE: the destructured option names below must never shadow an
// Object.prototype member (`valueOf`, `toString`, ...). A plain object
// always inherits those from the prototype chain, so `{} .valueOf` is
// `Object.prototype.valueOf` — never `undefined` — and a default value
// like `{ valueOf = (o) => o } = {}` silently never applies. That bug is
// exactly why the capsule/element dropdowns below used to come up empty:
// the borrowed native `valueOf` ran instead of the identity default and
// threw on the very first option, aborting the rest of loadCompare().
function populateSelect(select, options, { toValue = (o) => o, toLabel = (o) => o } = {}) {
  const previous = select.value || "*";
  select.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "*";
  allOption.textContent = "All (*)";
  select.appendChild(allOption);

  for (const option of options) {
    const el = document.createElement("option");
    el.value = toValue(option);
    el.textContent = toLabel(option);
    select.appendChild(el);
  }

  select.value = [...select.options].some((o) => o.value === previous) ? previous : "*";
}

// Species names come from the protocol already capitalized
// (combat.started/capture.* `species_name`), but an unresolved encounter
// falls back to the lowercase `species_id` slug — capitalize either way
// so the UI never shows a raw slug.
function capitalizeWords(text) {
  return String(text)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function speciesLabel(speciesName, speciesId) {
  const raw = speciesName || speciesId;
  return raw ? capitalizeWords(raw) : "—";
}

function distinctSpeciesOptions(encounters) {
  const bySpeciesId = new Map();

  for (const encounter of encounters) {
    if (!encounter.speciesId || bySpeciesId.has(encounter.speciesId)) continue;
    bySpeciesId.set(encounter.speciesId, speciesLabel(encounter.speciesName, encounter.speciesId));
  }

  return [...bySpeciesId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

function distinctValues(encounters, field) {
  const values = new Set();

  for (const encounter of encounters) {
    if (encounter[field]) values.add(encounter[field]);
  }

  return [...values].sort();
}

function distinctElements(encounters) {
  const values = new Set();

  for (const encounter of encounters) {
    if (Array.isArray(encounter.elements)) {
      for (const element of encounter.elements) values.add(element);
    }
  }

  return [...values].sort();
}

function applyCompareFilters(encounters) {
  return encounters.filter((encounter) => {
    if (compareFilters.species !== "*" && encounter.speciesId !== compareFilters.species) {
      return false;
    }

    if (compareFilters.capsule !== "*" && encounter.capsuleName !== compareFilters.capsule) {
      return false;
    }

    if (
      compareFilters.element !== "*" &&
      !(Array.isArray(encounter.elements) && encounter.elements.includes(compareFilters.element))
    ) {
      return false;
    }

    return true;
  });
}

// "By Cycle": species + level + config, same grouping as before.
function buildCompareGroups(encounters) {
  const groups = new Map();

  for (const encounter of encounters) {
    // Orphans and malformed rows never resolved a group_key — nothing to
    // compare them against (docs/ARCHITECTURE.md §5).
    if (!encounter.groupKey) continue;

    if (!groups.has(encounter.groupKey)) {
      groups.set(encounter.groupKey, {
        speciesId: encounter.speciesId,
        speciesName: encounter.speciesName,
        level: encounter.level,
        encounters: []
      });
    }

    groups.get(encounter.groupKey).encounters.push(encounter);
  }

  return groups;
}

function renderCompareHead() {
  const row = document.getElementById("compare-head-row");
  row.replaceChildren();

  for (const label of COMPARE_THEMES[compareTheme].headers) {
    const th = document.createElement("th");
    th.textContent = label;
    row.appendChild(th);
  }

  document.getElementById("compare-subtitle").textContent = COMPARE_THEMES[compareTheme].label;
}

function renderCompareByCycle(encounters, body) {
  const groups = buildCompareGroups(encounters);
  document.getElementById("compare-empty").hidden = groups.size > 0;

  for (const group of groups.values()) {
    const metrics = computeGroupMetrics(group.encounters);
    const row = document.createElement("tr");

    fillRow(row, [
      speciesLabel(group.speciesName, group.speciesId),
      group.level ?? "—",
      formatNumber(metrics.seen),
      formatNumber(metrics.captured),
      formatNumber(metrics.failed),
      formatPerHour(metrics.trainerExpPerCycleHour),
      formatPerHour(metrics.dollarPerCycleHour)
    ]);

    body.appendChild(row);
  }
}

// Identical structure to Current's own By Rarity table (docs/ARCHITECTURE.md
// §9) — same 7 tiers, same columns — computed over Compare's filtered,
// cross-session encounter set instead of one session's. Always shows all
// 7 rows (even at zero), so there is no empty state here.
function renderCompareByRarity(encounters, body) {
  document.getElementById("compare-empty").hidden = true;

  const breakdown = computeRarityBreakdown(encounters);

  for (const [key, label] of RARITY_LABELS) {
    const bucket = breakdown.rarities[key];
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    const nameSpan = document.createElement("span");
    nameSpan.className = `rarity-name rarity-${key}`;
    nameSpan.textContent = label;
    nameCell.appendChild(nameSpan);
    row.appendChild(nameCell);

    fillRow(row, [
      formatNumber(bucket.seen),
      formatNumber(bucket.captured),
      formatNumber(bucket.failed),
      formatRate(bucket.seen ? bucket.captured / bucket.seen : null)
    ]);

    body.appendChild(row);
  }
}

function renderCompareTable() {
  const filtered = applyCompareFilters(compareEncounters);

  const body = document.getElementById("compare-body");
  body.replaceChildren();
  renderCompareHead();

  if (compareTheme === "rarity") {
    renderCompareByRarity(filtered, body);
  } else {
    renderCompareByCycle(filtered, body);
  }
}

async function loadCompare() {
  const encountersRepo = createEncountersRepository(db);
  compareEncounters = await encountersRepo.getAll();

  populateSelect(
    document.getElementById("compare-filter-species"),
    distinctSpeciesOptions(compareEncounters),
    { toValue: ([id]) => id, toLabel: ([, label]) => label }
  );
  populateSelect(
    document.getElementById("compare-filter-capsule"),
    distinctValues(compareEncounters, "capsuleName")
  );
  populateSelect(
    document.getElementById("compare-filter-element"),
    distinctElements(compareEncounters)
  );

  renderCompareTable();
}

function wireCompare() {
  document.getElementById("compare-theme-select").addEventListener("change", (event) => {
    compareTheme = event.target.value;
    renderCompareTable();
  });

  document.getElementById("compare-filter-species").addEventListener("change", (event) => {
    compareFilters.species = event.target.value;
    renderCompareTable();
  });

  document.getElementById("compare-filter-capsule").addEventListener("change", (event) => {
    compareFilters.capsule = event.target.value;
    renderCompareTable();
  });

  document.getElementById("compare-filter-element").addEventListener("change", (event) => {
    compareFilters.element = event.target.value;
    renderCompareTable();
  });
}

// ============================================================
// Init
// ============================================================

async function init() {
  createRarityRows();
  wireTabs();
  wireActions();
  wireHistory();
  wireCompare();
  switchView("current");

  await openDb();
  await loadAndRender();

  // Reatividade: a Side Panel lê IndexedDB direto (não há notificação
  // entre contextos), então recomputa a cada 1s — mesmo padrão do
  // relógio visual da v0.3.0. Só a view Current precisa disso ao vivo;
  // History/Compare recarregam quando abertas ou após uma ação.
  setInterval(() => {
    if (activeView !== "current") return;

    loadAndRender().catch((error) => console.error("PokePixel Hunt Analyzer:", error));
  }, POLL_INTERVAL_MS);
}

init().catch((error) => console.error("PokePixel Hunt Analyzer:", error));
