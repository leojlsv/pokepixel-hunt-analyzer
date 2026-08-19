import "./current-v15.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.5.1";

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

function installRarityPalette(shadow) {
  if (shadow.getElementById("pha-rarity-palette-style")) return;

  const style = document.createElement("style");
  style.id = "pha-rarity-palette-style";
  style.textContent = `
    .rarity-weak,
    .rarity-common,
    .rarity-uncommon,
    .rarity-rare,
    .rarity-epic,
    .rarity-legendary,
    .rarity-mythical {
      text-shadow: none !important;
      box-shadow: none !important;
      filter: none !important;
      background-image: none !important;
    }

    .rarity-weak { color: #b8bec5 !important; }
    .rarity-common { color: #48d77a !important; }
    .rarity-uncommon { color: #45d7e8 !important; }
    .rarity-rare { color: #c58cff !important; }
    .rarity-epic { color: #f0c64f !important; }
    .rarity-legendary { color: #ff9d2e !important; }
    .rarity-mythical { color: #ff6384 !important; }
  `;

  shadow.appendChild(style);
}

async function init() {
  const shadow = await waitForShadow();
  installRarityPalette(shadow);

  const version = shadow.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (rarity palette):", error)
);
