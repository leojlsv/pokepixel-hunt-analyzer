import {
  buildCatchGalleryRows,
  CATCH_GALLERY_PAGE_SIZE,
  CATCH_GALLERY_SORT_KEYS,
  paginateCatchGallery
} from "../domain/catchGallery.js";
import { formatCaptureTimestamp } from "./encounter-list-model.js";
import {
  generateCaptureTicket,
  openCaptureTicketPreview
} from "./capture-ticket.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const TAB_ID = "alerts-tab";
const VIEW_ID = "view-alerts";
const SECTION_ID = "catch-gallery";
const STYLE_ID = "pha-catch-gallery-styles";

const STYLES = `
  .catch-gallery-section .section-head { cursor: default; }
  .catch-gallery-head-meta { display:flex; align-items:center; gap:6px; }

  .catch-gallery-filters {
    padding:7px 9px;
    display:grid;
    grid-template-columns:minmax(120px,1fr) 116px;
    gap:7px;
    border-bottom:1px solid var(--border-soft);
    background:var(--bg-elevated);
  }
  .catch-gallery-filters input,
  .catch-gallery-filters select {
    width:100%; min-width:0; height:26px; padding:4px 6px;
    border:1px solid var(--border); border-radius:3px;
    background:var(--bg); color:var(--text); font-size:10px;
  }

  .catch-gallery-section .table-wrap { max-height:none; overflow:auto; }
  .catch-gallery-table { table-layout:fixed; }
  .catch-gallery-table th,
  .catch-gallery-table td { height:29px; padding:5px 7px; vertical-align:middle; }
  .catch-gallery-pokemon-col { width:25%; }
  .catch-gallery-captured-col { width:21%; }
  .catch-gallery-quality-col { width:12%; }
  .catch-gallery-iv-col { width:12%; }
  .catch-gallery-actions-col { width:30%; }
  .catch-gallery-table th:nth-child(3),
  .catch-gallery-table th:nth-child(4),
  .catch-gallery-table th:nth-child(5) { text-align:right; }
  .catch-gallery-table td:nth-child(3),
  .catch-gallery-table td:nth-child(4),
  .catch-gallery-table td:nth-child(5) { text-align:right; }

  .catch-gallery-sort {
    appearance:none; width:100%; padding:0; border:0; background:transparent;
    color:inherit; font:inherit; font-weight:inherit; text-align:inherit;
    cursor:pointer; white-space:nowrap;
  }
  .catch-gallery-sort:hover { color:var(--gold); }
  .catch-gallery-sort-arrow { margin-left:3px; color:#77746a; font-size:8px; }
  .catch-gallery-sort.active .catch-gallery-sort-arrow { color:var(--gold); }

  .catch-gallery-name {
    display:inline-flex; align-items:center; min-width:0; max-width:100%;
    overflow:hidden; font-weight:800; text-overflow:ellipsis; white-space:nowrap;
  }
  .catch-gallery-shiny { color:#cfd5de !important; }
  .catch-gallery-star { flex:0 0 auto; margin-right:4px; color:#e4e7ec; font-size:10px; line-height:1; }
  .catch-gallery-date {
    overflow:hidden; color:var(--muted); font-size:10px;
    font-variant-numeric:tabular-nums; text-overflow:ellipsis; white-space:nowrap;
  }
  .catch-gallery-number { color:#d8d4c9; font-variant-numeric:tabular-nums; }

  .catch-gallery-actions { display:flex; align-items:center; justify-content:flex-end; gap:4px; }
  .catch-gallery-action {
    min-width:46px; height:21px; padding:0 5px;
    border:1px solid #5b594f; border-radius:3px; background:#30312c;
    color:#d8d4c9; font-size:9px; line-height:19px; white-space:nowrap; cursor:pointer;
  }
  .catch-gallery-action.generate { min-width:62px; color:#dccd95; }
  .catch-gallery-action:hover { border-color:#81764f; background:#3a392f; }
  .catch-gallery-action:disabled { cursor:default; opacity:.55; }

  .catch-gallery-pagination {
    min-height:31px; padding:5px 8px; display:flex; align-items:center;
    justify-content:flex-end; gap:6px; border-top:1px solid var(--border-soft);
    background:var(--bg-elevated);
  }
  .catch-gallery-pagination[hidden] { display:none !important; }
  .catch-gallery-page-button {
    min-width:48px; height:21px; padding:0 6px;
    border:1px solid #55544c; border-radius:3px; background:#30312c;
    color:var(--text); font-size:9px; cursor:pointer;
  }
  .catch-gallery-page-button:disabled { opacity:.4; cursor:default; }
  .catch-gallery-page-label {
    min-width:38px; color:var(--muted); font-size:9px;
    font-variant-numeric:tabular-nums; text-align:center;
  }
`;

