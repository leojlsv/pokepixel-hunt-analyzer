import "./compare-qol-v141.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.4.2";

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

async function init() {
  const shadow = await waitForShadow();

  if (!shadow.getElementById("pha-view-visibility-fix")) {
    const style = document.createElement("style");
    style.id = "pha-view-visibility-fix";
    style.textContent = `
      #view-current[hidden],
      #view-compare[hidden] {
        display: none !important;
      }
    `;
    shadow.appendChild(style);
  }

  const version = shadow.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (view visibility fix):", error)
);
