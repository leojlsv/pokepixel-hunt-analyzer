export const MOBILE_STYLES = String.raw`
.pha-ui-mode-select {
  height: 18px;
  max-width: 62px;
  padding: 0 2px;
  border: 1px solid #4b4a43;
  border-radius: 3px;
  background: #20211e;
  color: #aaa79c;
  font-size: 8px;
  line-height: 1;
}

:host([data-ui-mode="mobile"]) {
  --pha-safe-top: env(safe-area-inset-top, 0px);
  --pha-safe-right: env(safe-area-inset-right, 0px);
  --pha-safe-bottom: env(safe-area-inset-bottom, 0px);
  --pha-safe-left: env(safe-area-inset-left, 0px);
}

:host([data-ui-mode="mobile"]) .panel {
  position: fixed !important;
  inset: 0 auto auto 0 !important;
  width: 100vw !important;
  min-width: 0 !important;
  max-width: none !important;
  height: 100vh !important;
  height: 100dvh !important;
  min-height: 0 !important;
  max-height: none !important;
  padding: var(--pha-safe-top) var(--pha-safe-right) var(--pha-safe-bottom) var(--pha-safe-left);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  resize: none;
  border-radius: 0;
  scrollbar-gutter: auto;
}

:host([data-ui-mode="mobile"]) .panel[hidden] {
  display: none !important;
}

:host([data-ui-mode="mobile"]) .topbar {
  position: relative;
  top: auto;
  flex: 0 0 auto;
  cursor: default;
  touch-action: auto;
}

:host([data-ui-mode="mobile"]) .tabs {
  position: relative;
  top: auto;
  flex: 0 0 auto;
  min-height: 44px;
  padding: 5px 8px;
}

:host([data-ui-mode="mobile"]) .tabs .tab {
  min-height: 36px;
  padding: 7px 12px;
}

:host([data-ui-mode="mobile"]) .hunt-time {
  font-size: 14px;
}

:host([data-ui-mode="mobile"]) .view {
  min-height: 0;
  flex: 1 1 auto;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}

:host([data-ui-mode="mobile"]) .current-view,
:host([data-ui-mode="mobile"]) .history-view {
  min-width: 0;
}

:host([data-ui-mode="mobile"]) .current-view {
  gap: 8px;
  padding: 8px;
}

:host([data-ui-mode="mobile"]) .live-card {
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "status"
    "actions"
    "metrics";
  gap: 8px;
  padding: 8px;
}

:host([data-ui-mode="mobile"]) .status-row {
  width: 100%;
  min-height: 30px;
  justify-content: space-between;
  gap: 8px;
}

:host([data-ui-mode="mobile"]) .status-row > span {
  min-width: 0;
  overflow: hidden;
  color: var(--gold);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:host([data-ui-mode="mobile"]) .hunt-status {
  flex: 0 0 auto;
  padding: 4px 8px;
  font-size: 9px;
}

:host([data-ui-mode="mobile"]) .actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) 42px;
  gap: 6px;
}

:host([data-ui-mode="mobile"]) .actions button {
  min-height: 42px;
  padding: 7px 6px;
  font-size: 10px;
}

:host([data-ui-mode="mobile"]) .actions .collapse-button {
  width: 42px;
  min-width: 42px;
  height: 42px;
  padding: 0;
}

:host([data-ui-mode="mobile"]) .live-card.hunt-collapsed {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: "status actions";
  gap: 8px;
  padding: 8px;
}

:host([data-ui-mode="mobile"]) .live-card.hunt-collapsed .status-row {
  display: flex;
}

:host([data-ui-mode="mobile"]) .live-card.hunt-collapsed .metric-cards {
  display: none;
}

:host([data-ui-mode="mobile"]) .live-card.hunt-collapsed .actions {
  display: flex;
  justify-content: flex-end;
}

:host([data-ui-mode="mobile"]) .live-card.hunt-collapsed .actions > :not(.collapse-button) {
  display: none;
}

:host([data-ui-mode="mobile"]) .metric-cards,
:host([data-ui-mode="mobile"]) .capture-strip {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

:host([data-ui-mode="mobile"]) .metric-cards article,
:host([data-ui-mode="mobile"]) .capture-strip article {
  min-height: 60px;
  padding: 8px;
  gap: 4px;
}

:host([data-ui-mode="mobile"]) .metric-cards article > span,
:host([data-ui-mode="mobile"]) .capture-strip article > span {
  font-size: 9px;
}

:host([data-ui-mode="mobile"]) .metric-cards article > strong,
:host([data-ui-mode="mobile"]) .capture-strip article > strong {
  font-size: 17px;
}

:host([data-ui-mode="mobile"]) .metric-cards article > small {
  font-size: 9px;
}

:host([data-ui-mode="mobile"]) #rarity-section {
  overflow: hidden;
}

:host([data-ui-mode="mobile"]) #rarity-section .section-head {
  position: relative;
  min-height: 44px;
  padding: 5px 8px 5px 10px;
}

:host([data-ui-mode="mobile"]) #rarity-section .section-meta {
  gap: 4px;
  padding-right: 34px;
  pointer-events: none;
}

:host([data-ui-mode="mobile"]) #rarity-section .collapse-button {
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

:host([data-ui-mode="mobile"]) #rarity-section .collapse-button:active {
  background: rgba(255,255,255,.035);
}

:host([data-ui-mode="mobile"]) #rarity-section .table-wrap {
  max-height: none;
  overflow-x: hidden;
  overflow-y: visible;
}

:host([data-ui-mode="mobile"]) #rarity-section table {
  width: 100%;
  table-layout: fixed;
  white-space: nowrap;
}

:host([data-ui-mode="mobile"]) #rarity-section th,
:host([data-ui-mode="mobile"]) #rarity-section td {
  padding: 6px 4px;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
}

:host([data-ui-mode="mobile"]) #rarity-section th:first-child,
:host([data-ui-mode="mobile"]) #rarity-section td:first-child {
  width: 28%;
  padding-left: 8px;
}

:host([data-ui-mode="mobile"]) #rarity-section th:not(:first-child),
:host([data-ui-mode="mobile"]) #rarity-section td:not(:first-child) {
  width: 18%;
  text-align: right;
}

:host([data-ui-mode="mobile"]) .resize-bottom-left {
  display: none !important;
}

:host([data-ui-mode="mobile"]) .launcher {
  right: calc(8px + var(--pha-safe-right));
  bottom: calc(8px + var(--pha-safe-bottom));
}

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
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 11px;
}

:host([data-ui-mode="mobile"]) .encounter-section .rarity-check-menu {
  position: static;
  width: 100%;
  max-height: none;
  margin-top: 4px;
  padding: 4px;
  box-shadow: none;
}

:host([data-ui-mode="mobile"]) .encounter-section .rarity-check-option {
  min-height: 40px;
  padding: 8px;
  gap: 10px;
  font-size: 11px;
}

:host([data-ui-mode="mobile"]) .encounter-section .rarity-check-option input {
  width: 18px;
  min-width: 18px;
  height: 18px;
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
  display: block;
}

:host([data-ui-mode="mobile"]) .encounter-section th[data-encounter-sort] {
  min-height: 40px;
  padding-top: 10px;
  padding-bottom: 10px;
  touch-action: manipulation;
}

@media (orientation: landscape) and (min-width: 640px) {
  :host([data-ui-mode="mobile"]) .metric-cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
`;