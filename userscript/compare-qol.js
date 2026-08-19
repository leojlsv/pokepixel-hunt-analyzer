import "./hud-compact.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.4.0";
const STATE_KEY = "pokepixel_hunt_analyzer_compare_v1";

const FILTER_IDS = {
  theme: "compare-theme",
  species: "compare-species",
  capsule: "compare-capsule",
  element: "compare-element"
};

const DEFAULT_SORT = {
  cycle: { column: 5, direction: "desc" },
  rarity: { column: 1, direction: "desc" }
};

const RARITY_ORDER = new Map([
  ["weak", 0],
  ["common", 1],
  ["uncommon", 2],
  ["rare", 3],
  ["epic", 4],
  ["legendary", 5],
  ["mythical", 6]
]);

let shadow;
let sortState = null;
let applyingState = false;
let sortScheduled = false;

function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeState(patch) {
  const current = readState();
  localStorage.setItem(STATE_KEY, JSON.stringify({ ...current, ...patch }));
}

function waitForShadow() {
  return new Promise((resolve) => {
    const find = () => {
      const root = document.getElementById(ROOT_ID)?.shadowRoot;
      if (!root) return false;
      resolve(root);
      return true;
    };

    if (find()) return;
    const timer = setInterval(() => {
      if (find()) clearInterval(timer);
    }, 50);
  });
}

function installStyles() {
  if (shadow.getElementById("pha-compare-qol-style")) return;

  const style = document.createElement("style");
  style.id = "pha-compare-qol-style";
  style.textContent = `
    #view-compare {
      padding: 10px;
    }

    #view-compare > .filters {
      padding: 0 0 9px;
      align-items: flex-end;
    }

    #view-compare .table {
      margin: 0;
      max-height: 430px;
      border-color: #2a3947;
    }

    #view-compare thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      user-select: none;
      background: #17212b;
    }

    #view-compare thead th.pha-sortable {
      cursor: pointer;
      padding-right: 18px;
      position: sticky;
    }

    #view-compare thead th.pha-sortable::after {
      content: "↕";
      position: absolute;
      right: 6px;
      color: #657486;
      font-size: 9px;
    }

    #view-compare thead th.pha-sort-asc::after {
      content: "↑";
      color: #dce5ef;
    }

    #view-compare thead th.pha-sort-desc::after {
      content: "↓";
      color: #dce5ef;
    }

    #view-compare tbody tr:hover td {
      background: #17222d;
    }

    .pha-compare-reset {
      height: 28px;
      padding: 0 9px;
      border: 1px solid #344250;
      border-radius: 6px;
      background: #1b2530;
      color: #dbe3ec;
      font-size: 10px;
      cursor: pointer;
    }

    .pha-compare-reset:hover {
      border-color: #536579;
    }

    .pha-compare-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 24px;
      margin-bottom: 7px;
      color: #8f9cab;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    .pha-compare-summary strong {
      color: #dce4ed;
      font-size: 10px;
    }
  `;
  shadow.appendChild(style);
}

function theme() {
  return shadow.getElementById(FILTER_IDS.theme)?.value || "cycle";
}

function defaultSort() {
  return { ...DEFAULT_SORT[theme()] };
}

function normalizeSavedSort(saved) {
  if (!saved || typeof saved !== "object") return defaultSort();
  const column = Number(saved.column);
  const direction = saved.direction === "asc" ? "asc" : "desc";
  const maxColumn = theme() === "rarity" ? 4 : 6;
  if (!Number.isInteger(column) || column < 0 || column > maxColumn) return defaultSort();
  return { column, direction };
}

function parseNumeric(text) {
  const raw = String(text || "").trim();
  if (!raw || raw === "—") return Number.NEGATIVE_INFINITY;

  const percent = raw.endsWith("%");
  const normalized = raw
    .replace(/%/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.+-]/g, "");

  const value = Number(normalized);
  if (!Number.isFinite(value)) return Number.NEGATIVE_INFINITY;
  return percent ? value / 100 : value;
}

