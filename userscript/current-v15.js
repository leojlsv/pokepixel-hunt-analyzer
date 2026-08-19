import "./compare-stable.js";
import { openDatabase } from "../data/db.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.5.0";
const COLLAPSE_KEY = "pokepixel_hunt_analyzer_collapsed_v1";

const RARITY_KEYS = new Set([
  "weak",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical"
]);

let shadow;
let db;
let capturedObserver;
let refreshRunning = false;
let refreshQueued = false;

function waitForReady() {
  return new Promise((resolve) => {
    const find = () => {
      const root = document.getElementById(ROOT_ID)?.shadowRoot;
      const ready = root?.querySelector("#view-current.pha-current-v13") &&
        root?.querySelector(".pha-captured-section");

      if (!root || !ready) return false;
      resolve(root);
      return true;
    };

    if (find()) return;

    const timer = setInterval(() => {
      if (find()) clearInterval(timer);
    }, 50);
  });
}

function readCollapsed() {
  try {
    const value = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "null");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeCollapsed(key, collapsed) {
  const current = readCollapsed();
  current[key] = collapsed;
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(current));
}

function installStyles() {
  if (shadow.getElementById("pha-current-v15-style")) return;

  const style = document.createElement("style");
  style.id = "pha-current-v15-style";
  style.textContent = `
    :host {
      --pha-bg: #20211e;
      --pha-bg-2: #282824;
      --pha-bg-3: #30302b;
      --pha-card: #252621;
      --pha-border: #4b4a43;
      --pha-border-soft: #3d3d37;
      --pha-text: #f0eee6;
      --pha-muted: #aaa79c;
      --pha-gold: #d7b45d;
      --pha-gold-soft: #9d874f;
    }

    .panel.pha-qol-panel {
      background: var(--pha-bg) !important;
      border-color: var(--pha-border) !important;
      border-radius: 5px !important;
      color: var(--pha-text) !important;
      box-shadow: 0 10px 26px #000b !important;
    }

    .topbar {
      background: #2c2c28 !important;
      border-bottom-color: var(--pha-border) !important;
    }

    .topbar strong,
    .pha-section-head h3 {
      color: var(--pha-gold) !important;
    }

    .topbar small,
    .cards span,
    .summary span,
    label,
    .pha-compare-summary,
    .pha-section-meta {
      color: var(--pha-muted) !important;
    }

    .tabs {
      background: #242521;
      border-bottom: 1px solid var(--pha-border-soft);
    }

    .tab,
    .actions button,
    .pha-collapse-button {
      border-radius: 3px !important;
      border-color: #55544c !important;
      background: #30312c !important;
      color: var(--pha-text) !important;
    }

    .tab.active {
      background: #3a382f !important;
      border-color: var(--pha-gold-soft) !important;
      color: var(--pha-gold) !important;
    }

    .pha-live-card,
    .pha-section,
    .cards article,
    .summary article,
    .pha-capture-strip article {
      border-radius: 4px !important;
      border-color: var(--pha-border-soft) !important;
      background: var(--pha-card) !important;
    }

    .pha-live-card {
      background: #272823 !important;
    }

    .pha-section-head {
      background: #2b2c27 !important;
      border-bottom-color: var(--pha-border-soft) !important;
    }

    .pha-section-badge {
      background: #38372f !important;
      color: var(--pha-gold) !important;
      border-radius: 3px !important;
    }

    .table {
      border-radius: 3px !important;
      border-color: var(--pha-border-soft) !important;
    }

    th {
      background: #2a2b27 !important;
      color: #c5b98f !important;
    }

    td {
      border-bottom-color: #383934 !important;
    }

    .filters select,
    .filters input {
      background: #191a17 !important;
      border-color: #4a4942 !important;
      border-radius: 3px !important;
      color: var(--pha-text) !important;
    }

    .launcher.pha-hud {
      background: #292a26 !important;
      border-color: #5b594f !important;
      border-radius: 5px !important;
      box-shadow: 0 5px 15px #0009 !important;
    }

    .pha-hud-compact .pha-hud-mark {
      border-radius: 4px !important;
      background: #35362f !important;
      color: var(--pha-gold) !important;
    }

    .pha-hud-compact-metric span {
      color: #b9ad81 !important;
    }

    #new-hunt {
      background: #314331 !important;
      border-color: #597258 !important;
      color: #cbe2c7 !important;
    }

    #pause-resume {
      background: #51472a !important;
      border-color: #82713c !important;
      color: #f0d987 !important;
    }

    #end-hunt {
      background: #50302e !important;
      border-color: #80504b !important;
      color: #efbbb5 !important;
    }

    #new-hunt:disabled,
    #pause-resume:disabled,
    #end-hunt:disabled {
      opacity: .42;
    }

    .pha-live-card .cards article > span,
    .pha-capture-strip article span,
    .pha-captured-section .filters label,
    .pha-failed-section .filters label {
      color: #c0ad72 !important;
    }

    .pha-capture-strip article {
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-start !important;
      justify-content: center !important;
      gap: 4px !important;
      min-width: 0 !important;
    }

    .pha-capture-strip article strong {
      max-width: 100%;
      font-size: 14px !important;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .pha-collapse-button {
      width: 24px;
      height: 22px;
      padding: 0 !important;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px !important;
      cursor: pointer;
    }

    .pha-live-card.pha-hunt-collapsed {
      display: block !important;
      padding: 7px !important;
    }

    .pha-live-card.pha-hunt-collapsed .statusrow,
    .pha-live-card.pha-hunt-collapsed .cards {
      display: none !important;
    }

    .pha-live-card.pha-hunt-collapsed .actions {
      justify-content: flex-start !important;
    }

    .pha-section.pha-section-collapsed > :not(.pha-section-head) {
      display: none !important;
    }

    .pha-gender {
      width: 28px;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
    }

    .pha-gender-male { color: #7fb3e8 !important; }
    .pha-gender-female { color: #e598b7 !important; }

    .pha-failed-section .table,
    .pha-captured-section .table {
      max-height: 245px;
    }

    .pha-failed-section tbody tr:hover td,
    .pha-captured-section tbody tr:hover td,
    #view-compare tbody tr:hover td {
      background: #30312c !important;
    }

    #view-compare thead th {
      background: #2a2b27 !important;
    }

    @container pha-analyzer (max-width: 500px) {
      .pha-capture-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
    }
  `;

  shadow.appendChild(style);
}

