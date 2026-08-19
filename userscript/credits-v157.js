import "./layout-v156.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
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
  if (shadow.getElementById("pha-credits-v157-style")) return;

  const style = document.createElement("style");
  style.id = "pha-credits-v157-style";
  style.textContent = `
    .pha-credit-line {
      display: inline-flex;
      align-items: center;
      gap: 3px;
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

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the document copy fallback.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.documentElement.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  textarea.remove();
  return copied;
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

  code.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const copied = await copyText(REF_CODE);
    const originalTitle = `Copy ref code ${REF_CODE}`;
    code.title = copied ? "Copied!" : "Could not copy";

    window.setTimeout(() => {
      code.title = originalTitle;
    }, 1200);
  });

  line.append(prefix, code);
  brand.appendChild(line);
}

async function init() {
  const shadow = await waitForShadow();
  installStyles(shadow);
  installCredits(shadow);
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (credits v1.5.7):", error)
);
