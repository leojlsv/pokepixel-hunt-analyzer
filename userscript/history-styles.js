export const HISTORY_STYLES = String.raw`
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
  justify-content: flex-end;
  align-items: center;
}

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

.history-hunts-table th:nth-child(1),
.history-hunts-table td:nth-child(1) { width: 94px; }
.history-hunts-table th:nth-child(2),
.history-hunts-table td:nth-child(2) { width: 54px; }
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

.history-notable-list th:nth-child(1),
.history-notable-list td:nth-child(1) { width: 62px; }
.history-notable-list th:nth-child(2),
.history-notable-list td:nth-child(2) { width: 118px; }
.history-notable-list th:nth-child(3),
.history-notable-list td:nth-child(3) { width: 52px; }
.history-notable-list th:nth-child(4),
.history-notable-list td:nth-child(4),
.history-notable-list th:nth-child(5),
.history-notable-list td:nth-child(5) { text-align: right; }

.history-result-captured { color: #70dfaa; }
.history-result-fled { color: #ef8b82; }

.history-pokemon-table th:nth-child(1),
.history-pokemon-table td:nth-child(1) { width: 104px; }
.history-pokemon-table th:nth-child(2),
.history-pokemon-table td:nth-child(2) { width: 34px; text-align: center; }
.history-pokemon-table th:nth-child(n+3),
.history-pokemon-table td:nth-child(n+3) { text-align: right; }

.history-pokemon-detail-row > td {
  padding: 6px 7px;
}

.history-pokemon-rarity-table th:nth-child(1),
.history-pokemon-rarity-table td:nth-child(1) { width: 58px; text-align: left; }
.history-pokemon-rarity-table th:nth-child(2),
.history-pokemon-rarity-table td:nth-child(2) { width: 82px; }
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

.history-attempts-table th:nth-child(1),
.history-attempts-table td:nth-child(1) { width: 62px; }
.history-attempts-table th:nth-child(2),
.history-attempts-table td:nth-child(2) { width: 112px; }
.history-attempts-table th:nth-child(3),
.history-attempts-table td:nth-child(3) { width: 44px; }
.history-attempts-table th:nth-child(4),
.history-attempts-table td:nth-child(4) { width: 52px; }
.history-attempts-table th:nth-child(5),
.history-attempts-table td:nth-child(5),
.history-attempts-table th:nth-child(6),
.history-attempts-table td:nth-child(6) { text-align: right; }

@container analyzer (max-width: 500px) {
  .history-filter-grid {
    gap: 5px;
  }

  .history-filter-grid label,
  .history-table-wrap th { font-size: 8px; }
  .history-filter-grid select,
  .history-table-wrap td { font-size: 9px; }

  .history-hunts-table th:nth-child(1),
  .history-hunts-table td:nth-child(1) { width: 82px; }
  .history-hunts-table th:nth-child(2),
  .history-hunts-table td:nth-child(2) { width: 46px; }

  .history-notable-list th:nth-child(2),
  .history-notable-list td:nth-child(2) { width: 96px; }
}
`;