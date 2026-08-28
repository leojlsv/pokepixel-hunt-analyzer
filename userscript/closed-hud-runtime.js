import { createClosedHud as createBaseClosedHud } from "./closed-hud.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const STYLE_ID = "pha-closed-hud-runtime-style";

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

export function createClosedHud(options = {}) {
  const hud = createBaseClosedHud(options);
  let hydrated = false;
  let shadow = null;
  let launcher = null;
  let style = null;

  function resolveElements() {
    shadow = document.getElementById(ROOT_ID)?.shadowRoot || null;
    launcher = shadow?.getElementById("pha-toggle") || null;
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
    for (const grid of shadow.querySelectorAll(".pha-hud-rarity-grid")) {
      const count = grid.querySelectorAll(".pha-hud-rarity-cell").length;
      grid.classList.toggle("compact", count === 5);
    }
  }

  function mount() {
    hud.mount();
    resolveElements();
    ensureRuntimeStyle();
    if (launcher && !hydrated) launcher.style.visibility = "hidden";
  }

  function render(state) {
    hud.render(state);
    resolveElements();
    ensureRuntimeStyle();
    applyRarityDensity();
    if (!hydrated) {
      hydrated = true;
      if (launcher) launcher.style.visibility = "";
    }
  }

  function dispose() {
    style?.remove();
    hud.dispose();
    hydrated = false;
    shadow = null;
    launcher = null;
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
