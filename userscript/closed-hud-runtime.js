import { createClosedHud as createBaseClosedHud } from "./closed-hud.js";
import { formatNumber } from "./ui-utils.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const STYLE_ID = "pha-closed-hud-runtime-style";
export const POTION_USAGE_STORAGE_KEY = "pokepixel_hunt_analyzer_potion_usage_v1";

const RUNTIME_STYLE = `
  .pha-hud-rarity-grid .pha-hud-rarity-count,
  .pha-hud-rarity-grid.with-failed .pha-hud-rarity-count {
    font-size:12px;
  }
  .pha-hud-rarity-captured {
    font-size:1em;
    font-weight:900;
    line-height:1;
  }
  .pha-hud-rarity-failed,
  .pha-hud-rarity-separator {
    flex:none;
    font-size:7px;
    line-height:1;
  }
  .pha-hud-rarity-grid.compact .pha-hud-rarity-count,
  .pha-hud-rarity-grid.compact.with-failed .pha-hud-rarity-count {
    font-size:10px;
  }
  .pha-hud-rarity-grid.compact .pha-hud-rarity-failed,
  .pha-hud-rarity-grid.compact .pha-hud-rarity-separator {
    font-size:6px;
  }
  .pha-hud-rarity-grid.dense .pha-hud-rarity-count,
  .pha-hud-rarity-grid.dense.with-failed .pha-hud-rarity-count {
    font-size:9px;
  }
  .pha-hud-rarity-grid.dense .pha-hud-rarity-failed,
  .pha-hud-rarity-grid.dense .pha-hud-rarity-separator {
    font-size:6px;
  }
`;

