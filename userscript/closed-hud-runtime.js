import {
  createClosedHud as createBaseClosedHud,
  createPotionUsageTracker,
  POTION_USAGE_STORAGE_KEY
} from "./closed-hud.js";
import { MOBILE_CLOSED_HUD_STYLES } from "./closed-hud-mobile-styles.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const STYLE_ID = "pha-closed-hud-polish-style";
const HUD_SETTINGS_BUTTON_ID = "pha-hud-settings-button";
const HUD_SETTINGS_ID = "pha-hud-settings";
const MISC_TAB_ID = "alerts-tab";
const MISC_VIEW_ID = "view-alerts";
const INTERFACE_SECTION_ID = "pha-interface-settings";
const INTERFACE_STAGING_ID = "pha-interface-staging";
const DESKTOP_COMPACT_WIDTH_PX = 415;
const LEGACY_DESKTOP_MIN_WIDTH_PX = 430;
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

  function hideHudView() {
    if (!shadow) return;
    const settings = shadow.getElementById(HUD_SETTINGS_ID);
    const settingsButton = shadow.getElementById(HUD_SETTINGS_BUTTON_ID);
    if (settings) {
      settings.hidden = true;
      settings.classList.remove("pha-hud-exclusive-view");
    }
    settingsButton?.classList.remove("active");
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
      if (miscTab.nextElementSibling !== settingsButton) miscTab.after(settingsButton);
      return;
    }

    if (huntTime && settingsButton.parentElement !== tabs) huntTime.before(settingsButton);
  }

  function applyLayoutPolish() {
    normalizeHeaderVersion();
    compactLegacyDesktopWidth();
    stageInterfaceControls();
    ensureMiscInterfaceSettings();
    placeOperationalStatus();
    placeHudSettingsNextToMisc();
    bindHudExclusiveNavigation();
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