function speciesLabel(row) {
  const raw = row.speciesName || row.speciesId || "—";
  return String(raw)
    .split(/[\s_-]+/)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : "")
    .join(" ");
}

function rarityClass(value) {
  const key = String(value || "").toLowerCase();
  return RARITY_KEYS.has(key) ? `rarity-${key}` : "";
}

function genderInfo(value) {
  const key = String(value || "").trim().toLowerCase();

  if (["male", "m", "masculino", "♂"].includes(key)) {
    return { label: "♂", className: "pha-gender-male", title: "Male" };
  }

  if (["female", "f", "feminino", "♀"].includes(key)) {
    return { label: "♀", className: "pha-gender-female", title: "Female" };
  }

  return { label: "—", className: "", title: value || "Unknown" };
}

function ivBreakdown(ivs) {
  if (!ivs || typeof ivs !== "object") return "—";
  const values = [ivs.hp, ivs.atk, ivs.def, ivs.spa, ivs.spd, ivs.spe];
  if (!values.some(Number.isFinite)) return "—";
  return values.map((value) => Number.isFinite(value) ? value : "—").join("-");
}

function numericFilter(id) {
  const input = shadow.getElementById(id);
  if (!input?.value) return null;
  const value = Number(input.value);
  return Number.isFinite(value) ? value : null;
}

function passesFilters(encounter, prefix) {
  const rarity = shadow.getElementById(`${prefix}-rarity`)?.value || "*";
  const qualityMin = numericFilter(`${prefix}-quality`);
  const ivMin = numericFilter(`${prefix}-iv`);

  if (rarity !== "*" && encounter.quality !== rarity) return false;
  if (qualityMin != null && !(Number.isFinite(encounter.qualityMultiplier) && encounter.qualityMultiplier > qualityMin)) return false;
  if (ivMin != null && !(Number.isFinite(encounter.ivTotal) && encounter.ivTotal > ivMin)) return false;
  return true;
}

