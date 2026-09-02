import {
  createClosedHud as createBaseClosedHud,
  createPotionUsageTracker,
  POTION_USAGE_STORAGE_KEY
} from "./closed-hud.js";
import { MOBILE_CLOSED_HUD_STYLES } from "./closed-hud-mobile-styles.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const STYLE_ID = "pha-closed-hud-polish-style";
const HUD_SETTINGS_BUTTON_ID = "pha-hud-settings-button";
const MISC_TAB_ID = "alerts-tab";
const INTERFACE_SECTION_ID = "pha-interface-settings";
const INTERFACE_STAGING_ID = "pha-interface-staging";
const HUD_COLUMNS_STORAGE_KEY = "pokepixel_hunt_analyzer_closed_hud_columns_v1";
const DESKTOP_COMPACT_WIDTH_STORAGE_KEY = "pokepixel_hunt_analyzer_desktop_compact_width_v1";
const DESKTOP_COMPACT_WIDTH_PX = 400;
const HUD_COLUMN_WIDTHS = Object.freeze({ 0: 52, 1: 140, 2: 220 });
const HUD_SYMBOLS = new Set(["✓", "✕", "$", "↓"]);

const POLISH_STYLE = `
  .pha-hud-inventory-primary.has-symbol,
  .pha-hud-inventory-secondary.has-symbol {
    display:inline-flex;
    align-items:baseline;
    justify-content:center;
    gap:2px;
  }
  .pha-hud-inventory-symbol {
    flex:none;
    font-size:7px;
    font-weight:700;
    line-height:1;
    opacity:.82;
  }
  .pha-hud-inventory-secondary .pha-hud-inventory-symbol {
    font-size:6px;
    opacity:.78;
  }

  /* Shared header hierarchy: identity only in the topbar. */
  .pha-hud-topbar {
    position:relative;
    grid-template-columns:minmax(0,1fr);
    gap:0;
    padding-right:44px;
  }
  .pha-hud-topbar .brand {
    grid-column:1;
    min-width:0;
  }
  .pha-hud-topbar .brand-meta {
    min-width:0;
    overflow:hidden;
  }
  .pha-hud-topbar .brand-meta > span {
    min-width:0;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .pha-hud-topbar .refcode {
    flex:0 0 auto;
  }
  .pha-hud-topbar #pha-close {
    position:absolute;
    top:50%;
    right:10px;
    transform:translateY(-50%);
    margin:0;
  }

  /* Desktop keeps the compact content width instead of stretching into a reserved scrollbar gutter. */
  :host([data-ui-mode="desktop"]) .panel {
    min-width:${DESKTOP_COMPACT_WIDTH_PX}px !important;
    scrollbar-gutter:auto;
  }

  /* Operational controls live in the navigation row. */
  .tabs .pha-hud-settings-button {
    min-width:38px;
    white-space:nowrap;
  }
  .tabs #pha-tab-state {
    flex:0 0 auto;
    white-space:nowrap;
  }

  /* HUD configuration is an exclusive view, never an inline collapse below the tabs. */
  .pha-hud-settings.pha-hud-exclusive-view {
    min-height:0;
    flex:1 1 auto;
    overflow-x:hidden;
    overflow-y:auto;
    border-bottom:0;
  }
  .pha-hud-settings.pha-hud-exclusive-view[hidden] {
    display:none !important;
  }
  .pha-hud-columns-control select {
    width:100%;
  }

  /* UI mode and opacity are configuration, so they belong to Misc. */
  .pha-interface-controls {
    padding:10px;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:8px;
    background:var(--bg-elevated);
  }
  .pha-interface-setting {
    min-width:0;
    min-height:38px;
    padding:6px 8px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    border:1px solid var(--border-soft);
    border-radius:3px;
    background:var(--bg);
  }
  .pha-interface-setting > span {
    color:var(--muted);
    font-size:9px;
    font-weight:700;
    letter-spacing:.04em;
    text-transform:uppercase;
    white-space:nowrap;
  }
  .pha-interface-setting .pha-ui-mode-select {
    width:96px;
    max-width:96px;
    height:28px;
  }
  .pha-interface-setting .alpha-button {
    min-width:72px;
    height:28px;
  }

  :host([data-ui-mode="mobile"]) .pha-hud-topbar {
    min-height:46px;
    padding:5px 50px 5px 8px;
    gap:0;
  }
  :host([data-ui-mode="mobile"]) .pha-hud-topbar .brand strong {
    font-size:12px;
  }
  :host([data-ui-mode="mobile"]) .pha-hud-topbar .brand-meta {
    gap:3px;
    font-size:8px;
  }
  :host([data-ui-mode="mobile"]) .pha-hud-topbar .refcode {
    min-height:20px;
    padding:0 2px;
  }
  :host([data-ui-mode="mobile"]) .pha-hud-topbar #pha-close {
    right:8px;
    width:36px;
    height:36px;
  }
  :host([data-ui-mode="mobile"]) .tabs {
    min-height:44px;
    padding:4px 6px;
    gap:4px;
  }
  :host([data-ui-mode="mobile"]) .tabs .tab {
    min-height:36px;
    padding:6px 7px;
    font-size:9px;
  }
  :host([data-ui-mode="mobile"]) .tabs .hunt-time {
    margin-left:auto;
    padding:0 1px;
    font-size:12px;
  }
  :host([data-ui-mode="mobile"]) .tabs #pha-tab-state {
    padding:3px 4px;
    font-size:8px;
  }
  :host([data-ui-mode="mobile"]) .pha-interface-controls {
    padding:8px;
    gap:6px;
  }
  :host([data-ui-mode="mobile"]) .pha-interface-setting {
    min-height:44px;
    padding:6px;
  }
  :host([data-ui-mode="mobile"]) .pha-interface-setting > span {
    font-size:8px;
  }
  :host([data-ui-mode="mobile"]) .pha-interface-setting .pha-ui-mode-select,
  :host([data-ui-mode="mobile"]) .pha-interface-setting .alpha-button {
    min-width:0;
    width:min(92px,45vw);
    max-width:92px;
    height:38px;
  }

  :host([data-ui-mode="mobile"]) .capture-strip {
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:4px;
  }
  :host([data-ui-mode="mobile"]) .capture-strip article {
    min-width:0;
    min-height:56px;
    padding:7px 4px;
  }
  :host([data-ui-mode="mobile"]) .capture-strip article > span {
    min-width:0;
    overflow:hidden;
    font-size:8px;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  :host([data-ui-mode="mobile"]) .capture-strip article > strong {
    font-size:15px;
  }

  ${MOBILE_CLOSED_HUD_STYLES}

  /* Column count controls the closed HUD footprint in both UI modes. */
  #pha-toggle.pha-custom-hud[data-hud-columns="2"] {
    width:${HUD_COLUMN_WIDTHS[2]}px !important;
    min-width:${HUD_COLUMN_WIDTHS[2]}px !important;
    grid-template-columns:32px minmax(0,1fr) !important;
  }
  #pha-toggle.pha-custom-hud[data-hud-columns="1"] {
    width:${HUD_COLUMN_WIDTHS[1]}px !important;
    min-width:${HUD_COLUMN_WIDTHS[1]}px !important;
    grid-template-columns:32px minmax(0,1fr) !important;
  }
  #pha-toggle.pha-custom-hud[data-hud-columns="1"] .pha-hud-grid {
    grid-template-columns:minmax(0,1fr) !important;
    grid-template-rows:repeat(2,minmax(0,1fr)) !important;
  }
  #pha-toggle.pha-custom-hud[data-hud-columns="1"] .pha-hud-slot.is-wide {
    grid-column:span 1 !important;
  }
  #pha-toggle.pha-custom-hud[data-hud-columns="1"] .pha-hud-slot:nth-child(2),
  #pha-toggle.pha-custom-hud[data-hud-columns="1"] .pha-hud-slot:nth-child(4) {
    display:none !important;
  }
  #pha-toggle.pha-custom-hud[data-hud-columns="0"] {
    width:${HUD_COLUMN_WIDTHS[0]}px !important;
    min-width:${HUD_COLUMN_WIDTHS[0]}px !important;
    grid-template-columns:32px !important;
    justify-content:center;
  }
  #pha-toggle.pha-custom-hud[data-hud-columns="0"] .pha-hud-grid {
    display:none !important;
  }

  :host([data-ui-mode="mobile"]) #pha-toggle.pha-custom-hud[data-hud-columns="2"],
  :host([data-ui-mode="mobile"]) #pha-toggle.pha-custom-hud[data-hud-columns="1"],
  :host([data-ui-mode="mobile"]) #pha-toggle.pha-custom-hud[data-hud-columns="0"] {
    max-width:calc(100vw - var(--pha-safe-left) - var(--pha-safe-right) - 16px) !important;
  }

  .pha-hud-settings[data-hud-columns="1"] .pha-hud-slot-config:nth-child(2),
  .pha-hud-settings[data-hud-columns="1"] .pha-hud-slot-config:nth-child(4),
  .pha-hud-settings[data-hud-columns="0"] .pha-hud-slot-configs,
  .pha-hud-settings[data-hud-columns="0"] .pha-hud-inventory-status {
    display:none !important;
  }
  .pha-hud-settings[data-hud-columns="0"] [data-hud-preset],
  .pha-hud-settings[data-hud-columns="0"] [data-hud-reset] {
    opacity:.45;
    pointer-events:none;
  }
`;

