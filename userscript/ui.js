import { computeGroupMetrics } from "../domain/groupMetrics.js";
import { computeRarityBreakdown } from "../domain/rarityBreakdown.js";
import { STYLES } from "./styles.js";

const APP_VERSION = __APP_VERSION__;
const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_STATE_KEY = "pokepixel_hunt_analyzer_ui_v1";
const COLLAPSE_KEY = "pokepixel_hunt_analyzer_collapsed_v1";
const ALPHA_KEY = "pokepixel_hunt_analyzer_alpha_v1";
const REF_CODE = "Q4BSZJD";
const EDGE_GAP = 8;

const ALPHA_LEVELS = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
const RARITIES = [
  ["weak", "Weak"],
  ["common", "Common"],
  ["uncommon", "Uncommon"],
  ["rare", "Rare"],
  ["epic", "Epic"],
  ["legendary", "Legendary"],
  ["mythical", "Mythical"]
];
const RARITY_KEYS = new Set(RARITIES.map(([key]) => key));
const RARITY_ORDER = new Map(RARITIES.map(([key], index) => [key, index]));
const DEFAULT_COMPARE_SORT = {
  cycle: { column: 5, direction: "desc" },
  rarity: { column: 1, direction: "desc" }
};

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0
});

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

function formatCompact(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 100_000) {
    return `${formatNumber(Math.round(number / 1_000))}K`;
  }
  return formatNumber(number);
}

