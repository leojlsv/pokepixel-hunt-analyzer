import { normalizeUiModeOverride } from "./ui-mode.js";

export const UI_STATE_V1_KEY = "pokepixel_hunt_analyzer_ui_v1";
export const UI_STATE_V2_KEY = "pokepixel_hunt_analyzer_ui_v2";

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalizeLauncher(value) {
  if (!value || typeof value !== "object") return null;
  const left = finite(value.left);
  const top = finite(value.top);
  if (left === null || top === null) return null;
  return { left, top };
}

function normalizePanel(value) {
  if (!value || typeof value !== "object") return null;
  const left = finite(value.left);
  const top = finite(value.top);
  const width = finite(value.width);
  const height = finite(value.height);
  const panel = {};
  if (left !== null) panel.left = left;
  if (top !== null) panel.top = top;
  if (width !== null) panel.width = width;
  if (height !== null) panel.height = height;
  return Object.keys(panel).length ? panel : null;
}

function defaultState() {
  return {
    shared: {
      view: "current",
      open: false,
      modeOverride: "auto"
    },
    desktop: {
      panel: null,
      launcher: null
    },
    mobile: {
      launcher: null
    }
  };
}

function normalizeState(raw) {
  const fallback = defaultState();
  if (!raw || typeof raw !== "object") return fallback;

  const shared = raw.shared && typeof raw.shared === "object" ? raw.shared : {};
  const desktop = raw.desktop && typeof raw.desktop === "object" ? raw.desktop : {};
  const mobile = raw.mobile && typeof raw.mobile === "object" ? raw.mobile : {};

  return {
    shared: {
      view: shared.view === "history" ? "history" : "current",
      open: shared.open === true,
      modeOverride: normalizeUiModeOverride(shared.modeOverride)
    },
    desktop: {
      panel: normalizePanel(desktop.panel),
      launcher: normalizeLauncher(desktop.launcher)
    },
    mobile: {
      launcher: normalizeLauncher(mobile.launcher)
    }
  };
}

function readRecord(storage, key) {
  try {
    const parsed = JSON.parse(storage?.getItem(key) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function persist(storage, state) {
  try {
    storage?.setItem(UI_STATE_V2_KEY, JSON.stringify(state));
  } catch {
    // Runtime state remains usable if persistence is unavailable.
  }
}

export function migrateUiStateV1(raw) {
  const state = defaultState();
  if (!raw || typeof raw !== "object") return state;

  state.shared.view = raw.view === "history" ? "history" : "current";
  state.shared.open = raw.open === true;
  state.desktop.panel = normalizePanel(raw.panel);
  state.desktop.launcher = normalizeLauncher(raw.launcher);
  return state;
}

export function loadUiState(storage = globalThis.localStorage) {
  const current = readRecord(storage, UI_STATE_V2_KEY);
  if (current) return normalizeState(current);

  const legacy = readRecord(storage, UI_STATE_V1_KEY);
  const migrated = legacy ? migrateUiStateV1(legacy) : defaultState();
  persist(storage, migrated);
  return migrated;
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function createUiStateStore(storage = globalThis.localStorage) {
  let state = loadUiState(storage);

  function commit(nextState) {
    state = normalizeState(nextState);
    persist(storage, state);
    return cloneState(state);
  }

  return {
    read: () => cloneState(state),
    patchShared(patch = {}) {
      return commit({
        ...state,
        shared: { ...state.shared, ...patch }
      });
    },
    patchDesktop(patch = {}) {
      return commit({
        ...state,
        desktop: { ...state.desktop, ...patch }
      });
    },
    patchMobile(patch = {}) {
      return commit({
        ...state,
        mobile: { ...state.mobile, ...patch }
      });
    }
  };
}
