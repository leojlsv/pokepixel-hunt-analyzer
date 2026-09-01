import fs from "node:fs";

function replaceOnce(text, oldValue, newValue, label) {
  if (text.includes(newValue)) return text;
  if (!text.includes(oldValue)) throw new Error(`Missing patch anchor: ${label}`);
  return text.replace(oldValue, newValue);
}

let text = fs.readFileSync("userscript/current-view.js", "utf8");

const oldImport = 'import { latestSpeciesEncounter } from "./hunt-view-model.js";\n';
const newImport = `${oldImport}import { createMobileEncounterRenderer } from "./mobile-encounter-renderer.js";\n`;
text = replaceOnce(text, oldImport, newImport, "renderer import");

const oldLists = `  const lists = {
    captured: createListState("captured"),
    failed: createListState("failed")
  };

  bindListControls("captured");`;
const newLists = `  const lists = {
    captured: createListState("captured"),
    failed: createListState("failed")
  };
  const mobileEncounterRenderer = shadow.host?.dataset.uiMode === "mobile"
    ? createMobileEncounterRenderer(shadow, {
        onSort(prefix, sort) {
          lists[prefix].sort = sort;
          updateSortIndicators(prefix);
          rebuildEncounterList(prefix, { resetScroll: false });
        },
        onNeedMore(prefix) {
          appendEncounterBatch(prefix);
        },
        onToggleCaptured(encounterId) {
          toggleEncounterDetail("captured", encounterId);
        }
      })
    : null;

  bindListControls("captured");`;
text = replaceOnce(text, oldLists, newLists, "renderer initialization");

const helperMarker = "  function updateSortIndicators(prefix) {";
const helper = `  function renderMobileEncounterList(prefix) {
    if (!mobileEncounterRenderer) return;
    const state = lists[prefix];
    mobileEncounterRenderer.render(
      prefix,
      state.visible.slice(0, state.renderedCount),
      {
        expandedIds: state.expandedIds,
        currentHuntStartedAtMs,
        sort: state.sort
      }
    );
  }

`;
if (!text.includes(helper)) {
  if (!text.includes(helperMarker)) throw new Error("Missing patch anchor: mobile render helper");
  text = text.replace(helperMarker, helper + helperMarker);
}

const oldSortEnd = `    for (const header of shadow.querySelectorAll(\`[data-encounter-sort="\${prefix}"]\`)) {
      const indicator = header.querySelector("[data-sort-indicator]");
      if (!indicator) continue;
      indicator.textContent = header.dataset.sortKey === state.sort.key
        ? state.sort.direction === "desc" ? "▼" : "▲"
        : "";
    }
  }

  function rebuildEncounterList`;
const newSortEnd = `    for (const header of shadow.querySelectorAll(\`[data-encounter-sort="\${prefix}"]\`)) {
      const indicator = header.querySelector("[data-sort-indicator]");
      if (!indicator) continue;
      indicator.textContent = header.dataset.sortKey === state.sort.key
        ? state.sort.direction === "desc" ? "▼" : "▲"
        : "";
    }
    mobileEncounterRenderer?.syncSort(prefix, state.sort);
  }

  function rebuildEncounterList`;
text = replaceOnce(text, oldSortEnd, newSortEnd, "sort sync");

text = replaceOnce(
  text,
  `    body.replaceChildren();\n    if (resetScroll && tableWrap) tableWrap.scrollTop = 0;`,
  `    body.replaceChildren();\n    renderMobileEncounterList(prefix);\n    if (resetScroll && tableWrap) tableWrap.scrollTop = 0;`,
  "mobile list clear"
);

text = replaceOnce(
  text,
  `      body.appendChild(fragment);\n      state.renderedCount = end;\n      state.rendering = false;`,
  `      body.appendChild(fragment);\n      state.renderedCount = end;\n      state.rendering = false;\n      renderMobileEncounterList(prefix);`,
  "mobile batch render"
);

text = replaceOnce(
  text,
  `    state.renderedCount = desiredRenderedCount;\n  }\n\n  function createEncounterRow`,
  `    state.renderedCount = desiredRenderedCount;\n    renderMobileEncounterList(prefix);\n  }\n\n  function createEncounterRow`,
  "mobile upsert render"
);

text = replaceOnce(
  text,
  `      rowState.detail = null;\n      rowState.main.setAttribute("aria-expanded", "false");\n      return;`,
  `      rowState.detail = null;\n      rowState.main.setAttribute("aria-expanded", "false");\n      renderMobileEncounterList(prefix);\n      return;`,
  "mobile collapse render"
);

text = replaceOnce(
  text,
  `    rowState.main.setAttribute("aria-expanded", "true");\n    rowState.main.after(detail);\n  }\n\n  function updateCount`,
  `    rowState.main.setAttribute("aria-expanded", "true");\n    rowState.main.after(detail);\n    renderMobileEncounterList(prefix);\n  }\n\n  function updateCount`,
  "mobile expand render"
);

