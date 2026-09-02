import {
  createClosedHud as createBaseClosedHud,
  createPotionUsageTracker,
  POTION_USAGE_STORAGE_KEY
} from "./closed-hud.js";
import { MOBILE_CLOSED_HUD_STYLES } from "./closed-hud-mobile-styles.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const STYLE_ID = "pha-closed-hud-polish-style";
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
    observeGrid();
    decorateSupplySymbols();
  }

  function render(state) {
    hud.render(state);
    resolveElements();
    ensureStyle();
    if (!observer) observeGrid();
    decorateSupplySymbols();
  }

  function dispose() {
    observer?.disconnect();
    observer = null;
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
