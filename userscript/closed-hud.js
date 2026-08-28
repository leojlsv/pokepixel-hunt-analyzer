import {
  RARITIES,
  formatCompact,
  formatDuration,
  formatNumber,
  formatRate
} from "./ui-utils.js";
import { createInventoryState } from "./inventory-state.js";

export const CLOSED_HUD_STORAGE_KEY = "pokepixel_hunt_analyzer_closed_hud_v1";

export const CLOSED_HUD_WIDGETS = Object.freeze([
  { id: "empty", label: "Empty", category: "Layout" },
  { id: "seen", label: "Seen", category: "Hunt" },
  { id: "seenPerHour", label: "Seen/h", category: "Hunt" },
  { id: "captured", label: "Captured", category: "Capture" },
  { id: "failed", label: "Failed", category: "Capture" },
  { id: "captureRate", label: "Capture Rate", category: "Capture" },
  { id: "trainerXpPerHour", label: "Trainer XP/h", category: "Leveling" },
  { id: "pokemonXpPerHour", label: "Pokémon XP/h", category: "Leveling" },
  { id: "dollarPerHour", label: "Dollar/h", category: "Economy" },
  { id: "profitPerHour", label: "Profit/h", category: "Economy" },
  { id: "expenses", label: "Expenses", category: "Economy" },
  { id: "huntTime", label: "Hunt Time", category: "Hunt" },
  { id: "capturedRarities", label: "Captured Rarities", category: "Capture" },
  { id: "rarePlusFailed", label: "Rare+ Failed", category: "Capture" },
  { id: "shinyCaptured", label: "Shiny Captured", category: "Capture" },
  { id: "totalBallsUsed", label: "Total Balls Used", category: "HUD Exclusive" },
  {
    id: "ballTracker",
    label: "Ball Tracker",
    category: "HUD Exclusive",
    itemType: "capsule"
  },
  {
    id: "potionTracker",
    label: "Potion Tracker",
    category: "HUD Exclusive",
    itemType: "potion"
  }
]);

const WIDGET_BY_ID = new Map(CLOSED_HUD_WIDGETS.map((widget) => [widget.id, widget]));
const RARE_PLUS_KEYS = new Set(["rare", "epic", "legendary", "mythical"]);

export const CLOSED_HUD_PRESETS = Object.freeze({
  default: Object.freeze([
    { widget: "seen" },
    { widget: "seenPerHour" },
    { widget: "captured" },
    { widget: "capturedRarities" }
  ]),
  leveling: Object.freeze([
    { widget: "trainerXpPerHour" },
    { widget: "pokemonXpPerHour" },
    { widget: "seen" },
    { widget: "seenPerHour" }
  ]),
  economy: Object.freeze([
    { widget: "dollarPerHour" },
    { widget: "profitPerHour" },
    { widget: "expenses" },
    { widget: "huntTime" }
  ]),
  capture: Object.freeze([
    { widget: "seen" },
    { widget: "captured" },
    { widget: "failed" },
    { widget: "captureRate" }
  ])
});

function cloneSlot(slot) {
  return {
    widget: String(slot?.widget || "empty"),
    itemId: slot?.itemId ? String(slot.itemId) : null
  };
}

export function closedHudConfigForPreset(preset = "default") {
  const key = Object.hasOwn(CLOSED_HUD_PRESETS, preset) ? preset : "default";
  return {
    preset: key,
    slots: CLOSED_HUD_PRESETS[key].map(cloneSlot)
  };
}

