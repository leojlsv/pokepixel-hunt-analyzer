const ROOT_ID = "pokepixel-hunt-analyzer-root";
const HUD_COLUMNS_STORAGE_KEY = "pokepixel_hunt_analyzer_closed_hud_columns_v1";
const ONE_COLUMN_VALUE = "1";
const MAX_BIND_ATTEMPTS = 200;

let formFieldObserver = null;
let observedFormShadow = null;

export function isOneColumnModeValue(value) {
  return value === 1 || value === ONE_COLUMN_VALUE;
}

function readStoredOneColumnMode() {
  try {
    return localStorage.getItem(HUD_COLUMNS_STORAGE_KEY) === ONE_COLUMN_VALUE;
  } catch {
    return false;
  }
}

function writeOneColumnMode() {
  try {
    localStorage.setItem(HUD_COLUMNS_STORAGE_KEY, ONE_COLUMN_VALUE);
  } catch {
    // Current-page mode still applies if storage is unavailable.
  }
}

function ensureOneColumnOption(select) {
  if (!select || select.querySelector('option[value="1"]')) return;
  const option = document.createElement("option");
  option.value = ONE_COLUMN_VALUE;
  option.textContent = "1 · One column";
  const pxOnly = select.querySelector('option[value="0"]');
  if (pxOnly) select.insertBefore(option, pxOnly);
  else select.appendChild(option);
}

function hudFieldId(field) {
  if (field.matches?.("[data-hud-zero-mode]")) return "pha-hud-columns";
  if (field.matches?.("[data-hud-preset]")) return "pha-hud-preset";
  if (field.matches?.("[data-hud-widget]")) return `pha-hud-widget-${field.dataset.hudWidget}`;
  if (field.matches?.("[data-hud-item]")) return `pha-hud-item-${field.dataset.hudItem}`;
  if (field.matches?.("[data-hud-rarity-width]")) return `pha-hud-rarity-width-${field.dataset.hudRarityWidth}`;
  if (field.matches?.("[data-hud-rarity-failed]")) return `pha-hud-rarity-failed-${field.dataset.hudRarityFailed}`;
  if (field.matches?.("[data-hud-rarity-key]")) {
    return `pha-hud-rarity-${field.dataset.hudRarityKey}-${field.value}`;
  }
  return "";
}

function analyzerFieldId(field) {
  const hudId = hudFieldId(field);
  if (hudId) return hudId;
  if (field.matches?.(".pha-ui-mode-select")) return "pha-ui-mode";
  if (field.matches?.("[data-sound-volume]")) return "pha-sound-volume";
  if (field.matches?.(".catch-gallery-pokemon-filter")) return "catch-gallery-pokemon-filter";
  if (field.matches?.(".catch-gallery-rarity-filter")) return "catch-gallery-rarity-filter";
  return "";
}

function assignFormFieldIds(root, resolver) {
  if (!root?.querySelectorAll) return 0;
  let assigned = 0;
  for (const field of root.querySelectorAll("input, select, textarea")) {
    if (field.id || field.name) continue;
    const id = resolver(field);
    if (!id) continue;
    field.id = id;
    assigned += 1;
  }
  return assigned;
}

export function ensureHudFormFieldIds(shadow) {
  const settings = shadow?.getElementById?.("pha-hud-settings");
  return assignFormFieldIds(settings, hudFieldId);
}

export function ensureAnalyzerFormFieldIds(shadow) {
  return assignFormFieldIds(shadow, analyzerFieldId);
}

function installAnalyzerFormFieldIds(shadow) {
  if (!shadow) return;
  ensureAnalyzerFormFieldIds(shadow);
  if (typeof MutationObserver === "undefined") return;
  if (formFieldObserver && observedFormShadow === shadow) return;

  formFieldObserver?.disconnect();
  observedFormShadow = shadow;
  formFieldObserver = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => mutation.addedNodes.length > 0)) return;
    ensureAnalyzerFormFieldIds(shadow);
  });
  formFieldObserver.observe(shadow, { childList: true, subtree: true });
}

