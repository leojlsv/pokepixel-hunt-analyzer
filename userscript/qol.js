import "./main.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_STATE_KEY = "pokepixel_hunt_analyzer_ui_v1";
const UI_VERSION = "1.2.0";
const EDGE_GAP = 8;

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_STATE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(patch) {
  const current = readState();
  localStorage.setItem(UI_STATE_KEY, JSON.stringify({ ...current, ...patch }));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function waitForUi() {
  return new Promise((resolve) => {
    const find = () => {
      const host = document.getElementById(ROOT_ID);
      if (host?.shadowRoot) {
        resolve({ host, shadow: host.shadowRoot });
        return true;
      }
      return false;
    };

    if (find()) return;

    const timer = setInterval(() => {
      if (find()) clearInterval(timer);
    }, 50);
  });
}

function installStyles(shadow) {
  if (shadow.getElementById("pha-qol-style")) return;

  const style = document.createElement("style");
  style.id = "pha-qol-style";
  style.textContent = `
    .launcher.pha-hud {
      width: 132px;
      height: 48px;
      padding: 5px 9px;
      display: grid;
      grid-template-columns: auto 1fr;
      grid-template-rows: 1fr 1fr;
      column-gap: 8px;
      align-items: center;
      text-align: left;
      user-select: none;
      touch-action: none;
    }
    .pha-hud-mark {
      grid-row: 1 / span 2;
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 9px;
      background: #273442;
      font-size: 11px;
      letter-spacing: .04em;
    }
    .pha-hud-main {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      font-size: 12px;
      line-height: 1;
    }
    .pha-hud-main strong {
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .pha-hud-dot {
      width: 7px;
      height: 7px;
      flex: 0 0 auto;
      border-radius: 50%;
      background: #728090;
    }
    .pha-hud-sub {
      color: #9ca8b6;
      font-size: 10px;
      line-height: 1;
      white-space: nowrap;
    }
    .launcher.pha-hud[data-status="running"] .pha-hud-dot { background: #57d694; }
    .launcher.pha-hud[data-status="paused"] .pha-hud-dot { background: #ffc266; }
    .launcher.pha-hud[data-status="standby"] .pha-hud-dot { background: #ef8d68; }
    .launcher.pha-hud:hover { border-color: #718295; }

    .panel.pha-qol-panel {
      resize: both;
      min-width: 360px;
      min-height: 280px;
      max-width: calc(100vw - 16px);
      max-height: calc(100vh - 16px);
    }
    .panel.pha-qol-panel .topbar {
      cursor: move;
      user-select: none;
      touch-action: none;
    }
    .panel.pha-qol-panel .topbar button,
    .panel.pha-qol-panel .topbar .state {
      cursor: default;
    }
  `;
  shadow.appendChild(style);
}

function parseDisplayedInteger(text) {
  const digits = String(text || "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function installHud(shadow) {
  const launcher = shadow.getElementById("pha-toggle");
  if (!launcher || launcher.classList.contains("pha-hud")) return launcher;

  launcher.classList.add("pha-hud");
  launcher.title = "Open PokePixel Hunt Analyzer · drag to reposition";
  launcher.innerHTML = `
    <span class="pha-hud-mark">PX</span>
    <span class="pha-hud-main"><i class="pha-hud-dot"></i><strong id="pha-hud-time">00:00</strong></span>
    <span class="pha-hud-sub">R+ fail <b id="pha-hud-rare-failed">0</b></span>
  `;

  const huntTime = shadow.getElementById("hunt-time");
  const huntStatus = shadow.getElementById("hunt-status");
  const tabState = shadow.getElementById("pha-tab-state");
  const rarityBody = shadow.getElementById("rarity-body");

  const update = () => {
    shadow.getElementById("pha-hud-time").textContent = huntTime?.textContent || "00:00";

    const status = String(huntStatus?.textContent || "waiting").trim().toLowerCase();
    const isStandby = String(tabState?.textContent || "").trim().toUpperCase() === "STANDBY";
    launcher.dataset.status = isStandby ? "standby" : status;

    let rarePlusFailed = 0;
    for (const rarity of ["rare", "epic", "legendary", "mythical"]) {
      const row = rarityBody?.querySelector(`[data-rarity="${rarity}"]`);
      rarePlusFailed += parseDisplayedInteger(row?.querySelector('[data-f="failed"]')?.textContent);
    }
    shadow.getElementById("pha-hud-rare-failed").textContent = String(rarePlusFailed);
  };

  const observer = new MutationObserver(update);
  for (const node of [huntTime, huntStatus, tabState, rarityBody]) {
    if (node) observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true });
  }
  update();

  return launcher;
}

