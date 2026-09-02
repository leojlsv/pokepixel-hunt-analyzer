import { STYLES } from "./styles.js";
import { MOBILE_STYLES } from "./mobile-styles.js";
import { createCurrentView } from "./current-view.js";
import { createHistoryView } from "./history-view.js";
import { createUiMarkup, REF_CODE } from "./ui-markup.js";
import {
  normalizeUiModeOverride,
  resolveUiMode
} from "./ui-mode.js";
import { createUiStateStore } from "./ui-state.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const COLLAPSE_KEY = "pokepixel_hunt_analyzer_collapsed_v1";
const ALPHA_KEY = "pokepixel_hunt_analyzer_alpha_v1";
const EDGE_GAP = 8;
const MIN_PANEL_WIDTH_PX = 430;
const MIN_PANEL_HEIGHT_PX = 280;
const ALPHA_LEVELS = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
const MOBILE_LAUNCHER_DRAG_THRESHOLD_PX = 8;
const DESKTOP_LAUNCHER_DRAG_THRESHOLD_PX = 4;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function createUi({
  onSessionAction,
  onLoadHistorySessions,
  onLoadHistorySessionEncounters
}) {
  const uiStateStore = createUiStateStore(localStorage);
  const initialUiState = uiStateStore.read();
  const uiMode = resolveUiMode({
    override: initialUiState.shared.modeOverride,
    matchMedia: window.matchMedia?.bind(window),
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight
  });

  let host;
  let shadow;
  let panel;
  let launcher;
  let resizeHandle;
  let activeView = "current";
  let suppressLauncherClick = false;
  let currentView;
  let historyView;

  mount();

  function mount() {
    document.getElementById(ROOT_ID)?.remove();

    host = document.createElement("div");
    host.id = ROOT_ID;
    host.dataset.uiMode = uiMode;
    shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `${STYLES}\n${MOBILE_STYLES}`;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = createUiMarkup();
    shadow.append(style, wrapper);
    document.documentElement.appendChild(host);

    panel = shadow.getElementById("pha-panel");
    if (uiMode === "desktop") {
      panel.style.minWidth = `${MIN_PANEL_WIDTH_PX}px`;
      panel.style.minHeight = `${MIN_PANEL_HEIGHT_PX}px`;
    }
    launcher = shadow.getElementById("pha-toggle");
    currentView = createCurrentView(shadow);
    historyView = createHistoryView(shadow, {
      loadSessions: onLoadHistorySessions,
      loadSessionEncounters: onLoadHistorySessionEncounters
    });

    bindUiEvents();
    installUiModeControl();
    restoreUiState();
    if (uiMode === "desktop") {
      installPanelDrag();
      installBottomLeftResize();
      installWheelScrolling();
      installResizePersistence();
    }
    installLauncherDrag();
    installViewportGuard();
    applyCollapseState();
    applyAlpha(readAlpha());
  }

  function bindUiEvents() {
    shadow.getElementById("pha-close").addEventListener("click", () => setPanelOpen(false));
    shadow.getElementById("pha-alpha").addEventListener("click", cycleAlpha);
    shadow.getElementById("pha-refcode").addEventListener("click", copyRefCode);

    for (const tab of shadow.querySelectorAll("[data-view]")) {
      tab.addEventListener("click", () => switchView(tab.dataset.view));
    }

    shadow.getElementById("new-hunt").addEventListener("click", () => onSessionAction("new"));
    shadow.getElementById("end-hunt").addEventListener("click", () => onSessionAction("end"));
    shadow.getElementById("pause-resume").addEventListener("click", (event) => {
      onSessionAction(event.currentTarget.dataset.action || "pause");
    });

    for (const button of shadow.querySelectorAll("[data-collapse]")) {
      button.addEventListener("click", () => toggleCollapse(button.dataset.collapse));
    }
  }

  function installUiModeControl() {
    const meta = shadow.querySelector(".brand-meta");
    if (!meta) return;

    const select = document.createElement("select");
    select.className = "pha-ui-mode-select";
    select.title = `UI mode: ${initialUiState.shared.modeOverride} · active: ${uiMode}`;
    select.setAttribute("aria-label", "Analyzer UI mode");

    for (const [value, label] of [
      ["auto", "Auto"],
      ["desktop", "Desktop"],
      ["mobile", "Mobile"]
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }

    select.value = normalizeUiModeOverride(initialUiState.shared.modeOverride);
    select.addEventListener("change", () => {
      uiStateStore.patchShared({ modeOverride: normalizeUiModeOverride(select.value) });
      window.location.reload();
    });
    meta.appendChild(select);
  }

  function switchView(view) {
    activeView = view === "history" ? "history" : "current";
    shadow.getElementById("view-current").hidden = activeView !== "current";
    shadow.getElementById("view-history").hidden = activeView !== "history";
    for (const tab of shadow.querySelectorAll("[data-view]")) {
      tab.classList.toggle("active", tab.dataset.view === activeView);
    }
    saveUiState({ view: activeView });

    if (activeView === "history") {
      historyView.refresh().catch((error) => {
        console.error("PokePixel Hunt Analyzer (History):", error);
      });
    }
  }

  function renderCurrent(state) {
    currentView.render(state);
  }

  function setActive(isActive) {
    const badge = shadow.getElementById("pha-tab-state");
    badge.textContent = isActive ? "ACTIVE" : "STANDBY";
    badge.className = isActive ? "state active" : "state standby";
    badge.title = `Analyzer ${badge.textContent}`;
    badge.setAttribute("aria-label", badge.title);
  }

  function setPanelOpen(open) {
    panel.hidden = !open;
    if (uiMode === "mobile") launcher.hidden = open;
    if (resizeHandle) resizeHandle.hidden = !open;
    saveUiState({ open });
    if (open && uiMode === "desktop") {
      fitToViewport(panel);
      syncResizeHandle();
    }
  }

  function saveUiState(patch) {
    uiStateStore.patchShared(patch);
  }

  function savePanelGeometry() {
    if (uiMode !== "desktop" || panel.hidden) return;
    const rect = panel.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return;
    uiStateStore.patchDesktop({
      panel: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    });
  }

  function saveLauncherGeometry() {
    if (launcher.hidden) return;
    const rect = launcher.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const launcherGeometry = {
      left: Math.round(rect.left),
      top: Math.round(rect.top)
    };
    if (uiMode === "mobile") uiStateStore.patchMobile({ launcher: launcherGeometry });
    else uiStateStore.patchDesktop({ launcher: launcherGeometry });
  }

  function applyPanelGeometry(panelState) {
    if (!panelState) return;
    if (Number.isFinite(panelState.width)) panel.style.width = `${panelState.width}px`;
    if (Number.isFinite(panelState.height)) panel.style.height = `${panelState.height}px`;
    if (Number.isFinite(panelState.left) && Number.isFinite(panelState.top)) {
      panel.style.left = `${panelState.left}px`;
      panel.style.top = `${panelState.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }
  }

  function applyLauncherGeometry(launcherState) {
    if (!launcherState) return;
    if (Number.isFinite(launcherState.left) && Number.isFinite(launcherState.top)) {
      launcher.style.left = `${launcherState.left}px`;
      launcher.style.top = `${launcherState.top}px`;
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
    }
  }

  function restoreUiState() {
    const state = uiStateStore.read();
    if (uiMode === "desktop") {
      applyPanelGeometry(state.desktop.panel);
      applyLauncherGeometry(state.desktop.launcher);
    } else {
      applyLauncherGeometry(state.mobile.launcher);
    }

    fitToViewport(launcher);
    switchView(state.shared.view);
    setPanelOpen(state.shared.open === true);
  }

  function safeAreaInset(name) {
    if (uiMode !== "mobile" || !host) return 0;
    const raw = getComputedStyle(host).getPropertyValue(`--pha-safe-${name}`);
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function viewportBounds() {
    if (uiMode !== "mobile") {
      return {
        left: EDGE_GAP,
        top: EDGE_GAP,
        right: window.innerWidth - EDGE_GAP,
        bottom: window.innerHeight - EDGE_GAP
      };
    }

    const visual = window.visualViewport;
    const viewportLeft = Number.isFinite(visual?.offsetLeft) ? visual.offsetLeft : 0;
    const viewportTop = Number.isFinite(visual?.offsetTop) ? visual.offsetTop : 0;
    const viewportWidth = Number.isFinite(visual?.width) ? visual.width : window.innerWidth;
    const viewportHeight = Number.isFinite(visual?.height) ? visual.height : window.innerHeight;

    return {
      left: viewportLeft + safeAreaInset("left") + EDGE_GAP,
      top: viewportTop + safeAreaInset("top") + EDGE_GAP,
      right: viewportLeft + viewportWidth - safeAreaInset("right") - EDGE_GAP,
      bottom: viewportTop + viewportHeight - safeAreaInset("bottom") - EDGE_GAP
    };
  }

  function fitToViewport(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const bounds = viewportBounds();
    const left = clamp(rect.left, bounds.left, bounds.right - rect.width);
    const top = clamp(rect.top, bounds.top, bounds.bottom - rect.height);
    if (left !== rect.left || top !== rect.top) {
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.style.right = "auto";
      element.style.bottom = "auto";
    }
  }

  function installPanelDrag() {
    const handle = shadow.querySelector(".topbar");
    let drag = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest("button, .state, select")) return;
      const rect = panel.getBoundingClientRect();
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const bounds = viewportBounds();
      const left = clamp(
        event.clientX - drag.offsetX,
        bounds.left,
        bounds.right - panel.offsetWidth
      );
      const top = clamp(
        event.clientY - drag.offsetY,
        bounds.top,
        bounds.bottom - panel.offsetHeight
      );
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      syncResizeHandle();
    });

    const finish = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      savePanelGeometry();
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  }

  function installLauncherDrag() {
    let drag = null;
    const threshold = uiMode === "mobile"
      ? MOBILE_LAUNCHER_DRAG_THRESHOLD_PX
      : DESKTOP_LAUNCHER_DRAG_THRESHOLD_PX;

    launcher.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const rect = launcher.getBoundingClientRect();
      launcher.style.left = `${rect.left}px`;
      launcher.style.top = `${rect.top}px`;
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        moved: false
      };
      launcher.setPointerCapture(event.pointerId);
    });

    launcher.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > threshold) {
        drag.moved = true;
      }
      if (!drag.moved) return;
      const bounds = viewportBounds();
      const left = clamp(
        event.clientX - drag.offsetX,
        bounds.left,
        bounds.right - launcher.offsetWidth
      );
      const top = clamp(
        event.clientY - drag.offsetY,
        bounds.top,
        bounds.bottom - launcher.offsetHeight
      );
      launcher.style.left = `${left}px`;
      launcher.style.top = `${top}px`;
      event.preventDefault();
    });

    const finish = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      suppressLauncherClick = drag.moved;
      if (launcher.hasPointerCapture(event.pointerId)) launcher.releasePointerCapture(event.pointerId);
      if (drag.moved) saveLauncherGeometry();
      drag = null;
    };
    launcher.addEventListener("pointerup", finish);
    launcher.addEventListener("pointercancel", finish);
    launcher.addEventListener("click", (event) => {
      if (suppressLauncherClick) {
        suppressLauncherClick = false;
        event.preventDefault();
        return;
      }
      setPanelOpen(panel.hidden);
    });
  }

  function installResizePersistence() {
    let timer = null;
    new ResizeObserver(() => {
      if (panel.hidden) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        fitToViewport(panel);
        syncResizeHandle();
        savePanelGeometry();
      }, 120);
    }).observe(panel);
  }

  function installBottomLeftResize() {
    resizeHandle = document.createElement("button");
    resizeHandle.type = "button";
    resizeHandle.className = "resize-bottom-left";
    resizeHandle.title = "Resize from bottom-left";
    shadow.appendChild(resizeHandle);

    let resize = null;
    resizeHandle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const rect = panel.getBoundingClientRect();
      const computed = getComputedStyle(panel);
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      resize = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        startRight: rect.right,
        startHeight: rect.height,
        minWidth: Number.parseFloat(computed.minWidth) || MIN_PANEL_WIDTH_PX,
        minHeight: Number.parseFloat(computed.minHeight) || MIN_PANEL_HEIGHT_PX
      };
      resizeHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });

    resizeHandle.addEventListener("pointermove", (event) => {
      if (!resize || event.pointerId !== resize.pointerId) return;
      const left = clamp(
        resize.startLeft + event.clientX - resize.startX,
        EDGE_GAP,
        resize.startRight - resize.minWidth
      );
      const width = resize.startRight - left;
      const maxHeight = Math.max(
        resize.minHeight,
        window.innerHeight - resize.startTop - EDGE_GAP
      );
      const height = clamp(
        resize.startHeight + event.clientY - resize.startY,
        resize.minHeight,
        maxHeight
      );
      panel.style.left = `${left}px`;
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
      syncResizeHandle();
      event.preventDefault();
      event.stopPropagation();
    });

    const finish = (event) => {
      if (!resize || event.pointerId !== resize.pointerId) return;
      resize = null;
      if (resizeHandle.hasPointerCapture(event.pointerId)) {
        resizeHandle.releasePointerCapture(event.pointerId);
      }
      syncResizeHandle();
      savePanelGeometry();
    };
    resizeHandle.addEventListener("pointerup", finish);
    resizeHandle.addEventListener("pointercancel", finish);
    syncResizeHandle();
  }

  function syncResizeHandle() {
    if (!resizeHandle) return;
    if (panel.hidden) {
      resizeHandle.hidden = true;
      return;
    }
    const rect = panel.getBoundingClientRect();
    resizeHandle.hidden = rect.width <= 0 || rect.height <= 0;
    if (resizeHandle.hidden) return;
    resizeHandle.style.left = `${Math.round(rect.left)}px`;
    resizeHandle.style.top = `${Math.round(rect.bottom - 15)}px`;
  }

  function scrollableFromEvent(event, axis, delta) {
    const overflowProperty = axis === "x" ? "overflowX" : "overflowY";
    const sizeProperty = axis === "x" ? "scrollWidth" : "scrollHeight";
    const clientProperty = axis === "x" ? "clientWidth" : "clientHeight";
    const positionProperty = axis === "x" ? "scrollLeft" : "scrollTop";

    for (const node of event.composedPath()) {
      if (!(node instanceof Element)) continue;
      const computed = getComputedStyle(node);
      if (!/(auto|scroll|overlay)/.test(computed[overflowProperty])) continue;
      if (node[sizeProperty] <= node[clientProperty] + 1) continue;
      const position = node[positionProperty];
      const max = node[sizeProperty] - node[clientProperty];
      if (delta < 0 ? position > 0 : position < max) return node;
      if (node === panel) break;
    }

    return panel[sizeProperty] > panel[clientProperty] + 1 ? panel : null;
  }

  function installWheelScrolling() {
    panel.addEventListener("wheel", (event) => {
      if (event.ctrlKey) return;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const axis = horizontal ? "x" : "y";
      const delta = horizontal ? event.deltaX : event.deltaY;
      if (!delta) return;
      const target = scrollableFromEvent(event, axis, delta);
      if (!target) return;
      if (axis === "x") target.scrollLeft += delta;
      else target.scrollTop += delta;
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true, passive: false });
  }

  function installViewportGuard() {
    let timer = null;

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (uiMode === "desktop") {
          if (!panel.hidden) {
            fitToViewport(panel);
            savePanelGeometry();
          }
          if (!launcher.hidden) {
            fitToViewport(launcher);
            saveLauncherGeometry();
          }
          syncResizeHandle();
          return;
        }

        if (!launcher.hidden) fitToViewport(launcher);
      }, 100);
    };

    window.addEventListener("resize", schedule);
    if (uiMode === "mobile") {
      window.addEventListener("orientationchange", schedule);
      window.visualViewport?.addEventListener("resize", schedule);
      window.visualViewport?.addEventListener("scroll", schedule);
    }
  }

  function readCollapseState() {
    return readJson(COLLAPSE_KEY, {});
  }

  function applyCollapseState() {
    const state = readCollapseState();
    for (const key of ["hunt", "rarity", "captured", "failed"]) {
      setCollapsed(key, state[key] === true);
    }
  }

  function toggleCollapse(key) {
    const state = readCollapseState();
    state[key] = !state[key];
    writeJson(COLLAPSE_KEY, state);
    setCollapsed(key, state[key]);
  }

  function setCollapsed(key, collapsed) {
    const target = key === "hunt"
      ? shadow.getElementById("hunt-section")
      : shadow.getElementById(`${key}-section`);
    const button = shadow.querySelector(`[data-collapse="${key}"]`);
    if (!target || !button) return;
    target.classList.toggle(key === "hunt" ? "hunt-collapsed" : "collapsed", collapsed);
    button.textContent = collapsed ? "▸" : "▾";
    button.title = collapsed ? "Expand" : "Collapse";
    button.setAttribute("aria-expanded", String(!collapsed));
  }

  function readAlpha() {
    const value = Number(localStorage.getItem(ALPHA_KEY));
    return ALPHA_LEVELS.includes(value) ? value : 1;
  }

  function cycleAlpha() {
    const current = readAlpha();
    const index = Math.max(0, ALPHA_LEVELS.indexOf(current));
    const next = ALPHA_LEVELS[(index + 1) % ALPHA_LEVELS.length];
    localStorage.setItem(ALPHA_KEY, String(next));
    applyAlpha(next);
  }

  function applyAlpha(alpha) {
    for (const element of [panel, launcher, resizeHandle]) {
      if (element) element.style.opacity = String(alpha);
    }
    const percent = Math.round(alpha * 100);
    const button = shadow.getElementById("pha-alpha");
    button.textContent = `α ${percent}%`;
    button.title = `Analyzer alpha: ${percent}% · click to change`;
  }

  async function copyRefCode(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    let copied = false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(REF_CODE);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = REF_CODE;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.documentElement.appendChild(textarea);
      textarea.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      textarea.remove();
    }

    button.title = copied ? "Copied!" : `Ref code: ${REF_CODE}`;
    window.setTimeout(() => {
      button.title = `Copy ref code ${REF_CODE}`;
    }, 1_200);
  }

  return {
    renderCurrent,
    setActive,
    getActiveView: () => activeView,
    getUiMode: () => uiMode
  };
}
