import "./hud-captures.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.5.3";

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
  if (shadow.getElementById("pha-current-polish-v153-style")) return;

  const style = document.createElement("style");
  style.id = "pha-current-polish-v153-style";
  style.textContent = `
    /* Same collapse control in Hunt, By Rarity, Captured and Failed. */
    #pha-collapse-hunt,
    .pha-section-meta .pha-collapse-button {
      appearance: none !important;
      width: 24px !important;
      min-width: 24px !important;
      height: 22px !important;
      padding: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      border: 1px solid #55544c !important;
      border-radius: 3px !important;
      background: #30312c !important;
      color: #f0eee6 !important;
      box-shadow: none !important;
      font: inherit !important;
      font-size: 11px !important;
      line-height: 1 !important;
      cursor: pointer !important;
    }

    #pha-collapse-hunt:hover,
    .pha-section-meta .pha-collapse-button:hover {
      background: #3a3a34 !important;
      border-color: #69675e !important;
    }

    /* Filters belong visually to the section instead of becoming a black strip. */
    .pha-captured-section > .filters,
    .pha-failed-section > .filters {
      background: #252621 !important;
      border-top: 0 !important;
      border-bottom: 1px solid #3d3d37 !important;
      padding: 8px 10px !important;
    }

    .pha-captured-section > .filters select,
    .pha-captured-section > .filters input,
    .pha-failed-section > .filters select,
    .pha-failed-section > .filters input {
      background: #20211e !important;
      border: 1px solid #4b4a43 !important;
      color: #f0eee6 !important;
      border-radius: 3px !important;
      box-shadow: none !important;
    }

    /* Match By Rarity's typography: 10px headers, 12px data rows. */
    .pha-captured-section th,
    .pha-failed-section th {
      font-size: 10px !important;
      line-height: 1.2 !important;
    }

    .pha-captured-section td,
    .pha-failed-section td {
      font-size: 12px !important;
      line-height: 1.2 !important;
    }

    .pha-captured-section th,
    .pha-captured-section td,
    .pha-failed-section th,
    .pha-failed-section td {
      padding: 5px 9px !important;
    }

    .pha-captured-section th:last-child,
    .pha-failed-section th:last-child,
    .pha-captured-section td:last-child,
    .pha-failed-section td:last-child {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  `;

  shadow.appendChild(style);
}

function parseIvBreakdown(text) {
  const raw = String(text || "").trim();
  if (!raw || raw === "—") return null;

  // Already formatted by this layer: "123 (20-21-...)".
  if (/^\d+\s*\([^)]*\)$/.test(raw)) return null;

  const parts = raw.split("-").map((part) => Number(part.trim()));
  if (parts.length !== 6 || parts.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    total: parts.reduce((sum, value) => sum + value, 0),
    breakdown: parts.join("-")
  };
}

function polishIvTable(bodyId) {
  const body = document.getElementById(ROOT_ID)?.shadowRoot?.getElementById(bodyId);
  if (!body) return;

  const header = body.closest("table")?.querySelector("thead tr th:last-child");
  if (header) {
    header.textContent = "IV";
    header.title = "IV Total (HP-ATK-DEF-SATK-SDEF-SPE)";
  }

  for (const row of body.rows) {
    const cell = row.cells[row.cells.length - 1];
    if (!cell) continue;

    const parsed = parseIvBreakdown(cell.textContent);
    if (!parsed) continue;

    cell.textContent = `${parsed.total} (${parsed.breakdown})`;
    cell.title = `IV Total ${parsed.total} · HP-ATK-DEF-SATK-SDEF-SPE ${parsed.breakdown}`;
  }
}

function installIvFormatting(shadow) {
  const bodyIds = ["captured-body", "failed-body"];

  const apply = () => {
    for (const id of bodyIds) polishIvTable(id);
  };

  for (const id of bodyIds) {
    const body = shadow.getElementById(id);
    if (!body) continue;

    new MutationObserver(apply).observe(body, {
      childList: true
    });
  }

  apply();
}

function installVersionAuthority(shadow) {
  const node = shadow.querySelector(".topbar small");
  if (!node) return;

  const expected = `Userscript ${UI_VERSION}`;
  const apply = () => {
    if (node.textContent !== expected) node.textContent = expected;
  };

  const observer = new MutationObserver(apply);
  observer.observe(node, {
    subtree: true,
    childList: true,
    characterData: true
  });

  apply();
}

async function init() {
  const shadow = await waitForShadow();
  installStyles(shadow);

  // Failed is created asynchronously by current-v15.js. Wait until both
  // table bodies exist before binding table formatting.
  const waitForTables = setInterval(() => {
    if (!shadow.getElementById("captured-body") || !shadow.getElementById("failed-body")) return;
    clearInterval(waitForTables);
    installIvFormatting(shadow);
  }, 50);

  installVersionAuthority(shadow);
}

init().catch((error) =>
  console.error("PokePixel Hunt Analyzer (Current polish v1.5.3):", error)
);