fs.writeFileSync("userscript/current-view.js", text);

let css = fs.readFileSync("userscript/mobile-styles.js", "utf8");
const mediaMarker = '@media (orientation: landscape) and (min-width: 640px) {';
const m3Css = String.raw`
:host([data-ui-mode="mobile"]) .encounter-section .filters {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 8px;
  padding: 8px;
}

:host([data-ui-mode="mobile"]) .encounter-section .filters label,
:host([data-ui-mode="mobile"]) .encounter-section .filters .filter-field {
  min-width: 0;
}

:host([data-ui-mode="mobile"]) .encounter-section .filters select,
:host([data-ui-mode="mobile"]) .encounter-section .filters input,
:host([data-ui-mode="mobile"]) .encounter-section .rarity-multiselect summary {
  min-height: 42px;
  font-size: 11px;
}

:host([data-ui-mode="mobile"]) .encounter-section .filter-field:has(.rarity-multiselect) {
  grid-column: 1 / -1;
}

:host([data-ui-mode="mobile"]) .encounter-section .rarity-check-menu {
  position: static;
  width: 100%;
  max-height: none;
  margin-top: 4px;
  box-shadow: none;
}

:host([data-ui-mode="mobile"]) .encounter-section .rarity-check-option {
  min-height: 38px;
}

:host([data-ui-mode="mobile"]) .mobile-sort-field {
  grid-column: 1 / -1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: #c0ad72;
  font-size: 9px;
  letter-spacing: .025em;
  text-transform: uppercase;
}

:host([data-ui-mode="mobile"]) .encounter-section .section-head {
  position: relative;
  min-height: 44px;
}

:host([data-ui-mode="mobile"]) .encounter-section .section-meta {
  padding-right: 34px;
  pointer-events: none;
}

:host([data-ui-mode="mobile"]) .encounter-section .collapse-button {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  min-width: 100%;
  height: 100%;
  padding: 0 10px 0 0;
  justify-content: flex-end;
  border: 0;
  background: transparent;
  pointer-events: auto;
}

:host([data-ui-mode="mobile"]) .encounter-section .collapse-button:active {
  background: rgba(255,255,255,.035);
}

:host([data-ui-mode="mobile"]) .encounter-section .table-wrap {
  display: none !important;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-list {
  width: 100%;
  min-width: 0;
  padding: 8px;
  display: grid;
  gap: 7px;
  overflow: visible;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-card {
  min-width: 0;
  padding: 10px;
  display: grid;
  gap: 6px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: #272823;
  color: var(--text);
  touch-action: manipulation;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-card-captured { cursor: pointer; }
:host([data-ui-mode="mobile"]) .mobile-encounter-card:active { background: #30312c; }
:host([data-ui-mode="mobile"]) .mobile-encounter-card:focus-visible {
  outline: 2px solid var(--gold-soft);
  outline-offset: 1px;
}
:host([data-ui-mode="mobile"]) .encounter-card-shiny { background: #383323; }

:host([data-ui-mode="mobile"]) .mobile-encounter-card-top,
:host([data-ui-mode="mobile"]) .mobile-encounter-card-meta,
:host([data-ui-mode="mobile"]) .mobile-encounter-card-footer {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-name {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-iv {
  flex: 0 0 auto;
  color: var(--text);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-card-meta,
:host([data-ui-mode="mobile"]) .mobile-encounter-card-footer {
  color: var(--muted);
  font-size: 10px;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-card-meta > span,
:host([data-ui-mode="mobile"]) .mobile-encounter-card-footer > span,
:host([data-ui-mode="mobile"]) .mobile-encounter-card-footer > time {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-time {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-chevron {
  flex: 0 0 auto;
  color: var(--gold);
  font-size: 13px;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-detail {
  margin-top: 3px;
  padding-top: 8px;
  display: grid;
  gap: 7px;
  border-top: 1px solid var(--border-soft);
}

:host([data-ui-mode="mobile"]) .mobile-encounter-iv-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-iv-grid > span {
  min-width: 0;
  padding: 5px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  border-radius: 3px;
  background: #22231f;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-iv-grid small {
  color: var(--muted);
  font-size: 8px;
}
:host([data-ui-mode="mobile"]) .mobile-encounter-iv-grid strong {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

:host([data-ui-mode="mobile"]) .mobile-encounter-detail-row {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 9px;
}
:host([data-ui-mode="mobile"]) .mobile-encounter-detail-label { color: #c0ad72; }
:host([data-ui-mode="mobile"]) .mobile-encounter-detail-value {
  min-width: 0;
  overflow: hidden;
  color: #c7c3b7;
  font-size: 9px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

`;
if (!css.includes('.mobile-encounter-list {')) {
  if (!css.includes(mediaMarker)) throw new Error("Missing patch anchor: mobile media block");
  css = css.replace(mediaMarker, m3Css + mediaMarker);
}
fs.writeFileSync("userscript/mobile-styles.js", css);
