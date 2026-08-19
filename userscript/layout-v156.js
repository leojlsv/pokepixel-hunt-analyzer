import "./alpha-v155.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";

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
  if (shadow.getElementById("pha-layout-v156-style")) return;

  const style = document.createElement("style");
  style.id = "pha-layout-v156-style";
  style.textContent = `
    .tabs {
      align-items: center !important;
    }

    #hunt-time.pha-tabs-timer {
      margin-left: auto;
      padding: 0 4px;
      color: #f0eee6 !important;
      font-size: 15px !important;
      font-weight: 800 !important;
      line-height: 1 !important;
      letter-spacing: -.02em;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      align-self: center;
    }

    .pha-live-card .statusrow {
      grid-template-columns: auto auto !important;
    }

    .pha-live-card .cards {
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 5px !important;
    }

    .pha-live-card .cards article {
      min-width: 0 !important;
      min-height: 54px !important;
      padding: 7px 7px !important;
    }

    .pha-live-card .cards article > span {
      font-size: 9px !important;
      line-height: 1.05 !important;
      letter-spacing: .025em !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pha-live-card .cards article > strong {
      font-size: 15px !important;
      line-height: 1 !important;
      letter-spacing: -.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pha-live-card .cards article > small {
      font-size: 8px !important;
      line-height: 1.05 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @container pha-analyzer (max-width: 500px) {
      .pha-live-card .cards {
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 4px !important;
      }

      .pha-live-card .cards article {
        min-height: 52px !important;
        padding: 6px 6px !important;
      }

      .pha-live-card .cards article > span {
        font-size: 8.5px !important;
      }

      .pha-live-card .cards article > strong {
        font-size: 14px !important;
      }

      .pha-live-card .cards article > small {
        font-size: 7.5px !important;
      }
    }
  `;

  shadow.appendChild(style);
}

function moveTimerToTabs(shadow) {
  const tabs = shadow.querySelector(".tabs");
  const timer = shadow.getElementById("hunt-time");
  if (!tabs || !timer) return;

  timer.classList.add("pha-tabs-timer");
  tabs.appendChild(timer);
}

async function init() {
  const shadow = await waitForShadow();
  installStyles(shadow);
  moveTimerToTabs(shadow);
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (layout v1.5.6):", error)
);
