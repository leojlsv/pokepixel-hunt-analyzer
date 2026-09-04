export const STYLES = String.raw`
:host {
  all: initial;
  font-family: Inter, "Segoe UI", Arial, sans-serif;
  color: #f0eee6;
  font-size: 12px;

  --hunt-surface-canvas: #20211e;
  --hunt-surface-raised: #252621;
  --hunt-surface-header: #2b2c27;
  --hunt-surface-topbar: #2c2c28;
  --hunt-surface-launcher: #292a26;
  --hunt-surface-control: #30312c;
  --hunt-surface-control-active: #3a382f;
  --hunt-border-default: #4b4a43;
  --hunt-border-soft: #3d3d37;
  --hunt-text-primary: #f0eee6;
  --hunt-text-muted: #aaa79c;
  --hunt-accent-primary: #d7b45d;
  --hunt-accent-border: #9d874f;
  --hunt-accent-info: #79e6f2;
  --hunt-focus-ring: var(--hunt-accent-primary);
  --hunt-state-active-bg: #173b2c;
  --hunt-state-active-text: #70dfaa;
  --hunt-state-standby-bg: #4b3520;
  --hunt-state-standby-text: #ffc477;
  --hunt-action-start-bg: #314331;
  --hunt-action-start-border: #597258;
  --hunt-action-start-text: #cbe2c7;
  --hunt-action-pause-bg: #51472a;
  --hunt-action-pause-border: #82713c;
  --hunt-action-pause-text: #f0d987;
  --hunt-action-end-bg: #50302e;
  --hunt-action-end-border: #80504b;
  --hunt-action-end-text: #efbbb5;

  /* Compatibility aliases used by feature styles during gradual migration. */
  --bg: var(--hunt-surface-canvas);
  --bg-elevated: var(--hunt-surface-raised);
  --bg-header: var(--hunt-surface-header);
  --border: var(--hunt-border-default);
  --border-soft: var(--hunt-border-soft);
  --text: var(--hunt-text-primary);
  --muted: var(--hunt-text-muted);
  --gold: var(--hunt-accent-primary);
  --gold-soft: var(--hunt-accent-border);
  --cyan: var(--hunt-accent-info);
}

* {
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: #8e7943 var(--bg);
}

*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-track,
*::-webkit-scrollbar-corner { background: var(--bg); }
*::-webkit-scrollbar-thumb {
  background: #8e7943;
  border: 2px solid var(--bg);
  border-radius: 2px;
}
*::-webkit-scrollbar-thumb:hover { background: #b19857; }

button,
select,
input { font: inherit; }

button { user-select: none; }

button:focus-visible,
select:focus-visible,
input:focus-visible,
[tabindex="0"]:focus-visible,
th.sortable:focus-visible {
  outline: 2px solid var(--hunt-focus-ring);
  outline-offset: 2px;
}

[hidden] { display: none !important; }

.launcher {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  width: 158px;
  height: 48px;
  padding: 5px 9px;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  column-gap: 9px;
  align-items: center;
  border: 1px solid #5b594f;
  border-radius: 5px;
  background: var(--hunt-surface-launcher);
  color: var(--text);
  box-shadow: 0 5px 15px #0009;
  cursor: pointer;
  touch-action: none;
}

.hud-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: #35362f;
  color: var(--gold);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .04em;
}

.hud-content {
  min-width: 0;
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
}

.hud-xp {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 5px;
  line-height: 1;
  white-space: nowrap;
}

.hud-xp span {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
}

.hud-xp strong {
  min-width: 0;
  overflow: hidden;
  color: #b9ad81;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
}

.hud-rarities {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0;
  font-size: 9px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}

.hud-rarities .separator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 1px;
  color: #77746a;
  font-weight: 500;
}

.panel {
  position: fixed;
  right: 16px;
  bottom: 72px;
  z-index: 2147483646;
  width: min(620px, calc(100vw - 16px));
  min-width: 430px;
  min-height: 280px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  overflow: auto;
  resize: both;
  container-type: inline-size;
  container-name: analyzer;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--hunt-surface-canvas);
  color: var(--text);
  box-shadow: 0 10px 26px #000b;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  min-height: 46px;
  padding: 7px 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid var(--border);
  background: var(--hunt-surface-topbar);
  cursor: move;
  touch-action: none;
}

.brand {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.brand strong {
  overflow: hidden;
  color: var(--gold);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.15;
  white-space: nowrap;
}

.refcode {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--cyan);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .14em;
  line-height: 1;
  cursor: pointer;
  box-shadow: none;
  text-shadow: none;
}

.refcode:hover {
  color: #9ceef6;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.state {
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 800;
}
.state.active { background: var(--hunt-state-active-bg); color: var(--hunt-state-active-text); }
.state.standby { background: var(--hunt-state-standby-bg); color: var(--hunt-state-standby-text); }

.alpha-button,
.icon-button,
.tab,
.actions button,
.collapse-button {
  appearance: none;
  border: 1px solid #55544c;
  border-radius: 3px;
  background: var(--hunt-surface-control);
  color: var(--text);
  box-shadow: none;
  cursor: pointer;
}

.alpha-button {
  height: 22px;
  min-width: 52px;
  padding: 0 7px;
  border-color: #665c3d;
  background: #353329;
  color: var(--gold);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
.alpha-button:hover { background: #403c2e; border-color: #8e7943; }

.icon-button {
  width: 24px;
  height: 22px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
}

.tabs {
  position: relative;
  top: auto;
  z-index: 9;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid var(--border-soft);
  background: #242521;
}

.tab { padding: 6px 10px; }
.tab.active {
  border-color: var(--gold-soft);
  background: var(--hunt-surface-control-active);
  color: var(--gold);
}

.hunt-time {
  margin-left: auto;
  padding: 0 4px;
  color: var(--text);
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.02em;
  line-height: 1;
  white-space: nowrap;
}

.view { padding: 10px; }

.current-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.live-card,
.section,
.capture-strip article,
.metric-cards article {
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: var(--bg-elevated);
}

.live-card {
  padding: 9px;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "status actions" "metrics metrics";
  gap: 8px;
  background: #272823;
}

.status-row {
  grid-area: status;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-row > span {
  color: var(--muted);
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.hunt-status {
  padding: 3px 7px;
  border-radius: 999px;
  background: #34352f;
  color: #d1cec4;
  font-size: 10px;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.actions {
  grid-area: actions;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}

.actions button { padding: 5px 8px; font-size: 10px; }
#new-hunt {
  background: var(--hunt-action-start-bg);
  border-color: var(--hunt-action-start-border);
  color: var(--hunt-action-start-text);
}
#pause-resume {
  background: var(--hunt-action-pause-bg);
  border-color: var(--hunt-action-pause-border);
  color: var(--hunt-action-pause-text);
}
#end-hunt {
  background: var(--hunt-action-end-bg);
  border-color: var(--hunt-action-end-border);
  color: var(--hunt-action-end-text);
}
#new-hunt:disabled,
#pause-resume:disabled,
#end-hunt:disabled { opacity: .42; }

.collapse-button {
  width: 24px;
  min-width: 24px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
}
.collapse-button:hover { background: #3a3a34; border-color: #69675e; }

.metric-cards {
  grid-area: metrics;
}

.metric-cards,
.capture-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.metric-cards article,
.capture-strip article {
  min-width: 0;
  min-height: 54px;
  padding: 7px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.metric-cards article > span,
.capture-strip article > span,
.filters label {
  color: #c0ad72;
  font-size: 9px;
  letter-spacing: .025em;
  text-transform: uppercase;
}

.metric-cards article > strong,
.capture-strip article > strong {
  overflow: hidden;
  color: var(--text);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.01em;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-cards article > small {
  margin-top: auto;
  overflow: hidden;
  color: var(--muted);
  font-size: 8px;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section { overflow: hidden; }

.section-head {
  min-height: 34px;
  padding: 7px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-header);
}

.section-head h3 {
  margin: 0;
  color: var(--gold);
  font-size: 11px;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.section-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 9px;
  white-space: nowrap;
}

.section-badge {
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: #38372f;
  color: var(--gold);
  font-size: 9px;
  font-weight: 700;
}

.filters {
  padding: 8px 10px;
  display: flex;
  align-items: flex-end;
  gap: 7px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-elevated);
}

.filters label {
  min-width: 90px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.filters select,
.filters input {
  min-width: 0;
  height: 27px;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  box-shadow: none;
  font-size: 10px;
}

.filters select {
  width: 100%;
  display: block;
  line-height: 15px;
}

:host(:not([data-ui-mode="mobile"])) .filters .shiny-filter-field {
  position: relative;
}

:host(:not([data-ui-mode="mobile"])) .filters .shiny-filter-field select {
  appearance: none;
  padding-right: 22px;
}

:host(:not([data-ui-mode="mobile"])) .filters .shiny-filter-field::after {
  content: "▾";
  position: absolute;
  right: 7px;
  bottom: 8px;
  color: var(--muted);
  line-height: 1;
  pointer-events: none;
}

:host(:not([data-ui-mode="mobile"])) .encounter-section .filters > label,
:host(:not([data-ui-mode="mobile"])) .encounter-section .filters > .filter-field {
  height: 41px;
  display: grid;
  grid-template-rows: 11px 27px;
  gap: 3px;
  align-items: stretch;
}

.table-wrap { max-height: 245px; overflow: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; white-space: nowrap; }
.rarity-table,
.captured-table,
.failed-table { table-layout: fixed; }
.rarity-name-col { width: 28%; }
.rarity-metric-col,
.rarity-rate-col { width: 18%; }
.captured-pokemon-col { width: 20%; }
.captured-gender-col { width: 7%; }
.captured-nature-col { width: 16%; }
.captured-quality-col { width: 12%; }
.captured-iv-col { width: 45%; }
.captured-table { max-width: 100%; }
.captured-table th:last-child { padding-right: 4px; padding-left: 4px; font-size: 9px; }
.captured-table td:not(:last-child) { overflow: hidden; text-overflow: ellipsis; }
.iv-atk { color: #e598b7; font-weight: 700; }
.iv-spatk { color: #7fb3e8; font-weight: 700; }
.failed-pokemon-col { width: 24%; }
.failed-iv-col { width: 10%; }
.failed-ball-col { width: 24%; }
.failed-chance-col { width: 14%; }
.failed-time-col { width: 28%; }
th, td { padding: 5px 9px; text-align: left; border-bottom: 1px solid #383934; }
th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #2a2b27;
  color: #c5b98f;
  font-size: 10px;
}
td { font-size: 11px; }
tbody tr:hover td { background: #30312c; }
tbody tr:last-child td { border-bottom: 0; }

.rarity-section .table-wrap { max-height: 225px; }
.rarity-section td { font-size: 12px; }
.shiny-count { color: var(--gold); font-weight: 800; }

.encounter-section .table-wrap { max-height: 168px; }
#captured-section .table-wrap { overflow-x: hidden; }
.encounter-section th,
.encounter-section td { height: 28px; }
.encounter-row-shiny td { background: #383323; }
.encounter-row-shiny:hover td { background: #443b27; }

.gender { width: 28px; text-align: center; font-size: 12px; font-weight: 700; }
.gender-male { color: #7fb3e8; }
.gender-female { color: #e598b7; }
.iv-cell { font-variant-numeric: tabular-nums; white-space: nowrap; }

.rarity-weak { color: #b8bec5; }
.rarity-common { color: #48d77a; }
.rarity-uncommon { color: #45d7e8; }
.rarity-rare { color: #c58cff; }
.rarity-epic { color: #f0c64f; }
.rarity-legendary { color: #ff9d2e; }
.rarity-mythical { color: #ff6384; }

.rarity-weak,
.rarity-common,
.rarity-uncommon,
.rarity-rare,
.rarity-epic,
.rarity-legendary,
.rarity-mythical {
  text-shadow: none !important;
  box-shadow: none !important;
  filter: none !important;
  background-image: none !important;
}

.section.collapsed > :not(.section-head) { display: none !important; }
.live-card.hunt-collapsed { display: block; padding: 7px; }
.live-card.hunt-collapsed .status-row,
.live-card.hunt-collapsed .metric-cards { display: none; }
.live-card.hunt-collapsed .actions { justify-content: flex-start; }

.compare-view .filters { padding: 0 0 9px; border-bottom: 0; }
.compare-view .table-wrap {
  max-height: 430px;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
}
.compare-view th.sortable { padding-right: 18px; cursor: pointer; user-select: none; }
.compare-view th.sortable::after {
  content: "↕";
  position: absolute;
  right: 6px;
  color: #77746a;
  font-size: 9px;
}
.compare-view th.sort-asc::after { content: "↑"; color: var(--gold); }
.compare-view th.sort-desc::after { content: "↓"; color: var(--gold); }

.resize-bottom-left {
  position: fixed;
  z-index: 2147483647;
  width: 15px;
  height: 15px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: nesw-resize;
  touch-action: none;
}
.resize-bottom-left::before,
.resize-bottom-left::after {
  content: "";
  position: absolute;
  left: 3px;
  bottom: 3px;
  height: 1px;
  background: #8e7943;
  transform: rotate(-45deg);
  transform-origin: left center;
  pointer-events: none;
}
.resize-bottom-left::before { width: 10px; }
.resize-bottom-left::after { width: 6px; bottom: 7px; }

@container analyzer (max-width: 500px) {
  .metric-cards,
  .capture-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
  }

  .metric-cards article,
  .capture-strip article {
    min-height: 52px;
    padding: 6px;
  }

  .metric-cards article > span,
  .capture-strip article > span { font-size: 8.5px; }

  .metric-cards article > strong,
  .capture-strip article > strong { font-size: 14px; }

  .metric-cards article > small { font-size: 7.5px; }
}
`;