export { createPotionUsageTracker, POTION_USAGE_STORAGE_KEY };

export function splitHudSymbolValue(value) {
  const text = String(value ?? "");
  const symbol = text[0] || "";
  if (!HUD_SYMBOLS.has(symbol)) return null;
  return {
    symbol,
    value: text.slice(1).trimStart()
  };
}

function normalizeHudColumns(value) {
  const columns = Number(value);
  return columns === 0 || columns === 1 || columns === 2 ? columns : 2;
}

function readHudColumns() {
  try {
    return normalizeHudColumns(localStorage.getItem(HUD_COLUMNS_STORAGE_KEY));
  } catch {
    return 2;
  }
}

function writeHudColumns(columns) {
  try {
    localStorage.setItem(HUD_COLUMNS_STORAGE_KEY, String(normalizeHudColumns(columns)));
  } catch {
    // In-memory layout remains valid if storage is unavailable.
  }
}

function installPrePaintLauncherGuard() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return null;

  const hideLauncher = (host) => {
    if (!host || host.id !== ROOT_ID) return;
    const launcher = host.shadowRoot?.getElementById("pha-toggle");
    if (launcher) launcher.style.visibility = "hidden";
  };

  hideLauncher(document.getElementById(ROOT_ID));

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.id === ROOT_ID) {
          hideLauncher(node);
          continue;
        }
        hideLauncher(node.querySelector?.(`#${ROOT_ID}`));
      }
    }
  });

  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true
  });

  return observer;
}