function populateRarity(select, encounters) {
  if (!select) return;
  const previous = select.value || "*";
  const values = [...new Set(encounters.map((row) => row.quality).filter(Boolean))].sort();

  select.replaceChildren();
  const all = document.createElement("option");
  all.value = "*";
  all.textContent = "All (*)";
  select.appendChild(all);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }

  select.value = [...select.options].some((option) => option.value === previous)
    ? previous
    : "*";
}

function ensureCapturedGenderHeader() {
  const body = shadow.getElementById("captured-body");
  const row = body?.closest("table")?.querySelector("thead tr");
  if (!row || row.querySelector('[data-pha-column="gender"]')) return;

  const th = document.createElement("th");
  th.dataset.phaColumn = "gender";
  th.textContent = "G";
  th.title = "Gender";
  row.insertBefore(th, row.children[1] || null);
}

function rowElement(encounter) {
  const tr = document.createElement("tr");
  const gender = genderInfo(encounter.gender);

  const pokemon = document.createElement("td");
  pokemon.className = rarityClass(encounter.quality);
  pokemon.textContent = speciesLabel(encounter) + (encounter.isShiny ? " *" : "");

  const genderCell = document.createElement("td");
  genderCell.className = `pha-gender ${gender.className}`.trim();
  genderCell.textContent = gender.label;
  genderCell.title = gender.title;

  const nature = document.createElement("td");
  nature.textContent = encounter.nature || "—";

  const quality = document.createElement("td");
  quality.textContent = Number.isFinite(encounter.qualityMultiplier)
    ? encounter.qualityMultiplier.toFixed(2)
    : "—";

  const ivs = document.createElement("td");
  ivs.textContent = ivBreakdown(encounter.ivs);

  tr.append(pokemon, genderCell, nature, quality, ivs);
  return tr;
}

function renderCaptured(encounters) {
  ensureCapturedGenderHeader();

  const captured = encounters.filter((row) => row.captureResult === "success");
  const select = shadow.getElementById("captured-rarity");
  populateRarity(select, captured);

  const body = shadow.getElementById("captured-body");
  if (!body) return;

  const fragment = document.createDocumentFragment();
  let count = 0;

  for (const encounter of captured) {
    if (!passesFilters(encounter, "captured")) continue;
    fragment.appendChild(rowElement(encounter));
    count += 1;
  }

  body.replaceChildren(fragment);
  const badge = shadow.getElementById("pha-current-captured-count");
  if (badge) badge.textContent = `${count} ${count === 1 ? "row" : "rows"}`;
}

function createFailedSection() {
  if (shadow.getElementById("pha-failed-section")) return;

  const captured = shadow.querySelector(".pha-captured-section");
  if (!captured) return;

  const section = document.createElement("section");
  section.id = "pha-failed-section";
  section.className = "pha-section pha-captured-section pha-failed-section";
  section.innerHTML = `
    <div class="pha-section-head">
      <h3>Failed</h3>
      <div class="pha-section-meta">
        <span id="pha-current-failed-count" class="pha-section-badge">0 rows</span>
      </div>
    </div>
    <div class="filters">
      <label>Rarity<select id="failed-rarity"></select></label>
      <label>Quality &gt;<input id="failed-quality" type="number" step="0.01"></label>
      <label>IV &gt;<input id="failed-iv" type="number" step="1"></label>
    </div>
    <div class="table">
      <table>
        <thead><tr><th>Pokémon</th><th title="Gender">G</th><th>Nat</th><th>Qlt</th><th>HP-ATK-DEF-SATK-SDEF-SPE</th></tr></thead>
        <tbody id="failed-body"></tbody>
      </table>
    </div>
  `;

  captured.after(section);

  for (const id of ["failed-rarity", "failed-quality", "failed-iv"]) {
    const control = shadow.getElementById(id);
    const eventName = control?.tagName === "SELECT" ? "change" : "input";
    control?.addEventListener(eventName, refreshEncounterLists);
  }
}

