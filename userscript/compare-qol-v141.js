import "./hud-compact.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.4.1";
const STATE_KEY = "pokepixel_hunt_analyzer_compare_v2";

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
let observer;
let sortState;
let reconciling = false;
let reconcileScheduled = false;
let restoredForCurrentRender = false;

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

function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    return state && typeof state === "object" ? state : {};
  } catch {
    return {};
  }
}

function writeState(patch) {
  localStorage.setItem(STATE_KEY, JSON.stringify({ ...readState(), ...patch }));
}

function currentTheme() {
  return shadow.getElementById(FILTER_IDS.theme)?.value || "cycle";
}

function defaultSort() {
  return { ...DEFAULT_SORT[currentTheme()] };
}

function validSort(saved) {
  if (!saved || typeof saved !== "object") return defaultSort();
  const column = Number(saved.column);
  const direction = saved.direction === "asc" ? "asc" : "desc";
  const max = currentTheme() === "rarity" ? 4 : 6;
  return Number.isInteger(column) && column >= 0 && column <= max
    ? { column, direction }
    : defaultSort();
}

function installStyles() {
  if (shadow.getElementById("pha-compare-qol-v141-style")) return;

  const style = document.createElement("style");
  style.id = "pha-compare-qol-v141-style";
  style.textContent = `
    #view-compare { padding: 10px; }
    #view-compare > .filters { padding: 0 0 9px; align-items: flex-end; }
    #view-compare .table { margin: 0; max-height: 430px; border-color: #2a3947; }
    #view-compare thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      user-select: none;
      background: #17212b;
    }
    #view-compare thead th.pha-sortable { cursor: pointer; padding-right: 18px; }
    #view-compare thead th.pha-sortable::after {
      content: "↕";
      position: absolute;
      right: 6px;
      color: #657486;
      font-size: 9px;
    }
    #view-compare thead th.pha-sort-asc::after { content: "↑"; color: #dce5ef; }
    #view-compare thead th.pha-sort-desc::after { content: "↓"; color: #dce5ef; }
    #view-compare tbody tr:hover td { background: #17222d; }
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
    .pha-compare-summary strong { color: #dce4ed; font-size: 10px; }
  `;
  shadow.appendChild(style);
}

function parseNumeric(text) {
  const raw = String(text || "").trim();
  if (!raw || raw === "—") return Number.NEGATIVE_INFINITY;

  if (raw.endsWith("%")) {
    const value = Number(raw.slice(0, -1).replace(",", "."));
    return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
  }

  const value = Number(
    raw.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.+-]/g, "")
  );
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function cellValue(row, column) {
  const text = row.cells[column]?.textContent?.trim() || "";
  if (currentTheme() === "rarity" && column === 0) {
    return RARITY_ORDER.get(text.toLowerCase()) ?? 999;
  }

  const numeric = currentTheme() === "rarity"
    ? [1, 2, 3, 4]
    : [1, 2, 3, 4, 5, 6];

  return numeric.includes(column) ? parseNumeric(text) : text.toLocaleLowerCase();
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function updateSummary(count) {
  const table = shadow.querySelector("#view-compare > .table");
  if (!table) return;

  let summary = shadow.getElementById("pha-compare-summary");
  if (!summary) {
    summary = document.createElement("div");
    summary.id = "pha-compare-summary";
    summary.className = "pha-compare-summary";
    table.before(summary);
  }

  summary.innerHTML = `<span>Ranking</span><strong>${count} ${currentTheme() === "rarity" ? "rarity groups" : "cycle groups"}</strong>`;
}

function decorateHeaders() {
  const head = shadow.getElementById("compare-head");
  if (!head) return;

  [...head.children].forEach((th, column) => {
    th.classList.add("pha-sortable");
    th.classList.toggle("pha-sort-asc", sortState.column === column && sortState.direction === "asc");
    th.classList.toggle("pha-sort-desc", sortState.column === column && sortState.direction === "desc");

    if (th.dataset.phaSortBound === "1") return;
    th.dataset.phaSortBound = "1";
    th.addEventListener("click", () => {
      sortState = sortState.column === column
        ? { column, direction: sortState.direction === "desc" ? "asc" : "desc" }
        : { column, direction: "desc" };
      writeState({ sort: sortState });
      scheduleReconcile();
    });
  });
}

function observeTargets() {
  const body = shadow.getElementById("compare-body");
  const head = shadow.getElementById("compare-head");
  if (!observer || !body || !head) return;
  observer.observe(body, { childList: true });
  observer.observe(head, { childList: true });
}

function sortRows() {
  const body = shadow.getElementById("compare-body");
  if (!body) return;

  const original = [...body.children];
  const sorted = original.slice();
  const direction = sortState.direction === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    const primary = compareValues(cellValue(a, sortState.column), cellValue(b, sortState.column));
    if (primary !== 0) return primary * direction;

    const name = compareValues(cellValue(a, 0), cellValue(b, 0));
    if (name !== 0) return name;
    return currentTheme() === "cycle"
      ? compareValues(cellValue(a, 1), cellValue(b, 1))
      : 0;
  });

  const changed = sorted.some((row, index) => row !== original[index]);
  if (changed) {
    observer?.disconnect();
    const fragment = document.createDocumentFragment();
    for (const row of sorted) fragment.appendChild(row);
    body.appendChild(fragment);
    observeTargets();
    observer?.takeRecords();
  }

  decorateHeaders();
  updateSummary(sorted.length);
}

