import "./stability-v159.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.5.10";
const REF_CODE = "Q4BSZJD";

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

function installStyles(shadow) {
  if (shadow.getElementById("pha-polish-v1510-style")) return;

  const style = document.createElement("style");
  style.id = "pha-polish-v1510-style";
  style.textContent = `
    .pha-captured-section td,
    .pha-failed-section td {
      font-size: 11px !important;
    }

    .pha-credit-line {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 1px;
      color: #aaa79c;
      font-size: 9px;
      line-height: 1.1;
      white-space: nowrap;
    }

    .pha-refcode {
      appearance: none;
      padding: 0;
      border: 0;
      background: transparent;
      color: #79e6f2;
      font: inherit;
      font-weight: 800;
      letter-spacing: .14em;
      line-height: 1.1;
      cursor: pointer;
      text-shadow: none;
      box-shadow: none;
    }

    .pha-refcode:hover {
      color: #9ceef6;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .pha-refcode:focus-visible {
      outline: 1px solid #79e6f2;
      outline-offset: 2px;
    }
  `;

  shadow.appendChild(style);
}

function replaceVersionNode(shadow) {
  const current = shadow.querySelector(".topbar small");
  if (!current) return;

  const replacement = current.cloneNode(false);
  replacement.textContent = `Userscript ${UI_VERSION}`;
  current.replaceWith(replacement);
}

async function copyRefCode(button) {
  try {
    await navigator.clipboard.writeText(REF_CODE);
    button.title = "Copied!";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = REF_CODE;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.documentElement.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
      button.title = "Copied!";
    } catch {
      button.title = `Ref code: ${REF_CODE}`;
    } finally {
      textarea.remove();
    }
  }

  window.setTimeout(() => {
    button.title = `Copy ref code ${REF_CODE}`;
  }, 1200);
}

function installCredits(shadow) {
  if (shadow.getElementById("pha-credit-line")) return;

  const brand = shadow.querySelector(".topbar > div:first-child");
  if (!brand) return;

  const line = document.createElement("span");
  line.id = "pha-credit-line";
  line.className = "pha-credit-line";

  const prefix = document.createElement("span");
  prefix.textContent = "by Rhyxus ·";

  const code = document.createElement("button");
  code.id = "pha-refcode";
  code.className = "pha-refcode";
  code.type = "button";
  code.textContent = REF_CODE;
  code.title = `Copy ref code ${REF_CODE}`;
  code.setAttribute("aria-label", `Copy ref code ${REF_CODE}`);
  code.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyRefCode(code);
  });

  line.append(prefix, code);
  brand.appendChild(line);
}

async function init() {
  const shadow = await waitForShadow();
  installStyles(shadow);

  // Keep the v1.5.9 stability pattern: replace the version node once,
  // without attaching any MutationObserver to the header.
  replaceVersionNode(shadow);
  installCredits(shadow);
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (polish v1.5.10):", error)
);
