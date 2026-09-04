import {
  createClosedHud as createBaseClosedHud,
  createPotionUsageTracker,
  POTION_USAGE_STORAGE_KEY
} from "./closed-hud.js";
import { MOBILE_CLOSED_HUD_STYLES } from "./closed-hud-mobile-styles.js";
import { createSelectProxy } from "./select-proxy.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const STYLE_ID = "pha-closed-hud-polish-style";
const HUD_SETTINGS_BUTTON_ID = "pha-hud-settings-button";
const HUD_SETTINGS_ID = "pha-hud-settings";
const HUD_COLUMNS_STORAGE_KEY = "pokepixel_hunt_analyzer_closed_hud_columns_v1";
const MISC_TAB_ID = "alerts-tab";
const MISC_VIEW_ID = "view-alerts";
const INTERFACE_SECTION_ID = "pha-interface-settings";
const INTERFACE_STAGING_ID = "pha-interface-staging";
const DESKTOP_COMPACT_WIDTH_PX = 415;
const LEGACY_DESKTOP_MIN_WIDTH_PX = 430;
const HUD_SYMBOLS = new Set(["✓", "✕", "$", "↓"]);
const SELECT_PROXY_BY_ELEMENT = new WeakMap();
const SELECT_PROXY_CLEANUP_BY_ELEMENT = new WeakMap();
const LAYOUT_RECONCILE_SELECTOR = [
  ".pha-ui-mode-select",
  "#pha-alpha",
  "#pha-tab-state",
  "#alerts-tab",
  "#view-alerts",
  "#pha-hud-settings-button",
  "#pha-hud-settings",
  "[data-hud-zero-mode]",
  "[data-hud-widget]",
  "[data-hud-preset]",
  "[data-hud-rarity-width]",
  "[data-hud-item]",
  "#view-current .encounter-section select",
  "#view-history .history-filter-grid select",
  ".catch-gallery-rarity-filter"
].join(",");
const NAV_ITEMS = Object.freeze([
  { button: '[data-view="current"]', buttonId: "pha-tab-current", panelId: "view-current" },
  { button: '[data-view="history"]', buttonId: "pha-tab-history", panelId: "view-history" },
  { button: `#${MISC_TAB_ID}`, buttonId: MISC_TAB_ID, panelId: MISC_VIEW_ID },
  { button: `#${HUD_SETTINGS_BUTTON_ID}`, buttonId: HUD_SETTINGS_BUTTON_ID, panelId: HUD_SETTINGS_ID }
]);

function syncSelectProxyMode(proxy, select, shadow) {
  if (!proxy || !select || !shadow?.host) return;
  const mode = shadow.host.dataset.uiMode === "mobile" ? "mobile" : "desktop";
  if (proxy.dataset.uiMode === mode) return;
  proxy.dataset.uiMode = mode;
  proxy.open = false;
  if (mode === "mobile") proxy.prepend(select);
  else proxy.before(select);
}

