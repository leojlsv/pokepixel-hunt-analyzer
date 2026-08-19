import { STYLES } from "./styles.js";
import { createCompareView } from "./compare-view.js";
import { createCurrentView } from "./current-view.js";
import { RARITIES } from "./ui-utils.js";

const APP_VERSION = __APP_VERSION__;
const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_STATE_KEY = "pokepixel_hunt_analyzer_ui_v1";
const COLLAPSE_KEY = "pokepixel_hunt_analyzer_collapsed_v1";
const ALPHA_KEY = "pokepixel_hunt_analyzer_alpha_v1";
const REF_CODE = "Q4BSZJD";
const EDGE_GAP = 8;
const MIN_PANEL_WIDTH_PX = 430;
const MIN_PANEL_HEIGHT_PX = 280;
const ALPHA_LEVELS = [1, 0.9, 0.8, 0.7, 0.6, 0.5];

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

function createRarityRowsMarkup() {
  return RARITIES.map(([key, label]) => `
    <tr data-rarity="${key}">
      <td class="rarity-${key}">${label}</td>
      <td data-field="seen">0</td>
      <td data-field="captured">0</td>
      <td data-field="failed">0</td>
      <td data-field="rate">—</td>
    </tr>`).join("");
}

function createHudRarityMarkup() {
  return RARITIES.map(([key, label], index) => {
    const separator = index < RARITIES.length - 1
      ? '<span class="separator" aria-hidden="true">-</span>'
      : "";
    return `<span id="hud-${key}" class="rarity-${key}" title="${label} captured">0</span>${separator}`;
  }).join("");
}

function encounterSectionMarkup(prefix, title) {
  return `
    <section id="${prefix}-section" class="section encounter-section">
      <div class="section-head">
        <h3>${title}</h3>
        <div class="section-meta">
          <span id="${prefix}-count" class="section-badge">0 Pokémons</span>
          <button class="collapse-button" data-collapse="${prefix}" type="button" title="Collapse">▾</button>
        </div>
      </div>
      <div class="filters">
        <label>Rarity<select id="${prefix}-rarity"></select></label>
        <label>Quality &gt;<input id="${prefix}-quality" type="number" step="0.01"></label>
        <label>IV &gt;<input id="${prefix}-iv" type="number" step="1"></label>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Pokémon</th><th title="Gender">G</th><th>Nat</th><th>Qlt</th><th title="IV Total (HP-ATK-DEF-SATK-SDEF-SPE)">IV</th></tr></thead>
          <tbody id="${prefix}-body"></tbody>
        </table>
      </div>
    </section>`;
}

function createMarkup() {
  return `
    <button id="pha-toggle" class="launcher" type="button" aria-label="PokePixel Hunt Analyzer">
      <span class="hud-mark">PX</span>
      <span class="hud-content">
        <span class="hud-xp"><span>XP/h</span><strong id="hud-xp">—</strong></span>
        <span class="hud-rarities" aria-label="Captured by rarity">${createHudRarityMarkup()}</span>
      </span>
    </button>

    <aside id="pha-panel" class="panel" hidden>
      <header class="topbar">
        <div class="brand">
          <strong>PokePixel Hunt Analyzer</strong>
          <span class="brand-meta">
            <span>Userscript ${APP_VERSION}</span>
            <span>· by Rhyxus ·</span>
            <button id="pha-refcode" class="refcode" type="button" title="Copy ref code ${REF_CODE}">${REF_CODE}</button>
          </span>
        </div>
        <span id="pha-tab-state" class="state standby">STANDBY</span>
        <button id="pha-alpha" class="alpha-button" type="button">α 100%</button>
        <button id="pha-close" class="icon-button" type="button" title="Minimize to HUD">−</button>
      </header>

      <nav class="tabs">
        <button data-view="current" class="tab active" type="button">Current</button>
        <button data-view="compare" class="tab" type="button">Compare</button>
        <strong id="hunt-time" class="hunt-time">00:00</strong>
      </nav>

      <section id="view-current" class="view current-view">
        <section id="hunt-section" class="live-card">
          <div class="status-row">
            <span>Hunt</span>
            <b id="hunt-status" class="hunt-status">Waiting</b>
          </div>
          <div class="actions">
            <button id="new-hunt" type="button">New Hunt</button>
            <button id="pause-resume" type="button">Pause</button>
            <button id="end-hunt" type="button">End Hunt</button>
            <button class="collapse-button" data-collapse="hunt" type="button" title="Collapse">▾</button>
          </div>
          <div class="metric-cards">
            <article><span>XP/h You</span><strong id="trainer-exp-hour">—</strong><small>Total <b id="trainer-exp-total">0</b></small></article>
            <article><span>XP/h Poké</span><strong id="pokemon-exp-hour">—</strong><small>Total <b id="pokemon-exp-total">0</b></small></article>
            <article><span>Dollar</span><strong id="dollars-total">0</strong><small>$/h <b id="dollars-hour">—</b></small></article>
            <article><span>Profit</span><strong id="profit-total">0</strong><small>Expenses <b id="expenses-total">0</b></small></article>
          </div>
        </section>

        <div class="capture-strip">
          <article><span>Seen</span><strong id="seen">0</strong></article>
          <article><span>Captured</span><strong id="captured">0</strong></article>
          <article><span>Failed</span><strong id="failed">0</strong></article>
          <article><span>Capture</span><strong id="capture-rate">—</strong></article>
        </div>

        <section id="rarity-section" class="section rarity-section">
          <div class="section-head">
            <h3>By Rarity</h3>
            <div class="section-meta">
              <span id="rare-failed-count" class="section-badge">R+ fail 0</span>
              <button class="collapse-button" data-collapse="rarity" type="button" title="Collapse">▾</button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Rarity</th><th>Seen</th><th>Cap.</th><th>Fail</th><th>Rate</th></tr></thead>
              <tbody id="rarity-body">${createRarityRowsMarkup()}</tbody>
            </table>
          </div>
        </section>

        ${encounterSectionMarkup("captured", "Captured")}
        ${encounterSectionMarkup("failed", "Failed")}
      </section>

      <section id="view-compare" class="view compare-view" hidden>
        <div class="filters">
          <label>Theme<select id="compare-theme"><option value="cycle">By Cycle</option><option value="rarity">By Rarity</option></select></label>
          <label>Pokémon<select id="compare-species"></select></label>
          <label>Capsule<select id="compare-capsule"></select></label>
          <label>Element<select id="compare-element"></select></label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr id="compare-head"></tr></thead>
            <tbody id="compare-body"></tbody>
          </table>
        </div>
      </section>
    </aside>
  `;
}