function renderFailed(encounters) {
  const failed = encounters.filter((row) => row.captureResult === "failed");
  populateRarity(shadow.getElementById("failed-rarity"), failed);

  const body = shadow.getElementById("failed-body");
  if (!body) return;

  const fragment = document.createDocumentFragment();
  let count = 0;

  for (const encounter of failed) {
    if (!passesFilters(encounter, "failed")) continue;
    fragment.appendChild(rowElement(encounter));
    count += 1;
  }

  body.replaceChildren(fragment);
  const badge = shadow.getElementById("pha-current-failed-count");
  if (badge) badge.textContent = `${count} ${count === 1 ? "row" : "rows"}`;
}

function observeCaptured() {
  const body = shadow.getElementById("captured-body");
  if (!capturedObserver || !body) return;
  capturedObserver.observe(body, { childList: true });
}

async function currentEncounters() {
  const sessions = createSessionsRepository(db);
  const encounters = createEncountersRepository(db);
  const session = await sessions.getCurrentReadOnly();
  return session ? encounters.getBySessionId(session.sessionId) : [];
}

async function refreshEncounterLists() {
  if (!db) return;

  if (refreshRunning) {
    refreshQueued = true;
    return;
  }

  refreshRunning = true;

  try {
    const encounters = await currentEncounters();

    capturedObserver?.disconnect();
    renderCaptured(encounters);
    renderFailed(encounters);
    observeCaptured();
    capturedObserver?.takeRecords();
  } catch (error) {
    console.error("PokePixel Hunt Analyzer (Current lists):", error);
  } finally {
    refreshRunning = false;

    if (refreshQueued) {
      refreshQueued = false;
      queueMicrotask(refreshEncounterLists);
    }
  }
}

function installCapturedObserver() {
  capturedObserver = new MutationObserver(() => refreshEncounterLists());
  observeCaptured();
}

function collapseButton(key, target, mode = "section") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pha-collapse-button";
  button.dataset.collapseKey = key;

  const apply = (collapsed) => {
    if (mode === "hunt") {
      target.classList.toggle("pha-hunt-collapsed", collapsed);
    } else {
      target.classList.toggle("pha-section-collapsed", collapsed);
    }

    button.textContent = collapsed ? "▸" : "▾";
    button.title = collapsed ? "Expand" : "Collapse";
    button.setAttribute("aria-expanded", String(!collapsed));
  };

  const initial = readCollapsed()[key] === true;
  apply(initial);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const collapsed = mode === "hunt"
      ? !target.classList.contains("pha-hunt-collapsed")
      : !target.classList.contains("pha-section-collapsed");

    apply(collapsed);
    writeCollapsed(key, collapsed);
  });

  return button;
}

function installCollapseControls() {
  const hunt = shadow.querySelector(".pha-live-card");
  const actions = hunt?.querySelector(".actions");
  if (hunt && actions && !shadow.getElementById("pha-collapse-hunt")) {
    const button = collapseButton("hunt", hunt, "hunt");
    button.id = "pha-collapse-hunt";
    actions.appendChild(button);
  }

  const sections = [
    ["rarity", shadow.querySelector(".pha-rarity-section")],
    ["captured", shadow.querySelector(".pha-captured-section:not(.pha-failed-section)")],
    ["failed", shadow.querySelector(".pha-failed-section")]
  ];

  for (const [key, section] of sections) {
    if (!section) continue;
    const meta = section.querySelector(".pha-section-meta");
    if (!meta || meta.querySelector(`[data-collapse-key="${key}"]`)) continue;
    meta.appendChild(collapseButton(key, section));
  }
}

async function init() {
  shadow = await waitForReady();
  db = await openDatabase();

  installStyles();
  ensureCapturedGenderHeader();
  createFailedSection();
  installCollapseControls();
  installCapturedObserver();

  for (const id of [
    "captured-rarity",
    "captured-quality",
    "captured-iv"
  ]) {
    const control = shadow.getElementById(id);
    const eventName = control?.tagName === "SELECT" ? "change" : "input";
    control?.addEventListener(eventName, refreshEncounterLists);
  }

  await refreshEncounterLists();
  setInterval(refreshEncounterLists, 1500);

  const version = shadow.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (Current v1.5):", error)
);
