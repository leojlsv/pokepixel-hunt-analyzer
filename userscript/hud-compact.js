import "./current-responsive.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.3.2";

function waitForShadow() {
  return new Promise((resolve) => {
    const find = () => {
      const shadow = document.getElementById(ROOT_ID)?.shadowRoot;
      if (shadow) {
        resolve(shadow);
        return true;
      }
      return false;
    };

    if (find()) return;

    const timer = setInterval(() => {
      if (find()) clearInterval(timer);
    }, 50);
  });
}

function installStyles(shadow) {
  if (shadow.getElementById("pha-hud-compact-style")) return;

  const style = document.createElement("style");
  style.id = "pha-hud-compact-style";
  style.textContent = `
    .launcher.pha-hud.pha-hud-v13.pha-hud-compact {
      width: 158px;
      height: 48px;
      padding: 6px 8px;
      display: grid;
      grid-template-columns: 32px 1fr;
      grid-template-rows: 1fr;
      column-gap: 9px;
      align-items: center;
      box-sizing: border-box;
    }

    .pha-hud-compact .pha-hud-mark {
      width: 32px;
      height: 32px;
      grid-row: auto;
      border-radius: 9px;
      font-size: 11px;
    }

    .pha-hud-compact-metrics {
      min-width: 0;
      display: grid;
      grid-template-rows: repeat(2, minmax(0, 1fr));
      gap: 2px;
      align-self: stretch;
    }

    .pha-hud-compact-metric {
      min-width: 0;
      display: grid;
      grid-template-columns: 38px 1fr;
      align-items: center;
      gap: 6px;
      line-height: 1;
      white-space: nowrap;
    }

    .pha-hud-compact-metric span {
      color: #8f9cab;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .03em;
    }

    .pha-hud-compact-metric strong {
      min-width: 0;
      color: #f1f5f9;
      font-size: 12px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pha-hud-compat-targets {
      display: none !important;
    }
  `;

  shadow.appendChild(style);
}

function installCompactHud(shadow) {
  const launcher = shadow.getElementById("pha-toggle");
  if (!launcher || launcher.classList.contains("pha-hud-compact")) return;

  launcher.classList.add("pha-hud-compact");
  launcher.title = "Open PokePixel Hunt Analyzer · drag to reposition";
  launcher.innerHTML = `
    <span class="pha-hud-mark">PX</span>
    <span class="pha-hud-compact-metrics">
      <span class="pha-hud-compact-metric">
        <span>XP/h</span>
        <strong id="pha-hud-compact-xp">—</strong>
      </span>
      <span class="pha-hud-compact-metric">
        <span>$/h</span>
        <strong id="pha-hud-compact-gold">—</strong>
      </span>
    </span>
    <span class="pha-hud-compat-targets" aria-hidden="true">
      <span id="pha-hud-time">00:00</span>
      <span id="pha-hud-rare-failed">0</span>
    </span>
  `;

  const xpSource = shadow.getElementById("trainer-exp-hour");
  const goldSource = shadow.getElementById("dollars-hour");

  const update = () => {
    const xp = shadow.getElementById("pha-hud-compact-xp");
    const gold = shadow.getElementById("pha-hud-compact-gold");

    if (xp) xp.textContent = xpSource?.textContent || "—";
    if (gold) gold.textContent = goldSource?.textContent || "—";
  };

  const observer = new MutationObserver(update);
  for (const node of [xpSource, goldSource]) {
    if (node) {
      observer.observe(node, {
        subtree: true,
        childList: true,
        characterData: true
      });
    }
  }

  update();
}

async function init() {
  const shadow = await waitForShadow();
  installStyles(shadow);
  installCompactHud(shadow);

  const version = shadow.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (compact HUD):", error)
);
