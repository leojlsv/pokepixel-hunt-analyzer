export const STYLES = String.raw`
:host {
  all: initial;
  font-family: Inter, "Segoe UI", Arial, sans-serif;
  color: #f0eee6;
  font-size: 12px;

  --bg: #20211e;
  --bg-elevated: #252621;
  --bg-header: #2b2c27;
  --border: #4b4a43;
  --border-soft: #3d3d37;
  --text: #f0eee6;
  --muted: #aaa79c;
  --gold: #d7b45d;
  --gold-soft: #9d874f;
  --cyan: #79e6f2;
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
  background: #292a26;
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
  background: var(--bg);
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
  background: #2c2c28;
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
.state.active { background: #173b2c; color: #70dfaa; }
.state.standby { background: #4b3520; color: #ffc477; }

.alpha-button,
.icon-button,
.tab,
.actions button,
.collapse-button {
  appearance: none;
  border: 1px solid #55544c;
  border-radius: 3px;
  background: #30312c;
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
  position: sticky;
  top: 46px;
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
  background: #3a382f;
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
#new-hunt { background: #314331; border-color: #597258; color: #cbe2c7; }
#pause-resume { background: #51472a; border-color: #82713c; color: #f0d987; }
#end-hunt { background: #50302e; border-color: #80504b; color: #efbbb5; }
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

.table-wrap { max-height: 245px; overflow: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; white-space: nowrap; }
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