function cellValue(row, column) {
  const text = row.cells[column]?.textContent?.trim() || "";

  if (theme() === "rarity" && column === 0) {
    return RARITY_ORDER.get(text.toLowerCase()) ?? 999;
  }

  const numericColumns = theme() === "rarity"
    ? new Set([1, 2, 3, 4])
    : new Set([1, 2, 3, 4, 5, 6]);

  return numericColumns.has(column) ? parseNumeric(text) : text.toLocaleLowerCase();
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function decorateHeaders() {
  const head = shadow.getElementById("compare-head");
  if (!head) return;

  [...head.children].forEach((th, column) => {
    th.classList.add("pha-sortable");
    th.classList.toggle("pha-sort-asc", sortState?.column === column && sortState.direction === "asc");
    th.classList.toggle("pha-sort-desc", sortState?.column === column && sortState.direction === "desc");
    th.title = "Sort column";

    if (th.dataset.phaSortBound === "1") return;
    th.dataset.phaSortBound = "1";
    th.addEventListener("click", () => {
      if (sortState?.column === column) {
        sortState.direction = sortState.direction === "desc" ? "asc" : "desc";
      } else {
        sortState = { column, direction: "desc" };
      }
      writeState({ sort: sortState });
      sortTable();
    });
  });
}

function updateSummary(rowCount) {
  let summary = shadow.getElementById("pha-compare-summary");
  const table = shadow.querySelector("#view-compare > .table");
  if (!table) return;

  if (!summary) {
    summary = document.createElement("div");
    summary.id = "pha-compare-summary";
    summary.className = "pha-compare-summary";
    table.before(summary);
  }

  const mode = theme() === "rarity" ? "rarity groups" : "cycle groups";
  summary.innerHTML = `<span>Ranking</span><strong>${rowCount} ${mode}</strong>`;
}

function sortTable() {
  if (!shadow) return;
  const body = shadow.getElementById("compare-body");
  if (!body) return;

  if (!sortState) sortState = defaultSort();
  const rows = [...body.querySelectorAll(":scope > tr")];
  const direction = sortState.direction === "asc" ? 1 : -1;

  rows.sort((a, b) => {
    const primary = compareValues(
      cellValue(a, sortState.column),
      cellValue(b, sortState.column)
    );
    if (primary !== 0) return primary * direction;

    // Stable/useful tie-breaker: Pokémon/Rarity then level.
    const name = compareValues(cellValue(a, 0), cellValue(b, 0));
    if (name !== 0) return name;
    if (theme() === "cycle") return compareValues(cellValue(a, 1), cellValue(b, 1));
    return 0;
  });

  for (const row of rows) body.appendChild(row);
  decorateHeaders();
  updateSummary(rows.length);
}

function scheduleSort() {
  if (sortScheduled) return;
  sortScheduled = true;
  queueMicrotask(() => {
    sortScheduled = false;
    sortTable();
  });
}

function persistFilters() {
  if (applyingState) return;
  const filters = {};
  for (const [key, id] of Object.entries(FILTER_IDS)) {
    filters[key] = shadow.getElementById(id)?.value || (key === "theme" ? "cycle" : "*");
  }
  writeState({ filters, sort: sortState });
}

function applySavedFilters() {
  const saved = readState();
  const filters = saved.filters || {};
  applyingState = true;

  for (const [key, id] of Object.entries(FILTER_IDS)) {
    const select = shadow.getElementById(id);
    if (!select) continue;
    const wanted = filters[key];
    if (wanted == null) continue;
    if ([...select.options].some((option) => option.value === wanted)) {
      select.value = wanted;
    }
  }

  applyingState = false;
  sortState = normalizeSavedSort(saved.sort);
}

function dispatchChange(select) {
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function resetCompare() {
  const themeSelect = shadow.getElementById(FILTER_IDS.theme);
  if (themeSelect) themeSelect.value = "cycle";

  for (const key of ["species", "capsule", "element"]) {
    const select = shadow.getElementById(FILTER_IDS[key]);
    if (select) select.value = "*";
  }

  sortState = { ...DEFAULT_SORT.cycle };
  localStorage.removeItem(STATE_KEY);

  // One change is enough: main.js reads all current compareFilters from
  // each control's own listener, so dispatch each changed select explicitly.
  for (const id of Object.values(FILTER_IDS)) {
    const select = shadow.getElementById(id);
    if (select) dispatchChange(select);
  }

  writeState({
    filters: { theme: "cycle", species: "*", capsule: "*", element: "*" },
    sort: sortState
  });
}

function installResetButton() {
  const filters = shadow.querySelector("#view-compare > .filters");
  if (!filters || shadow.getElementById("pha-compare-reset")) return;

  const button = document.createElement("button");
  button.id = "pha-compare-reset";
  button.className = "pha-compare-reset";
  button.type = "button";
  button.textContent = "Reset";
  button.addEventListener("click", resetCompare);
  filters.appendChild(button);
}

function wireFilters() {
  for (const [key, id] of Object.entries(FILTER_IDS)) {
    const select = shadow.getElementById(id);
    if (!select || select.dataset.phaCompareBound === "1") continue;
    select.dataset.phaCompareBound = "1";
    select.addEventListener("change", () => {
      if (key === "theme") {
        const savedSort = readState().sort;
        sortState = normalizeSavedSort(savedSort);
        if (sortState.column > (theme() === "rarity" ? 4 : 6)) sortState = defaultSort();
      }
      persistFilters();
      scheduleSort();
    });
  }
}

function observeCompareRender() {
  const body = shadow.getElementById("compare-body");
  const head = shadow.getElementById("compare-head");
  if (!body || !head) return;

  const observer = new MutationObserver(() => {
    // Options may have just been rebuilt by loadCompare(). Reapply saved
    // values only when those options now exist, then sort the rendered rows.
    applySavedFilters();
    scheduleSort();
  });
  observer.observe(body, { childList: true });
  observer.observe(head, { childList: true });

  for (const key of ["species", "capsule", "element"]) {
    const select = shadow.getElementById(FILTER_IDS[key]);
    if (select) observer.observe(select, { childList: true });
  }
}

async function init() {
  shadow = await waitForShadow();
  installStyles();
  installResetButton();
  wireFilters();
  applySavedFilters();
  sortState = normalizeSavedSort(readState().sort);
  observeCompareRender();
  scheduleSort();

  const version = shadow.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (Compare QoL):", error)
);
