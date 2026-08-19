import "./current-ui.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";

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

function numericValue(text) {
  const match = String(text || "").match(/([\d.,]+)/);
  if (!match) return "0";
  const value = Number(match[1].replace(/\./g, "").replace(/,/g, ""));
  return Number.isFinite(value) ? String(value) : "0";
}

async function init() {
  const shadow = await waitForShadow();

  const bind = () => {
    const source = shadow.getElementById("pha-current-rare-failed");
    const target = shadow.getElementById("pha-hud-rare-failed");
    if (!source || !target) return false;

    const update = () => {
      target.textContent = numericValue(source.textContent);
    };

    new MutationObserver(update).observe(source, {
      subtree: true,
      childList: true,
      characterData: true
    });

    update();
    return true;
  };

  if (bind()) return;

  const timer = setInterval(() => {
    if (bind()) clearInterval(timer);
  }, 50);
}

init().catch((error) => console.error("PokePixel Hunt Analyzer (v1.3):", error));
