import "./interaction-v154.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.5.8";
const ALPHA_KEY = "pokepixel_hunt_analyzer_alpha_v1";
const ALPHA_LEVELS = [1, 0.9, 0.8, 0.7, 0.6, 0.5];

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

function readAlpha() {
  const value = Number(localStorage.getItem(ALPHA_KEY));
  return ALPHA_LEVELS.includes(value) ? value : 1;
}

function writeAlpha(value) {
  localStorage.setItem(ALPHA_KEY, String(value));
}

function installStyles(shadow) {
  if (shadow.getElementById("pha-alpha-v155-style")) return;

  const style = document.createElement("style");
  style.id = "pha-alpha-v155-style";
  style.textContent = `
    .topbar {
      grid-template-columns: minmax(0, 1fr) auto auto auto !important;
    }

    .pha-alpha-button {
      appearance: none;
      height: 22px;
      min-width: 52px;
      padding: 0 7px;
      border: 1px solid #665c3d;
      border-radius: 3px;
      background: #353329;
      color: #d7b45d;
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: none;
    }

    .pha-alpha-button:hover {
      background: #403c2e;
      border-color: #8e7943;
    }
  `;

  shadow.appendChild(style);
}

function applyAlpha(shadow, alpha, button) {
  const panel = shadow.getElementById("pha-panel");
  const launcher = shadow.getElementById("pha-toggle");
  const resizeHandle = shadow.getElementById("pha-resize-bottom-left");

  for (const element of [panel, launcher, resizeHandle]) {
    if (element) element.style.opacity = String(alpha);
  }

  const percent = Math.round(alpha * 100);
  if (button) {
    button.textContent = `α ${percent}%`;
    button.title = `Analyzer alpha: ${percent}% · click to change`;
    button.setAttribute("aria-label", `Analyzer alpha ${percent} percent`);
  }
}

function installAlphaButton(shadow) {
  const topbar = shadow.querySelector(".topbar");
  const close = shadow.getElementById("pha-close");
  if (!topbar || !close) return;

  let button = shadow.getElementById("pha-alpha-button");
  if (!button) {
    button = document.createElement("button");
    button.id = "pha-alpha-button";
    button.className = "pha-alpha-button";
    button.type = "button";
    topbar.insertBefore(button, close);
  }

  let alpha = readAlpha();
  applyAlpha(shadow, alpha, button);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const currentIndex = Math.max(0, ALPHA_LEVELS.indexOf(alpha));
    alpha = ALPHA_LEVELS[(currentIndex + 1) % ALPHA_LEVELS.length];
    writeAlpha(alpha);
    applyAlpha(shadow, alpha, button);
  });

  const handleTimer = setInterval(() => {
    const handle = shadow.getElementById("pha-resize-bottom-left");
    if (!handle) return;
    clearInterval(handleTimer);
    handle.style.opacity = String(alpha);
  }, 50);
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
  installStyles(shadow);
  installAlphaButton(shadow);
  installVersionAuthority(shadow);
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (alpha v1.5.8):", error)
);