export function mutationNeedsLayoutReconcile(
  mutations,
  { ElementClass = globalThis.Element } = {}
) {
  if (typeof ElementClass !== "function") return false;

  const containsRelevantControl = (node) =>
    node instanceof ElementClass && (
      node.matches?.(LAYOUT_RECONCILE_SELECTOR) ||
      Boolean(node.querySelector?.(LAYOUT_RECONCILE_SELECTOR))
    );

  return mutations.some((mutation) =>
    containsRelevantControl(mutation.target) ||
    [...mutation.addedNodes, ...mutation.removedNodes].some(containsRelevantControl)
  );
}

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
    padding-right:54px;
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
    right:8px;
    transform:translateY(-50%);
    margin:0;
  }

  /* Desktop keeps the compact footprint and does not reserve an empty scrollbar gutter. */
  :host([data-ui-mode="desktop"]) .panel {
    min-width:${DESKTOP_COMPACT_WIDTH_PX}px !important;
    scrollbar-gutter:auto;
  }

  /* HUD configuration behaves as a navigation view instead of an inline collapse. */
  .pha-hud-settings.pha-hud-exclusive-view {
    border-bottom:0;
  }
  :host([data-ui-mode="mobile"]) .pha-hud-settings.pha-hud-exclusive-view {
    min-height:0;
    flex:1 1 auto;
    overflow-y:auto;
    overscroll-behavior:contain;
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
    padding:5px 52px 5px 8px;
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

  /* Isolated checkpoint: 0 columns = PX mark only. */
  #pha-toggle.pha-custom-hud[data-hud-columns="0"] {
    width:52px !important;
    min-width:52px !important;
    grid-template-columns:32px !important;
    column-gap:0 !important;
  }
  #pha-toggle.pha-custom-hud[data-hud-columns="0"] .pha-hud-grid {
    display:none !important;
  }
  .pha-hud-zero-control {
    margin-bottom:7px;
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

export function normalizeHudColumns(value) {
  return value === 0 || value === "0" ? 0 : 2;
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
    // Current-page choice still applies if storage is unavailable.
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
  let launcher = null;
  let grid = null;
  let style = null;
  let observer = null;
  let layoutObserver = null;
  let layoutReconcileQueued = false;
  let decorating = false;
  let hudColumns = readHudColumns();
  const selectProxyCleanups = new Set();

  function trackSelectProxy(select, destroy) {
    const cleanup = () => {
      destroy();
      SELECT_PROXY_BY_ELEMENT.delete(select);
      SELECT_PROXY_CLEANUP_BY_ELEMENT.delete(select);
      selectProxyCleanups.delete(cleanup);
    };
    SELECT_PROXY_CLEANUP_BY_ELEMENT.set(select, cleanup);
    selectProxyCleanups.add(cleanup);
  }

  function releaseSelectProxy(select) {
    SELECT_PROXY_CLEANUP_BY_ELEMENT.get(select)?.();
  }

  function resolveElements() {
    shadow = document.getElementById(ROOT_ID)?.shadowRoot || null;
    launcher = shadow?.getElementById("pha-toggle") || null;
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

  function compactLegacyDesktopWidth() {
    if (!shadow || shadow.host?.dataset.uiMode !== "desktop") return;
    const panel = shadow.getElementById("pha-panel");
    if (!panel) return;
    const restoredWidth = Number.parseFloat(panel.style.width);
    if (
      Number.isFinite(restoredWidth)
      && restoredWidth >= LEGACY_DESKTOP_MIN_WIDTH_PX
      && restoredWidth <= LEGACY_DESKTOP_MIN_WIDTH_PX + 1
    ) {
      panel.style.width = `${DESKTOP_COMPACT_WIDTH_PX}px`;
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
    const alertsView = shadow.getElementById(MISC_VIEW_ID);
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
    const modeControl = SELECT_PROXY_BY_ELEMENT.get(modeSelect) || modeSelect;
    if (modeSlot && modeControl.parentElement !== modeSlot) modeSlot.appendChild(modeControl);
    if (alphaSlot && alphaButton.parentElement !== alphaSlot) alphaSlot.appendChild(alphaButton);
    shadow.getElementById(INTERFACE_STAGING_ID)?.remove();
  }

  function syncUiModeProxy() {
    const select = shadow?.querySelector(".pha-ui-mode-select");
    const proxy = SELECT_PROXY_BY_ELEMENT.get(select);
    const summary = proxy?.querySelector(".pha-ui-mode-summary");
    if (!select || !summary) return;
    const isMobile = shadow.host?.dataset.uiMode === "mobile";
    if (!isMobile) {
      proxy.before(select);
      releaseSelectProxy(select);
      proxy.remove();
      return;
    }
    if (proxy.dataset.uiMode !== "mobile") {
      proxy.dataset.uiMode = "mobile";
      proxy.open = false;
    }
    const label = select.selectedOptions?.[0]?.textContent || "Auto";
    if (summary.textContent !== label) summary.textContent = label;
  }

  function installUiModeProxy() {
    const select = shadow?.querySelector(".pha-ui-mode-select");
    if (!select || SELECT_PROXY_BY_ELEMENT.has(select)) {
      syncUiModeProxy();
      return;
    }
    if (shadow.host?.dataset.uiMode !== "mobile") return;

    const parent = select.parentElement;
    const anchor = select.previousSibling;
    const { proxy, destroy } = createSelectProxy({
      select,
      classPrefix: "pha-ui-mode",
      ariaLabel: "Analyzer UI mode",
      fallbackLabel: "Auto",
      focusAfterSelect: false,
      onChange: syncUiModeProxy
    });
    if (anchor) anchor.after(proxy);
    else parent?.prepend(proxy);
    SELECT_PROXY_BY_ELEMENT.set(select, proxy);
    trackSelectProxy(select, destroy);
    syncUiModeProxy();
  }

  function placeOperationalStatus() {
    if (!shadow) return;
    const state = shadow.getElementById("pha-tab-state");
    const tabs = shadow.querySelector(".tabs");
    const huntTime = shadow.getElementById("hunt-time");
    const statusRow = shadow.querySelector(".live-card .status-row");
    const actions = shadow.querySelector(".live-card .actions");
    const statusLabel = statusRow?.querySelector(":scope > span:first-child");
    const huntStatus = statusRow?.querySelector(".hunt-status");
    const collapseButton = actions?.querySelector('[data-collapse="hunt"]')
      || statusRow?.querySelector('[data-collapse="hunt"]');
    if (!state || !tabs || !huntTime || !statusRow || !actions
      || !statusLabel || !huntStatus || !collapseButton) return;

    if (shadow.host?.dataset.uiMode === "mobile") {
      if (statusLabel.nextElementSibling !== state
        || state.nextElementSibling !== huntTime
        || huntTime.nextElementSibling !== huntStatus
        || huntStatus.nextElementSibling !== collapseButton) {
        statusLabel.after(state, huntTime, huntStatus, collapseButton);
      }
      return;
    }

    if (collapseButton.parentElement !== actions) actions.appendChild(collapseButton);
    if (huntTime.parentElement !== tabs) tabs.appendChild(huntTime);
    if (state.parentElement !== tabs || huntTime.nextElementSibling !== state) huntTime.after(state);
  }

  function hideHudView() {
    if (!shadow) return;
    const settings = shadow.getElementById(HUD_SETTINGS_ID);
    const settingsButton = shadow.getElementById(HUD_SETTINGS_BUTTON_ID);
    if (settings) {
      settings.hidden = true;
      settings.classList.remove("pha-hud-exclusive-view");
    }
    settingsButton?.classList.remove("active");
    syncNavigationSemantics();
  }

  function showHudView() {
    if (!shadow) return;
    const settings = shadow.getElementById(HUD_SETTINGS_ID);
    const settingsButton = shadow.getElementById(HUD_SETTINGS_BUTTON_ID);
    if (!settings || !settingsButton) return;

    const currentView = shadow.getElementById("view-current");
    const historyView = shadow.getElementById("view-history");
    const miscView = shadow.getElementById(MISC_VIEW_ID);
    if (currentView) currentView.hidden = true;
    if (historyView) historyView.hidden = true;
    if (miscView) miscView.hidden = true;

    for (const tab of shadow.querySelectorAll("[data-view]")) tab.classList.remove("active");
    shadow.getElementById(MISC_TAB_ID)?.classList.remove("active");

    settings.hidden = false;
    settings.classList.add("pha-hud-exclusive-view");
    settingsButton.classList.add("active");
    syncNavigationSemantics();
  }

  function getNavigationItems() {
    if (!shadow) return [];
    return NAV_ITEMS.flatMap((item) => {
      const button = shadow.querySelector(item.button);
      const panel = shadow.getElementById(item.panelId);
      return button && panel ? [{ ...item, button, panel }] : [];
    });
  }

  function syncNavigationSemantics() {
    if (!shadow) return;
    const tabs = shadow.querySelector(".tabs");
    const items = getNavigationItems();
    if (!tabs || items.length === 0) return;

    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Analyzer views");

    for (const item of items) {
      if (!item.button.id) item.button.id = item.buttonId;
      const selected = item.button.classList.contains("active") && !item.panel.hidden;
      item.button.setAttribute("role", "tab");
      item.button.setAttribute("aria-controls", item.panelId);
      item.button.setAttribute("aria-selected", String(selected));
      item.button.tabIndex = selected ? 0 : -1;
      item.panel.setAttribute("role", "tabpanel");
      item.panel.setAttribute("aria-labelledby", item.button.id);
    }
  }

  function bindNavigationKeyboard() {
    for (const item of getNavigationItems()) {
      if (item.button.dataset.navigationKeysBound === "true") continue;
      item.button.dataset.navigationKeysBound = "true";
      item.button.addEventListener("keydown", (event) => {
        const items = getNavigationItems();
        const index = items.findIndex(({ button }) => button === event.currentTarget);
        if (index < 0) return;

        let nextIndex = index;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = items.length - 1;
        else return;

        event.preventDefault();
        items[nextIndex].button.focus();
        items[nextIndex].button.click();
      });
    }
  }

  function bindHudExclusiveNavigation() {
    if (!shadow) return;
    const settingsButton = shadow.getElementById(HUD_SETTINGS_BUTTON_ID);
    if (settingsButton && settingsButton.dataset.hudExclusiveBound !== "true") {
      settingsButton.dataset.hudExclusiveBound = "true";
      settingsButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        showHudView();
      }, true);
    }

    for (const tab of shadow.querySelectorAll("[data-view]")) {
      if (tab.dataset.hudExclusiveBound === "true") continue;
      tab.dataset.hudExclusiveBound = "true";
      tab.addEventListener("click", hideHudView);
    }

    const miscTab = shadow.getElementById(MISC_TAB_ID);
    if (miscTab && miscTab.dataset.hudExclusiveBound !== "true") {
      miscTab.dataset.hudExclusiveBound = "true";
      miscTab.addEventListener("click", hideHudView);
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
      if (miscTab.parentElement !== tabs) tabs.appendChild(miscTab);
      if (miscTab.nextElementSibling !== settingsButton) miscTab.after(settingsButton);
      return;
    }

    if (huntTime && settingsButton.parentElement !== tabs) huntTime.before(settingsButton);
  }

  function applyHudZeroMode() {
    if (!shadow || !launcher) return;
    launcher.dataset.hudColumns = String(hudColumns);

    const settings = shadow.getElementById(HUD_SETTINGS_ID);
    if (!settings) return;
    const pxOnly = hudColumns === 0;
    const select = settings.querySelector("[data-hud-zero-mode]");
    if (select && select.value !== String(hudColumns)) select.value = String(hudColumns);

    const slotConfigs = settings.querySelector(".pha-hud-slot-configs");
    if (slotConfigs) {
      slotConfigs.hidden = pxOnly;
      for (const control of slotConfigs.querySelectorAll("select,input,button")) {
        control.disabled = pxOnly;
      }
    }

    const preset = settings.querySelector("[data-hud-preset]");
    const reset = settings.querySelector("[data-hud-reset]");
    if (preset) preset.disabled = pxOnly;
    if (reset) reset.disabled = pxOnly;

    const inventoryStatus = settings.querySelector("[data-hud-inventory-status]");
    if (inventoryStatus) inventoryStatus.hidden = pxOnly;

    const summary = settings.querySelector(".pha-hud-settings-head small");
    if (summary) {
      summary.textContent = pxOnly
        ? "PX icon only · widget config preserved"
        : "4 layout units · changes apply instantly";
    }
  }

  function installHudZeroModeControl() {
    if (!shadow) return;
    const settings = shadow.getElementById(HUD_SETTINGS_ID);
    if (!settings || settings.querySelector("[data-hud-zero-mode]")) {
      applyHudZeroMode();
      return;
    }

    const control = document.createElement("label");
    control.className = "pha-hud-zero-control";
    control.innerHTML = `
      Columns
      <select data-hud-zero-mode aria-label="Closed HUD columns">
        <option value="2">2 · Current HUD</option>
        <option value="0">0 · PX only</option>
      </select>`;

    const head = settings.querySelector(".pha-hud-settings-head");
    if (head) head.after(control);
    else settings.prepend(control);

    const select = control.querySelector("[data-hud-zero-mode]");
    select.value = String(hudColumns);
    select.addEventListener("change", () => {
      hudColumns = normalizeHudColumns(select.value);
      writeHudColumns(hudColumns);
      applyHudZeroMode();
      window.dispatchEvent(new Event("resize"));
    });
    applyHudZeroMode();
  }

  function syncHudColumnsProxy() {
    const select = shadow?.querySelector("[data-hud-zero-mode]");
    const proxy = SELECT_PROXY_BY_ELEMENT.get(select);
    const summary = proxy?.querySelector(".pha-hud-columns-summary");
    if (!select || !summary) return;
    syncSelectProxyMode(proxy, select, shadow);
    const label = select.selectedOptions?.[0]?.textContent || "Columns";
    if (summary.textContent !== label) summary.textContent = label;
  }

  function installHudColumnsProxy() {
    const select = shadow?.querySelector("[data-hud-zero-mode]");
    if (!select || SELECT_PROXY_BY_ELEMENT.has(select)) {
      syncHudColumnsProxy();
      return;
    }

    const parent = select.parentElement;
    const anchor = select.previousSibling;
    const { proxy, destroy } = createSelectProxy({
      select,
      classPrefix: "pha-hud-columns",
      ariaLabel: "Closed HUD columns",
      fallbackLabel: "Columns",
      onChange: syncHudColumnsProxy
    });
    if (anchor) anchor.after(proxy);
    else parent?.prepend(proxy);
    SELECT_PROXY_BY_ELEMENT.set(select, proxy);
    trackSelectProxy(select, destroy);
    syncHudColumnsProxy();
  }

  function syncHudWidgetProxies() {
    for (const select of shadow?.querySelectorAll("[data-hud-widget]") || []) {
      const proxy = SELECT_PROXY_BY_ELEMENT.get(select);
      const summary = proxy?.querySelector(".pha-hud-widget-summary");
      if (!summary) continue;
      syncSelectProxyMode(proxy, select, shadow);
      const label = select.selectedOptions?.[0]?.textContent || "Widget";
      if (summary.textContent !== label) summary.textContent = label;
      if (proxy.hidden !== select.hidden) proxy.hidden = select.hidden;
    }
  }

  function installHudWidgetProxies() {
    for (const select of shadow?.querySelectorAll("[data-hud-widget]") || []) {
      if (SELECT_PROXY_BY_ELEMENT.has(select)) continue;
      const parent = select.parentElement;
      const anchor = select.previousSibling;
      const { proxy, destroy } = createSelectProxy({
        select,
        classPrefix: "pha-hud-widget",
        ariaLabel: `HUD widget ${Number(select.dataset.hudWidget) + 1}`,
        fallbackLabel: "Widget",
        getSelectedLabel: () => select.selectedOptions?.[0]?.textContent,
        onChange: syncHudWidgetProxies,
        onOpen: (currentProxy) => {
          for (const other of shadow.querySelectorAll(".pha-hud-widget-proxy[open]")) {
            if (other !== currentProxy) other.open = false;
          }
        }
      });
      if (anchor) anchor.after(proxy);
      else parent?.prepend(proxy);
      SELECT_PROXY_BY_ELEMENT.set(select, proxy);
      trackSelectProxy(select, destroy);
    }
    syncHudWidgetProxies();
  }

  function syncHudPresetProxy() {
    const select = shadow?.querySelector("[data-hud-preset]");
    const proxy = SELECT_PROXY_BY_ELEMENT.get(select);
    const summary = proxy?.querySelector(".pha-hud-preset-summary");
    if (!select || !summary) return;
    syncSelectProxyMode(proxy, select, shadow);
    const label = select.selectedOptions?.[0]?.textContent || "Preset";
    if (summary.textContent !== label) summary.textContent = label;
    if (proxy.hidden !== select.hidden) proxy.hidden = select.hidden;
  }

  function installHudPresetProxy() {
    const select = shadow?.querySelector("[data-hud-preset]");
    if (!select || SELECT_PROXY_BY_ELEMENT.has(select)) {
      syncHudPresetProxy();
      return;
    }
    const parent = select.parentElement;
    const anchor = select.previousSibling;
    const { proxy, destroy } = createSelectProxy({
      select,
      classPrefix: "pha-hud-preset",
      ariaLabel: "HUD preset",
      fallbackLabel: "Preset",
      onChange: syncHudPresetProxy
    });
    if (anchor) anchor.after(proxy);
    else parent?.prepend(proxy);
    SELECT_PROXY_BY_ELEMENT.set(select, proxy);
    trackSelectProxy(select, destroy);
    syncHudPresetProxy();
  }

  function syncHudRarityWidthProxies() {
    for (const select of shadow?.querySelectorAll("[data-hud-rarity-width]") || []) {
      const proxy = SELECT_PROXY_BY_ELEMENT.get(select);
      const summary = proxy?.querySelector(".pha-hud-width-summary");
      if (!summary) continue;
      syncSelectProxyMode(proxy, select, shadow);
      const label = select.selectedOptions?.[0]?.textContent || "Width";
      if (summary.textContent !== label) summary.textContent = label;
      if (proxy.hidden !== select.hidden) proxy.hidden = select.hidden;
    }
  }

  function installHudRarityWidthProxies() {
    for (const select of shadow?.querySelectorAll("[data-hud-rarity-width]") || []) {
      if (SELECT_PROXY_BY_ELEMENT.has(select)) continue;
      const parent = select.parentElement;
      const anchor = select.previousSibling;
      const { proxy, destroy } = createSelectProxy({
        select,
        classPrefix: "pha-hud-width",
        ariaLabel: `Rarity widget width ${Number(select.dataset.hudRarityWidth) + 1}`,
        fallbackLabel: "Width",
        getSelectedLabel: () => select.selectedOptions?.[0]?.textContent,
        onChange: syncHudRarityWidthProxies
      });
      if (anchor) anchor.after(proxy);
      else parent?.prepend(proxy);
      SELECT_PROXY_BY_ELEMENT.set(select, proxy);
      trackSelectProxy(select, destroy);
    }
    syncHudRarityWidthProxies();
  }

  function syncHudItemProxies() {
    for (const select of shadow?.querySelectorAll("[data-hud-item]") || []) {
      const proxy = SELECT_PROXY_BY_ELEMENT.get(select);
      const summary = proxy?.querySelector(".pha-hud-item-summary");
      if (!summary) continue;
      syncSelectProxyMode(proxy, select, shadow);
      const label = select.selectedOptions?.[0]?.textContent || "Select item";
      if (summary.textContent !== label) summary.textContent = label;
      if (proxy.hidden !== select.hidden) proxy.hidden = select.hidden;
    }
  }

  function installHudItemProxies() {
    for (const select of shadow?.querySelectorAll("[data-hud-item]") || []) {
      if (SELECT_PROXY_BY_ELEMENT.has(select)) continue;
      const parent = select.parentElement;
      const anchor = select.previousSibling;
      const { proxy, destroy } = createSelectProxy({
        select,
        classPrefix: "pha-hud-item",
        ariaLabel: `HUD item ${Number(select.dataset.hudItem) + 1}`,
        fallbackLabel: "Select item",
        getSelectedLabel: () => select.selectedOptions?.[0]?.textContent,
        onChange: syncHudItemProxies
      });
      if (anchor) anchor.after(proxy);
      else parent?.prepend(proxy);
      SELECT_PROXY_BY_ELEMENT.set(select, proxy);
      trackSelectProxy(select, destroy);
    }
    syncHudItemProxies();
  }

  function syncCurrentShinyProxies() {
    for (const select of shadow?.querySelectorAll("#view-current .encounter-section select") || []) {
      const proxy = SELECT_PROXY_BY_ELEMENT.get(select);
      const summary = proxy?.querySelector(".pha-current-select-summary");
      if (!summary) continue;
      syncSelectProxyMode(proxy, select, shadow);
      const label = select.selectedOptions?.[0]?.textContent || "All (*)";
      if (summary.textContent !== label) summary.textContent = label;
    }
  }

  function installCurrentShinyProxies() {
    for (const select of shadow?.querySelectorAll("#view-current .encounter-section select") || []) {
      if (SELECT_PROXY_BY_ELEMENT.has(select)) continue;
      const parent = select.parentElement;
      const anchor = select.previousSibling;
      const { proxy, destroy } = createSelectProxy({
        select,
        classPrefix: "pha-current-select",
        ariaLabel: select.getAttribute("aria-label") || "Current Shiny filter",
        fallbackLabel: "All (*)",
        getSelectedLabel: () => select.selectedOptions?.[0]?.textContent,
        onChange: syncCurrentShinyProxies
      });
      if (anchor) anchor.after(proxy);
      else parent?.prepend(proxy);
      SELECT_PROXY_BY_ELEMENT.set(select, proxy);
      trackSelectProxy(select, destroy);
    }
    syncCurrentShinyProxies();
  }

  function syncHistoryFilterProxies() {
    for (const select of shadow?.querySelectorAll("#view-history .history-filter-grid select") || []) {
      const proxy = SELECT_PROXY_BY_ELEMENT.get(select);
      const summary = proxy?.querySelector(".pha-history-select-summary");
      if (!summary) continue;
      syncSelectProxyMode(proxy, select, shadow);
      const label = select.selectedOptions?.[0]?.textContent || "All (*)";
      if (summary.textContent !== label) summary.textContent = label;
      if (proxy.hidden !== select.hidden) proxy.hidden = select.hidden;
    }
  }

  function installHistoryFilterProxies() {
    for (const select of shadow?.querySelectorAll("#view-history .history-filter-grid select") || []) {
      if (SELECT_PROXY_BY_ELEMENT.has(select)) continue;
      const parent = select.parentElement;
      const anchor = select.previousSibling;
      const { proxy, destroy } = createSelectProxy({
        select,
        classPrefix: "pha-history-select",
        ariaLabel: select.getAttribute("aria-label") || select.id || "History filter",
        fallbackLabel: "All (*)",
        getSelectedLabel: () => select.selectedOptions?.[0]?.textContent,
        onChange: syncHistoryFilterProxies,
        onOpen: (currentProxy) => {
          for (const other of shadow.querySelectorAll(".pha-history-select-proxy[open]")) {
            if (other !== currentProxy) other.open = false;
          }
        }
      });
      if (anchor) anchor.after(proxy);
      else parent?.prepend(proxy);
      SELECT_PROXY_BY_ELEMENT.set(select, proxy);
      trackSelectProxy(select, destroy);
    }
    syncHistoryFilterProxies();
  }

  function syncCatchGalleryProxy() {
    const select = shadow?.querySelector(".catch-gallery-rarity-filter");
    const proxy = SELECT_PROXY_BY_ELEMENT.get(select);
    const summary = proxy?.querySelector(".pha-gallery-select-summary");
    if (!select || !summary) return;
    syncSelectProxyMode(proxy, select, shadow);
    const label = select.selectedOptions?.[0]?.textContent || "All rarities";
    if (summary.textContent !== label) summary.textContent = label;
  }

  function installCatchGalleryProxy() {
    const select = shadow?.querySelector(".catch-gallery-rarity-filter");
    if (!select || SELECT_PROXY_BY_ELEMENT.has(select)) {
      syncCatchGalleryProxy();
      return;
    }
    const parent = select.parentElement;
    const anchor = select.previousSibling;
    const { proxy, destroy } = createSelectProxy({
      select,
      classPrefix: "pha-gallery-select",
      ariaLabel: "Filter Catch Gallery by rarity",
      fallbackLabel: "All rarities",
      onChange: syncCatchGalleryProxy
    });
    if (anchor) anchor.after(proxy);
    else parent?.prepend(proxy);
    SELECT_PROXY_BY_ELEMENT.set(select, proxy);
    trackSelectProxy(select, destroy);
    syncCatchGalleryProxy();
  }

  function applyLayoutPolish() {
    normalizeHeaderVersion();
    compactLegacyDesktopWidth();
    stageInterfaceControls();
    ensureMiscInterfaceSettings();
    installUiModeProxy();
    placeOperationalStatus();
    placeHudSettingsNextToMisc();
    bindHudExclusiveNavigation();
    bindNavigationKeyboard();
    syncNavigationSemantics();
    syncHudColumnsProxy();
    syncHudWidgetProxies();
    syncHudPresetProxy();
    syncHudRarityWidthProxies();
    syncHudItemProxies();
    syncCurrentShinyProxies();
    syncHistoryFilterProxies();
    installCatchGalleryProxy();
  }

  function observeLayout() {
    layoutObserver?.disconnect();
    layoutObserver = null;
    if (!shadow || typeof MutationObserver === "undefined") return;

    layoutObserver = new MutationObserver((mutations) => {
      if (
        layoutReconcileQueued ||
        !mutationNeedsLayoutReconcile(mutations)
      ) return;

      layoutReconcileQueued = true;
      queueMicrotask(() => {
        layoutReconcileQueued = false;
        if (shadow) applyLayoutPolish();
      });
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
    installHudZeroModeControl();
    installHudColumnsProxy();
    installHudWidgetProxies();
    installHudPresetProxy();
    installHudRarityWidthProxies();
    installHudItemProxies();
    installCurrentShinyProxies();
    installHistoryFilterProxies();
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
  }

  function dispose() {
    observer?.disconnect();
    observer = null;
    layoutObserver?.disconnect();
    layoutObserver = null;
    layoutReconcileQueued = false;
    for (const cleanup of [...selectProxyCleanups]) cleanup();
    style?.remove();
    if (launcher) launcher.removeAttribute("data-hud-columns");
    hud.dispose();
    shadow = null;
    launcher = null;
    grid = null;
    style = null;
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
