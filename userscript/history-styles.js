export const HISTORY_STYLES = String.raw`
:host(:not([data-ui-mode="mobile"])) .topbar {
  position: sticky;
  top: 0;
  z-index: 20;
}

:host(:not([data-ui-mode="mobile"])) .tabs {
  position: sticky;
  top: 46px;
  z-index: 19;
}

.shiny-section-badge {
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}

#rarity-section td {
  font-size: 11px;
}

.history-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-subtabs {
  display: flex;
  align-items: center;
  gap: 5px;
}

.history-subtabs .tab {
  padding: 5px 9px;
  font-size: 10px;
}

.history-filter-block {
  overflow: hidden;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: var(--bg-elevated);
}

.history-filter-grid {
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  align-items: end;
}

.history-filter-grid-advanced {
  padding-top: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.history-filter-grid label {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: #c0ad72;
  font-size: 9px;
  letter-spacing: .025em;
  text-transform: uppercase;
}

.history-filter-grid select {
  min-width: 0;
  height: 27px;
  padding: 4px 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  box-shadow: none;
  font-size: 10px;
}

.history-more-button {
  margin: 0 8px 8px;
  height: 22px;
  padding: 0 7px;
  border: 1px solid #55544c;
  border-radius: 3px;
  background: #30312c;
  color: #c0ad72;
  font-size: 9px;
  cursor: pointer;
}

.history-toolbar {
  min-height: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  align-items: center;
}

.history-toolbar > .section-badge {
  flex: 1 1 120px;
  min-width: 0;
}
.history-toolbar > .section-badge:focus {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}

.history-load-more {
  margin: 0;
}

.history-refresh {
  margin: 0;
}
.history-refresh-dirty {
  border-color: var(--gold-soft);
  color: var(--gold);
}

.history-load-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  color: var(--text);
  font-size: 10px;
}
.history-load-error[hidden] { display: none; }
.history-load-error .history-more-button { margin: 0 0 0 auto; }

.history-table-wrap {
  max-height: 430px;
  overflow: auto;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
}

.history-table-wrap table {
  table-layout: fixed;
}

.history-table-wrap th,
.history-table-wrap td {
  overflow: hidden;
  padding: 5px 5px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.history-table-wrap th {
  font-size: 9px;
}

.history-table-wrap td {
  font-size: 10px;
}

.history-hunt-date-col { width: 24%; }
.history-hunt-duration-col { width: 14%; }
.history-hunt-metric-col { width: 12%; }
.history-hunt-priority-col { width: 12.666%; }
.history-hunts-table th:nth-child(n+3),
.history-hunts-table td:nth-child(n+3) { text-align: right; }

.history-hunt-row,
.history-attempt-row,
.history-pokemon-row {
  cursor: pointer;
}

.history-hunt-row[aria-expanded="true"] td,
.history-attempt-row[aria-expanded="true"] td,
.history-pokemon-row[aria-expanded="true"] td {
  background: #30312c;
}

.history-priority-cell {
  color: #d9c680;
  font-weight: 700;
}

.history-detail-row td {
  height: auto;
  padding: 7px;
  background: #22231f;
  color: #c7c3b7;
  white-space: normal;
}

.history-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 8px;
}

.history-detail-grid > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-detail-grid b {
  color: #9e9270;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: .03em;
  text-transform: uppercase;
}

.history-detail-grid strong {
  overflow: hidden;
  color: var(--text);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-detail-grid .value-positive { color: #70dfaa; }
.history-detail-grid .value-negative { color: #ef8b82; }

.history-fled-line {
  margin-top: 7px;
  padding-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border-top: 1px solid #3a3a34;
  font-size: 9px;
  line-height: 1;
  white-space: nowrap;
}

.history-fled-line b {
  flex: 0 0 auto;
  color: #9e9270;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .03em;
  text-transform: uppercase;
}

.history-fled-line span {
  flex: 0 0 auto;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.history-fled-line i {
  flex: 0 0 auto;
  color: #77746a;
  font-style: normal;
  font-weight: 500;
}

.history-notables {
  margin-top: 7px;
}

.history-notable-controls {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.history-notable-controls > b {
  margin-right: 1px;
  color: #9e9270;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .03em;
  text-transform: uppercase;
}

.history-notable-button {
  height: 21px;
  min-width: 50px;
  padding: 0 7px;
  border: 1px solid #4f4e47;
  border-radius: 3px;
  background: #2b2c27;
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
}

.history-notable-button:hover:not(:disabled),
.history-notable-button.active {
  border-color: #8e7943;
  background: #37352c;
}

.history-notable-button:disabled {
  opacity: .38;
  cursor: default;
}

.history-notable-list {
  max-height: 154px;
  margin-top: 6px;
  overflow: auto;
  border: 1px solid #3d3d37;
  border-radius: 3px;
  background: #20211e;
}

.history-notable-list table,
.history-pokemon-rarity-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.history-notable-list th,
.history-notable-list td,
.history-pokemon-rarity-table th,
.history-pokemon-rarity-table td {
  height: 25px;
  padding: 4px 6px;
  overflow: hidden;
  border-bottom: 1px solid #383934;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-notable-list th,
.history-pokemon-rarity-table th {
  background: #2a2b27;
  color: #c5b98f;
}

.history-notable-time-col { width: 18%; }
.history-notable-pokemon-col { width: 22%; }
.history-notable-result-col { width: 10%; }
.history-notable-ball-col { width: 20%; }
.history-notable-chance-col { width: 20%; }
.history-notable-iv-col { width: 10%; }
.history-notable-list th:nth-child(4),
.history-notable-list td:nth-child(4) { text-align: left; }
.history-notable-list th:nth-child(5),
.history-notable-list td:nth-child(5),
.history-notable-list th:nth-child(6),
.history-notable-list td:nth-child(6) { text-align: right; }

.history-result-captured { color: #70dfaa; }
.history-result-fled { color: #ef8b82; }

.history-pokemon-name-col { width: 26%; }
.history-pokemon-level-col { width: 9%; }
.history-pokemon-count-col { width: 11%; }
.history-pokemon-rate-col { width: 13%; }
.history-pokemon-output-col { width: 15%; }
.history-pokemon-table th:nth-child(2),
.history-pokemon-table td:nth-child(2) { text-align: center; }
.history-pokemon-table th:nth-child(n+3),
.history-pokemon-table td:nth-child(n+3) { text-align: right; }

.history-pokemon-detail-row > td {
  padding: 6px 7px;
}

.history-pokemon-rarity-name-col { width: 18%; }
.history-pokemon-rarity-metric-col { width: 20.5%; }
.history-pokemon-rarity-table th:nth-child(1),
.history-pokemon-rarity-table td:nth-child(1) { text-align: left; }
.history-pokemon-rarity-table tbody tr { font-weight: 650; }
.history-pokemon-rarity-table th:nth-child(n+2),
.history-pokemon-rarity-table td:nth-child(n+2) { text-align: right; }

.history-pokemon-rarity-table tbody tr.rarity-weak td:first-child { color: #b8bec5; }
.history-pokemon-rarity-table tbody tr.rarity-common td:first-child { color: #48d77a; }
.history-pokemon-rarity-table tbody tr.rarity-uncommon td:first-child { color: #45d7e8; }
.history-pokemon-rarity-table tbody tr.rarity-rare td:first-child { color: #c58cff; }
.history-pokemon-rarity-table tbody tr.rarity-epic td:first-child { color: #f0c64f; }
.history-pokemon-rarity-table tbody tr.rarity-legendary td:first-child { color: #ff9d2e; }
.history-pokemon-rarity-table tbody tr.rarity-mythical td:first-child { color: #ff6384; }

.history-attempt-time-col { width: 16%; }
.history-attempt-pokemon-col { width: 27%; }
.history-attempt-result-col { width: 11%; }
.history-attempt-ball-col { width: 22%; }
.history-attempt-chance-col { width: 14%; }
.history-attempt-iv-col { width: 10%; }
.history-attempts-table th:nth-child(4),
.history-attempts-table td:nth-child(4) { text-align: left; }
.history-attempts-table th:nth-child(5),
.history-attempts-table td:nth-child(5),
.history-attempts-table th:nth-child(6),
.history-attempts-table td:nth-child(6) { text-align: right; }

/* History > Loot groups observed items; monetary totals belong to encounters,
 * never to individual items, because the protocol does not price each drop. */
.history-loot-panel {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.history-loot-panel[hidden] { display: none; }

.history-loot-scope {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 9px;
}

.history-loot-scope > label,
.history-loot-scope .history-loot-scope-field > span {
  color: var(--gold);
  font-weight: 700;
  text-transform: uppercase;
}

.history-loot-scope-field {
  display: flex;
  flex: 1 1 155px;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  max-width: 190px;
}

.history-loot-scope .rarity-multiselect {
  width: 100%;
}

.history-loot-scope #history-loot-coverage {
  flex: 1 1 100%;
}

.history-loot-scope select {
  width: 100%;
  min-width: 0;
  height: 27px;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  font-size: 10px;
}

.history-loot-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.history-loot-summary article {
  min-width: 0;
  padding: 7px 5px;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  background: var(--bg-elevated);
  text-align: center;
}

.history-loot-summary span {
  display: block;
  color: var(--muted);
  font-size: 9px;
  white-space: nowrap;
}

.history-loot-summary strong {
  display: block;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-loot-summary article:last-child strong { color: var(--gold); }

.history-loot-help {
  margin: 0;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.3;
}

.history-loot-item-col { width: 57%; }
.history-loot-qty-col { width: 24%; }
.history-loot-drops-col { width: 19%; }
.history-loot-table th:nth-child(n+2),
.history-loot-table > tbody > tr.history-loot-row > td:nth-child(n+2) { text-align: right; }

.history-loot-row { cursor: pointer; }
.history-loot-row[aria-expanded="true"] > td { background: var(--bg-elevated); }
.history-loot-row:focus-visible { outline: 2px solid var(--gold); outline-offset: -2px; }
.history-loot-row > td:first-child { min-width: 0; }
.history-loot-item-name {
  display: block;
  overflow: hidden;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-loot-row small {
  display: block;
  overflow: hidden;
  color: var(--muted);
  font-size: 8px;
  text-overflow: ellipsis;
}
.history-loot-detail-row > td { padding: 7px; }
.history-loot-detail-row strong {
  display: block;
  margin-bottom: 5px;
  color: var(--gold);
  font-size: 9px;
}
.history-loot-sources-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.history-loot-sources-table th,
.history-loot-sources-table td {
  padding: 4px 6px;
  border-bottom: 1px solid var(--border-soft);
  font-size: 9px;
}
.history-loot-sources-table th:first-child { width: 57%; }
.history-loot-sources-table th:nth-child(n+2),
.history-loot-sources-table td:nth-child(n+2) { text-align: right; }
.history-loot-empty td { padding: 16px 8px; color: var(--muted); text-align: center; white-space: normal; }

/* Current > Failed: reserve enough room for a full 100.000% chance. */
.failed-chance-col { width: 18%; }
.failed-time-col { width: 24%; }

@container analyzer (max-width: 500px) {
  .history-filter-grid {
    gap: 5px;
  }

  .history-filter-grid label,
  .history-table-wrap th { font-size: 8px; }
  .history-filter-grid select,
  .history-table-wrap td { font-size: 9px; }

}
`;