function applyPanelState(panel, state) {
  const saved = state.panel;
  if (!saved || typeof saved !== "object") return;

  if (Number.isFinite(saved.width)) panel.style.width = `${saved.width}px`;
  if (Number.isFinite(saved.height)) panel.style.height = `${saved.height}px`;

  if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
    panel.style.left = `${saved.left}px`;
    panel.style.top = `${saved.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }
}

function applyLauncherState(launcher, state) {
  const saved = state.launcher;
  if (!saved || typeof saved !== "object") return;
  if (!Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return;

  launcher.style.left = `${saved.left}px`;
  launcher.style.top = `${saved.top}px`;
  launcher.style.right = "auto";
  launcher.style.bottom = "auto";
}

function fitElementToViewport(element) {
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

function savePanelGeometry(panel) {
  if (panel.hidden) return;
  const rect = panel.getBoundingClientRect();
  if (rect.width < 100 || rect.height < 100) return;

  writeState({
    panel: {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
  });
}

function saveLauncherGeometry(launcher) {
  const rect = launcher.getBoundingClientRect();
  writeState({
    launcher: {
      left: Math.round(rect.left),
      top: Math.round(rect.top)
    }
  });
}

function installPanelDragging(shadow, panel) {
  const handle = panel.querySelector(".topbar");
  if (!handle) return;

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

    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = clamp(event.clientX - drag.offsetX, EDGE_GAP, window.innerWidth - width - EDGE_GAP);
    const top = clamp(event.clientY - drag.offsetY, EDGE_GAP, window.innerHeight - height - EDGE_GAP);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  });

  const finish = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    savePanelGeometry(panel);
  };

  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);

  let resizeSaveTimer = null;
  const resizeObserver = new ResizeObserver(() => {
    if (panel.hidden) return;
    clearTimeout(resizeSaveTimer);
    resizeSaveTimer = setTimeout(() => {
      fitElementToViewport(panel);
      savePanelGeometry(panel);
    }, 120);
  });
  resizeObserver.observe(panel);
}

function installLauncherDragging(launcher) {
  let drag = null;
  let suppressClick = false;

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

    const left = clamp(event.clientX - drag.offsetX, EDGE_GAP, window.innerWidth - launcher.offsetWidth - EDGE_GAP);
    const top = clamp(event.clientY - drag.offsetY, EDGE_GAP, window.innerHeight - launcher.offsetHeight - EDGE_GAP);
    launcher.style.left = `${left}px`;
    launcher.style.top = `${top}px`;
    event.preventDefault();
  });

  const finish = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClick = drag.moved;
    if (launcher.hasPointerCapture(event.pointerId)) launcher.releasePointerCapture(event.pointerId);
    if (drag.moved) saveLauncherGeometry(launcher);
    drag = null;
  };

  launcher.addEventListener("pointerup", finish);
  launcher.addEventListener("pointercancel", finish);
  launcher.addEventListener("click", (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

function installStatePersistence(shadow, panel, launcher) {
  const close = shadow.getElementById("pha-close");
  if (close) {
    close.textContent = "−";
    close.title = "Minimize to HUD";
  }

  new MutationObserver(() => {
    writeState({ open: !panel.hidden });
  }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });

  shadow.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => writeState({ view: button.dataset.view }));
  });

  const state = readState();
  if (state.view === "compare") {
    shadow.querySelector('[data-view="compare"]')?.click();
  }
  if (state.open === true && panel.hidden) {
    launcher.click();
  }
}

function installViewportGuard(panel, launcher) {
  let timer = null;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!panel.hidden) {
        fitElementToViewport(panel);
        savePanelGeometry(panel);
      }
      fitElementToViewport(launcher);
      saveLauncherGeometry(launcher);
    }, 100);
  });
}

async function initQol() {
  const { shadow } = await waitForUi();
  const panel = shadow.getElementById("pha-panel");
  if (!panel) return;

  installStyles(shadow);
  panel.classList.add("pha-qol-panel");

  const launcher = installHud(shadow);
  if (!launcher) return;

  const state = readState();
  applyPanelState(panel, state);
  applyLauncherState(launcher, state);
  fitElementToViewport(launcher);

  const version = panel.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;

  installPanelDragging(shadow, panel);
  installLauncherDragging(launcher);
  installStatePersistence(shadow, panel, launcher);
  installViewportGuard(panel, launcher);
}

initQol().catch((error) => console.error("PokePixel Hunt Analyzer (QoL):", error));