function formatRate(value) {
  return value == null ? "—" : `${(value * 100).toFixed(2)}%`;
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  const parts = hours > 0
    ? [hours, minutes, remainingSeconds]
    : [minutes, remainingSeconds];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

function speciesLabel(encounter) {
  const raw = encounter.speciesName || encounter.speciesId || "—";
  return String(raw)
    .split(/[\s_-]+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

function rarityClass(value) {
  const key = String(value || "").toLowerCase();
  return RARITY_KEYS.has(key) ? `rarity-${key}` : "";
}

function genderInfo(value) {
  const key = String(value || "").trim().toLowerCase();
  if (["male", "m", "masculino", "♂"].includes(key)) {
    return { label: "♂", className: "gender-male", title: "Male" };
  }
  if (["female", "f", "feminino", "♀"].includes(key)) {
    return { label: "♀", className: "gender-female", title: "Female" };
  }
  return { label: "—", className: "", title: value || "Unknown" };
}

function ivValues(ivs) {
  if (!ivs || typeof ivs !== "object") return null;
  const values = [ivs.hp, ivs.atk, ivs.def, ivs.spa, ivs.spd, ivs.spe];
  return values.some(Number.isFinite) ? values : null;
}

function ivDisplay(encounter) {
  const values = ivValues(encounter.ivs);
  if (!values) return "—";

  const breakdown = values
    .map((value) => (Number.isFinite(value) ? value : "—"))
    .join("-");
  const total = Number.isFinite(encounter.ivTotal)
    ? encounter.ivTotal
    : values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);

  return `${total} (${breakdown})`;
}

function pokemonLabel(count) {
  return `${count} ${count === 1 ? "Pokémon" : "Pokémons"}`;
}

function createRarityRowsMarkup() {
  return RARITIES.map(([key, label]) => `
    <tr data-rarity="${key}">
      <td class="rarity-${key}">${label}</td>
      <td data-field="seen">0</td>
      <td data-field="captured">0</td>
      <td data-field="failed">0</td>
      <td data-field="rate">—</td>
    </tr>`).join("");
}

function createHudRarityMarkup() {
  return RARITIES.map(([key, label], index) => {
    const separator = index < RARITIES.length - 1
      ? '<span class="separator" aria-hidden="true">-</span>'
      : "";
    return `<span id="hud-${key}" class="rarity-${key}" title="${label} captured">0</span>${separator}`;
  }).join("");
}

function encounterSectionMarkup(prefix, title) {
  return `
    <section id="${prefix}-section" class="section encounter-section">
      <div class="section-head">
        <h3>${title}</h3>
        <div class="section-meta">
          <span id="${prefix}-count" class="section-badge">0 Pokémons</span>
          <button class="collapse-button" data-collapse="${prefix}" type="button" title="Collapse">▾</button>
        </div>
      </div>
      <div class="filters">
        <label>Rarity<select id="${prefix}-rarity"></select></label>
        <label>Quality &gt;<input id="${prefix}-quality" type="number" step="0.01"></label>
        <label>IV &gt;<input id="${prefix}-iv" type="number" step="1"></label>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Pokémon</th><th title="Gender">G</th><th>Nat</th><th>Qlt</th><th title="IV Total (HP-ATK-DEF-SATK-SDEF-SPE)">IV</th></tr></thead>
          <tbody id="${prefix}-body"></tbody>
        </table>
      </div>
    </section>`;
}

function markup() {
  return `
    <button id="pha-toggle" class="launcher" type="button" aria-label="PokePixel Hunt Analyzer">
      <span class="hud-mark">PX</span>
      <span class="hud-content">
        <span class="hud-xp"><span>XP/h</span><strong id="hud-xp">—</strong></span>
        <span class="hud-rarities" aria-label="Captured by rarity">${createHudRarityMarkup()}</span>
      </span>
    </button>

    <aside id="pha-panel" class="panel" hidden>
      <header class="topbar">
        <div class="brand">
          <strong>PokePixel Hunt Analyzer</strong>
          <span class="brand-meta">
            <span>Userscript ${APP_VERSION}</span>
            <span>· by Rhyxus ·</span>
            <button id="pha-refcode" class="refcode" type="button" title="Copy ref code ${REF_CODE}">${REF_CODE}</button>
          </span>
        </div>
        <span id="pha-tab-state" class="state standby">STANDBY</span>
        <button id="pha-alpha" class="alpha-button" type="button">α 100%</button>
        <button id="pha-close" class="icon-button" type="button" title="Minimize to HUD">−</button>
      </header>

      <nav class="tabs">
        <button data-view="current" class="tab active" type="button">Current</button>
        <button data-view="compare" class="tab" type="button">Compare</button>
        <strong id="hunt-time" class="hunt-time">00:00</strong>
      </nav>

      <section id="view-current" class="view current-view">
        <section id="hunt-section" class="live-card">
          <div class="status-row">
            <span>Hunt</span>
            <b id="hunt-status" class="hunt-status">Waiting</b>
          </div>
          <div class="actions">
            <button id="new-hunt" type="button">New Hunt</button>
            <button id="pause-resume" type="button">Pause</button>
            <button id="end-hunt" type="button">End Hunt</button>
            <button class="collapse-button" data-collapse="hunt" type="button" title="Collapse">▾</button>
          </div>
          <div class="metric-cards">
            <article><span>XP/h You</span><strong id="trainer-exp-hour">—</strong><small>Total <b id="trainer-exp-total">0</b></small></article>
            <article><span>XP/h Poké</span><strong id="pokemon-exp-hour">—</strong><small>Total <b id="pokemon-exp-total">0</b></small></article>
            <article><span>Dollar</span><strong id="dollars-total">0</strong><small>$/h <b id="dollars-hour">—</b></small></article>
            <article><span>Profit</span><strong id="profit-total">0</strong><small>Expenses <b id="expenses-total">0</b></small></article>
          </div>
        </section>

        <div class="capture-strip">
          <article><span>Seen</span><strong id="seen">0</strong></article>
          <article><span>Captured</span><strong id="captured">0</strong></article>
          <article><span>Failed</span><strong id="failed">0</strong></article>
          <article><span>Capture</span><strong id="capture-rate">—</strong></article>
        </div>

        <section id="rarity-section" class="section rarity-section">
          <div class="section-head">
            <h3>By Rarity</h3>
            <div class="section-meta">
              <span id="rare-failed-count" class="section-badge">R+ fail 0</span>
              <button class="collapse-button" data-collapse="rarity" type="button" title="Collapse">▾</button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Rarity</th><th>Seen</th><th>Cap.</th><th>Fail</th><th>Rate</th></tr></thead>
              <tbody id="rarity-body">${createRarityRowsMarkup()}</tbody>
            </table>
          </div>
        </section>

        ${encounterSectionMarkup("captured", "Captured")}
        ${encounterSectionMarkup("failed", "Failed")}
      </section>

      <section id="view-compare" class="view compare-view" hidden>
        <div class="filters">
          <label>Theme<select id="compare-theme"><option value="cycle">By Cycle</option><option value="rarity">By Rarity</option></select></label>
          <label>Pokémon<select id="compare-species"></select></label>
          <label>Capsule<select id="compare-capsule"></select></label>
          <label>Element<select id="compare-element"></select></label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr id="compare-head"></tr></thead>
            <tbody id="compare-body"></tbody>
          </table>
        </div>
      </section>
    </aside>
  `;
}

function populateSelect(select, values, mapper = (value) => [value, value]) {
  const previous = select.value || "*";
  const fragment = document.createDocumentFragment();

  const all = document.createElement("option");
  all.value = "*";
  all.textContent = "All (*)";
  fragment.appendChild(all);

  for (const item of values) {
    const [value, label] = mapper(item);
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    fragment.appendChild(option);
  }

  select.replaceChildren(fragment);
  select.value = [...select.options].some((option) => option.value === previous)
    ? previous
    : "*";
}

function distinct(encounters, key) {
  return [...new Set(encounters.map((encounter) => encounter[key]).filter(Boolean))].sort();
}

function distinctElements(encounters) {
  return [...new Set(encounters.flatMap((encounter) =>
    Array.isArray(encounter.elements) ? encounter.elements : []
  ))].sort();
}

function parseFilterNumber(input) {
  if (!input.value) return null;
  const value = Number(input.value);
  return Number.isFinite(value) ? value : null;
}

function encounterPassesFilters(encounter, filters) {
  if (filters.rarity !== "*" && encounter.quality !== filters.rarity) return false;
  if (filters.qualityMin != null && !(
    Number.isFinite(encounter.qualityMultiplier) &&
    encounter.qualityMultiplier > filters.qualityMin
  )) return false;
  if (filters.ivMin != null && !(
    Number.isFinite(encounter.ivTotal) && encounter.ivTotal > filters.ivMin
  )) return false;
  return true;
}

function createEncounterRow(encounter) {
  const row = document.createElement("tr");
  const gender = genderInfo(encounter.gender);

  const pokemonCell = document.createElement("td");
  pokemonCell.className = rarityClass(encounter.quality);
  pokemonCell.textContent = `${speciesLabel(encounter)}${encounter.isShiny ? " *" : ""}`;

  const genderCell = document.createElement("td");
  genderCell.className = `gender ${gender.className}`.trim();
  genderCell.textContent = gender.label;
  genderCell.title = gender.title;

  const natureCell = document.createElement("td");
  natureCell.textContent = encounter.nature || "—";

  const qualityCell = document.createElement("td");
  qualityCell.textContent = Number.isFinite(encounter.qualityMultiplier)
    ? encounter.qualityMultiplier.toFixed(2)
    : "—";

  const ivCell = document.createElement("td");
  ivCell.className = "iv-cell";
  ivCell.textContent = ivDisplay(encounter);

  row.append(pokemonCell, genderCell, natureCell, qualityCell, ivCell);
  return row;
}

function compareValues(left, right) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

export function createUi({ onSessionAction, onLoadCompare }) {
  let shadow;
  let panel;
  let launcher;
  let resizeHandle;
  let currentEncounters = [];
  let compareEncounters = [];
  let activeView = "current";
  let suppressLauncherClick = false;

  const listFilters = {
    captured: { rarity: "*", qualityMin: null, ivMin: null },
    failed: { rarity: "*", qualityMin: null, ivMin: null }
  };

  const compareFilters = {
    species: "*",
    capsule: "*",
    element: "*",
    theme: "cycle"
  };
  let compareSort = { ...DEFAULT_COMPARE_SORT.cycle };

  function mount() {
    document.getElementById(ROOT_ID)?.remove();

    const host = document.createElement("div");
    host.id = ROOT_ID;
    shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = STYLES;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = markup();
    shadow.append(style, wrapper);
    document.documentElement.appendChild(host);

    panel = shadow.getElementById("pha-panel");
    launcher = shadow.getElementById("pha-toggle");
    bindUiEvents();
    restoreUiState();
    installPanelDrag();
    installLauncherDrag();
    installBottomLeftResize();
    installWheelScrolling();
    installViewportGuard();
    installResizePersistence();
    applyCollapseState();
    applyAlpha(readAlpha());
  }

  function bindUiEvents() {
    shadow.getElementById("pha-close").addEventListener("click", () => setPanelOpen(false));
    shadow.getElementById("pha-alpha").addEventListener("click", cycleAlpha);
    shadow.getElementById("pha-refcode").addEventListener("click", copyRefCode);

    for (const tab of shadow.querySelectorAll("[data-view]")) {
      tab.addEventListener("click", () => switchView(tab.dataset.view));
    }

    shadow.getElementById("new-hunt").addEventListener("click", () => onSessionAction("new"));
    shadow.getElementById("end-hunt").addEventListener("click", () => onSessionAction("end"));
    shadow.getElementById("pause-resume").addEventListener("click", (event) => {
      onSessionAction(event.currentTarget.dataset.action || "pause");
    });

    for (const prefix of ["captured", "failed"]) bindEncounterFilters(prefix);

    for (const button of shadow.querySelectorAll("[data-collapse]")) {
      button.addEventListener("click", () => toggleCollapse(button.dataset.collapse));
    }

    shadow.getElementById("compare-theme").addEventListener("change", (event) => {
      compareFilters.theme = event.target.value;
      compareSort = { ...DEFAULT_COMPARE_SORT[compareFilters.theme] };
      renderCompare();
    });
    shadow.getElementById("compare-species").addEventListener("change", (event) => {
      compareFilters.species = event.target.value;
      renderCompare();
    });
    shadow.getElementById("compare-capsule").addEventListener("change", (event) => {
      compareFilters.capsule = event.target.value;
      renderCompare();
    });
    shadow.getElementById("compare-element").addEventListener("change", (event) => {
      compareFilters.element = event.target.value;
      renderCompare();
    });
  }

  function bindEncounterFilters(prefix) {
    const filters = listFilters[prefix];
    shadow.getElementById(`${prefix}-rarity`).addEventListener("change", (event) => {
      filters.rarity = event.target.value;
      renderEncounterList(prefix);
    });
    shadow.getElementById(`${prefix}-quality`).addEventListener("input", (event) => {
      filters.qualityMin = parseFilterNumber(event.target);
      renderEncounterList(prefix);
    });
    shadow.getElementById(`${prefix}-iv`).addEventListener("input", (event) => {
      filters.ivMin = parseFilterNumber(event.target);
      renderEncounterList(prefix);
    });
  }

  function switchView(view) {
    activeView = view === "compare" ? "compare" : "current";
    shadow.getElementById("view-current").hidden = activeView !== "current";
    shadow.getElementById("view-compare").hidden = activeView !== "compare";
    for (const tab of shadow.querySelectorAll("[data-view]")) {
      tab.classList.toggle("active", tab.dataset.view === activeView);
    }
    saveUiState({ view: activeView });

    if (activeView === "compare") void refreshCompare();
  }

  async function refreshCompare() {
    try {
      compareEncounters = await onLoadCompare();
      populateCompareFilters();
      renderCompare();
    } catch (error) {
      console.error("PokePixel Hunt Analyzer (Compare):", error);
    }
  }

  function populateCompareFilters() {
    const species = new Map();
    for (const encounter of compareEncounters) {
      if (encounter.speciesId && !species.has(encounter.speciesId)) {
        species.set(encounter.speciesId, speciesLabel(encounter));
      }
    }

    populateSelect(
      shadow.getElementById("compare-species"),
      [...species.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      ([id, label]) => [id, label]
    );
    populateSelect(shadow.getElementById("compare-capsule"), distinct(compareEncounters, "capsuleName"));
    populateSelect(shadow.getElementById("compare-element"), distinctElements(compareEncounters));

    compareFilters.species = shadow.getElementById("compare-species").value;
    compareFilters.capsule = shadow.getElementById("compare-capsule").value;
    compareFilters.element = shadow.getElementById("compare-element").value;
  }

  function filteredCompareEncounters() {
    return compareEncounters.filter((encounter) =>
      (compareFilters.species === "*" || encounter.speciesId === compareFilters.species) &&
      (compareFilters.capsule === "*" || encounter.capsuleName === compareFilters.capsule) &&
      (compareFilters.element === "*" || (
        Array.isArray(encounter.elements) && encounter.elements.includes(compareFilters.element)
      ))
    );
  }

  function renderCompare() {
    if (compareFilters.theme === "rarity") renderRarityCompare();
    else renderCycleCompare();
  }

  function renderRarityCompare() {
    const breakdown = computeRarityBreakdown(filteredCompareEncounters());
    const rows = RARITIES.map(([key, label]) => {
      const metric = breakdown.rarities[key];
      return {
        sort: [
          RARITY_ORDER.get(key),
          metric.seen,
          metric.captured,
          metric.failed,
          metric.seen ? metric.captured / metric.seen : Number.NEGATIVE_INFINITY
        ],
        cells: [
          label,
          formatNumber(metric.seen),
          formatNumber(metric.captured),
          formatNumber(metric.failed),
          formatRate(metric.seen ? metric.captured / metric.seen : null)
        ],
        rarity: key
      };
    });
    renderCompareRows(["Rarity", "Seen", "Cap.", "Fail", "Rate"], rows);
  }

  function renderCycleCompare() {
    const groups = new Map();
    for (const encounter of filteredCompareEncounters()) {
      if (!encounter.groupKey) continue;
      if (!groups.has(encounter.groupKey)) {
        groups.set(encounter.groupKey, { sample: encounter, encounters: [] });
      }
      groups.get(encounter.groupKey).encounters.push(encounter);
    }

    const rows = [...groups.values()].map(({ sample, encounters }) => {
      const metric = computeGroupMetrics(encounters);
      const name = speciesLabel(sample);
      const level = Number.isFinite(sample.level) ? sample.level : Number.NEGATIVE_INFINITY;
      return {
        sort: [
          name.toLocaleLowerCase(),
          level,
          metric.seen,
          metric.captured,
          metric.failed,
          metric.trainerExpPerCycleHour ?? Number.NEGATIVE_INFINITY,
          metric.dollarPerCycleHour ?? Number.NEGATIVE_INFINITY
        ],
        cells: [
          name,
          sample.level ?? "—",
          formatNumber(metric.seen),
          formatNumber(metric.captured),
          formatNumber(metric.failed),
          metric.trainerExpPerCycleHour == null ? "—" : formatNumber(metric.trainerExpPerCycleHour),
          metric.dollarPerCycleHour == null ? "—" : formatNumber(metric.dollarPerCycleHour)
        ]
      };
    });
    renderCompareRows(["Pokémon", "Lvl", "Seen", "Cap.", "Fail", "EXP/Cycle h", "$/Cycle h"], rows);
  }

  function renderCompareRows(headers, rows) {
    const direction = compareSort.direction === "asc" ? 1 : -1;
    rows.sort((left, right) => {
      const primary = compareValues(left.sort[compareSort.column], right.sort[compareSort.column]);
      if (primary !== 0) return primary * direction;
      return compareValues(left.sort[0], right.sort[0]);
    });

    const head = shadow.getElementById("compare-head");
    head.replaceChildren();
    headers.forEach((label, column) => {
      const cell = document.createElement("th");
      cell.textContent = label;
      cell.classList.add("sortable");
      if (compareSort.column === column) {
        cell.classList.add(compareSort.direction === "asc" ? "sort-asc" : "sort-desc");
      }
      cell.addEventListener("click", () => {
        compareSort = compareSort.column === column
          ? { column, direction: compareSort.direction === "desc" ? "asc" : "desc" }
          : { column, direction: "desc" };
        renderCompare();
      });
      head.appendChild(cell);
    });

    const body = shadow.getElementById("compare-body");
    const fragment = document.createDocumentFragment();
    for (const rowData of rows) {
      const row = document.createElement("tr");
      rowData.cells.forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 0 && rowData.rarity) cell.className = `rarity-${rowData.rarity}`;
        row.appendChild(cell);
      });
      fragment.appendChild(row);
    }
    body.replaceChildren(fragment);
  }

  function renderCurrent({ metrics, encounters }) {
    currentEncounters = encounters;
    shadow.getElementById("hunt-time").textContent = formatDuration(metrics.activeMs);
    shadow.getElementById("trainer-exp-hour").textContent = metrics.trainerExpPerHour == null
      ? "—" : formatCompact(metrics.trainerExpPerHour);
    shadow.getElementById("trainer-exp-total").textContent = formatCompact(metrics.trainerExp);
    shadow.getElementById("pokemon-exp-hour").textContent = metrics.pokemonExpPerHour == null
      ? "—" : formatCompact(metrics.pokemonExpPerHour);
    shadow.getElementById("pokemon-exp-total").textContent = formatCompact(metrics.pokemonExp);
    shadow.getElementById("dollars-total").textContent = formatCompact(metrics.gold);
    shadow.getElementById("dollars-hour").textContent = metrics.goldPerHour == null
      ? "—" : formatCompact(metrics.goldPerHour);
    shadow.getElementById("expenses-total").textContent = formatCompact(metrics.expenses);
    shadow.getElementById("profit-total").textContent = formatCompact(metrics.gold - metrics.expenses);
    shadow.getElementById("seen").textContent = formatNumber(metrics.seen);
    shadow.getElementById("captured").textContent = formatNumber(metrics.captured);
    shadow.getElementById("failed").textContent = formatNumber(metrics.failed);
    shadow.getElementById("capture-rate").textContent = formatRate(metrics.seenToCaptureRate);

    const status = metrics.status === "running"
      ? "Running"
      : metrics.status === "paused" ? "Paused" : "Waiting";
    shadow.getElementById("hunt-status").textContent = status;

    const pauseButton = shadow.getElementById("pause-resume");
    pauseButton.disabled = !["running", "paused"].includes(metrics.status);
    pauseButton.dataset.action = metrics.status === "running" ? "pause" : "resume";
    pauseButton.textContent = metrics.status === "running" ? "Pause" : "Resume";
    shadow.getElementById("end-hunt").disabled = metrics.status === "waiting";

    let rarePlusFailed = 0;
    for (const [key] of RARITIES) {
      const rarity = metrics.rarities[key];
      const row = shadow.querySelector(`[data-rarity="${key}"]`);
      row.querySelector('[data-field="seen"]').textContent = rarity.shinySeen
        ? `${formatNumber(rarity.seen)} (${formatNumber(rarity.shinySeen)})`
        : formatNumber(rarity.seen);
      row.querySelector('[data-field="captured"]').textContent = rarity.shinyCaptured
        ? `${formatNumber(rarity.captured)} (${formatNumber(rarity.shinyCaptured)})`
        : formatNumber(rarity.captured);
      row.querySelector('[data-field="failed"]').textContent = rarity.shinyFailed
        ? `${formatNumber(rarity.failed)} (${formatNumber(rarity.shinyFailed)})`
        : formatNumber(rarity.failed);
      row.querySelector('[data-field="rate"]').textContent = formatRate(
        rarity.seen ? rarity.captured / rarity.seen : null
      );

      shadow.getElementById(`hud-${key}`).textContent = String(rarity.captured || 0);
      if (["rare", "epic", "legendary", "mythical"].includes(key)) {
        rarePlusFailed += rarity.failed || 0;
      }
    }

    shadow.getElementById("rare-failed-count").textContent = `R+ fail ${rarePlusFailed}`;
    shadow.getElementById("hud-xp").textContent = metrics.trainerExpPerHour == null
      ? "—" : formatCompact(metrics.trainerExpPerHour);

    renderEncounterList("captured");
    renderEncounterList("failed");
  }

  function renderEncounterList(prefix) {
    const captureResult = prefix === "captured" ? "success" : "failed";
    const matching = currentEncounters.filter((encounter) => encounter.captureResult === captureResult);
    const select = shadow.getElementById(`${prefix}-rarity`);
    populateSelect(
      select,
      [...new Set(matching.map((encounter) => encounter.quality).filter(Boolean))].sort()
    );

    const filters = listFilters[prefix];
    filters.rarity = select.value;

    const body = shadow.getElementById(`${prefix}-body`);
    const fragment = document.createDocumentFragment();
    let visibleCount = 0;

    for (const encounter of matching) {
      if (!encounterPassesFilters(encounter, filters)) continue;
      fragment.appendChild(createEncounterRow(encounter));
      visibleCount += 1;
    }

    body.replaceChildren(fragment);
    shadow.getElementById(`${prefix}-count`).textContent = pokemonLabel(visibleCount);
  }

  function setActive(isActive) {
    const badge = shadow.getElementById("pha-tab-state");
    badge.textContent = isActive ? "ACTIVE" : "STANDBY";
    badge.className = isActive ? "state active" : "state standby";
  }

  function setPanelOpen(open) {
    panel.hidden = !open;
    if (resizeHandle) resizeHandle.hidden = !open;
    saveUiState({ open });
    if (open) {
      fitToViewport(panel);
      syncResizeHandle();
    }
  }

  function saveUiState(patch) {
    const state = readJson(UI_STATE_KEY, {});
    writeJson(UI_STATE_KEY, { ...state, ...patch });
  }

  function savePanelGeometry() {
    if (panel.hidden) return;
    const rect = panel.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return;
    saveUiState({
      panel: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    });
  }

  function saveLauncherGeometry() {
    const rect = launcher.getBoundingClientRect();
    saveUiState({
      launcher: {
        left: Math.round(rect.left),
        top: Math.round(rect.top)
      }
    });
  }

  function restoreUiState() {
    const state = readJson(UI_STATE_KEY, {});
    const panelState = state.panel;
    if (panelState) {
      if (Number.isFinite(panelState.width)) panel.style.width = `${panelState.width}px`;
      if (Number.isFinite(panelState.height)) panel.style.height = `${panelState.height}px`;
      if (Number.isFinite(panelState.left) && Number.isFinite(panelState.top)) {
        panel.style.left = `${panelState.left}px`;
        panel.style.top = `${panelState.top}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      }
    }

    const launcherState = state.launcher;
    if (launcherState && Number.isFinite(launcherState.left) && Number.isFinite(launcherState.top)) {
      launcher.style.left = `${launcherState.left}px`;
      launcher.style.top = `${launcherState.top}px`;
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
    }

    fitToViewport(launcher);
    switchView(state.view === "compare" ? "compare" : "current");
    setPanelOpen(state.open === true);
  }

  function fitToViewport(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const left = clamp(rect.left, EDGE_GAP, window.innerWidth - rect.width - EDGE_GAP);
    const top = clamp(rect.top, EDGE_GAP, window.innerHeight - rect.height - EDGE_GAP);
    if (left !== rect.left || top !== rect.top) {
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.style.right = "auto";
      element.style.bottom = "auto";
    }
  }

  function installPanelDrag() {
    const handle = shadow.querySelector(".topbar");
    let drag = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest("button, .state")) return;
      const rect = panel.getBoundingClientRect();
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const left = clamp(
        event.clientX - drag.offsetX,
        EDGE_GAP,
        window.innerWidth - panel.offsetWidth - EDGE_GAP
      );
      const top = clamp(
        event.clientY - drag.offsetY,
        EDGE_GAP,
        window.innerHeight - panel.offsetHeight - EDGE_GAP
      );
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      syncResizeHandle();
    });

    const finish = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      savePanelGeometry();
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  }

  function installLauncherDrag() {
    let drag = null;

    launcher.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const rect = launcher.getBoundingClientRect();
      launcher.style.left = `${rect.left}px`;
      launcher.style.top = `${rect.top}px`;
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        moved: false
      };
      launcher.setPointerCapture(event.pointerId);
    });

    launcher.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
        drag.moved = true;
      }
      if (!drag.moved) return;
      const left = clamp(
        event.clientX - drag.offsetX,
        EDGE_GAP,
        window.innerWidth - launcher.offsetWidth - EDGE_GAP
      );
      const top = clamp(
        event.clientY - drag.offsetY,
        EDGE_GAP,
        window.innerHeight - launcher.offsetHeight - EDGE_GAP
      );
      launcher.style.left = `${left}px`;
      launcher.style.top = `${top}px`;
      event.preventDefault();
    });

    const finish = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      suppressLauncherClick = drag.moved;
      if (launcher.hasPointerCapture(event.pointerId)) launcher.releasePointerCapture(event.pointerId);
      if (drag.moved) saveLauncherGeometry();
      drag = null;
    };
    launcher.addEventListener("pointerup", finish);
    launcher.addEventListener("pointercancel", finish);
    launcher.addEventListener("click", (event) => {
      if (suppressLauncherClick) {
        suppressLauncherClick = false;
        event.preventDefault();
        return;
      }
      setPanelOpen(true);
    });
  }

  function installResizePersistence() {
    let timer = null;
    new ResizeObserver(() => {
      if (panel.hidden) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        fitToViewport(panel);
        syncResizeHandle();
        savePanelGeometry();
      }, 120);
    }).observe(panel);
  }

  function installBottomLeftResize() {
    resizeHandle = document.createElement("button");
    resizeHandle.type = "button";
    resizeHandle.className = "resize-bottom-left";
    resizeHandle.title = "Resize from bottom-left";
    shadow.appendChild(resizeHandle);

    let resize = null;
    resizeHandle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const rect = panel.getBoundingClientRect();
      const computed = getComputedStyle(panel);
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      resize = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        startRight: rect.right,
        startHeight: rect.height,
        minWidth: Number.parseFloat(computed.minWidth) || 360,
        minHeight: Number.parseFloat(computed.minHeight) || 280
      };
      resizeHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });

    resizeHandle.addEventListener("pointermove", (event) => {
      if (!resize || event.pointerId !== resize.pointerId) return;
      const left = clamp(
        resize.startLeft + event.clientX - resize.startX,
        EDGE_GAP,
        resize.startRight - resize.minWidth
      );
      const width = resize.startRight - left;
      const maxHeight = Math.max(
        resize.minHeight,
        window.innerHeight - resize.startTop - EDGE_GAP
      );
      const height = clamp(
        resize.startHeight + event.clientY - resize.startY,
        resize.minHeight,
        maxHeight
      );
      panel.style.left = `${left}px`;
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
      syncResizeHandle();
      event.preventDefault();
      event.stopPropagation();
    });

    const finish = (event) => {
      if (!resize || event.pointerId !== resize.pointerId) return;
      resize = null;
      if (resizeHandle.hasPointerCapture(event.pointerId)) {
        resizeHandle.releasePointerCapture(event.pointerId);
      }
      syncResizeHandle();
      savePanelGeometry();
    };
    resizeHandle.addEventListener("pointerup", finish);
    resizeHandle.addEventListener("pointercancel", finish);
    syncResizeHandle();
  }

  function syncResizeHandle() {
    if (!resizeHandle) return;
    if (panel.hidden) {
      resizeHandle.hidden = true;
      return;
    }
    const rect = panel.getBoundingClientRect();
    resizeHandle.hidden = rect.width <= 0 || rect.height <= 0;
    if (resizeHandle.hidden) return;
    resizeHandle.style.left = `${Math.round(rect.left)}px`;
    resizeHandle.style.top = `${Math.round(rect.bottom - 15)}px`;
  }

  function scrollableFromEvent(event, axis, delta) {
    const overflowProperty = axis === "x" ? "overflowX" : "overflowY";
    const sizeProperty = axis === "x" ? "scrollWidth" : "scrollHeight";
    const clientProperty = axis === "x" ? "clientWidth" : "clientHeight";
    const positionProperty = axis === "x" ? "scrollLeft" : "scrollTop";

    for (const node of event.composedPath()) {
      if (!(node instanceof Element)) continue;
      const computed = getComputedStyle(node);
      if (!/(auto|scroll|overlay)/.test(computed[overflowProperty])) continue;
      if (node[sizeProperty] <= node[clientProperty] + 1) continue;
      const position = node[positionProperty];
      const max = node[sizeProperty] - node[clientProperty];
      if (delta < 0 ? position > 0 : position < max) return node;
      if (node === panel) break;
    }

    return panel[sizeProperty] > panel[clientProperty] + 1 ? panel : null;
  }

  function installWheelScrolling() {
    panel.addEventListener("wheel", (event) => {
      if (event.ctrlKey) return;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const axis = horizontal ? "x" : "y";
      const delta = horizontal ? event.deltaX : event.deltaY;
      if (!delta) return;
      const target = scrollableFromEvent(event, axis, delta);
      if (!target) return;
      if (axis === "x") target.scrollLeft += delta;
      else target.scrollTop += delta;
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true, passive: false });
  }

  function installViewportGuard() {
    let timer = null;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!panel.hidden) {
          fitToViewport(panel);
          savePanelGeometry();
        }
        fitToViewport(launcher);
        saveLauncherGeometry();
        syncResizeHandle();
      }, 100);
    });
  }

  function readCollapseState() {
    return readJson(COLLAPSE_KEY, {});
  }

  function applyCollapseState() {
    const state = readCollapseState();
    for (const key of ["hunt", "rarity", "captured", "failed"]) {
      setCollapsed(key, state[key] === true);
    }
  }

  function toggleCollapse(key) {
    const state = readCollapseState();
    state[key] = !state[key];
    writeJson(COLLAPSE_KEY, state);
    setCollapsed(key, state[key]);
  }

  function setCollapsed(key, collapsed) {
    const target = key === "hunt"
      ? shadow.getElementById("hunt-section")
      : shadow.getElementById(`${key}-section`);
    const button = shadow.querySelector(`[data-collapse="${key}"]`);
    if (!target || !button) return;
    target.classList.toggle(key === "hunt" ? "hunt-collapsed" : "collapsed", collapsed);
    button.textContent = collapsed ? "▸" : "▾";
    button.title = collapsed ? "Expand" : "Collapse";
    button.setAttribute("aria-expanded", String(!collapsed));
  }

  function readAlpha() {
    const value = Number(localStorage.getItem(ALPHA_KEY));
    return ALPHA_LEVELS.includes(value) ? value : 1;
  }

  function cycleAlpha() {
    const current = readAlpha();
    const index = Math.max(0, ALPHA_LEVELS.indexOf(current));
    const next = ALPHA_LEVELS[(index + 1) % ALPHA_LEVELS.length];
    localStorage.setItem(ALPHA_KEY, String(next));
    applyAlpha(next);
  }

  function applyAlpha(alpha) {
    for (const element of [panel, launcher, resizeHandle]) {
      if (element) element.style.opacity = String(alpha);
    }
    const percent = Math.round(alpha * 100);
    const button = shadow.getElementById("pha-alpha");
    button.textContent = `α ${percent}%`;
    button.title = `Analyzer alpha: ${percent}% · click to change`;
  }

  async function copyRefCode(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    let copied = false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(REF_CODE);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = REF_CODE;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.documentElement.appendChild(textarea);
      textarea.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      textarea.remove();
    }

    button.title = copied ? "Copied!" : `Ref code: ${REF_CODE}`;
    window.setTimeout(() => {
      button.title = `Copy ref code ${REF_CODE}`;
    }, 1_200);
  }

  mount();

  return {
    renderCurrent,
    setActive,
    getActiveView: () => activeView
  };
}
