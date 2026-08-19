import "./layout-v156.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.5.9";

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

function replaceVersionNode(shadow) {
  const current = shadow.querySelector(".topbar small");
  if (!current) return;

  const replacement = current.cloneNode(false);
  replacement.textContent = `Userscript ${UI_VERSION}`;
  current.replaceWith(replacement);
}

async function init() {
  const shadow = await waitForShadow();

  // Older layers attached MutationObservers directly to the previous <small>
  // node. Replacing the node detaches those observers from the live header,
  // preventing competing version writers from creating a mutation loop.
  replaceVersionNode(shadow);
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (stability v1.5.9):", error)
);