export function normalizeClosedHudConfig(raw) {
  if (!raw || typeof raw !== "object") return closedHudConfigForPreset("default");

  const preset = Object.hasOwn(CLOSED_HUD_PRESETS, raw.preset)
    ? raw.preset
    : raw.preset === "custom"
      ? "custom"
      : "default";
  const fallback = closedHudConfigForPreset(preset === "custom" ? "default" : preset);
  const rawSlots = Array.isArray(raw.slots) ? raw.slots : fallback.slots;
  const slots = [];

  for (let index = 0; index < 4; index += 1) {
    const candidate = cloneSlot(rawSlots[index] || fallback.slots[index]);
    if (!WIDGET_BY_ID.has(candidate.widget)) candidate.widget = fallback.slots[index].widget;
    slots.push(candidate);
  }

  return { preset, slots };
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function deriveClosedHudState({ metrics = {}, encounters = [] } = {}) {
  const rarities = metrics.rarities || {};
  const rarityCaptured = {};
  let rarePlusFailed = 0;
  let shinyCaptured = 0;

  for (const [key] of RARITIES) {
    const row = rarities[key] || {};
    rarityCaptured[key] = numeric(row.captured);
    shinyCaptured += numeric(row.shinyCaptured);
    if (RARE_PLUS_KEYS.has(key)) rarePlusFailed += numeric(row.failed);
  }

  const ballUsage = new Map();
  for (const encounter of encounters || []) {
    if (!["success", "failed"].includes(encounter?.captureResult)) continue;
    const itemId = String(encounter?.capsuleItemId || "");
    if (!itemId) continue;
    ballUsage.set(itemId, (ballUsage.get(itemId) || 0) + 1);
  }

  const activeMs = numeric(metrics.activeMs);
  const profit = numeric(metrics.gold) - numeric(metrics.expenses);
  const profitPerHour = activeMs > 0 ? profit * 3_600_000 / activeMs : null;

  return {
    seen: numeric(metrics.seen),
    seenPerHour: metrics.seenPerHour == null ? null : numeric(metrics.seenPerHour),
    captured: numeric(metrics.captured),
    failed: numeric(metrics.failed),
    captureRate: metrics.seenToCaptureRate == null ? null : Number(metrics.seenToCaptureRate),
    trainerXpPerHour: metrics.trainerExpPerHour == null ? null : numeric(metrics.trainerExpPerHour),
    pokemonXpPerHour: metrics.pokemonExpPerHour == null ? null : numeric(metrics.pokemonExpPerHour),
    dollarPerHour: metrics.goldPerHour == null ? null : numeric(metrics.goldPerHour),
    profitPerHour,
    expenses: numeric(metrics.expenses),
    activeMs,
    rarityCaptured,
    rarePlusFailed,
    shinyCaptured,
    totalBallsUsed: [...ballUsage.values()].reduce((sum, count) => sum + count, 0),
    ballUsage
  };
}

function shortInventoryName(item, type) {
  const raw = String(item?.name || item?.item_id || (type === "capsule" ? "Ball" : "Potion"));
  if (type === "capsule") return raw.replace(/\s+Ball$/i, "") || raw;
  if (type === "potion") return raw.replace(/\s+Potion$/i, "") || raw;
  return raw;
}

function firstInventoryItem(inventory, type) {
  const items = type === "capsule" ? inventory?.capsules : inventory?.potions;
  if (!Array.isArray(items) || items.length === 0) return null;
  if (type === "capsule") {
    return items.find((item) => item.item_id === "capsule_ultra") || items[0];
  }
  return items[0];
}

function inventoryItemForSlot(slot, inventory, type) {
  if (slot?.itemId && inventory?.byId?.has(slot.itemId)) return inventory.byId.get(slot.itemId);
  return firstInventoryItem(inventory, type);
}

export function closedHudDisplay(slot, derived, inventory) {
  const widgetId = slot?.widget || "empty";

  switch (widgetId) {
    case "empty":
      return { label: "", value: "", empty: true };
    case "seen":
      return { label: "Seen", value: formatNumber(derived.seen) };
    case "seenPerHour":
      return {
        label: "Seen/h",
        value: derived.seenPerHour == null ? "—" : formatCompact(derived.seenPerHour)
      };
    case "captured":
      return { label: "Captured", value: formatNumber(derived.captured) };
    case "failed":
      return { label: "Failed", value: formatNumber(derived.failed) };
    case "captureRate":
      return { label: "Capture", value: formatRate(derived.captureRate) };
    case "trainerXpPerHour":
      return {
        label: "XP/h",
        value: derived.trainerXpPerHour == null ? "—" : formatCompact(derived.trainerXpPerHour)
      };
    case "pokemonXpPerHour":
      return {
        label: "PK XP/h",
        value: derived.pokemonXpPerHour == null ? "—" : formatCompact(derived.pokemonXpPerHour)
      };
    case "dollarPerHour":
      return {
        label: "$/h",
        value: derived.dollarPerHour == null ? "—" : formatCompact(derived.dollarPerHour)
      };
    case "profitPerHour":
      return {
        label: "Profit/h",
        value: derived.profitPerHour == null ? "—" : formatCompact(derived.profitPerHour),
        tone: derived.profitPerHour == null ? "" : derived.profitPerHour < 0 ? "negative" : "positive"
      };
    case "expenses":
      return { label: "Expenses", value: formatCompact(derived.expenses) };
    case "huntTime":
      return { label: "Time", value: formatDuration(derived.activeMs) };
    case "capturedRarities":
      return {
        label: "Rarity",
        kind: "rarities",
        rarities: RARITIES.map(([key, label]) => ({
          key,
          label,
          value: derived.rarityCaptured[key] || 0
        }))
      };
    case "rarePlusFailed":
      return { label: "R+ Failed", value: formatNumber(derived.rarePlusFailed) };
    case "shinyCaptured":
      return { label: "Shiny Cap", value: formatNumber(derived.shinyCaptured) };
    case "totalBallsUsed":
      return { label: "Balls Used", value: formatNumber(derived.totalBallsUsed) };
    case "ballTracker": { 
      const item = inventoryItemForSlot(slot, inventory, "capsule");
      const itemId = item?.item_id || slot?.itemId || "";
      const remaining = item ? numeric(item.qty ?? item.quantity) : null;
      const used = itemId ? derived.ballUsage.get(itemId) || 0 : 0;
      return {
        label: shortInventoryName(item, "capsule"),
        value: `${remaining == null ? "—" : formatNumber(remaining)} · ↓${formatNumber(used)}`,
        title: `${item?.name || itemId || "Ball"}: ${remaining == null ? "unknown" : formatNumber(remaining)} remaining, ${formatNumber(used)} used in this Hunt`
      };
    }
    case "potionTracker": {
      const item = inventoryItemForSlot(slot, inventory, "potion");
      const remaining = item ? numeric(item.qty ?? item.quantity) : null;
      return {
        label: shortInventoryName(item, "potion"),
        value: remaining == null ? "—" : formatNumber(remaining),
        title: `${item?.name || slot?.itemId || "Potion"}: ${remaining == null ? "unknown" : formatNumber(remaining)} remaining`
      };
    }
    default:
      return { label: "", value: "", empty: true };
  }
}

function readStoredConfig() {
  try {
    return normalizeClosedHudConfig(JSON.parse(localStorage.getItem(CLOSED_HUD_STORAGE_KEY) || "null"));
  } catch {
    return closedHudConfigForPreset("default");
  }
}

function writeStoredConfig(config) {
  localStorage.setItem(CLOSED_HUD_STORAGE_KEY, JSON.stringify(config));
}

function widgetOptionsMarkup() {
  const groups = new Map();
  for (const widget of CLOSED_HUD_WIDGETS) {
    if (!groups.has(widget.category)) groups.set(widget.category, []);
    groups.get(widget.category).push(widget);
  }

  return [...groups.entries()].map(([category, widgets]) => `
    <optgroup label="${category}">
      ${widgets.map((widget) => `<option value="${widget.id}">${widget.label}</option>`).join("")}
    </optgroup>`).join("");
}

const CLOSED_HUD_STYLE = `
  .topbar.pha-hud-topbar {
    grid-template-columns:minmax(0,1fr) auto auto auto auto;
  }
  #pha-toggle.pha-custom-hud {
    width:220px !important;
    min-width:220px !important;
    height:52px !important;
    grid-template-columns:32px minmax(0,1fr) !important;
  }
  #pha-toggle.pha-custom-hud > .hud-content { display:none !important; }
  .pha-hud-grid {
    grid-column:2;
    grid-row:1;
    min-width:0;
    height:40px;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    grid-template-rows:repeat(2,minmax(0,1fr));
    column-gap:7px;
    row-gap:2px;
    align-self:center;
  }
  .pha-hud-slot {
    min-width:0;
    padding:1px 2px;
    display:flex;
    flex-direction:column;
    justify-content:center;
    overflow:hidden;
    border-left:1px solid #41423c;
    line-height:1;
    text-align:left;
  }
  .pha-hud-slot.is-empty { opacity:.3; }
  .pha-hud-slot-label {
    overflow:hidden;
    color:#8f8c82;
    font-size:7px;
    font-weight:700;
    letter-spacing:.03em;
    text-overflow:ellipsis;
    text-transform:uppercase;
    white-space:nowrap;
  }
  .pha-hud-slot-value {
    margin-top:2px;
    overflow:hidden;
    color:#f0eee6;
    font-size:10px;
    font-weight:800;
    font-variant-numeric:tabular-nums;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .pha-hud-slot-value.positive { color:#70dfaa; }
  .pha-hud-slot-value.negative { color:#ef8b82; }
  .pha-hud-rarity-values {
    margin-top:2px;
    display:flex;
    align-items:center;
    gap:2px;
    overflow:hidden;
    font-size:7px;
    font-weight:800;
    font-variant-numeric:tabular-nums;
    white-space:nowrap;
  }
  .pha-hud-rarity-separator { color:#66645d; font-weight:400; }
  .pha-hud-settings-button { min-width:38px; }
  .pha-hud-settings {
    padding:8px 10px;
    border-bottom:1px solid var(--border-soft);
    background:#292a26;
  }
  .pha-hud-settings-head {
    margin-bottom:7px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
  }
  .pha-hud-settings-head strong {
    color:var(--gold);
    font-size:10px;
    letter-spacing:.05em;
    text-transform:uppercase;
  }
  .pha-hud-settings-head small { color:var(--muted); font-size:8px; }
  .pha-hud-settings-toolbar {
    margin-bottom:7px;
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    gap:6px;
    align-items:end;
  }
  .pha-hud-settings label,
  .pha-hud-slot-config > span {
    color:#c0ad72;
    font-size:8px;
    letter-spacing:.025em;
    text-transform:uppercase;
  }
  .pha-hud-settings label { display:flex; flex-direction:column; gap:3px; }
  .pha-hud-settings select,
  .pha-hud-settings button {
    height:25px;
    border:1px solid var(--border);
    border-radius:3px;
    background:var(--bg);
    color:var(--text);
    font-size:9px;
  }
  .pha-hud-settings button { padding:0 7px; cursor:pointer; }
  .pha-hud-slot-configs {
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:6px;
  }
  .pha-hud-slot-config {
    min-width:0;
    padding:5px;
    display:grid;
    grid-template-columns:18px minmax(0,1fr);
    gap:4px;
    align-items:center;
    border:1px solid #3d3d37;
    border-radius:3px;
    background:#252621;
  }
  .pha-hud-slot-config > span { text-align:center; }
  .pha-hud-slot-config select { min-width:0; width:100%; }
  .pha-hud-slot-config select[data-hud-item] { grid-column:2; }
  .pha-hud-inventory-status {
    margin-top:6px;
    color:var(--muted);
    font-size:8px;
  }
  .pha-hud-inventory-status.ready { color:#70dfaa; }
`;

export function createClosedHud({ pageWindow } = {}) {
  let shadow = null;
  let launcher = null;
  let grid = null;
  let settings = null;
  let settingsButton = null;
  let style = null;
  let lastState = null;
  let config = readStoredConfig();
  let inventorySnapshot = null;
  let mounted = false;

  const inventoryState = createInventoryState({
    pageWindow,
    onChange: (snapshot) => {
      inventorySnapshot = snapshot;
      syncSettings();
      renderLastState();
    }
  });

  function activeInventory() {
    return inventorySnapshot || inventoryState.getSnapshot();
  }

  function saveConfig(nextConfig) {
    config = normalizeClosedHudConfig(nextConfig);
    writeStoredConfig(config);
    syncSettings();
    renderLastState();
  }

  function selectOptionsForType(type, selectedId) {
    const inventory = activeInventory();
    const items = type === "capsule" ? inventory?.capsules : inventory?.potions;
    if (!Array.isArray(items) || items.length === 0) {
      return selectedId
        ? `<option value="${selectedId}">${selectedId}</option>`
        : '<option value="">Waiting for inventory…</option>';
    }

    return items.map((item) =>
      `<option value="${item.item_id}">${item.name || item.item_id}</option>`
    ).join("");
  }

  function syncSettings() {
    if (!settings) return;
    const presetSelect = settings.querySelector("[data-hud-preset]");
    presetSelect.value = config.preset;

    for (let index = 0; index < 4; index += 1) {
      const slot = config.slots[index];
      const widgetSelect = settings.querySelector(`[data-hud-widget="${index}"]`);
      const itemSelect = settings.querySelector(`[data-hud-item="${index}"]`);
      const widget = WIDGET_BY_ID.get(slot.widget);
      widgetSelect.value = slot.widget;

      if (!widget?.itemType) {
        itemSelect.hidden = true;
        itemSelect.replaceChildren();
        continue;
      }

      const inventory = activeInventory();
      const effectiveItem = inventoryItemForSlot(slot, inventory, widget.itemType);
      const selectedId = effectiveItem?.item_id || slot.itemId || "";
      itemSelect.innerHTML = selectOptionsForType(widget.itemType, selectedId);
      itemSelect.hidden = false;
      if (selectedId && [...itemSelect.options].some((option) => option.value === selectedId)) {
        itemSelect.value = selectedId;
      }
    }

    const status = settings.querySelector("[data-hud-inventory-status]");
    const inventory = activeInventory();
    status.textContent = inventory?.ready
      ? `Inventory live · ${inventory.capsules.length} capsules · ${inventory.potions.length} potions`
      : "Waiting for inventory snapshot…";
    status.classList.toggle("ready", Boolean(inventory?.ready));
  }

  function enforceUniqueStandardWidget(index, widgetId, slots) {
    const widget = WIDGET_BY_ID.get(widgetId);
    if (!widget || widget.itemType || widgetId === "empty") return slots;
    return slots.map((slot, slotIndex) =>
      slotIndex !== index && slot.widget === widgetId
        ? { widget: "empty", itemId: null }
        : slot
    );
  }

  function bindSettings() {
    settingsButton.addEventListener("click", () => {
      settings.hidden = !settings.hidden;
      settingsButton.classList.toggle("active", !settings.hidden);
    });

    settings.querySelector("[data-hud-preset]").addEventListener("change", (event) => {
      const preset = event.target.value;
      if (preset === "custom") return;
      saveConfig(closedHudConfigForPreset(preset));
    });

    settings.querySelector("[data-hud-reset]").addEventListener("click", () => {
      saveConfig(closedHudConfigForPreset("default"));
    });

    for (const select of settings.querySelectorAll("[data-hud-widget]")) {
      select.addEventListener("change", (event) => {
        const index = Number(event.currentTarget.dataset.hudWidget);
        const widgetId = event.currentTarget.value;
        let slots = config.slots.map(cloneSlot);
        slots[index] = { widget: widgetId, itemId: null };
        slots = enforceUniqueStandardWidget(index, widgetId, slots);
        saveConfig({ preset: "custom", slots });
      });
    }

    for (const select of settings.querySelectorAll("[data-hud-item]")) {
      select.addEventListener("change", (event) => {
        const index = Number(event.currentTarget.dataset.hudItem);
        const slots = config.slots.map(cloneSlot);
        slots[index] = { ...slots[index], itemId: event.currentTarget.value || null };
        saveConfig({ preset: "custom", slots });
      });
    }
  }

  function mount() {
    if (mounted) return;
    shadow = document.getElementById("pokepixel-hunt-analyzer-root")?.shadowRoot || null;
    if (!shadow) return;

    launcher = shadow.getElementById("pha-toggle");
    const topbar = shadow.querySelector(".topbar");
    const tabs = shadow.querySelector(".tabs");
    const alphaButton = shadow.getElementById("pha-alpha");
    if (!launcher || !topbar || !tabs || !alphaButton) return;

    style = document.createElement("style");
    style.id = "pha-closed-hud-style";
    style.textContent = CLOSED_HUD_STYLE;
    shadow.appendChild(style);

    launcher.classList.add("pha-custom-hud");
    topbar.classList.add("pha-hud-topbar");

    grid = document.createElement("span");
    grid.className = "pha-hud-grid";
    grid.setAttribute("aria-label", "Custom Hunt HUD");
    for (let index = 0; index < 4; index += 1) {
      const slot = document.createElement("span");
      slot.className = "pha-hud-slot";
      slot.dataset.hudSlot = String(index);
      grid.appendChild(slot);
    }
    launcher.appendChild(grid);

    settingsButton = document.createElement("button");
    settingsButton.id = "pha-hud-settings-button";
    settingsButton.className = "alpha-button pha-hud-settings-button";
    settingsButton.type = "button";
    settingsButton.textContent = "HUD";
    settingsButton.title = "Configure Closed HUD";
    topbar.insertBefore(settingsButton, alphaButton);

    settings = document.createElement("section");
    settings.id = "pha-hud-settings";
    settings.className = "pha-hud-settings";
    settings.hidden = true;
    settings.innerHTML = `
      <div class="pha-hud-settings-head">
        <strong>Closed HUD · MVP</strong>
        <small>4 indicators · changes apply instantly</small>
      </div>
      <div class="pha-hud-settings-toolbar">
        <label>Preset
          <select data-hud-preset>
            <option value="default">Default</option>
            <option value="leveling">Leveling</option>
            <option value="economy">Economy</option>
            <option value="capture">Capture</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <button type="button" data-hud-reset>Reset Default</button>
      </div>
      <div class="pha-hud-slot-configs">
        ${[0, 1, 2, 3].map((index) => `
          <label class="pha-hud-slot-config">
            <span>${index + 1}</span>
            <select data-hud-widget="${index}">${widgetOptionsMarkup()}</select>
            <select data-hud-item="${index}" hidden></select>
          </label>`).join("")}
      </div>
      <div class="pha-hud-inventory-status" data-hud-inventory-status>Waiting for inventory snapshot…</div>
    `;
    tabs.after(settings);

    mounted = true;
    bindSettings();
    syncSettings();
    renderLastState();
    inventoryState.start();
  }

  function renderRarities(container, display) {
    container.replaceChildren();
    const wrap = document.createElement("span");
    wrap.className = "pha-hud-rarity-values";
    const titleParts = [];

    display.rarities.forEach((rarity, index) => {
      const value = document.createElement("span");
      value.className = `rarity-${rarity.key}`;
      value.textContent = formatNumber(rarity.value);
      wrap.appendChild(value);
      titleParts.push(`${rarity.label}: ${formatNumber(rarity.value)}`);
      if (index < display.rarities.length - 1) {
        const separator = document.createElement("span");
        separator.className = "pha-hud-rarity-separator";
        separator.textContent = "·";
        wrap.appendChild(separator);
      }
    });

    container.title = titleParts.join(" · ");
    container.appendChild(wrap);
  }

  function renderLastState() {
    if (!mounted || !grid || !lastState) return;
    const derived = deriveClosedHudState(lastState);
    const inventory = activeInventory();

    for (let index = 0; index < 4; index += 1) {
      const slotElement = grid.querySelector(`[data-hud-slot="${index}"]`);
      const display = closedHudDisplay(config.slots[index], derived, inventory);
      slotElement.classList.toggle("is-empty", Boolean(display.empty));
      slotElement.title = display.title || "";
      slotElement.replaceChildren();

      if (display.empty) continue;

      const label = document.createElement("span");
      label.className = "pha-hud-slot-label";
      label.textContent = display.label;
      slotElement.appendChild(label);

      if (display.kind === "rarities") {
        renderRarities(slotElement, display);
        continue;
      }

      const value = document.createElement("span");
      value.className = `pha-hud-slot-value${display.tone ? ` ${display.tone}` : ""}`;
      value.textContent = display.value;
      slotElement.appendChild(value);
    }
  }

  function render(state) {
    lastState = state;
    renderLastState();
  }

  function dispose() {
    inventoryState.dispose();
    if (launcher) launcher.classList.remove("pha-custom-hud");
    shadow?.querySelector(".topbar")?.classList.remove("pha-hud-topbar");
    grid?.remove();
    settings?.remove();
    settingsButton?.remove();
    style?.remove();
    mounted = false;
    shadow = null;
    launcher = null;
    grid = null;
    settings = null;
    settingsButton = null;
    style = null;
  }

  return {
    mount,
    render,
    dispose,
    getConfig: () => normalizeClosedHudConfig(config),
    getInventorySnapshot: () => activeInventory()
  };
}
