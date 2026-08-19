import "./hud-compact.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.4.3";

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
let sortState = { ...DEFAULT_SORT.cycle };
let sortScheduled = false;

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

function currentTheme() {
  return shadow.getElementById("compare-theme")?.value || "cycle";
}

function installStyles() {
  if (shadow.getElementById("pha-compare-stable-style")) return;

  const style = document.createElement("style");
  style.id = "pha-compare-stable-style";
  style.textContent = `
    #view-current[hidden],
    #view-compare[hidden] {
      display: none !important;
    }

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
  `;

  shadow.appendChild(style);
}

function removeExport() {
  shadow.getElementById("pha-export")?.remove();
}

function parseNumeric(text) {
  const raw = String(text || "").trim();
  if (!raw || raw === "—") return Number.NEGATIVE_INFINITY;

  if (raw.endsWith("%")) {
    const value = Number(raw.slice(0, -1).replace(",", "."));
    return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
  }

  const value = Number(
    raw
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .replace(/[^\d.+-]/g, "")
  );

  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function cellValue(row, column) {
  const text = row.cells[column]?.textContent?.trim() || "";
  const theme = currentTheme();

  if (theme === "rarity" && column === 0) {
    return RARITY_ORDER.get(text.toLowerCase()) ?? 999;
  }

  const numericColumns = theme === "rarity"
    ? [1, 2, 3, 4]
    : [1, 2, 3, 4, 5, 6];

  return numericColumns.includes(column)
    ? parseNumeric(text)
    : text.toLocaleLowerCase();
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function observeTable() {
  const head = shadow.getElementById("compare-head");
  const body = shadow.getElementById("compare-body");
  if (!observer || !head || !body) return;

  observer.observe(head, { childList: true });
  observer.observe(body, { childList: true });
}

function decorateHeaders() {
  const head = shadow.getElementById("compare-head");
  if (!head) return;

  [...head.children].forEach((th, column) => {
    th.classList.add("pha-sortable");
    th.classList.toggle(
      "pha-sort-asc",
      sortState.column === column && sortState.direction === "asc"
    );
    th.classList.toggle(
      "pha-sort-desc",
      sortState.column === column && sortState.direction === "desc"
    );

    if (th.dataset.phaStableSortBound === "1") return;
    th.dataset.phaStableSortBound = "1";

    th.addEventListener("click", () => {
      sortState = sortState.column === column
        ? {
            column,
            direction: sortState.direction === "desc" ? "asc" : "desc"
          }
        : { column, direction: "desc" };

      sortTable();
    });
  });
}

function sortTable() {
  const body = shadow.getElementById("compare-body");
  if (!body) return;

  const maxColumn = currentTheme() === "rarity" ? 4 : 6;
  if (sortState.column > maxColumn) {
    sortState = { ...DEFAULT_SORT[currentTheme()] };
  }

  const original = [...body.children];
  const sorted = original.slice();
  const direction = sortState.direction === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    const primary = compareValues(
      cellValue(a, sortState.column),
      cellValue(b, sortState.column)
    );

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
    observeTable();
    observer?.takeRecords();
  }

  decorateHeaders();
}

function scheduleSort() {
  if (sortScheduled) return;
  sortScheduled = true;

  queueMicrotask(() => {
    sortScheduled = false;
    sortTable();
  });
}

function wireNativeFilters() {
  const ids = [
    "compare-theme",
    "compare-species",
    "compare-capsule",
    "compare-element"
  ];

  for (const id of ids) {
    const select = shadow.getElementById(id);
    if (!select) continue;

    select.addEventListener("change", () => {
      if (id === "compare-theme") {
        sortState = { ...DEFAULT_SORT[currentTheme()] };
      }

      // main.js owns filtering and renders synchronously through its existing
      // onchange handler. This layer only sorts the already-filtered result.
      scheduleSort();
    });
  }
}

function installObserver() {
  observer = new MutationObserver(() => scheduleSort());
  observeTable();
}

async function init() {
  shadow = await waitForShadow();

  installStyles();
  removeExport();

  // Remove state left by the two experimental Compare persistence layers.
  // No Compare state is persisted from v1.4.3 onward.
  localStorage.removeItem("pokepixel_hunt_analyzer_compare_v1");
  localStorage.removeItem("pokepixel_hunt_analyzer_compare_v2");

  wireNativeFilters();
  installObserver();

  const compareTab = shadow.querySelector('[data-view="compare"]');
  compareTab?.addEventListener("click", scheduleSort);

  const version = shadow.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (stable Compare):", error)
);
