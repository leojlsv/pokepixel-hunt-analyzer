import "./current-polish-v153.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.5.4";
const EDGE_GAP = 8;

function waitForShadow() {
  return new Promise((resolve) => {
    const find = () => {
      const shadow = document.getElementById(ROOT_ID)?.shadowRoot;
      if (!shadow) return false;
      resolve(shadow);
      return true;
    };

    if (find()) return;

    const timer = setInterval(() => {
      if (find()) clearInterval(timer);
    }, 50);
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function installStyles(shadow) {
  if (shadow.getElementById("pha-interaction-v154-style")) return;

  const style = document.createElement("style");
  style.id = "pha-interaction-v154-style";
  style.textContent = `
    /* Scrollbar palette for every scrollable area inside the Analyzer. */
    * {
      scrollbar-width: thin;
      scrollbar-color: #8e7943 #20211e;
    }

    *::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    *::-webkit-scrollbar-track {
      background: #20211e;
    }

    *::-webkit-scrollbar-thumb {
      background: #8e7943;
      border: 2px solid #20211e;
      border-radius: 2px;
    }

    *::-webkit-scrollbar-thumb:hover {
      background: #b19857;
    }

    *::-webkit-scrollbar-corner {
      background: #20211e;
    }

    .panel.pha-qol-panel {
      position: fixed !important;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }

    .pha-resize-bottom-left {
      position: absolute;
      left: 0;
      bottom: 0;
      z-index: 30;
      width: 15px;
      height: 15px;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: nesw-resize;
      touch-action: none;
    }

    .pha-resize-bottom-left::before,
    .pha-resize-bottom-left::after {
      content: "";
      position: absolute;
      left: 3px;
      bottom: 3px;
      height: 1px;
      background: #8e7943;
      transform: rotate(-45deg);
      transform-origin: left center;
      pointer-events: none;
    }

    .pha-resize-bottom-left::before { width: 10px; }
    .pha-resize-bottom-left::after {
      width: 6px;
      left: 3px;
      bottom: 7px;
    }
  `;

  shadow.appendChild(style);
}

function scrollableFromEvent(event, panel, axis, delta) {
  const property = axis === "x" ? "overflowX" : "overflowY";
  const sizeProperty = axis === "x" ? "scrollWidth" : "scrollHeight";
  const clientProperty = axis === "x" ? "clientWidth" : "clientHeight";
  const positionProperty = axis === "x" ? "scrollLeft" : "scrollTop";

  for (const node of event.composedPath()) {
    if (!(node instanceof Element)) continue;

    const style = getComputedStyle(node);
    if (!/(auto|scroll|overlay)/.test(style[property])) continue;
    if (node[sizeProperty] <= node[clientProperty] + 1) continue;

    const position = node[positionProperty];
    const max = node[sizeProperty] - node[clientProperty];
    const canMove = delta < 0 ? position > 0 : position < max;
    if (canMove) return node;

    if (node === panel) break;
  }

  if (panel[sizeProperty] > panel[clientProperty] + 1) return panel;
  return null;
}

function installWheelScrolling(panel) {
  if (panel.dataset.phaWheelBound === "1") return;
  panel.dataset.phaWheelBound = "1";

  panel.addEventListener("wheel", (event) => {
    if (event.ctrlKey) return;

    const useHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const axis = useHorizontal ? "x" : "y";
    const delta = useHorizontal ? event.deltaX : event.deltaY;
    if (!delta) return;

    const target = scrollableFromEvent(event, panel, axis, delta);
    if (!target) return;

    if (axis === "x") target.scrollLeft += delta;
    else target.scrollTop += delta;

    // Keep the game/page from consuming or cancelling wheel while the pointer
    // is inside the Analyzer. Scrolling has already been applied above.
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true, passive: false });
}

function installBottomLeftResize(panel) {
  if (panel.querySelector(".pha-resize-bottom-left")) return;

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "pha-resize-bottom-left";
  handle.title = "Resize from bottom-left";
  handle.setAttribute("aria-label", "Resize Analyzer from bottom-left");
  panel.appendChild(handle);

  let resize = null;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const rect = panel.getBoundingClientRect();
    const style = getComputedStyle(panel);

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
      startWidth: rect.width,
      startHeight: rect.height,
      minWidth: Number.parseFloat(style.minWidth) || 360,
      minHeight: Number.parseFloat(style.minHeight) || 280
    };

    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!resize || event.pointerId !== resize.pointerId) return;

    const dx = event.clientX - resize.startX;
    const dy = event.clientY - resize.startY;

    const minLeft = EDGE_GAP;
    const maxLeft = resize.startRight - resize.minWidth;
    const left = clamp(resize.startLeft + dx, minLeft, maxLeft);
    const width = resize.startRight - left;
    const maxHeight = Math.max(resize.minHeight, window.innerHeight - resize.startTop - EDGE_GAP);
    const height = clamp(resize.startHeight + dy, resize.minHeight, maxHeight);

    panel.style.left = `${left}px`;
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;

    event.preventDefault();
    event.stopPropagation();
  });

  const finish = (event) => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    resize = null;
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    event.stopPropagation();
  };

  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
}

function pokemonLabel(count) {
  return `${count} ${Number(count) === 1 ? "Pokémon" : "Pokémons"}`;
}

function installPokemonBadges(shadow) {
  const ids = ["pha-current-captured-count", "pha-current-failed-count"];

  for (const id of ids) {
    const node = shadow.getElementById(id);
    if (!node || node.dataset.phaPokemonLabel === "1") continue;
    node.dataset.phaPokemonLabel = "1";

    const apply = () => {
      const match = String(node.textContent || "").match(/\d+/);
      const count = match ? Number(match[0]) : 0;
      const expected = pokemonLabel(count);
      if (node.textContent !== expected) node.textContent = expected;
    };

    new MutationObserver(apply).observe(node, {
      subtree: true,
      childList: true,
      characterData: true
    });

    apply();
  }
}

function installVersionAuthority(shadow) {
  const node = shadow.querySelector(".topbar small");
  if (!node) return;

  const expected = `Userscript ${UI_VERSION}`;
  const apply = () => {
    if (node.textContent !== expected) node.textContent = expected;
  };

  new MutationObserver(apply).observe(node, {
    subtree: true,
    childList: true,
    characterData: true
  });

  apply();
}

async function init() {
  const shadow = await waitForShadow();
  const panel = shadow.getElementById("pha-panel");
  if (!panel) return;

  installStyles(shadow);
  installWheelScrolling(panel);
  installBottomLeftResize(panel);

  const badgeTimer = setInterval(() => {
    const captured = shadow.getElementById("pha-current-captured-count");
    const failed = shadow.getElementById("pha-current-failed-count");
    if (!captured || !failed) return;
    clearInterval(badgeTimer);
    installPokemonBadges(shadow);
  }, 50);

  installVersionAuthority(shadow);
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (interaction v1.5.4):", error)
);
