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

:host([data-ui-mode="mobile"]) .history-filter-block {
  position: relative;
  z-index: 10;
  overflow: visible;
}

:host([data-ui-mode="mobile"]) .catch-gallery-section,
:host([data-ui-mode="mobile"]) .catch-gallery-filters {
  overflow: visible;
}

:host([data-ui-mode="mobile"]) .catch-gallery-filters {
  position: relative;
  z-index: 10;
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
  grid-template-columns: repeat(3, minmax(0, 1fr)) 44px;
  gap: 6px;
}

:host([data-ui-mode="mobile"]) .actions button {
  min-height: 44px;
  padding: 7px 6px;
  font-size: 10px;
}

:host([data-ui-mode="mobile"]) .actions .collapse-button {
  width: 44px;
  min-width: 44px;
  height: 44px;
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
  min-height: 44px;
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 11px;
}

:host([data-ui-mode="mobile"]) .encounter-section .rarity-check-menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  min-width: 100%;
  max-height: min(34dvh, 196px);
  margin-top: 0;
  padding: 4px;
  overflow-y: auto;
  box-shadow: 0 6px 18px rgba(0,0,0,.38);
}

:host([data-ui-mode="mobile"]) .encounter-section .rarity-check-option {
  min-height: 44px;
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

/* History Mobile: interaction-only improvements; preserve the original layout. */
:host([data-ui-mode="mobile"]) .history-subtabs .tab {
  min-height: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .history-subtabs .tab:active {
  border-color: #8e7943;
  background: #3a382f;
}

:host([data-ui-mode="mobile"]) .history-more-button {
  min-height: 44px;
  height: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .history-more-button:active {
  border-color: #8e7943;
  background: #3a382f;
}

:host([data-ui-mode="mobile"]) .history-notable-button {
  min-height: 44px;
  height: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .history-notable-button:active:not(:disabled) {
  border-color: #8e7943;
  background: #3a382f;
}

:host([data-ui-mode="mobile"]) .history-hunt-row,
:host([data-ui-mode="mobile"]) .history-pokemon-row,
:host([data-ui-mode="mobile"]) .history-attempt-row {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .history-hunt-row:active > td,
:host([data-ui-mode="mobile"]) .history-pokemon-row:active > td,
:host([data-ui-mode="mobile"]) .history-attempt-row:active > td {
  background: #30312c;
}

:host([data-ui-mode="mobile"]) .history-attempts-table th:nth-child(1),
:host([data-ui-mode="mobile"]) .history-attempts-table td:nth-child(1) { width: 16%; }
:host([data-ui-mode="mobile"]) .history-attempts-table th:nth-child(2),
:host([data-ui-mode="mobile"]) .history-attempts-table td:nth-child(2) { width: 26%; }
:host([data-ui-mode="mobile"]) .history-attempts-table th:nth-child(3),
:host([data-ui-mode="mobile"]) .history-attempts-table td:nth-child(3) { width: 11%; }
:host([data-ui-mode="mobile"]) .history-attempts-table th:nth-child(4),
:host([data-ui-mode="mobile"]) .history-attempts-table td:nth-child(4) { width: 12%; }
:host([data-ui-mode="mobile"]) .history-attempts-table th:nth-child(5),
:host([data-ui-mode="mobile"]) .history-attempts-table td:nth-child(5) { width: 25%; }
:host([data-ui-mode="mobile"]) .history-attempts-table th:nth-child(6),
:host([data-ui-mode="mobile"]) .history-attempts-table td:nth-child(6) { width: 10%; }

/* M6: secondary controls keep their existing layouts while gaining Mobile touch targets. */
:host([data-ui-mode="mobile"]) .alpha-button {
  min-width: 58px;
  height: 44px;
  padding: 0 8px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) #pha-close {
  width: 44px;
  height: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .pha-ui-mode-select {
  height: 44px;
  max-width: 72px;
  padding: 0 4px;
  font-size: 9px;
  touch-action: manipulation;
}

:host([data-ui-mode="mobile"]) .refcode {
  min-height: 44px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .alpha-button:active,
:host([data-ui-mode="mobile"]) #pha-close:active,
:host([data-ui-mode="mobile"]) .refcode:active {
  border-color: #8e7943;
  background: #3a382f;
}

:host([data-ui-mode="mobile"]) .alert-grid {
  grid-template-columns: minmax(64px, .8fr) repeat(2, minmax(0, 1fr));
  gap: 8px 4px;
  padding: 8px 6px;
}

:host([data-ui-mode="mobile"]) .alert-choice-pair {
  gap: 2px;
}

:host([data-ui-mode="mobile"]) .alert-fled-heading,
:host([data-ui-mode="mobile"]) .alert-choice-pair-fled {
  padding-left: 6px;
}

:host([data-ui-mode="mobile"]) .alert-choice {
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .alert-choice input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

:host([data-ui-mode="mobile"]) .custom-audio-manage {
  width: 44px;
  min-width: 44px;
  height: 44px;
  line-height: 42px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .custom-audio-popover {
  top: 48px;
  min-width: min(200px, calc(100vw - 32px));
  padding: 8px;
}

:host([data-ui-mode="mobile"]) .custom-audio-actions button {
  min-height: 44px;
  padding: 6px 8px;
  font-size: 9px;
  touch-action: manipulation;
}

:host([data-ui-mode="mobile"]) .catch-gallery-filters input,
:host([data-ui-mode="mobile"]) .catch-gallery-filters select {
  height: 44px;
  min-height: 44px;
  padding: 8px;
  font-size: 11px;
}

:host([data-ui-mode="mobile"]) .catch-gallery-sort {
  min-height: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .catch-gallery-actions {
  gap: 3px;
}

:host([data-ui-mode="mobile"]) .catch-gallery-action,
:host([data-ui-mode="mobile"]) .catch-gallery-action.generate {
  min-width: 0;
  height: 44px;
  min-height: 44px;
  padding: 0 4px;
  flex: 1 1 0;
  line-height: 1.1;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .catch-gallery-collapse {
  width: 44px;
  min-width: 44px;
  height: 44px;
  touch-action: manipulation;
}

:host([data-ui-mode="mobile"]) .catch-gallery-pagination {
  min-height: 50px;
}

:host([data-ui-mode="mobile"]) .catch-gallery-page-button {
  min-width: 54px;
  height: 44px;
  min-height: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .catch-gallery-action:active:not(:disabled),
:host([data-ui-mode="mobile"]) .catch-gallery-page-button:active:not(:disabled),
:host([data-ui-mode="mobile"]) .catch-gallery-collapse:active,
:host([data-ui-mode="mobile"]) .custom-audio-manage:active,
:host([data-ui-mode="mobile"]) .custom-audio-actions button:active {
  border-color: #8e7943;
  background: #3a382f;
}

:host([data-ui-mode="mobile"]) .history-delete-button {
  min-width: 72px;
  height: 44px;
  min-height: 44px;
  padding: 0 10px;
  line-height: 42px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:host([data-ui-mode="mobile"]) .history-delete-button:active:not(:disabled) {
  border-color: #b45f59;
  background: #432824;
  color: #ffaaa2;
}

@media (orientation: landscape) and (min-width: 640px) {
  :host([data-ui-mode="mobile"]) .metric-cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
`;
