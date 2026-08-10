/**
 * Visual preview — no chrome.* APIs, no IndexedDB. Deterministic mock
 * data shaped exactly like the domain layer's outputs
 * (computeSessionMetrics(), computeGroupMetrics()), so this file's
 * rendering logic mirrors sidepanel.js's (kept as a separate,
 * self-contained copy — same convention as before Fase 3). Tabs/History/
 * Compare read from in-memory mock arrays instead of IndexedDB; list
 * navigation and Compare filters are fully interactive (pure DOM/array
 * work) so the new UI can be checked visually, but anything that would
 * mutate or export real data (New Hunt/Pause/End Hunt, delete, export)
 * only shows the existing "preview only" alert.
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

// Hunt card only: numbers over 5 digits (>= 100,000) get their last 3
// digits abbreviated into a "K" suffix instead of wrapping/overflowing
// the narrow card (e.g. "185.673" -> "186K").
function formatCompactNumber(value) {
  const num = Number(value) || 0;
  if (Math.abs(num) >= 100_000) {
    return `${formatNumber(Math.round(num / 1000))}K`;
  }
  return formatNumber(num);
}

function formatCompactNumberSmall(value) {
  const num = Number(value) || 0;
  if (Math.abs(num) >= 1_000) {
    return `${formatNumber(Math.round(num / 1000))}K`;
  }
  return formatNumber(num);
}

function formatCompactPerHour(value) {
  return value === null || value === undefined ? "—" : formatCompactNumber(value);
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

function perHour(amount, elapsedMs) {
  return elapsedMs > 0 ? amount / (elapsedMs / 3600000) : null;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function previewOnly() {
  alert("Preview: no real data was changed.");
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
    renderHistoryList();
  } else if (view === "compare") {
    renderCompare();
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

const MOCK_SESSION_STARTED_AT = Date.now() - (4 * 60 + 56) * 1000;

const MOCK_BASE = {
  status: "running",
  trainerExp: 185673,
  pokemonExp: 278510,
  gold: 7962,
  seen: 2622,
  captured: 97,
  failed: 2525,
  capsulesCost: 3480,
  potionsUsed: 214,
  potionsCost: 3102,
  // shinySeen/shinyCaptured/shinyFailed are annotations, not additive —
  // the plain seen/captured/failed above already include the shiny ones.
  rarities: {
    weak: { seen: 430, captured: 18, failed: 412, shinySeen: 0, shinyCaptured: 0, shinyFailed: 0 },
    common: { seen: 1180, captured: 49, failed: 1131, shinySeen: 1, shinyCaptured: 0, shinyFailed: 1 },
    uncommon: { seen: 585, captured: 21, failed: 564, shinySeen: 0, shinyCaptured: 0, shinyFailed: 0 },
    rare: { seen: 320, captured: 7, failed: 313, shinySeen: 1, shinyCaptured: 1, shinyFailed: 0 },
    epic: { seen: 82, captured: 2, failed: 80, shinySeen: 1, shinyCaptured: 0, shinyFailed: 1 },
    legendary: { seen: 20, captured: 0, failed: 20, shinySeen: 0, shinyCaptured: 0, shinyFailed: 0 },
    mythical: { seen: 5, captured: 0, failed: 5, shinySeen: 0, shinyCaptured: 0, shinyFailed: 0 },
    unknown: { seen: 0, captured: 0, failed: 0, shinySeen: 0, shinyCaptured: 0, shinyFailed: 0 }
  }
};

function computeMockMetrics(now) {
  const elapsedMs = Math.max(0, now - MOCK_SESSION_STARTED_AT);
  const rarities = MOCK_BASE.rarities;
  const expenses = MOCK_BASE.capsulesCost + MOCK_BASE.potionsCost;

  return {
    status: MOCK_BASE.status,
    activeMs: elapsedMs,
    trainerExp: MOCK_BASE.trainerExp,
    trainerExpPerHour: perHour(MOCK_BASE.trainerExp, elapsedMs),
    pokemonExp: MOCK_BASE.pokemonExp,
    pokemonExpPerHour: perHour(MOCK_BASE.pokemonExp, elapsedMs),
    gold: MOCK_BASE.gold,
    goldPerHour: perHour(MOCK_BASE.gold, elapsedMs),
    capsulesCost: MOCK_BASE.capsulesCost,
    potionsUsed: MOCK_BASE.potionsUsed,
    potionsCost: MOCK_BASE.potionsCost,
    expenses,
    // Lucro Total: a straight total, no active-time division at all
    // ("não importa o custo temporal") — unlike every other card here.
    profitTotal: MOCK_BASE.gold - expenses,
    seen: MOCK_BASE.seen,
    captured: MOCK_BASE.captured,
    failed: MOCK_BASE.failed,
    seenToCaptureRate: rate(MOCK_BASE.captured, MOCK_BASE.seen),
    attemptRate: rate(MOCK_BASE.captured, MOCK_BASE.captured + MOCK_BASE.failed),
    rarities,
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

// "Qty (ShinyQty)" — the shiny count is an annotation, never additive:
// bucket.seen/captured/failed already include the shiny ones.
function renderCountWithShiny(cell, count, shinyCount) {
  cell.replaceChildren(document.createTextNode(formatNumber(count)));

  if (shinyCount > 0) {
    const span = document.createElement("span");
    span.className = "shiny-count";
    span.textContent = ` (${formatNumber(shinyCount)})`;
    cell.appendChild(span);
  }
}

function renderRarityRow(key, bucket) {
  const row = document.querySelector(`[data-rarity="${key}"]`);
  if (!row || !bucket) return;

  renderCountWithShiny(row.querySelector('[data-field="seen"]'), bucket.seen, bucket.shinySeen);
  renderCountWithShiny(
    row.querySelector('[data-field="captured"]'),
    bucket.captured,
    bucket.shinyCaptured
  );
  renderCountWithShiny(row.querySelector('[data-field="failed"]'), bucket.failed, bucket.shinyFailed);
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
    formatCompactPerHour(metrics.trainerExpPerHour);
  document.getElementById("trainer-exp-total").textContent =
    formatCompactNumber(metrics.trainerExp);

  document.getElementById("pokemon-exp-hour").textContent =
    formatCompactPerHour(metrics.pokemonExpPerHour);
  document.getElementById("pokemon-exp-total").textContent =
    formatCompactNumber(metrics.pokemonExp);

  // Dólar shows the total up front now, the per-hour rate demoted below.
  document.getElementById("dollars-total").textContent = formatCompactNumber(metrics.gold);
  document.getElementById("dollars-hour").textContent = formatCompactPerHour(metrics.goldPerHour);

  // Lucro Total: a straight total (gold - expenses), no per-hour rate —
  // it deliberately doesn't care how long the Hunt has been running.
  // The breakdown below is just ↑ income / ↓ expenses — no labels, no
  // Potions (dropped from this card).
  const profitEl = document.getElementById("profit-total");
  profitEl.textContent = formatCompactNumber(metrics.profitTotal);
  profitEl.classList.toggle("positive", metrics.profitTotal > 0);
  profitEl.classList.toggle("negative", metrics.profitTotal < 0);
  document.getElementById("profit-expenses-total").textContent =
    formatCompactNumber(metrics.expenses);

  const status = document.getElementById("hunt-status");
  status.className = "status-badge running";
  status.textContent = "Running";

  document.getElementById("total-seen").textContent = formatNumber(metrics.seen);
  document.getElementById("total-captured").textContent = formatNumber(metrics.captured);
  document.getElementById("total-failed").textContent = formatNumber(metrics.failed);

  document.getElementById("seen-rate").textContent = formatRate(metrics.seenToCaptureRate);

  for (const [key] of RARITY_LABELS) {
    renderRarityRow(key, metrics.rarities[key]);
  }

  document.getElementById("unknown-warning").hidden = !metrics.hasUnknownQuality;

  updatePauseResumeButton(metrics.status);
}

function wireActions() {
  for (const id of ["new-hunt-button", "end-hunt-button", "pause-resume-button"]) {
    document.getElementById(id).addEventListener("click", previewOnly);
  }
}

// ============================================================
// Captured (Current view — list of successfully captured Pokémon)
//
// Self-contained mock, independent of the History mock below (that one
// belongs to a different tab) — a handful of fictitious captures with
// varied rarity/gender/nature/IVs/qualityMultiplier.
// ============================================================

function formatQualityMultiplier(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

function formatIvStat(value) {
  return Number.isFinite(value) ? String(value) : "—";
}

// Single-column IV presentation for the Captured table: "31-31-31-31-31-31"
// — the 6 individual stats in HP-ATK-DEF-SATK-SDEF-SPE order (matching the
// column header) instead of 6 separate columns. Frees up horizontal space
// so Nature stops getting clipped in a narrow panel. ivTotal itself is
// deliberately not shown here (still used by the "IV Total >" filter) —
// dropped from display to save even more width.
function formatIvBreakdown(ivs) {
  return [ivs.hp, ivs.atk, ivs.def, ivs.spa, ivs.spd, ivs.spe]
    .map(formatIvStat)
    .join("-");
}

function genderSymbol(gender) {
  if (gender === "male") return "♂";
  if (gender === "female") return "♀";
  return "";
}

// Falls back to "unknown" (same default gray as the By Rarity table) for
// anything outside the known tiers, instead of emitting an arbitrary,
// unsanitized CSS class name.
function rarityKeyFor(quality) {
  return RARITY_LABELS.some(([key]) => key === quality) ? quality : "unknown";
}

const MOCK_CAPTURED = [
  {
    speciesId: "dragonite",
    speciesName: "Dragonite",
    quality: "epic",
    gender: "female",
    nature: "brave",
    qualityMultiplier: 1.4821,
    ivTotal: 152,
    ivs: { hp: 28, atk: 24, def: 30, spa: 22, spd: 26, spe: 22 }
  },
  {
    speciesId: "charmander",
    speciesName: "Charmander",
    quality: "uncommon",
    gender: "male",
    nature: "adamant",
    qualityMultiplier: 1.1874,
    ivTotal: 121,
    ivs: { hp: 20, atk: 25, def: 18, spa: 15, spd: 21, spe: 22 }
  },
  {
    speciesId: "pidgey",
    speciesName: "Pidgey",
    quality: "weak",
    gender: "female",
    nature: "hardy",
    qualityMultiplier: 0.9421,
    ivTotal: 41,
    ivs: { hp: 8, atk: 6, def: 9, spa: 5, spd: 7, spe: 6 },
    isShiny: true
  },
  {
    speciesId: "tauros",
    speciesName: "Tauros",
    quality: "common",
    gender: "male",
    nature: "careful",
    qualityMultiplier: 1.0234,
    ivTotal: 82,
    ivs: { hp: 5, atk: 2, def: 20, spa: 6, spd: 19, spe: 30 }
  },
  {
    speciesId: "kabutops",
    speciesName: "Kabutops",
    quality: "rare",
    gender: "female",
    nature: "jolly",
    qualityMultiplier: 1.312,
    ivTotal: 174,
    ivs: { hp: 29, atk: 31, def: 28, spa: 24, spd: 30, spe: 32 }
  }
].map((entry) => ({ ...entry, captureResult: "success" }));

const capturedFilters = { rarity: "*", qualityMin: null, ivTotalMin: null };

function applyCapturedFilters(captured) {
  return captured.filter((entry) => {
    if (capturedFilters.rarity !== "*" && entry.quality !== capturedFilters.rarity) {
      return false;
    }

    if (
      Number.isFinite(capturedFilters.qualityMin) &&
      !(Number.isFinite(entry.qualityMultiplier) && entry.qualityMultiplier > capturedFilters.qualityMin)
    ) {
      return false;
    }

    if (
      Number.isFinite(capturedFilters.ivTotalMin) &&
      !(Number.isFinite(entry.ivTotal) && entry.ivTotal > capturedFilters.ivTotalMin)
    ) {
      return false;
    }

    return true;
  });
}

function renderCapturedList() {
  populateSelect(
    document.getElementById("captured-filter-rarity"),
    distinctValues(MOCK_CAPTURED, "quality")
  );

  const filtered = applyCapturedFilters(MOCK_CAPTURED);
  const body = document.getElementById("captured-body");
  body.replaceChildren();

  document.getElementById("captured-empty").hidden = filtered.length > 0;

  for (const entry of filtered) {
    const row = document.createElement("tr");
    if (entry.isShiny) row.classList.add("captured-row-shiny");

    const ivs = entry.ivs || {};

    const nameCell = document.createElement("td");
    const nameWrap = document.createElement("span");
    nameWrap.className = "captured-pokemon";

    const nameSpan = document.createElement("span");
    nameSpan.className = `rarity-name rarity-${rarityKeyFor(entry.quality)}`;
    // Asterisk on the name is the only per-Pokémon shiny marker — the row
    // highlight (captured-row-shiny) does the rest.
    nameSpan.textContent = speciesLabel(entry.speciesName, entry.speciesId) + (entry.isShiny ? " *" : "");

    const genderSpan = document.createElement("span");
    const symbol = genderSymbol(entry.gender);
    genderSpan.className = symbol ? `gender-symbol gender-${entry.gender}` : "gender-symbol";
    genderSpan.textContent = symbol;

    nameWrap.append(nameSpan, genderSpan);
    nameCell.appendChild(nameWrap);
    row.appendChild(nameCell);

    fillRow(row, [
      entry.nature ?? "—",
      formatQualityMultiplier(entry.qualityMultiplier),
      formatIvBreakdown(ivs)
    ]);

    body.appendChild(row);
  }
}

function wireCapturedFilters() {
  document.getElementById("captured-filter-rarity").addEventListener("change", (event) => {
    capturedFilters.rarity = event.target.value;
    renderCapturedList();
  });

  document.getElementById("captured-filter-quality-min").addEventListener("input", (event) => {
    const value = parseFloat(event.target.value);
    capturedFilters.qualityMin = Number.isFinite(value) ? value : null;
    renderCapturedList();
  });

  document.getElementById("captured-filter-iv-min").addEventListener("input", (event) => {
    const value = parseInt(event.target.value, 10);
    capturedFilters.ivTotalMin = Number.isFinite(value) ? value : null;
    renderCapturedList();
  });
}

// ============================================================
// History mock data (docs/DEVELOPMENT.md §6: "history and filters")
//
// Fictitious sessions + encounters, shaped like real `sessions`/
// `encounters` rows, including the qualitative fields (elements/gender/
// ivTotal) requested during Fase 4 planning.
// ============================================================

function mockEncounter({
  speciesId,
  speciesName,
  level,
  quality,
  elements,
  gender,
  nature,
  qualityMultiplier,
  ivTotal,
  isShiny = false,
  captureResult,
  capsuleName,
  configId,
  trainerExp,
  pokemonExp,
  gold,
  supplyCost = null,
  autoSold = false,
  autoSellValue = null,
  cycleMs,
  startedAtMs
}) {
  return {
    speciesId,
    speciesName,
    level,
    quality,
    elements,
    gender,
    nature,
    qualityMultiplier,
    ivTotal,
    isShiny,
    captureResult,
    state: "resolved",
    capsuleName,
    configId,
    groupKey: `${speciesId}|${level}|${configId}`,
    trainerExp,
    pokemonExp,
    gold,
    supplyCost,
    autoSold,
    autoSellValue,
    cycleMs,
    startedAtMs
  };
}

const CONFIG_A = "3f7a1c9e0b2d4568a1f0";
const CONFIG_B = "9b6d2e410ac773bf5e02";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const MOCK_HISTORY_SESSIONS = [
  {
    sessionId: "preview-session-1",
    status: "ended",
    startedAtMs: now - DAY_MS * 0.3,
    accumulatedActiveMs: 42 * 60 * 1000,
    activeStartedAtMs: null,
    encounters: [
      mockEncounter({
        speciesId: "dragonite",
        speciesName: "Dragonite",
        level: 55,
        quality: "epic",
        elements: ["dragon", "flying"],
        gender: "female",
        nature: "brave",
        qualityMultiplier: 1.4821,
        ivTotal: 152,
        isShiny: false,
        captureResult: "success",
        capsuleName: "Ultra Ball",
        configId: CONFIG_A,
        trainerExp: 1450,
        pokemonExp: 2100,
        gold: 80,
        supplyCost: 130,
        cycleMs: 6200,
        startedAtMs: now - DAY_MS * 0.3 + 60_000
      }),
      mockEncounter({
        speciesId: "dragonite",
        speciesName: "Dragonite",
        level: 55,
        quality: "epic",
        elements: ["dragon", "flying"],
        gender: "male",
        nature: "jolly",
        qualityMultiplier: 1.3054,
        ivTotal: 98,
        isShiny: false,
        captureResult: "failed",
        capsuleName: "Ultra Ball",
        configId: CONFIG_A,
        trainerExp: 0,
        pokemonExp: 0,
        gold: 0,
        supplyCost: 130,
        cycleMs: 5800,
        startedAtMs: now - DAY_MS * 0.3 + 130_000
      }),
      mockEncounter({
        speciesId: "pidgey",
        speciesName: "Pidgey",
        level: 12,
        quality: "weak",
        elements: ["normal", "flying"],
        gender: "female",
        nature: "hardy",
        qualityMultiplier: 0.9421,
        ivTotal: 41,
        isShiny: true,
        captureResult: "success",
        capsuleName: "Poke Ball",
        configId: CONFIG_B,
        trainerExp: 60,
        pokemonExp: 90,
        gold: 5,
        supplyCost: 10,
        cycleMs: 2100,
        startedAtMs: now - DAY_MS * 0.3 + 200_000
      })
    ],
    potionsUsed: 8,
    potionsCost: 176
  },
  {
    sessionId: "preview-session-2",
    status: "ended",
    startedAtMs: now - DAY_MS * 1.4,
    accumulatedActiveMs: 118 * 60 * 1000,
    activeStartedAtMs: null,
    encounters: [
      mockEncounter({
        speciesId: "charmander",
        speciesName: "Charmander",
        level: 20,
        quality: "uncommon",
        elements: ["fire"],
        gender: "male",
        nature: "adamant",
        qualityMultiplier: 1.1874,
        ivTotal: 121,
        isShiny: false,
        captureResult: "success",
        capsuleName: "Great Ball",
        configId: CONFIG_B,
        trainerExp: 320,
        pokemonExp: 410,
        gold: 22,
        supplyCost: 50,
        autoSold: true,
        autoSellValue: 65,
        cycleMs: 3300,
        startedAtMs: now - DAY_MS * 1.4 + 45_000
      }),
      mockEncounter({
        speciesId: "pidgey",
        speciesName: "Pidgey",
        level: 12,
        quality: "weak",
        elements: ["normal", "flying"],
        gender: "male",
        nature: "timid",
        qualityMultiplier: 0.8765,
        ivTotal: 30,
        isShiny: false,
        captureResult: "failed",
        capsuleName: "Poke Ball",
        configId: CONFIG_B,
        trainerExp: 0,
        pokemonExp: 0,
        gold: 0,
        supplyCost: 10,
        cycleMs: 1900,
        startedAtMs: now - DAY_MS * 1.4 + 90_000
      })
    ],
    potionsUsed: 23,
    potionsCost: 506
  },
  {
    sessionId: "preview-session-3",
    status: "ended",
    startedAtMs: now - DAY_MS * 3.1,
    accumulatedActiveMs: 27 * 60 * 1000,
    activeStartedAtMs: null,
    encounters: [
      mockEncounter({
        speciesId: "dragonite",
        speciesName: "Dragonite",
        level: 55,
        quality: "epic",
        elements: ["dragon", "flying"],
        gender: "female",
        nature: "calm",
        qualityMultiplier: 1.312,
        ivTotal: 174,
        isShiny: false,
        captureResult: "failed",
        capsuleName: "Ultra Ball",
        configId: CONFIG_A,
        trainerExp: 0,
        pokemonExp: 0,
        gold: 0,
        supplyCost: 130,
        cycleMs: 6600,
        startedAtMs: now - DAY_MS * 3.1 + 30_000
      })
    ],
    potionsUsed: 2,
    potionsCost: 44
  }
];

const historySessionsById = new Map(
  MOCK_HISTORY_SESSIONS.map((session) => [session.sessionId, session])
);

let historyFilterAfter = -Infinity;
let historyFilterBefore = Infinity;

function computeMockSessionMetrics(session) {
  const encounters = session.encounters;

  let trainerExp = 0;
  let pokemonExp = 0;
  let gold = 0;
  let capsulesCost = 0;
  let captured = 0;
  let failed = 0;

  for (const encounter of encounters) {
    trainerExp += Number(encounter.trainerExp) || 0;
    pokemonExp += Number(encounter.pokemonExp) || 0;
    gold += Number(encounter.gold) || 0;
    if (encounter.autoSold) gold += Number(encounter.autoSellValue) || 0;
    capsulesCost += Number(encounter.supplyCost) || 0;
    if (encounter.captureResult === "success") captured += 1;
    if (encounter.captureResult === "failed") failed += 1;
  }

  // Seen = Captured + Failed, exactly (domain/rarityBreakdown.js).
  const seen = captured + failed;
  const activeMs = session.accumulatedActiveMs;
  const potionsUsed = session.potionsUsed || 0;
  const potionsCost = session.potionsCost || 0;
  const expenses = capsulesCost + potionsCost;

  return {
    activeMs,
    seen,
    captured,
    failed,
    trainerExp,
    trainerExpPerHour: perHour(trainerExp, activeMs),
    pokemonExp,
    pokemonExpPerHour: perHour(pokemonExp, activeMs),
    gold,
    goldPerHour: perHour(gold, activeMs),
    capsulesCost,
    potionsUsed,
    potionsCost,
    expenses,
    expensesPerHour: perHour(expenses, activeMs)
  };
}

function renderHistoryList() {
  const body = document.getElementById("history-body");
  body.replaceChildren();

  const rows = MOCK_HISTORY_SESSIONS.filter(
    (session) => session.startedAtMs >= historyFilterAfter && session.startedAtMs < historyFilterBefore
  );

  for (const session of rows) {
    const metrics = computeMockSessionMetrics(session);
    const row = document.createElement("tr");

    fillRow(row, [
      dateTimeFormatter.format(new Date(session.startedAtMs)),
      formatDuration(metrics.activeMs),
      formatNumber(metrics.seen),
      formatNumber(metrics.captured),
      formatNumber(metrics.failed),
      "→"
    ]);

    row.addEventListener("click", () => showHistoryDetail(session.sessionId));
    body.appendChild(row);
  }

  document.getElementById("history-empty").hidden = rows.length > 0;
  document.getElementById("history-load-more").hidden = true;
}

function renderHistorySummary(metrics) {
  const container = document.getElementById("history-detail-summary");
  container.replaceChildren();

  const entries = [
    ["Duration", formatDuration(metrics.activeMs)],
    ["Seen", formatNumber(metrics.seen)],
    ["Captured", formatNumber(metrics.captured)],
    ["Failed", formatNumber(metrics.failed)],
    ["XP/h You", formatPerHour(metrics.trainerExpPerHour)],
    ["XP/h Poké", formatPerHour(metrics.pokemonExpPerHour)],
    ["Dollar/h", formatPerHour(metrics.goldPerHour)],
    ["Expenses/h", formatPerHour(metrics.expensesPerHour)],
    ["Potions", formatNumber(metrics.potionsUsed)]
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
      formatQualityMultiplier(encounter.qualityMultiplier),
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

function showHistoryDetail(sessionId) {
  const session = historySessionsById.get(sessionId);
  if (!session) return;

  const metrics = computeMockSessionMetrics(session);

  document.getElementById("history-list-panel").hidden = true;
  const detailPanel = document.getElementById("history-detail-panel");
  detailPanel.hidden = false;
  detailPanel.dataset.sessionId = sessionId;

  renderHistorySummary(metrics);
  renderHistoryEncounters(session.encounters);
}

function backToHistoryList() {
  document.getElementById("history-detail-panel").hidden = true;
  document.getElementById("history-list-panel").hidden = false;
}

function wireHistory() {
  document.getElementById("history-filter-apply").addEventListener("click", () => {
    const fromValue = document.getElementById("history-filter-from").value;
    const toValue = document.getElementById("history-filter-to").value;

    historyFilterAfter = fromValue ? new Date(fromValue).getTime() : -Infinity;
    historyFilterBefore = toValue ? new Date(toValue).getTime() + DAY_MS : Infinity;

    renderHistoryList();
  });

  document.getElementById("history-filter-clear").addEventListener("click", () => {
    document.getElementById("history-filter-from").value = "";
    document.getElementById("history-filter-to").value = "";
    historyFilterAfter = -Infinity;
    historyFilterBefore = Infinity;

    renderHistoryList();
  });

  document.getElementById("history-back-button").addEventListener("click", backToHistoryList);
  document.getElementById("history-delete-button").addEventListener("click", previewOnly);
  document.getElementById("export-json-button").addEventListener("click", previewOnly);
}

// ============================================================
// Compare (docs/DEVELOPMENT.md §2: "aggregates by species + level + config")
// ============================================================

const COMPARE_THEMES = {
  cycle: {
    label: "Grouped by species + level + config",
    headers: ["Pokémon", "Lvl", "Seen", "Cap.", "Fail", "EXP/Cycle h", "$/Cycle h"]
  },
  rarity: {
    label: "Grouped by rarity",
    headers: ["Rarity", "Seen", "Cap.", "Fail", "Rate"]
  }
};

const compareEncounters = MOCK_HISTORY_SESSIONS.flatMap((session) => session.encounters);
let compareTheme = "cycle";
const compareFilters = { species: "*", capsule: "*", element: "*" };

function computeMockGroupMetrics(encounters) {
  let captured = 0;
  let failed = 0;
  let trainerExp = 0;
  let pokemonExp = 0;
  let gold = 0;
  let groupCycleMs = 0;

  for (const encounter of encounters) {
    if (encounter.captureResult === "success") captured += 1;
    if (encounter.captureResult === "failed") failed += 1;
    trainerExp += Number(encounter.trainerExp) || 0;
    pokemonExp += Number(encounter.pokemonExp) || 0;
    gold += Number(encounter.gold) || 0;
    if (encounter.autoSold) gold += Number(encounter.autoSellValue) || 0;
    if (Number.isFinite(encounter.cycleMs)) groupCycleMs += encounter.cycleMs;
  }

  // Seen = Captured + Failed, exactly (domain/rarityBreakdown.js).
  const seen = captured + failed;

  return {
    seen,
    captured,
    failed,
    seenToCaptureRate: seen ? captured / seen : null,
    trainerExpPerCycleHour: perHour(trainerExp, groupCycleMs),
    dollarPerCycleHour: perHour(gold, groupCycleMs)
  };
}

// Mirrors domain/rarityBreakdown.js's computeRarityBreakdown — same
// tiers/rules, duplicated here because preview.js has no imports.
function computeMockRarityBreakdown(encounters) {
  const rarities = {};
  for (const [key] of RARITY_LABELS) rarities[key] = { seen: 0, captured: 0, failed: 0 };

  for (const encounter of encounters) {
    const bucket = rarities[encounter.quality];
    if (!bucket) continue;

    const isCaptured = encounter.captureResult === "success";
    const isFailed = encounter.captureResult === "failed";

    if (isCaptured) bucket.captured += 1;
    if (isFailed) bucket.failed += 1;
    // Seen = Captured + Failed, exactly (domain/rarityBreakdown.js).
    if (isCaptured || isFailed) bucket.seen += 1;
  }

  return rarities;
}

// NOTE: the destructured option names below must never shadow an
// Object.prototype member (`valueOf`, `toString`, ...). A plain object
// always inherits those from the prototype chain, so `{}.valueOf` is
// `Object.prototype.valueOf` — never `undefined` — and a default value
// like `{ valueOf = (o) => o } = {}` silently never applies. That bug is
// exactly why the capsule/element dropdowns below used to come up empty:
// the borrowed native `valueOf` ran instead of the identity default and
// threw on the very first option, aborting the rest of renderCompare().
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

// Species names come from the protocol already capitalized, but an
// unresolved encounter falls back to the lowercase `species_id` slug —
// capitalize either way so the UI never shows a raw slug.
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
    const metrics = computeMockGroupMetrics(group.encounters);
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

// Identical structure to Current's own By Rarity table — same 7 tiers,
// same columns — computed over Compare's filtered mock encounters
// instead of one session's. Always shows all 7 rows.
function renderCompareByRarity(encounters, body) {
  document.getElementById("compare-empty").hidden = true;

  const rarities = computeMockRarityBreakdown(encounters);

  for (const [key, label] of RARITY_LABELS) {
    const bucket = rarities[key];
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

function renderCompare() {
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

createRarityRows();
renderMetrics(computeMockMetrics(Date.now()));
renderCapturedList();
wireTabs();
wireActions();
wireCapturedFilters();
wireHistory();
wireCompare();
switchView("current");

setInterval(() => {
  if (activeView !== "current") return;
  renderMetrics(computeMockMetrics(Date.now()));
}, 1000);