function displayTimestamp(value) {
  const formatted = formatCaptureTimestamp(value);
  return formatted === "—" ? "" : formatted.slice(0, 16);
}

function rarityClass(encounter) {
  return encounter.isShiny === true
    ? "catch-gallery-shiny"
    : `rarity-${encounter.quality}`;
}

async function copyTicketImage(encounter) {
  if (!navigator.clipboard?.write || typeof ClipboardItem !== "function") {
    throw new Error("Image clipboard is not supported by this browser");
  }

  const result = await generateCaptureTicket(encounter);
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": result.blob })
    ]);
  } finally {
    URL.revokeObjectURL(result.url);
  }
}

function actionButton({ text, className = "", title, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `catch-gallery-action ${className}`.trim();
  button.textContent = text;
  button.title = title;
  button.addEventListener("click", () => void onClick(button));
  return button;
}

export function createCatchGallery({ loadEncounters }) {
  let shadow = null;
  let tab = null;
  let section = null;
  let tbody = null;
  let pagination = null;
  let previousButton = null;
  let nextButton = null;
  let pageLabel = null;
  let pokemonFilter = null;
  let rarityFilter = null;
  let collapseButton = null;
  let rawEncounters = [];
  let page = 1;
  let sortKey = CATCH_GALLERY_SORT_KEYS.CAPTURED;
  let sortDirection = "desc";
  let dirty = true;
  let refreshPromise = null;
  let disposed = false;

  function filteredSortedRows() {
    return buildCatchGalleryRows(rawEncounters, {
      pokemon: pokemonFilter?.value || "",
      rarity: rarityFilter?.value || "all",
      sortKey,
      sortDirection
    });
  }

  function updateSortHeaders() {
    for (const button of section?.querySelectorAll("[data-catch-gallery-sort]") || []) {
      const active = button.dataset.catchGallerySort === sortKey;
      button.classList.toggle("active", active);
      const arrow = button.querySelector(".catch-gallery-sort-arrow");
      if (arrow) {
        arrow.textContent = active
          ? (sortDirection === "asc" ? "↑" : "↓")
          : "↕";
      }
    }
  }

  function render() {
    if (!tbody) return;
    tbody.replaceChildren();

    const rows = filteredSortedRows();
    const paged = paginateCatchGallery(rows, page, CATCH_GALLERY_PAGE_SIZE);
    page = paged.page;

    for (const encounter of paged.rows) {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      const name = document.createElement("span");
      name.className = `catch-gallery-name ${rarityClass(encounter)}`;
      name.title = encounter.speciesName || "";
      if (encounter.isShiny === true) {
        const star = document.createElement("span");
        star.className = "catch-gallery-star";
        star.textContent = "★";
        star.setAttribute("aria-hidden", "true");
        name.appendChild(star);
      }
      name.append(document.createTextNode(encounter.speciesName || "—"));
      nameCell.appendChild(name);

      const dateCell = document.createElement("td");
      dateCell.className = "catch-gallery-date";
      dateCell.textContent = displayTimestamp(encounter.captureAtMs);
      dateCell.title = formatCaptureTimestamp(encounter.captureAtMs);

      const qualityCell = document.createElement("td");
      qualityCell.className = "catch-gallery-number";
      qualityCell.textContent = Number(encounter.qualityMultiplier).toFixed(2);

      const ivCell = document.createElement("td");
      ivCell.className = "catch-gallery-number";
      ivCell.textContent = String(encounter.ivTotal);

      const actionsCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "catch-gallery-actions";

      const copyButton = actionButton({
        text: "Copy",
        title: `Copy ${encounter.speciesName} ticket image to clipboard`,
        onClick: async (button) => {
          const original = button.textContent;
          button.disabled = true;
          button.textContent = "Copying…";
          try {
            await copyTicketImage(encounter);
            button.textContent = "Copied";
            window.setTimeout(() => {
              button.textContent = original;
              button.disabled = false;
            }, 1200);
          } catch (error) {
            console.error("PokePixel Hunt Analyzer (Catch Gallery copy):", error);
            button.title = error?.message || "Could not copy Capture Ticket";
            button.textContent = "Error";
            window.setTimeout(() => {
              button.textContent = original;
              button.disabled = false;
            }, 1600);
          }
        }
      });

      const generateButton = actionButton({
        text: "Generate",
        className: "generate",
        title: `Generate Capture Ticket for ${encounter.speciesName}`,
        onClick: async (button) => {
          const original = button.textContent;
          button.disabled = true;
          button.textContent = "Generating…";
          try {
            await openCaptureTicketPreview(encounter);
            button.textContent = original;
            button.disabled = false;
          } catch (error) {
            console.error("PokePixel Hunt Analyzer (Catch Gallery):", error);
            button.title = error?.message || "Capture Ticket generation failed";
            button.textContent = "Error";
            window.setTimeout(() => {
              button.textContent = original;
              button.disabled = false;
            }, 1600);
          }
        }
      });

      actions.append(copyButton, generateButton);
      actionsCell.appendChild(actions);
      row.append(nameCell, dateCell, qualityCell, ivCell, actionsCell);
      tbody.appendChild(row);
    }

    const needsPagination = paged.totalRows > CATCH_GALLERY_PAGE_SIZE;
    pagination.hidden = !needsPagination;
    previousButton.disabled = paged.page <= 1;
    nextButton.disabled = paged.page >= paged.totalPages;
    pageLabel.textContent = `${paged.page}/${paged.totalPages}`;
    updateSortHeaders();
  }

  async function refresh({ force = false } = {}) {
    if (disposed || !tbody) return;
    if (!force && !dirty) return;
    if (refreshPromise) return refreshPromise;

    refreshPromise = Promise.resolve()
      .then(() => loadEncounters())
      .then((encounters) => {
        if (disposed) return;
        rawEncounters = Array.isArray(encounters) ? encounters : [];
        page = 1;
        render();
        dirty = false;
      })
      .catch((error) => {
        console.error("PokePixel Hunt Analyzer (Catch Gallery load):", error);
        rawEncounters = [];
        page = 1;
        render();
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  function isVisible() {
    return Boolean(shadow?.getElementById(VIEW_ID) && !shadow.getElementById(VIEW_ID).hidden);
  }

  function markDirty() {
    dirty = true;
    if (isVisible()) void refresh();
  }

  function bindSortButtons() {
    for (const button of section.querySelectorAll("[data-catch-gallery-sort]")) {
      button.addEventListener("click", () => {
        const nextKey = button.dataset.catchGallerySort;
        if (sortKey === nextKey) {
          sortDirection = sortDirection === "desc" ? "asc" : "desc";
        } else {
          sortKey = nextKey;
          sortDirection = "desc";
        }
        page = 1;
        render();
      });
    }
  }

  function mountControls() {
    disposed = false;
    shadow = document.getElementById(ROOT_ID)?.shadowRoot || null;
    const view = shadow?.getElementById(VIEW_ID);
    tab = shadow?.getElementById(TAB_ID) || null;
    if (!shadow || !view || !tab) return false;

    shadow.getElementById(SECTION_ID)?.remove();

    if (!shadow.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = STYLES;
      shadow.appendChild(style);
    }

    section = document.createElement("section");
    section.id = SECTION_ID;
    section.className = "section catch-gallery-section";
    section.innerHTML = `
      <div class="section-head">
        <h3>Catch Gallery</h3>
        <div class="catch-gallery-head-meta">
          <button class="collapse-button catch-gallery-collapse" type="button" title="Collapse Catch Gallery" aria-expanded="true">▾</button>
        </div>
      </div>
      <div class="catch-gallery-filters">
        <input type="search" class="catch-gallery-pokemon-filter" placeholder="Filter Pokémon" aria-label="Filter Catch Gallery by Pokémon">
        <select class="catch-gallery-rarity-filter" aria-label="Filter Catch Gallery by rarity">
          <option value="all">All rarities</option>
          <option value="legendary">Legendary</option>
          <option value="mythical">Mythical</option>
          <option value="shiny">Shiny</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="catch-gallery-table">
          <colgroup>
            <col class="catch-gallery-pokemon-col"><col class="catch-gallery-captured-col"><col class="catch-gallery-quality-col"><col class="catch-gallery-iv-col"><col class="catch-gallery-actions-col">
          </colgroup>
          <thead>
            <tr>
              <th>Pokémon</th>
              <th><button type="button" class="catch-gallery-sort active" data-catch-gallery-sort="captured">Captured<span class="catch-gallery-sort-arrow">↓</span></button></th>
              <th><button type="button" class="catch-gallery-sort" data-catch-gallery-sort="quality">Quality<span class="catch-gallery-sort-arrow">↕</span></button></th>
              <th><button type="button" class="catch-gallery-sort" data-catch-gallery-sort="iv">IV<span class="catch-gallery-sort-arrow">↕</span></button></th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="catch-gallery-pagination" hidden>
        <button class="catch-gallery-page-button catch-gallery-prev" type="button">Prev</button>
        <span class="catch-gallery-page-label">1/1</span>
        <button class="catch-gallery-page-button catch-gallery-next" type="button">Next</button>
      </div>`;

    tbody = section.querySelector("tbody");
    pagination = section.querySelector(".catch-gallery-pagination");
    previousButton = section.querySelector(".catch-gallery-prev");
    nextButton = section.querySelector(".catch-gallery-next");
    pageLabel = section.querySelector(".catch-gallery-page-label");
    pokemonFilter = section.querySelector(".catch-gallery-pokemon-filter");
    rarityFilter = section.querySelector(".catch-gallery-rarity-filter");
    collapseButton = section.querySelector(".catch-gallery-collapse");

    pokemonFilter.addEventListener("input", () => {
      page = 1;
      render();
    });
    rarityFilter.addEventListener("change", () => {
      page = 1;
      render();
    });
    previousButton.addEventListener("click", () => {
      page -= 1;
      render();
    });
    nextButton.addEventListener("click", () => {
      page += 1;
      render();
    });
    collapseButton.addEventListener("click", () => {
      const collapsed = section.classList.toggle("collapsed");
      collapseButton.textContent = collapsed ? "▸" : "▾";
      collapseButton.title = collapsed ? "Expand Catch Gallery" : "Collapse Catch Gallery";
      collapseButton.setAttribute("aria-expanded", String(!collapsed));
    });
    bindSortButtons();

    view.appendChild(section);
    rawEncounters = [];
    page = 1;
    render();
    dirty = true;

    if (tab.dataset.catchGalleryBound !== "true") {
      tab.dataset.catchGalleryBound = "true";
      tab.addEventListener("click", () => void refresh({ force: true }));
    }

    return true;
  }

  function dispose() {
    disposed = true;
    section?.remove();
    section = null;
    tbody = null;
    pagination = null;
    previousButton = null;
    nextButton = null;
    pageLabel = null;
    pokemonFilter = null;
    rarityFilter = null;
    collapseButton = null;
    rawEncounters = [];
    shadow = null;
    tab = null;
  }

  return {
    mountControls,
    refresh,
    markDirty,
    dispose
  };
}