function restoreSlotConfig(config, index) {
  config.removeAttribute("data-hud-one-hidden");
  const label = config.querySelector(":scope > span");
  if (label) label.textContent = String(index + 1);
  const width = config.querySelector("[data-hud-rarity-width]");
  const twoSlots = width?.querySelector('option[value="2"]');
  if (twoSlots) twoSlots.disabled = false;
}

function restoreZeroModeControls(settings) {
  const slotConfigs = settings.querySelector(".pha-hud-slot-configs");
  if (slotConfigs) {
    slotConfigs.hidden = false;
    for (const control of slotConfigs.querySelectorAll("select,input,button")) {
      control.disabled = false;
    }
  }

  const preset = settings.querySelector("[data-hud-preset]");
  const reset = settings.querySelector("[data-hud-reset]");
  const inventoryStatus = settings.querySelector("[data-hud-inventory-status]");
  if (preset) preset.disabled = false;
  if (reset) reset.disabled = false;
  if (inventoryStatus) inventoryStatus.hidden = false;
}

function applyOneColumnSettings(shadow, enabled) {
  const settings = shadow?.getElementById("pha-hud-settings");
  if (!settings) return;
  if (enabled) restoreZeroModeControls(settings);

  const configs = [...settings.querySelectorAll(".pha-hud-slot-configs > .pha-hud-slot-config")];
  configs.forEach((config, index) => {
    restoreSlotConfig(config, index);
    if (!enabled) return;

    const visible = index === 0 || index === 2;
    if (!visible) {
      config.dataset.hudOneHidden = "true";
      return;
    }

    const label = config.querySelector(":scope > span");
    if (label) label.textContent = index === 0 ? "1" : "2";

    const width = config.querySelector("[data-hud-rarity-width]");
    const twoSlots = width?.querySelector('option[value="2"]');
    if (twoSlots) twoSlots.disabled = true;
    if (width?.value === "2") width.value = "1";
  });

  const summary = settings.querySelector(".pha-hud-settings-head small");
  if (enabled && summary) summary.textContent = "2 stacked widgets · 1 column";
}

function applyOneColumnMode(shadow, enabled) {
  const launcher = shadow?.getElementById("pha-toggle");
  const select = shadow?.querySelector("[data-hud-zero-mode]");
  if (!launcher || !select) return false;

  ensureOneColumnOption(select);
  if (enabled) {
    launcher.dataset.hudColumns = ONE_COLUMN_VALUE;
    select.value = ONE_COLUMN_VALUE;
  }
  applyOneColumnSettings(shadow, enabled);
  return true;
}

function bindOneColumnMode(shadow) {
  const select = shadow?.querySelector("[data-hud-zero-mode]");
  const settings = shadow?.getElementById("pha-hud-settings");
  if (!select || !settings || select.dataset.hudOneColumnBound === "true") return false;

  ensureOneColumnOption(select);
  ensureHudFormFieldIds(shadow);
  installAnalyzerFormFieldIds(shadow);
  select.dataset.hudOneColumnBound = "true";

  select.addEventListener("change", (event) => {
    if (!isOneColumnModeValue(event.currentTarget.value)) return;
    event.stopImmediatePropagation();
    writeOneColumnMode();
    applyOneColumnMode(shadow, true);
    window.dispatchEvent(new Event("resize"));
  }, true);

  settings.addEventListener("change", (event) => {
    if (event.target === select && !isOneColumnModeValue(select.value)) {
      setTimeout(() => applyOneColumnSettings(shadow, false), 0);
      return;
    }
    if (!isOneColumnModeValue(select.value)) return;
    setTimeout(() => applyOneColumnMode(shadow, true), 0);
  });

  applyOneColumnMode(shadow, readStoredOneColumnMode());
  return true;
}

function bindWhenReady(attempt = 0) {
  if (typeof document === "undefined") return;
  const shadow = document.getElementById(ROOT_ID)?.shadowRoot || null;
  if (bindOneColumnMode(shadow)) return;
  if (attempt >= MAX_BIND_ATTEMPTS) return;
  setTimeout(() => bindWhenReady(attempt + 1), 50);
}

if (typeof document !== "undefined") {
  queueMicrotask(() => bindWhenReady());
}
