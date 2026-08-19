import "./rarity-palette.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.5.2";

const RARITIES = [
  ["weak", "Weak"],
  ["common", "Common"],
  ["uncommon", "Uncommon"],
  ["rare", "Rare"],
  ["epic", "Epic"],
  ["legendary", "Legendary"],
  ["mythical", "Mythical"]
];

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
  if (shadow.getElementById("pha-hud-captures-style")) return;

  const style = document.createElement("style");
  style.id = "pha-hud-captures-style";
  style.textContent = `
    .launcher.pha-hud.pha-hud-compact.pha-hud-captures {
      width: 158px;
      height: 48px;
      grid-template-columns: 32px minmax(0, 1fr);
      column-gap: 9px;
    }

    .pha-hud-captures .pha-hud-compact-metrics {
      display: grid;
      grid-template-rows: 1fr 1fr;
      gap: 2px;
      min-width: 0;
      overflow: visible;
    }

    .pha-hud-captures .pha-hud-xp-line {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      align-items: center;
      gap: 6px;
      min-width: 0;
      line-height: 1;
    }

    .pha-hud-captures .pha-hud-xp-line > span {
      color: #b9ad81;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: .03em;
      text-transform: uppercase;
    }

    .pha-hud-captures .pha-hud-xp-line > strong {
      min-width: 0;
      color: #f0eee6;
      font-size: 12px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pha-hud-rarity-captures {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 3px;
      min-width: 0;
      white-space: nowrap;
      font-size: 9px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .pha-hud-rarity-captures .pha-hud-rarity-count {
      min-width: 6px;
      text-align: center;
      text-shadow: none !important;
      box-shadow: none !important;
      filter: none !important;
    }

    .pha-hud-rarity-captures .pha-hud-separator {
      color: #77746a;
      font-weight: 500;
    }
  `;

  shadow.appendChild(style);
}

function parseCount(text) {
  const match = String(text || "").trim().match(/^([\d.,]+)/);
  if (!match) return "0";

  const value = Number(match[1].replace(/\./g, "").replace(/,/g, ""));
  return Number.isFinite(value) ? String(value) : "0";
}

function installHud(shadow) {
  const launcher = shadow.getElementById("pha-toggle");
  if (!launcher) return;

  launcher.classList.add("pha-hud-captures");
  launcher.title = "Open PokePixel Hunt Analyzer · drag to reposition";

  const rarityMarkup = RARITIES.map(([key, label], index) => {
    const separator = index === RARITIES.length - 1
      ? ""
      : '<span class="pha-hud-separator" aria-hidden="true">-</span>';

    return `<span id="pha-hud-cap-${key}" class="pha-hud-rarity-count rarity-${key}" title="${label} captured">0</span>${separator}`;
  }).join("");

  launcher.innerHTML = `
    <span class="pha-hud-mark">PX</span>
    <span class="pha-hud-compact-metrics">
      <span class="pha-hud-xp-line">
        <span>XP/h</span>
        <strong id="pha-hud-compact-xp">—</strong>
      </span>
      <span class="pha-hud-rarity-captures" aria-label="Captured by rarity">
        ${rarityMarkup}
      </span>
    </span>
    <span class="pha-hud-compat-targets" aria-hidden="true">
      <span id="pha-hud-time">00:00</span>
      <span id="pha-hud-rare-failed">0</span>
    </span>
  `;
}

function bindUpdates(shadow) {
  const rarityBody = shadow.getElementById("rarity-body");
  if (!rarityBody) return;

  const update = () => {
    for (const [key] of RARITIES) {
      const source = rarityBody.querySelector(`[data-rarity="${key}"] [data-f="captured"]`);
      const target = shadow.getElementById(`pha-hud-cap-${key}`);
      if (target) target.textContent = parseCount(source?.textContent);
    }
  };

  new MutationObserver(update).observe(rarityBody, {
    subtree: true,
    childList: true,
    characterData: true
  });

  update();
}

async function init() {
  const shadow = await waitForShadow();
  installStyles(shadow);
  installHud(shadow);
  bindUpdates(shadow);

  const version = shadow.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (HUD captures):", error)
);
