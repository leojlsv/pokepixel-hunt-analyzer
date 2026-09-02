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
  height: 42px;
  min-height: 42px;
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

/* Bottom-navigation checkpoint 4: reuse all four native view buttons. */
:host([data-ui-mode="mobile"]) .panel::after {
  content: "";
  width: 100%;
  min-height: 54px;
  flex: 0 0 54px;
  order: 999;
  box-sizing: border-box;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, .24);
  pointer-events: none;
}

:host([data-ui-mode="mobile"]) .tabs > [data-view="current"],
:host([data-ui-mode="mobile"]) .tabs > [data-view="history"],
:host([data-ui-mode="mobile"]) .tabs > #alerts-tab,
:host([data-ui-mode="mobile"]) .tabs > .pha-hud-settings-button {
  position: fixed;
  bottom: calc(var(--pha-safe-bottom) + 5px);
  z-index: 11;
  width: calc((100vw - var(--pha-safe-left) - var(--pha-safe-right) - 26px) / 4);
  min-height: 44px;
}

:host([data-ui-mode="mobile"]) .tabs > [data-view="current"] {
  left: calc(var(--pha-safe-left) + 7px);
}

:host([data-ui-mode="mobile"]) .tabs > [data-view="history"] {
  left: calc(var(--pha-safe-left) + 11px + ((100vw - var(--pha-safe-left) - var(--pha-safe-right) - 26px) / 4));
}

:host([data-ui-mode="mobile"]) .tabs > #alerts-tab {
  right: calc(var(--pha-safe-right) + 11px + ((100vw - var(--pha-safe-left) - var(--pha-safe-right) - 26px) / 4));
}

:host([data-ui-mode="mobile"]) .tabs > .pha-hud-settings-button {
  right: calc(var(--pha-safe-right) + 7px);
}

/* The remaining operational row merges into the Hunt header on Mobile. */
:host([data-ui-mode="mobile"]) .tabs {
  min-height: 0;
  height: 0;
  padding: 0;
  gap: 0;
  border: 0;
}

:host([data-ui-mode="mobile"]) .live-card .status-row {
  justify-content: flex-start;
}

:host([data-ui-mode="mobile"]) .live-card .status-row > span:first-child {
  flex: 1 1 auto;
  order: 0;
}

:host([data-ui-mode="mobile"]) .live-card .status-row .hunt-time {
  margin-left: auto;
  padding: 0;
  font-size: 12px;
  order: 2;
}

:host([data-ui-mode="mobile"]) .live-card .status-row .hunt-status {
  order: 3;
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
  order: 1;
}

:host([data-ui-mode="mobile"]) .live-card .status-row [data-collapse="hunt"] {
  width: 44px;
  min-width: 44px;
  min-height: 44px;
  order: 4;
}
`;
