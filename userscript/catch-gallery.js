import { canGenerateCaptureTicket } from "../domain/captureTicket.js";
import { formatCaptureTimestamp } from "./encounter-list-model.js";
import { openCaptureTicketPreview } from "./capture-ticket.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const TAB_ID = "alerts-tab";
const VIEW_ID = "view-alerts";
const SECTION_ID = "catch-gallery";
const STYLE_ID = "pha-catch-gallery-styles";
const EMPTY_ROWS = 4;

const STYLES = `
  .catch-gallery-section .table-wrap {
    max-height: 230px;
  }

  .catch-gallery-table {
    table-layout: fixed;
  }

  .catch-gallery-table th,
  .catch-gallery-table td {
    height: 29px;
    padding: 5px 8px;
    vertical-align: middle;
  }

  .catch-gallery-table th:nth-child(1) { width: 31%; }
  .catch-gallery-table th:nth-child(2) { width: 25%; }
  .catch-gallery-table th:nth-child(3) { width: 13%; text-align: right; }
  .catch-gallery-table th:nth-child(4) { width: 10%; text-align: right; }
  .catch-gallery-table th:nth-child(5) { width: 21%; text-align: right; }

  .catch-gallery-table td:nth-child(3),
  .catch-gallery-table td:nth-child(4),
  .catch-gallery-table td:nth-child(5) {
    text-align: right;
  }

  .catch-gallery-name {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .catch-gallery-shiny {
    color: #cfd5de !important;
  }

  .catch-gallery-star {
    flex: 0 0 auto;
    margin-right: 4px;
    color: #e4e7ec;
    font-size: 10px;
    line-height: 1;
  }

  .catch-gallery-date {
    overflow: hidden;
    color: var(--muted);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .catch-gallery-number {
    color: #d8d4c9;
    font-variant-numeric: tabular-nums;
  }

  .catch-gallery-generate {
    min-width: 66px;
    height: 21px;
    padding: 0 6px;
    border: 1px solid #5b594f;
    border-radius: 3px;
    background: #30312c;
    color: #dccd95;
    font-size: 9px;
    line-height: 19px;
    white-space: nowrap;
    cursor: pointer;
  }

  .catch-gallery-generate:hover {
    border-color: #81764f;
    background: #3a392f;
  }

  .catch-gallery-generate:disabled {
    cursor: default;
    opacity: .55;
  }

  .catch-gallery-empty td {
    height: 29px;
    color: transparent;
    user-select: none;
  }
`;

function displayTimestamp(value) {
  const formatted = formatCaptureTimestamp(value);
  return formatted === "—" ? "" : formatted.slice(0, 16);
}

function sortNewestFirst(a, b) {
  return (Number(b.captureAtMs) || 0) - (Number(a.captureAtMs) || 0);
}

function eligibleCaptures(encounters) {
  return (Array.isArray(encounters) ? encounters : [])
    .filter(canGenerateCaptureTicket)
    .sort(sortNewestFirst);
}

function createEmptyRow() {
  const row = document.createElement("tr");
  row.className = "catch-gallery-empty";
  row.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 5; index += 1) {
    const cell = document.createElement("td");
    cell.textContent = "·";
    row.appendChild(cell);
  }
  return row;
}

function rarityClass(encounter) {
  return encounter.isShiny === true
    ? "catch-gallery-shiny"
    : `rarity-${encounter.quality}`;
}

export function createCatchGallery({ loadEncounters }) {
  let shadow = null;
  let tab = null;
  let section = null;
  let tbody = null;
  let dirty = true;
  let refreshPromise = null;
  let disposed = false;

  function render(encounters) {
    if (!tbody) return;
    tbody.replaceChildren();

    const rows = eligibleCaptures(encounters);
    if (!rows.length) {
      for (let index = 0; index < EMPTY_ROWS; index += 1) {
        tbody.appendChild(createEmptyRow());
      }
      return;
    }

    for (const encounter of rows) {
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

      const actionCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "catch-gallery-generate";
      button.textContent = "Generate";
      button.title = `Generate Capture Ticket for ${encounter.speciesName}`;
      button.addEventListener("click", async () => {
        const original = button.textContent;
        button.disabled = true;
        button.textContent = "Generating…";
        try {
          await openCaptureTicketPreview(encounter);
          button.textContent = original;
          button.disabled = false;
        } catch (error) {
          console.error("PokePixel Hunt Analyzer (Catch Gallery):", error);
          button.textContent = "Error";
          window.setTimeout(() => {
            button.textContent = original;
            button.disabled = false;
          }, 1600);
        }
      });
      actionCell.appendChild(button);

      row.append(nameCell, dateCell, qualityCell, ivCell, actionCell);
      tbody.appendChild(row);
    }
  }

  async function refresh({ force = false } = {}) {
    if (disposed || !tbody) return;
    if (!force && !dirty) return;
    if (refreshPromise) return refreshPromise;

    refreshPromise = Promise.resolve()
      .then(() => loadEncounters())
      .then((encounters) => {
        if (disposed) return;
        render(encounters);
        dirty = false;
      })
      .catch((error) => {
        console.error("PokePixel Hunt Analyzer (Catch Gallery load):", error);
        render([]);
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
      </div>
      <div class="table-wrap">
        <table class="catch-gallery-table">
          <thead>
            <tr>
              <th>Pokémon</th>
              <th>Captured</th>
              <th>Quality</th>
              <th>IV</th>
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>`;

    tbody = section.querySelector("tbody");
    view.appendChild(section);
    render([]);
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