export function createUi({ onSessionAction, onLoadCompare }) {
  let shadow;
  let panel;
  let launcher;
  let resizeHandle;
  let activeView = "current";
  let suppressLauncherClick = false;
  let currentView;
  let compareView;

  mount();

  function mount() {
    document.getElementById(ROOT_ID)?.remove();

    const host = document.createElement("div");
    host.id = ROOT_ID;
    shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = STYLES;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = createMarkup();
    shadow.append(style, wrapper);
    document.documentElement.appendChild(host);

    panel = shadow.getElementById("pha-panel");
    panel.style.minWidth = `${MIN_PANEL_WIDTH_PX}px`;
    panel.style.minHeight = `${MIN_PANEL_HEIGHT_PX}px`;
    launcher = shadow.getElementById("pha-toggle");
    currentView = createCurrentView(shadow);
    compareView = createCompareView(shadow, onLoadCompare);

    bindUiEvents();
    restoreUiState();
    installPanelDrag();
    installLauncherDrag();
    installBottomLeftResize();
    installWheelScrolling();
    installViewportGuard();
    installResizePersistence();
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

  function switchView(view) {
    activeView = view === "compare" ? "compare" : "current";
    shadow.getElementById("view-current").hidden = activeView !== "current";
    shadow.getElementById("view-compare").hidden = activeView !== "compare";
    for (const tab of shadow.querySelectorAll("[data-view]")) {
      tab.classList.toggle("active", tab.dataset.view === activeView);
    }
    saveUiState({ view: activeView });

    if (activeView === "compare") {
      compareView.refresh().catch((error) => {
        console.error("PokePixel Hunt Analyzer (Compare):", error);
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
  }

  function setPanelOpen(open) {
    panel.hidden = !open;
    if (resizeHandle) resizeHandle.hidden = !open;
    saveUiState({ open });
    if (open) {
      fitToViewport(panel);
      syncResizeHandle();
    }
  }

  function saveUiState(patch) {
    const state = readJson(UI_STATE_KEY, {});
    writeJson(UI_STATE_KEY, { ...state, ...patch });
  }

  function savePanelGeometry() {
    if (panel.hidden) return;
    const rect = panel.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return;
    saveUiState({
      panel: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    });
  }

  function saveLauncherGeometry() {
    const rect = launcher.getBoundingClientRect();
    saveUiState({
      launcher: {
        left: Math.round(rect.left),
        top: Math.round(rect.top)
      }
    });
  }

  function restoreUiState() {
    const state = readJson(UI_STATE_KEY, {});
    const panelState = state.panel;
    if (panelState) {
      if (Number.isFinite(panelState.width)) panel.style.width = `${panelState.width}px`;
      if (Number.isFinite(panelState.height)) panel.style.height = `${panelState.height}px`;
      if (Number.isFinite(panelState.left) && Number.isFinite(panelState.top)) {
        panel.style.left = `${panelState.left}px`;
        panel.style.top = `${panelState.top}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      }
    }

    const launcherState = state.launcher;
    if (launcherState && Number.isFinite(launcherState.left) && Number.isFinite(launcherState.top)) {
      launcher.style.left = `${launcherState.left}px`;
      launcher.style.top = `${launcherState.top}px`;
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
    }

    fitToViewport(launcher);
    switchView(state.view === "compare" ? "compare" : "current");
    setPanelOpen(state.open === true);
  }

  function fitToViewport(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const left = clamp(rect.left, EDGE_GAP, window.innerWidth - rect.width - EDGE_GAP);
    const top = clamp(rect.top, EDGE_GAP, window.innerHeight - rect.height - EDGE_GAP);
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
      if (event.target.closest("button, .state")) return;
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
      const left = clamp(
        event.clientX - drag.offsetX,
        EDGE_GAP,
        window.innerWidth - panel.offsetWidth - EDGE_GAP
      );
      const top = clamp(
        event.clientY - drag.offsetY,
        EDGE_GAP,
        window.innerHeight - panel.offsetHeight - EDGE_GAP
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
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
        drag.moved = true;
      }
      if (!drag.moved) return;
      const left = clamp(
        event.clientX - drag.offsetX,
        EDGE_GAP,
        window.innerWidth - launcher.offsetWidth - EDGE_GAP
      );
      const top = clamp(
        event.clientY - drag.offsetY,
        EDGE_GAP,
        window.innerHeight - launcher.offsetHeight - EDGE_GAP
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
      setPanelOpen(true);
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
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!panel.hidden) {
          fitToViewport(panel);
          savePanelGeometry();
        }
        fitToViewport(launcher);
        saveLauncherGeometry();
        syncResizeHandle();
      }, 100);
    });
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
    getActiveView: () => activeView
  };
}
