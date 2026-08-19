import "./current-ui.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.3.1";

function waitForShadow() {
  return new Promise((resolve) => {
    const find = () => {
      const host = document.getElementById(ROOT_ID);
      if (host?.shadowRoot) {
        resolve(host.shadowRoot);
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

function installResponsiveStyles(shadow) {
  if (shadow.getElementById("pha-current-responsive-style")) return;

  const style = document.createElement("style");
  style.id = "pha-current-responsive-style";
  style.textContent = `
    /*
     * v1.3.1: responsiveness follows the Analyzer panel itself, not the
     * browser viewport. The panel is user-resizable, so a viewport media
     * query cannot tell us when its internal cards are actually cramped.
     */
    .panel.pha-qol-panel {
      container-type: inline-size;
      container-name: pha-analyzer;
    }

    @container pha-analyzer (max-width: 500px) {
      .pha-live-card .cards,
      .pha-capture-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .pha-live-card .cards article {
        min-height: 54px;
      }

      .pha-live-card .cards article > strong {
        font-size: 16px;
      }

      .pha-capture-strip article {
        min-height: 36px;
      }

      .pha-capture-strip article strong {
        font-size: 14px;
      }
    }

    @container pha-analyzer (max-width: 455px) {
      .pha-live-card {
        padding: 9px;
      }

      .pha-live-card .cards,
      .pha-capture-strip {
        gap: 6px;
      }

      .pha-live-card .cards article,
      .pha-capture-strip article {
        padding-left: 10px;
        padding-right: 10px;
      }

      .pha-live-card .cards article > span,
      .pha-capture-strip article span {
        font-size: 9px;
      }
    }
  `;

  shadow.appendChild(style);
}

async function init() {
  const shadow = await waitForShadow();
  installResponsiveStyles(shadow);

  const version = shadow.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (responsive Current):", error)
);