const launcherGuard = installPrePaintLauncherGuard();

export function createClosedHud(options = {}) {
  const hud = createBaseClosedHud(options);
  let shadow = null;
  let grid = null;
  let style = null;
  let observer = null;
  let layoutObserver = null;
  let decorating = false;
  let hudColumns = readHudColumns();
  let hudViewBound = false;

  function resolveElements() {
    shadow = document.getElementById(ROOT_ID)?.shadowRoot || null;
    grid = shadow?.querySelector(".pha-hud-grid") || null;
  }

  function ensureStyle() {
    if (!shadow) return;
    style = shadow.getElementById(STYLE_ID);
    if (style) return;
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = POLISH_STYLE;
    shadow.appendChild(style);
  }

  function normalizeHeaderVersion() {
    const version = shadow?.querySelector(".brand-meta > span:first-child");
    if (!version) return;
    const text = String(version.textContent || "").trim();
    if (text.startsWith("Userscript ")) {
      version.textContent = `v${text.slice("Userscript ".length)}`;
    }
  }

  function compactDesktopPanelOnce() {
    if (!shadow || shadow.host?.dataset.uiMode !== "desktop") return;
    const panel = shadow.getElementById("pha-panel");
    if (!panel) return;
    panel.style.minWidth = `${DESKTOP_COMPACT_WIDTH_PX}px`;

    try {
      if (localStorage.getItem(DESKTOP_COMPACT_WIDTH_STORAGE_KEY) === "1") return;
      const width = panel.getBoundingClientRect().width;
      if (width > DESKTOP_COMPACT_WIDTH_PX && width <= 431) {
        panel.style.width = `${DESKTOP_COMPACT_WIDTH_PX}px`;
      }
      localStorage.setItem(DESKTOP_COMPACT_WIDTH_STORAGE_KEY, "1");
    } catch {
      // Compact min-width still applies even if migration persistence is unavailable.
    }
  }

  function stageInterfaceControls() {
    if (!shadow) return;
    const panel = shadow.getElementById("pha-panel");
    const alphaButton = shadow.getElementById("pha-alpha");
    const modeSelect = shadow.querySelector(".pha-ui-mode-select");
    if (!panel || (!alphaButton && !modeSelect)) return;
    if (shadow.getElementById(INTERFACE_SECTION_ID)) return;

    let staging = shadow.getElementById(INTERFACE_STAGING_ID);
    if (!staging) {
      staging = document.createElement("div");
      staging.id = INTERFACE_STAGING_ID;
      staging.hidden = true;
      panel.appendChild(staging);
    }

    if (modeSelect && modeSelect.parentElement !== staging) staging.appendChild(modeSelect);
    if (alphaButton && alphaButton.parentElement !== staging) staging.appendChild(alphaButton);
  }

  function ensureMiscInterfaceSettings() {
    if (!shadow) return;
    const alertsView = shadow.getElementById("view-alerts");
    const alphaButton = shadow.getElementById("pha-alpha");
    const modeSelect = shadow.querySelector(".pha-ui-mode-select");
    if (!alertsView || !alphaButton || !modeSelect) return;

    let section = shadow.getElementById(INTERFACE_SECTION_ID);
    if (!section) {
      section = document.createElement("section");
      section.id = INTERFACE_SECTION_ID;
      section.className = "section pha-interface-settings";
      section.innerHTML = `
        <div class="section-head">
          <h3>Interface</h3>
        </div>
        <div class="pha-interface-controls">
          <div class="pha-interface-setting">
            <span>UI Mode</span>
            <span data-interface-mode></span>
          </div>
          <div class="pha-interface-setting">
            <span>Opacity</span>
            <span data-interface-alpha></span>
          </div>
        </div>`;
      alertsView.prepend(section);
    }

    const modeSlot = section.querySelector("[data-interface-mode]");
    const alphaSlot = section.querySelector("[data-interface-alpha]");
    if (modeSlot && modeSelect.parentElement !== modeSlot) modeSlot.appendChild(modeSelect);
    if (alphaSlot && alphaButton.parentElement !== alphaSlot) alphaSlot.appendChild(alphaButton);
    shadow.getElementById(INTERFACE_STAGING_ID)?.remove();
  }

  function placeOperationalStatus() {
    if (!shadow) return;
    const state = shadow.getElementById("pha-tab-state");
    const tabs = shadow.querySelector(".tabs");
    const huntTime = shadow.getElementById("hunt-time");
    if (!state || !tabs || !huntTime) return;
    if (state.parentElement !== tabs || huntTime.nextElementSibling !== state) {
      huntTime.after(state);
    }
  }

  function placeHudSettingsNextToMisc() {
    if (!shadow) return;
    const settingsButton = shadow.getElementById(HUD_SETTINGS_BUTTON_ID);
    const miscTab = shadow.getElementById(MISC_TAB_ID);
    const tabs = shadow.querySelector(".tabs");
    const huntTime = shadow.getElementById("hunt-time");
    if (!settingsButton || !tabs) return;

    settingsButton.classList.remove("alpha-button");
    settingsButton.classList.add("tab");

    if (miscTab) {
      if (miscTab.nextElementSibling !== settingsButton) miscTab.after(settingsButton);
      return;
    }

    if (huntTime && settingsButton.parentElement !== tabs) huntTime.before(settingsButton);
  }

  function hideHudView() {
    if (!shadow) return;
    const settings = shadow.getElementById("pha-hud-settings");
    const settingsButton = shadow.getElementById(HUD_SETTINGS_BUTTON_ID);
    if (settings) settings.hidden = true;
    settingsButton?.classList.remove("active");
  }

  function showHudView() {
    if (!shadow) return;
    const historyTab = shadow.querySelector('[data-view="history"]');
    const settings = shadow.getElementById("pha-hud-settings");
    const settingsButton = shadow.getElementById(HUD_SETTINGS_BUTTON_ID);
    if (!settings || !settingsButton) return;

    // Reuse the existing non-Current state so the one-second Current refresh remains suspended.
    historyTab?.click();
    shadow.getElementById("view-current")?.setAttribute("hidden", "");
    shadow.getElementById("view-history")?.setAttribute("hidden", "");
    shadow.getElementById("view-alerts")?.setAttribute("hidden", "");
    for (const tab of shadow.querySelectorAll(".tabs .tab")) tab.classList.remove("active");
    settings.hidden = false;
    settings.classList.add("pha-hud-exclusive-view");
    settingsButton.classList.add("active");
  }

  function bindHudExclusiveView() {
    if (!shadow) return;
    const settingsButton = shadow.getElementById(HUD_SETTINGS_BUTTON_ID);
    if (settingsButton && !hudViewBound) {
      hudViewBound = true;
      settingsButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        showHudView();
      }, true);
    }

    for (const tab of shadow.querySelectorAll('[data-view], #alerts-tab')) {
      if (tab.dataset.hudExitBound === "true") continue;
      tab.dataset.hudExitBound = "true";
      tab.addEventListener("click", hideHudView);
    }
  }

  function ensureHudColumnsControl() {
    if (!shadow) return;
    const settings = shadow.getElementById("pha-hud-settings");
    const toolbar = settings?.querySelector(".pha-hud-settings-toolbar");
    if (!settings || !toolbar) return;

    settings.classList.add("pha-hud-exclusive-view");
    let control = toolbar.querySelector(".pha-hud-columns-control");
    if (!control) {
      control = document.createElement("label");
      control.className = "pha-hud-columns-control";
      control.innerHTML = `Columns
        <select data-hud-columns aria-label="Closed HUD columns">
          <option value="0">0 · PX only</option>
          <option value="1">1 column</option>
          <option value="2">2 columns</option>
        </select>`;
      const reset = toolbar.querySelector("[data-hud-reset]");
      if (reset) reset.before(control);
      else toolbar.appendChild(control);
      control.querySelector("[data-hud-columns]")?.addEventListener("change", (event) => {
        hudColumns = normalizeHudColumns(event.currentTarget.value);
        writeHudColumns(hudColumns);
        applyHudColumns();
      });
    }

    const select = control.querySelector("[data-hud-columns]");
    if (select) select.value = String(hudColumns);
  }

  function clampLauncherAfterColumnChange() {
    if (!shadow) return;
    const launcher = shadow.getElementById("pha-toggle");
    if (!launcher || launcher.hidden) return;
    const rect = launcher.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const visual = window.visualViewport;
    const offsetLeft = Number.isFinite(visual?.offsetLeft) ? visual.offsetLeft : 0;
    const offsetTop = Number.isFinite(visual?.offsetTop) ? visual.offsetTop : 0;
    const viewportWidth = Number.isFinite(visual?.width) ? visual.width : window.innerWidth;
    const viewportHeight = Number.isFinite(visual?.height) ? visual.height : window.innerHeight;
    const gap = 8;
    const maxLeft = offsetLeft + viewportWidth - rect.width - gap;
    const maxTop = offsetTop + viewportHeight - rect.height - gap;
    const nextLeft = Math.min(Math.max(rect.left, offsetLeft + gap), Math.max(offsetLeft + gap, maxLeft));
    const nextTop = Math.min(Math.max(rect.top, offsetTop + gap), Math.max(offsetTop + gap, maxTop));
    if (nextLeft !== rect.left || nextTop !== rect.top) {
      launcher.style.left = `${nextLeft}px`;
      launcher.style.top = `${nextTop}px`;
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
    }
  }

  function applyHudColumns() {
    if (!shadow) return;
    const launcher = shadow.getElementById("pha-toggle");
    const settings = shadow.getElementById("pha-hud-settings");
    if (!launcher || !settings) return;

    launcher.dataset.hudColumns = String(hudColumns);
    settings.dataset.hudColumns = String(hudColumns);

    const slotElements = [...launcher.querySelectorAll(".pha-hud-slot")];
    const configElements = [...settings.querySelectorAll(".pha-hud-slot-config")];
    for (let index = 0; index < 4; index += 1) {
      const enabled = hudColumns === 2 || (hudColumns === 1 && (index === 0 || index === 2));
      if (slotElements[index]) slotElements[index].hidden = !enabled;
      if (configElements[index]) {
        configElements[index].hidden = !enabled;
        for (const field of configElements[index].querySelectorAll("select, input, button")) {
          field.disabled = !enabled;
        }
      }
    }

    const preset = settings.querySelector("[data-hud-preset]");
    const reset = settings.querySelector("[data-hud-reset]");
    if (preset) preset.disabled = hudColumns === 0;
    if (reset) reset.disabled = hudColumns === 0;

    // In one-column mode every visible row has only one display column.
    for (const widthSelect of settings.querySelectorAll("[data-hud-rarity-width]")) {
      const index = Number(widthSelect.dataset.hudRarityWidth);
      const active = hudColumns === 2 || (hudColumns === 1 && (index === 0 || index === 2));
      for (const option of widthSelect.options) {
        option.disabled = hudColumns === 1 && active && option.value === "2";
      }
      if (hudColumns === 1 && active && widthSelect.value === "2") widthSelect.value = "1";
    }

    if (hudColumns === 1) {
      for (const index of [0, 2]) {
        slotElements[index]?.classList.remove("is-wide", "is-consumed");
      }
    }

    const columnsSelect = settings.querySelector("[data-hud-columns]");
    if (columnsSelect) columnsSelect.value = String(hudColumns);
    window.requestAnimationFrame?.(clampLauncherAfterColumnChange);
  }

  function applyLayoutPolish() {
    normalizeHeaderVersion();
    compactDesktopPanelOnce();
    stageInterfaceControls();
    ensureMiscInterfaceSettings();
    placeOperationalStatus();
    placeHudSettingsNextToMisc();
    ensureHudColumnsControl();
    bindHudExclusiveView();
    applyHudColumns();
  }

  function observeLayout() {
    layoutObserver?.disconnect();
    layoutObserver = null;
    if (!shadow || typeof MutationObserver === "undefined") return;

    layoutObserver = new MutationObserver(() => {
      applyLayoutPolish();
    });
    layoutObserver.observe(shadow, {
      childList: true,
      subtree: true
    });
  }

  function decorateElement(element) {
    if (!element || element.querySelector(".pha-hud-inventory-symbol")) return;
    const parsed = splitHudSymbolValue(element.textContent);
    if (!parsed || !parsed.value) return;

    const icon = document.createElement("span");
    icon.className = "pha-hud-inventory-symbol";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = parsed.symbol;

    element.classList.add("has-symbol");
    element.replaceChildren(icon, document.createTextNode(parsed.value));
  }

  function decorateSupplySymbols() {
    if (!grid || decorating) return;
    decorating = true;
    try {
      for (const element of grid.querySelectorAll(
        ".pha-hud-inventory-primary, .pha-hud-inventory-secondary"
      )) {
        decorateElement(element);
      }
    } finally {
      decorating = false;
    }
  }

  function observeGrid() {
    observer?.disconnect();
    observer = null;
    if (!grid || typeof MutationObserver === "undefined") return;

    observer = new MutationObserver(() => {
      decorateSupplySymbols();
      applyHudColumns();
    });
    observer.observe(grid, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function mount() {
    hud.mount();
    resolveElements();
    ensureStyle();
    applyLayoutPolish();
    observeLayout();
    observeGrid();
    decorateSupplySymbols();
  }

  function render(state) {
    hud.render(state);
    resolveElements();
    ensureStyle();
    applyLayoutPolish();
    if (!layoutObserver) observeLayout();
    if (!observer) observeGrid();
    decorateSupplySymbols();
    applyHudColumns();
  }

  function dispose() {
    observer?.disconnect();
    observer = null;
    layoutObserver?.disconnect();
    layoutObserver = null;
    style?.remove();
    hud.dispose();
    shadow = null;
    grid = null;
    style = null;
    hudViewBound = false;
  }

  return {
    mount,
    render,
    dispose,
    getConfig: () => hud.getConfig(),
    getInventorySnapshot: () => hud.getInventorySnapshot()
  };
}

void launcherGuard;
