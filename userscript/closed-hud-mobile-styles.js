import "./closed-hud-one-column.js";

export const MOBILE_CLOSED_HUD_STYLES = String.raw`
#pha-toggle.pha-custom-hud[data-hud-columns="1"] {
  width: 145px !important;
  min-width: 145px !important;
}

#pha-toggle.pha-custom-hud[data-hud-columns="1"] .pha-hud-grid {
  grid-template-columns: minmax(0, 1fr) !important;
  grid-template-rows: repeat(2, minmax(0, 1fr)) !important;
  column-gap: 0 !important;
}

#pha-toggle.pha-custom-hud[data-hud-columns="1"] [data-hud-slot="1"],
#pha-toggle.pha-custom-hud[data-hud-columns="1"] [data-hud-slot="3"] {
  display: none !important;
}

#pha-toggle.pha-custom-hud[data-hud-columns="1"] .pha-hud-slot.is-wide {
  grid-column: span 1 !important;
}

.pha-hud-slot-config[data-hud-one-hidden="true"] {
  display: none !important;
}

:host([data-ui-mode="mobile"]) #pha-toggle.pha-custom-hud {
  width: 220px !important;
  min-width: 0 !important;
  max-width: calc(100vw - var(--pha-safe-left) - var(--pha-safe-right) - 16px) !important;
  height: 52px !important;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
}

:host([data-ui-mode="mobile"]) #pha-toggle.pha-custom-hud[data-hud-columns="0"] {
  width: 52px !important;
  min-width: 52px !important;
  max-width: 52px !important;
}

:host([data-ui-mode="mobile"]) #pha-toggle.pha-custom-hud[data-hud-columns="1"] {
  width: 145px !important;
  min-width: 145px !important;
  max-width: 145px !important;
}

:host([data-ui-mode="mobile"]) #pha-toggle.pha-custom-hud:active {
  border-color: var(--gold-soft);
}

:host([data-ui-mode="mobile"]) .pha-hud-settings-button {
  min-width: 44px;
  min-height: 36px;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings {
  padding: 10px;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings-head {
  margin-bottom: 10px;
  gap: 10px;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings-head strong {
  font-size: 11px;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings-head small {
  font-size: 9px;
  text-align: right;
}

:host([data-ui-mode="mobile"]) .pha-hud-zero-control {
  width: 100%;
  min-width: 0;
  display: grid;
}

:host([data-ui-mode="mobile"]) .pha-hud-zero-control select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings-toolbar {
  margin-bottom: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings label,
:host([data-ui-mode="mobile"]) .pha-hud-slot-config > span {
  font-size: 9px;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings select,
:host([data-ui-mode="mobile"]) .pha-hud-settings button {
  width: 100%;
  height: 44px;
  min-height: 44px;
  padding: 0 8px;
  font-size: 11px;
}

:host([data-ui-mode="mobile"]) .pha-hud-slot-configs {
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

:host([data-ui-mode="mobile"]) .pha-hud-slot-config {
  padding: 8px;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 6px;
}

:host([data-ui-mode="mobile"]) .pha-hud-slot-config > span {
  font-size: 10px;
}

:host([data-ui-mode="mobile"]) .pha-hud-rarity-config {
  margin-top: 4px;
  padding-top: 8px;
}

:host([data-ui-mode="mobile"]) .pha-hud-rarity-toolbar {
  gap: 8px;
}

:host([data-ui-mode="mobile"]) .pha-hud-inline-check {
  min-height: 42px;
  height: 42px;
  padding: 0 8px;
}

:host([data-ui-mode="mobile"]) .pha-hud-inline-check input {
  width: 18px;
  height: 18px;
}

:host([data-ui-mode="mobile"]) .pha-hud-rarity-checks {
  margin-top: 8px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

:host([data-ui-mode="mobile"]) .pha-hud-rarity-checks label {
  min-height: 40px;
  height: 40px;
  gap: 5px;
}

:host([data-ui-mode="mobile"]) .pha-hud-rarity-checks input {
  width: 18px;
  height: 18px;
}

:host([data-ui-mode="mobile"]) .pha-hud-rarity-checks span {
  font-size: 10px;
}

:host([data-ui-mode="mobile"]) .pha-hud-inventory-status {
  margin-top: 8px;
  font-size: 9px;
}

/* The native tablist becomes the Mobile bottom navigation in normal layout flow. */
:host([data-ui-mode="mobile"]) .tabs {
  position: relative;
  top: auto;
  width: 100%;
  min-height: 54px;
  flex: 0 0 54px;
  order: 999;
  padding: 5px 7px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  align-items: stretch;
  border-bottom: 0;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, .24);
}

:host([data-ui-mode="mobile"]) .pha-interface-setting .pha-ui-mode-select,
:host([data-ui-mode="mobile"]) .pha-interface-setting .alpha-button {
  width: 100%;
  min-width: 0;
  max-width: none;
  height: 44px;
}

/* Match the compact label-over-control pattern used by Rarity and Shiny. */
:host([data-ui-mode="mobile"]) .pha-interface-setting {
  min-height: 0;
  padding: 0;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 3px;
  border: 0;
  background: transparent;
}

:host([data-ui-mode="mobile"]) .pha-interface-setting > span:first-child {
  color: var(--gold-soft);
  font-size: 9px;
  line-height: 1.2;
}

:host([data-ui-mode="mobile"]) .pha-interface-setting > span:last-child {
  width: 100%;
  min-width: 0;
  display: block;
}

:host([data-ui-mode="mobile"]) .pha-interface-settings {
  position: relative;
  z-index: 20;
  overflow: visible;
}

.pha-ui-mode-proxy { display: contents; }
.pha-ui-mode-summary,
.pha-ui-mode-menu { display: none; }

:host([data-ui-mode="mobile"]) .pha-ui-mode-proxy {
  position: relative;
  width: 100%;
  min-width: 0;
  display: block;
}

:host([data-ui-mode="mobile"]) .pha-ui-mode-proxy > select {
  position: absolute;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden;
  clip-path: inset(50%);
}

:host([data-ui-mode="mobile"]) .pha-ui-mode-summary {
  width: 100%;
  min-height: 44px;
  padding: 0 28px 0 8px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
}

:host([data-ui-mode="mobile"]) .pha-ui-mode-summary::-webkit-details-marker {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-ui-mode-summary::after {
  content: "⌄";
  position: absolute;
  right: 8px;
}

:host([data-ui-mode="mobile"]) .pha-ui-mode-menu {
  position: absolute;
  z-index: 50;
  top: calc(100% + 2px);
  left: 0;
  width: 100%;
  padding: 3px;
  display: grid;
  gap: 2px;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  box-shadow: 0 6px 18px rgba(0, 0, 0, .38);
}

:host([data-ui-mode="mobile"]) .pha-ui-mode-proxy:not([open]) .pha-ui-mode-menu {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-ui-mode-option {
  width: 100%;
  min-height: 40px;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 11px;
  text-align: left;
}

:host([data-ui-mode="mobile"]) .pha-ui-mode-option[aria-selected="true"] {
  border-color: var(--gold-soft);
  color: var(--gold);
}

:host([data-ui-mode="mobile"]) .pha-hud-topbar #pha-close {
  width: 44px;
  height: 44px;
}

:host([data-ui-mode="mobile"]) .tabs > [data-view="current"],
:host([data-ui-mode="mobile"]) .tabs > [data-view="history"],
:host([data-ui-mode="mobile"]) .tabs > #alerts-tab,
:host([data-ui-mode="mobile"]) .tabs > .pha-hud-settings-button {
  position: static;
  width: auto;
  min-width: 0;
  min-height: 44px;
}

:host([data-ui-mode="mobile"]) .live-card .status-row {
  justify-content: flex-start;
}

:host([data-ui-mode="mobile"]) .live-card .status-row > span:first-child {
  flex: 1 1 auto;
}

:host([data-ui-mode="mobile"]) .live-card .status-row .hunt-time {
  margin-left: auto;
  padding: 0;
  font-size: 12px;
}

:host([data-ui-mode="mobile"]) .live-card .status-row #pha-tab-state {
  width: 8px;
  min-width: 8px;
  height: 8px;
  min-height: 8px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 50%;
  background: currentColor;
  font-size: 0;
}

:host([data-ui-mode="mobile"]) .live-card .status-row [data-collapse="hunt"] {
  width: 44px;
  min-width: 44px;
  min-height: 44px;
}

/* Keep native selects constrained without changing their intrinsic popup behavior. */
:host([data-ui-mode="mobile"]) .panel select {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

/* Isolated checkpoint: bounded Mobile surface for HUD Columns only. */
.pha-hud-columns-proxy { display: contents; }
.pha-hud-columns-summary,
.pha-hud-columns-menu { display: none; }

:host([data-ui-mode="mobile"]) .pha-hud-columns-proxy {
  position: relative;
  width: 100%;
  min-width: 0;
  display: block;
}

:host([data-ui-mode="mobile"]) .pha-hud-columns-proxy > select {
  position: absolute;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden;
  clip-path: inset(50%);
}

:host([data-ui-mode="mobile"]) .pha-hud-columns-summary {
  width: 100%;
  min-height: 44px;
  padding: 0 30px 0 10px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-columns-summary::-webkit-details-marker {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-columns-summary::after {
  content: "⌄";
  position: absolute;
  right: 10px;
}

:host([data-ui-mode="mobile"]) .pha-hud-columns-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 2px);
  left: 0;
  width: 100%;
  max-height: 184px;
  padding: 3px;
  display: grid;
  gap: 2px;
  overflow-y: auto;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
}

:host([data-ui-mode="mobile"]) .pha-hud-columns-proxy:not([open]) .pha-hud-columns-menu {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings .pha-hud-columns-option {
  width: 100%;
  min-height: 40px;
  height: auto;
  padding: 7px 9px;
  text-align: left;
}

:host([data-ui-mode="mobile"]) .pha-hud-columns-option[aria-selected="true"] {
  border-color: var(--gold-soft);
  color: var(--gold);
}

/* Isolated checkpoint: bounded Mobile surfaces for HUD widget selectors. */
.pha-hud-widget-proxy { display: contents; }
.pha-hud-widget-summary,
.pha-hud-widget-menu { display: none; }

:host([data-ui-mode="mobile"]) .pha-hud-widget-proxy {
  position: relative;
  min-width: 0;
  display: block;
}

:host([data-ui-mode="mobile"]) .pha-hud-widget-proxy > select {
  position: absolute;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden;
  clip-path: inset(50%);
}

:host([data-ui-mode="mobile"]) .pha-hud-widget-summary {
  width: 100%;
  min-height: 44px;
  padding: 0 30px 0 9px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-widget-summary::-webkit-details-marker {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-widget-summary::after {
  content: "⌄";
  position: absolute;
  right: 9px;
}

:host([data-ui-mode="mobile"]) .pha-hud-widget-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 2px);
  left: 0;
  width: 100%;
  max-height: min(300px, 48vh);
  padding: 3px;
  display: grid;
  gap: 2px;
  overflow-y: auto;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
}

:host([data-ui-mode="mobile"]) .pha-hud-widget-proxy:not([open]) .pha-hud-widget-menu {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-widget-group {
  padding: 5px 7px 2px;
  color: var(--gold);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings .pha-hud-widget-option {
  width: 100%;
  min-height: 40px;
  height: auto;
  padding: 7px 9px;
  text-align: left;
}

:host([data-ui-mode="mobile"]) .pha-hud-widget-option[aria-selected="true"] {
  border-color: var(--gold-soft);
  color: var(--gold);
}

/* Isolated checkpoint: bounded Mobile surface for HUD Preset. */
.pha-hud-preset-proxy { display: contents; }
.pha-hud-preset-summary,
.pha-hud-preset-menu { display: none; }

:host([data-ui-mode="mobile"]) .pha-hud-preset-proxy {
  position: relative;
  min-width: 0;
  display: block;
}

:host([data-ui-mode="mobile"]) .pha-hud-preset-proxy > select {
  position: absolute;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden;
  clip-path: inset(50%);
}

:host([data-ui-mode="mobile"]) .pha-hud-preset-summary {
  width: 100%;
  min-height: 44px;
  padding: 0 30px 0 9px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-preset-summary::-webkit-details-marker {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-preset-summary::after {
  content: "⌄";
  position: absolute;
  right: 9px;
}

:host([data-ui-mode="mobile"]) .pha-hud-preset-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 2px);
  left: 0;
  width: 100%;
  max-height: 224px;
  padding: 3px;
  display: grid;
  gap: 2px;
  overflow-y: auto;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
}

:host([data-ui-mode="mobile"]) .pha-hud-preset-proxy:not([open]) .pha-hud-preset-menu {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings .pha-hud-preset-option {
  width: 100%;
  min-height: 40px;
  height: auto;
  padding: 7px 9px;
  text-align: left;
}

:host([data-ui-mode="mobile"]) .pha-hud-preset-option[aria-selected="true"] {
  border-color: var(--gold-soft);
  color: var(--gold);
}

/* Isolated checkpoint: bounded Mobile surface for rarity widget Width. */
.pha-hud-width-proxy { display: contents; }
.pha-hud-width-summary,
.pha-hud-width-menu { display: none; }

:host([data-ui-mode="mobile"]) .pha-hud-width-proxy {
  position: relative;
  min-width: 0;
  display: block;
}

:host([data-ui-mode="mobile"]) .pha-hud-width-proxy > select {
  position: absolute;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden;
  clip-path: inset(50%);
}

:host([data-ui-mode="mobile"]) .pha-hud-width-summary {
  width: 100%;
  min-height: 42px;
  padding: 0 28px 0 8px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-width-summary::-webkit-details-marker {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-width-summary::after {
  content: "⌄";
  position: absolute;
  right: 8px;
}

:host([data-ui-mode="mobile"]) .pha-hud-width-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 2px);
  left: 0;
  width: 100%;
  padding: 3px;
  display: grid;
  gap: 2px;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
}

:host([data-ui-mode="mobile"]) .pha-hud-width-proxy:not([open]) .pha-hud-width-menu {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings .pha-hud-width-option {
  width: 100%;
  min-height: 40px;
  height: auto;
  padding: 7px 8px;
  text-align: left;
}

:host([data-ui-mode="mobile"]) .pha-hud-width-option[aria-selected="true"] {
  border-color: var(--gold-soft);
  color: var(--gold);
}

/* Isolated checkpoint: bounded Mobile surfaces for dynamic HUD items. */
.pha-hud-item-proxy { display: contents; }
.pha-hud-item-summary,
.pha-hud-item-menu { display: none; }

:host([data-ui-mode="mobile"]) .pha-hud-item-proxy {
  position: relative;
  min-width: 0;
  display: block;
  grid-column: 2;
}

:host([data-ui-mode="mobile"]) .pha-hud-item-proxy > select {
  position: absolute;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden;
  clip-path: inset(50%);
}

:host([data-ui-mode="mobile"]) .pha-hud-item-summary {
  width: 100%;
  min-height: 44px;
  padding: 0 30px 0 9px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-item-summary::-webkit-details-marker {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-item-summary::after {
  content: "⌄";
  position: absolute;
  right: 9px;
}

:host([data-ui-mode="mobile"]) .pha-hud-item-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 2px);
  left: 0;
  width: 100%;
  max-height: min(300px, 48vh);
  padding: 3px;
  display: grid;
  gap: 2px;
  overflow-y: auto;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
}

:host([data-ui-mode="mobile"]) .pha-hud-item-proxy:not([open]) .pha-hud-item-menu {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-hud-settings .pha-hud-item-option {
  width: 100%;
  min-height: 40px;
  height: auto;
  padding: 7px 9px;
  overflow-wrap: anywhere;
  text-align: left;
}

:host([data-ui-mode="mobile"]) .pha-hud-item-option[aria-selected="true"] {
  border-color: var(--gold-soft);
  color: var(--gold);
}

/* Isolated checkpoint: bounded Mobile Shiny filters in Current. */
.pha-current-select-proxy { display: contents; }
.pha-current-select-summary,
.pha-current-select-menu { display: none; }

:host([data-ui-mode="mobile"]) .pha-current-select-proxy {
  position: relative;
  min-width: 0;
  display: block;
}

:host([data-ui-mode="mobile"]) .pha-current-select-proxy > select {
  position: absolute;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden;
  clip-path: inset(50%);
}

:host([data-ui-mode="mobile"]) .pha-current-select-summary {
  width: 100%;
  height: 44px;
  min-height: 44px;
  padding: 8px 22px 8px 5px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
}

:host([data-ui-mode="mobile"]) .pha-current-select-summary::-webkit-details-marker {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-current-select-summary::after {
  content: "▾";
  position: absolute;
  right: 7px;
}

:host([data-ui-mode="mobile"]) .pha-current-select-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 2px);
  left: 0;
  width: 100%;
  padding: 3px;
  display: grid;
  gap: 2px;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
}

:host([data-ui-mode="mobile"]) .pha-current-select-proxy:not([open]) .pha-current-select-menu {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-current-select-option {
  width: 100%;
  min-height: 40px;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 11px;
  text-align: left;
}

:host([data-ui-mode="mobile"]) .pha-current-select-option[aria-selected="true"] {
  border-color: var(--gold-soft);
  color: var(--gold);
}

/* Isolated checkpoint: bounded Mobile filters in History. */
.pha-history-select-proxy { display: contents; }
.pha-history-select-summary,
.pha-history-select-menu { display: none; }

:host([data-ui-mode="mobile"]) .pha-history-select-proxy {
  position: relative;
  min-width: 0;
  display: block;
}

:host([data-ui-mode="mobile"]) .pha-history-select-proxy > select {
  position: absolute;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden;
  clip-path: inset(50%);
}

:host([data-ui-mode="mobile"]) .pha-history-select-summary {
  width: 100%;
  min-height: 44px;
  padding: 0 28px 0 8px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
}

:host([data-ui-mode="mobile"]) .pha-history-select-summary::-webkit-details-marker {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-history-select-summary::after {
  content: "⌄";
  position: absolute;
  right: 8px;
}

:host([data-ui-mode="mobile"]) .pha-history-select-menu {
  position: absolute;
  z-index: 50;
  top: calc(100% + 2px);
  left: 0;
  width: 100%;
  max-height: min(240px, 42dvh);
  padding: 3px;
  display: grid;
  gap: 2px;
  overflow-y: auto;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  box-shadow: 0 6px 18px rgba(0, 0, 0, .38);
}

:host([data-ui-mode="mobile"]) .pha-history-select-proxy:not([open]) .pha-history-select-menu {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-history-select-option {
  width: 100%;
  min-height: 40px;
  height: auto;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 11px;
  overflow-wrap: anywhere;
  text-align: left;
}

:host([data-ui-mode="mobile"]) .pha-history-select-option[aria-selected="true"] {
  border-color: var(--gold-soft);
  color: var(--gold);
}

/* Isolated checkpoint: bounded Mobile rarity filter in Catch Gallery. */
.pha-gallery-select-proxy { display: contents; }
.pha-gallery-select-summary,
.pha-gallery-select-menu { display: none; }

:host([data-ui-mode="mobile"]) .pha-gallery-select-proxy {
  position: relative;
  min-width: 0;
  display: block;
}

:host([data-ui-mode="mobile"]) .pha-gallery-select-proxy > select {
  position: absolute;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden;
  clip-path: inset(50%);
}

:host([data-ui-mode="mobile"]) .pha-gallery-select-summary {
  width: 100%;
  min-height: 44px;
  padding: 0 28px 0 8px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
}

:host([data-ui-mode="mobile"]) .pha-gallery-select-summary::-webkit-details-marker {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-gallery-select-summary::after {
  content: "⌄";
  position: absolute;
  right: 8px;
}

:host([data-ui-mode="mobile"]) .pha-gallery-select-menu {
  position: absolute;
  z-index: 50;
  top: calc(100% + 2px);
  left: 0;
  width: 100%;
  max-height: 184px;
  padding: 3px;
  display: grid;
  gap: 2px;
  overflow-y: auto;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  box-shadow: 0 6px 18px rgba(0, 0, 0, .38);
}

:host([data-ui-mode="mobile"]) .pha-gallery-select-proxy:not([open]) .pha-gallery-select-menu {
  display: none;
}

:host([data-ui-mode="mobile"]) .pha-gallery-select-option {
  width: 100%;
  min-height: 40px;
  height: auto;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 11px;
  text-align: left;
}

:host([data-ui-mode="mobile"]) .pha-gallery-select-option[aria-selected="true"] {
  border-color: var(--gold-soft);
  color: var(--gold);
}

`;