function persistFilters() {
  const filters = {};
  for (const [key, id] of Object.entries(FILTER_IDS)) {
    filters[key] = shadow.getElementById(id)?.value || (key === "theme" ? "cycle" : "*");
  }
  writeState({ filters, sort: sortState });
}

function restoreFiltersOnce() {
  if (restoredForCurrentRender) return false;
  const saved = readState().filters || {};
  let changed = false;

  for (const [key, id] of Object.entries(FILTER_IDS)) {
    const select = shadow.getElementById(id);
    const wanted = saved[key];
    if (!select || wanted == null || select.value === wanted) continue;
    if (![...select.options].some((option) => option.value === wanted)) continue;

    select.value = wanted;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    changed = true;
  }

  restoredForCurrentRender = true;
  return changed;
}

function reconcile() {
  if (reconciling) return;
  reconciling = true;

  try {
    if (restoreFiltersOnce()) {
      // Production change handlers re-render synchronously. The observer will
      // schedule one clean pass for the new table; do not sort this stale pass.
      return;
    }

    sortState = validSort(readState().sort);
    sortRows();
  } finally {
    reconciling = false;
  }
}

function scheduleReconcile() {
  if (reconcileScheduled) return;
  reconcileScheduled = true;
  queueMicrotask(() => {
    reconcileScheduled = false;
    reconcile();
  });
}

function installObserver() {
  observer = new MutationObserver(() => {
    restoredForCurrentRender = false;
    scheduleReconcile();
  });
  observeTargets();
}

function resetCompare() {
  localStorage.removeItem(STATE_KEY);

  const values = {
    theme: "cycle",
    species: "*",
    capsule: "*",
    element: "*"
  };

  for (const [key, id] of Object.entries(FILTER_IDS)) {
    const select = shadow.getElementById(id);
    if (!select || select.value === values[key]) continue;
    select.value = values[key];
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  sortState = { ...DEFAULT_SORT.cycle };
  writeState({ filters: values, sort: sortState });
  restoredForCurrentRender = true;
  scheduleReconcile();
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
    if (!select) continue;

    select.addEventListener("change", () => {
      if (key === "theme") sortState = defaultSort();
      persistFilters();
      restoredForCurrentRender = true;
      scheduleReconcile();
    });
  }
}

async function init() {
  shadow = await waitForShadow();
  installStyles();
  sortState = validSort(readState().sort);
  installResetButton();
  wireFilters();
  installObserver();

  // Opening Compare is what populates and renders its data. The observer then
  // performs restoration + sorting only after production has finished.
  const compareTab = shadow.querySelector('[data-view="compare"]');
  compareTab?.addEventListener("click", () => {
    restoredForCurrentRender = false;
    scheduleReconcile();
  });

  const version = shadow.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (Compare QoL v1.4.1):", error)
);