function itemQuantity(item) {
  const value = Number(item?.qty ?? item?.quantity ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function potionQuantities(snapshot) {
  const quantities = new Map();
  for (const item of snapshot?.potions || []) {
    const itemId = String(item?.item_id || "");
    if (!itemId) continue;
    quantities.set(itemId, itemQuantity(item));
  }
  return quantities;
}

function mapFromStoredRecord(record) {
  const map = new Map();
  if (!record || typeof record !== "object") return map;
  for (const [key, rawValue] of Object.entries(record)) {
    const value = Number(rawValue);
    if (!key || !Number.isFinite(value) || value < 0) continue;
    map.set(key, value);
  }
  return map;
}

export function createPotionUsageTracker({
  storage = null,
  storageKey = POTION_USAGE_STORAGE_KEY
} = {}) {
  let sessionId = null;
  let lastQuantities = new Map();
  let usage = new Map();

  try {
    const stored = JSON.parse(storage?.getItem(storageKey) || "null");
    if (stored && typeof stored === "object" && stored.sessionId) {
      sessionId = String(stored.sessionId);
      lastQuantities = mapFromStoredRecord(stored.lastQuantities);
      usage = mapFromStoredRecord(stored.usage);
    }
  } catch {
    // Invalid or unavailable local storage starts a fresh runtime tracker.
  }

  function persist() {
    if (!storage || !sessionId) return;
    try {
      storage.setItem(storageKey, JSON.stringify({
        sessionId,
        lastQuantities: Object.fromEntries(lastQuantities),
        usage: Object.fromEntries(usage)
      }));
    } catch {
      // Usage tracking remains functional in-memory when persistence is unavailable.
    }
  }

  function reconcile(nextSessionId, inventorySnapshot) {
    const normalizedSessionId = nextSessionId ? String(nextSessionId) : null;
    if (!normalizedSessionId || !inventorySnapshot?.ready) return;

    const currentQuantities = potionQuantities(inventorySnapshot);
    if (sessionId !== normalizedSessionId) {
      sessionId = normalizedSessionId;
      lastQuantities = currentQuantities;
      usage = new Map();
      persist();
      return;
    }

    const itemIds = new Set([
      ...lastQuantities.keys(),
      ...currentQuantities.keys()
    ]);
    const nextLastQuantities = new Map();
    let changed = false;

    for (const itemId of itemIds) {
      const previous = lastQuantities.has(itemId)
        ? lastQuantities.get(itemId)
        : null;
      const current = currentQuantities.has(itemId)
        ? currentQuantities.get(itemId)
        : 0;

      if (previous !== null && current < previous) {
        usage.set(itemId, (usage.get(itemId) || 0) + previous - current);
      }
      if (previous === null || current !== previous) changed = true;
      nextLastQuantities.set(itemId, current);
    }

    if (!changed) return;
    lastQuantities = nextLastQuantities;
    persist();
  }

  return {
    reconcile,
    getUsage: (itemId) => itemId ? usage.get(String(itemId)) || 0 : 0,
    getSessionId: () => sessionId,
    getSnapshot: () => ({
      sessionId,
      lastQuantities: new Map(lastQuantities),
      usage: new Map(usage)
    })
  };
}

function potionItemForSlot(slot, inventory) {
  if (slot?.itemId && inventory?.byId?.has(slot.itemId)) {
    return inventory.byId.get(slot.itemId);
  }
  return Array.isArray(inventory?.potions) ? inventory.potions[0] || null : null;
}

function fitInventoryLine(line) {
  const primary = line?.querySelector(".pha-hud-inventory-primary");
  if (!primary) return;
  line.classList.remove("hide-secondary", "tight", "extra-tight");
  if (line.scrollWidth <= line.clientWidth + 1) return;
  line.classList.add("hide-secondary");
  if (line.scrollWidth <= line.clientWidth + 1) return;
  line.classList.add("tight");
  if (line.scrollWidth <= line.clientWidth + 1) return;
  line.classList.add("extra-tight");
}

export function createClosedHud(options = {}) {
  const hud = createBaseClosedHud(options);
  const potionUsage = createPotionUsageTracker({
    storage: typeof localStorage !== "undefined" ? localStorage : null
  });
  let hydrated = false;
  let shadow = null;
  let launcher = null;
  let grid = null;
  let style = null;
  let gridObserver = null;
  let lastSessionId = null;

  function resolveElements() {
    shadow = document.getElementById(ROOT_ID)?.shadowRoot || null;
    launcher = shadow?.getElementById("pha-toggle") || null;
    grid = shadow?.querySelector(".pha-hud-grid") || null;
  }

  function ensureRuntimeStyle() {
    if (!shadow) return;
    style = shadow.getElementById(STYLE_ID);
    if (style) return;
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = RUNTIME_STYLE;
    shadow.appendChild(style);
  }

  function applyRarityDensity() {
    if (!shadow) return;
    for (const rarityGrid of shadow.querySelectorAll(".pha-hud-rarity-grid")) {
      const count = rarityGrid.querySelectorAll(".pha-hud-rarity-cell").length;
      rarityGrid.classList.toggle("compact", count === 5);
    }
  }

  function applyPotionUsage() {
    if (!shadow || !grid) return;
    const inventory = hud.getInventorySnapshot();
    potionUsage.reconcile(lastSessionId, inventory);
    const config = hud.getConfig();

    for (let index = 0; index < config.slots.length; index += 1) {
      const slot = config.slots[index];
      if (slot?.widget !== "potionTracker") continue;

      const slotElement = grid.querySelector(`[data-hud-slot="${index}"]`);
      const line = slotElement?.querySelector(".pha-hud-inventory-line");
      if (!slotElement || !line) continue;

      const item = potionItemForSlot(slot, inventory);
      const itemId = item?.item_id || slot.itemId || "";
      const used = lastSessionId && itemId ? potionUsage.getUsage(itemId) : 0;
      const secondaryText = `↓${formatNumber(used)}`;
      let secondary = line.querySelector(".pha-hud-inventory-secondary");

      if (!secondary) {
        secondary = document.createElement("span");
        secondary.className = "pha-hud-inventory-secondary";
        line.appendChild(secondary);
      }
      if (secondary.textContent !== secondaryText) {
        secondary.textContent = secondaryText;
      }

      const remaining = item ? itemQuantity(item) : null;
      const title = `${item?.name || itemId || "Potion"}: ${remaining == null ? "unknown" : formatNumber(remaining)} remaining, ${formatNumber(used)} used in this Hunt`;
      if (slotElement.title !== title) slotElement.title = title;
      fitInventoryLine(line);
    }
  }

  function applyRuntimeState() {
    applyRarityDensity();
    applyPotionUsage();
  }

  function observeGrid() {
    gridObserver?.disconnect();
    gridObserver = null;
    if (!grid || typeof MutationObserver === "undefined") return;

    gridObserver = new MutationObserver(() => {
      applyRuntimeState();
    });
    gridObserver.observe(grid, { childList: true, subtree: true });
  }

  function mount() {
    hud.mount();
    resolveElements();
    ensureRuntimeStyle();
    observeGrid();
    applyRuntimeState();
    if (launcher && !hydrated) launcher.style.visibility = "hidden";
  }

  function render(state) {
    lastSessionId = state?.sessionId || null;
    hud.render(state);
    resolveElements();
    ensureRuntimeStyle();
    if (!gridObserver) observeGrid();
    applyRuntimeState();
    if (!hydrated) {
      hydrated = true;
      if (launcher) launcher.style.visibility = "";
    }
  }

  function dispose() {
    gridObserver?.disconnect();
    gridObserver = null;
    style?.remove();
    hud.dispose();
    hydrated = false;
    shadow = null;
    launcher = null;
    grid = null;
    style = null;
    lastSessionId = null;
  }

  return {
    mount,
    render,
    dispose,
    getConfig: () => hud.getConfig(),
    getInventorySnapshot: () => hud.getInventorySnapshot()
  };
}
