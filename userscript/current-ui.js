import "./qol.js";

const ROOT_ID = "pokepixel-hunt-analyzer-root";
const UI_VERSION = "1.3.0";

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

function addStyles(shadow) {
  if (shadow.getElementById("pha-current-v13-style")) return;

  const style = document.createElement("style");
  style.id = "pha-current-v13-style";
  style.textContent = `
    .panel.pha-qol-panel {
      width: min(620px, calc(100vw - 16px));
      min-width: 430px;
    }

    #view-current.pha-current-v13 {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
    }

    #view-current.pha-current-v13 > * {
      margin: 0;
    }

    .pha-live-card {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-areas:
        "status actions"
        "metrics metrics";
      gap: 8px;
      padding: 10px;
      border: 1px solid #2d3a48;
      border-radius: 10px;
      background: linear-gradient(180deg, #17212b 0%, #141c25 100%);
    }

    .pha-live-card .statusrow {
      grid-area: status;
      margin: 0;
      padding: 0;
      background: transparent;
      display: grid;
      grid-template-columns: auto auto 1fr;
      justify-content: start;
      gap: 8px;
      min-width: 0;
    }

    .pha-live-card .statusrow > span:first-child {
      color: #94a2b2;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .08em;
      align-self: center;
    }

    .pha-live-card #hunt-status {
      padding: 3px 7px;
      border-radius: 999px;
      background: #222f3b;
      color: #c7d0db;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .04em;
      align-self: center;
    }

    .pha-live-card #hunt-time {
      font-size: 22px;
      line-height: 1;
      letter-spacing: -.02em;
      font-variant-numeric: tabular-nums;
      align-self: center;
    }

    .pha-live-card .actions {
      grid-area: actions;
      padding: 0;
      justify-content: flex-end;
      align-items: center;
      flex-wrap: wrap;
    }

    .pha-live-card .actions button {
      padding: 5px 8px;
      font-size: 10px;
      border-radius: 6px;
    }

    .pha-live-card .cards {
      grid-area: metrics;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 7px;
      padding: 0;
    }

    .pha-live-card .cards article {
      min-height: 58px;
      padding: 8px 9px;
      border-color: #2a3947;
      background: #111922;
    }

    .pha-live-card .cards article > span {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    .pha-live-card .cards article > strong {
      margin-top: 2px;
      font-size: 17px;
      line-height: 1.05;
      font-variant-numeric: tabular-nums;
    }

    .pha-live-card .cards article > small {
      margin-top: auto;
      font-size: 9px;
    }

    .pha-capture-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 7px;
      padding: 0;
    }

    .pha-capture-strip article {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 7px 9px;
      background: #151e27;
      border: 1px solid #263442;
      border-radius: 8px;
    }

    .pha-capture-strip article span {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    .pha-capture-strip article strong {
      font-size: 15px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .pha-section {
      border: 1px solid #283746;
      border-radius: 10px;
      background: #131b24;
      overflow: hidden;
    }

    .pha-section-head {
      min-height: 34px;
      padding: 7px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid #253340;
      background: #161f29;
    }

    .pha-section-head h3 {
      margin: 0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .05em;
    }

    .pha-section-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #8f9cab;
      font-size: 9px;
      white-space: nowrap;
    }

    .pha-section-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 18px;
      padding: 0 6px;
      border-radius: 999px;
      background: #24313d;
      color: #d8e0e9;
      font-weight: 700;
      font-size: 9px;
    }

    .pha-section .table {
      margin: 0;
      border: 0;
      border-radius: 0;
    }

    .pha-rarity-section .table {
      max-height: 225px;
    }

    .pha-rarity-section th,
    .pha-rarity-section td {
      padding: 5px 9px;
    }

    .pha-rarity-section tbody tr:last-child td,
    .pha-captured-section tbody tr:last-child td {
      border-bottom: 0;
    }

    .pha-captured-section .filters {
      padding: 8px 10px;
      background: #111922;
      border-bottom: 1px solid #253340;
    }

    .pha-captured-section .filters label {
      min-width: 110px;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .03em;
    }

    .pha-captured-section .filters select,
    .pha-captured-section .filters input {
      height: 27px;
      box-sizing: border-box;
      font-size: 10px;
    }

    .pha-captured-section .table {
      max-height: 245px;
      overflow: auto;
    }

    .pha-captured-section thead th {
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .pha-captured-section th,
    .pha-captured-section td {
      padding: 5px 8px;
      font-size: 10px;
    }

    .pha-captured-section tbody tr:hover td {
      background: #17222d;
    }

    .launcher.pha-hud.pha-hud-v13 {
      width: 190px;
      height: 54px;
      grid-template-columns: auto 1fr;
      grid-template-rows: auto auto;
      padding: 6px 9px;
    }

    .pha-hud-v13 .pha-hud-mark {
      width: 32px;
      height: 32px;
    }

    .pha-hud-v13 .pha-hud-main {
      justify-content: space-between;
    }

    .pha-hud-v13 .pha-hud-main strong {
      font-size: 13px;
    }

    .pha-hud-v13 .pha-hud-sub {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      overflow: hidden;
    }

    .pha-hud-v13 .pha-hud-sub span {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      min-width: 0;
      white-space: nowrap;
    }

    .pha-hud-v13 .pha-hud-sub b {
      color: #dce4ed;
      font-variant-numeric: tabular-nums;
    }

    @media (max-width: 700px) {
      .panel.pha-qol-panel {
        min-width: 360px;
      }

      .pha-live-card {
        grid-template-columns: 1fr;
        grid-template-areas:
          "status"
          "actions"
          "metrics";
      }

      .pha-live-card .actions {
        justify-content: flex-start;
      }

      .pha-live-card .cards,
      .pha-capture-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  shadow.appendChild(style);
}

function createSection(title, className) {
  const section = document.createElement("section");
  section.className = `pha-section ${className}`;

  const head = document.createElement("div");
  head.className = "pha-section-head";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const meta = document.createElement("div");
  meta.className = "pha-section-meta";

  head.append(heading, meta);
  section.appendChild(head);
  return { section, head, meta };
}

function reorganizeCurrent(shadow) {
  const current = shadow.getElementById("view-current");
  if (!current || current.classList.contains("pha-current-v13")) return;

  const actions = current.querySelector(".actions");
  const status = current.querySelector(".statusrow");
  const cards = current.querySelector(".cards");
  const summary = current.querySelector(".summary");
  const rarityHeading = [...current.querySelectorAll("h3")].find((el) => el.textContent.trim() === "By Rarity");
  const tables = current.querySelectorAll(":scope > .table");
  const rarityTable = tables[0];
  const capturedTable = tables[1];
  const oldCapturedHead = current.querySelector(".section-head");
  const filters = current.querySelector(":scope > .filters");

  if (!actions || !status || !cards || !summary || !rarityTable || !capturedTable || !filters) return;

  current.classList.add("pha-current-v13");

  const live = document.createElement("section");
  live.className = "pha-live-card";
  live.append(status, actions, cards);

  summary.classList.add("pha-capture-strip");

  const rarity = createSection("By Rarity", "pha-rarity-section");
  const rareBadge = document.createElement("span");
  rareBadge.className = "pha-section-badge";
  rareBadge.id = "pha-current-rare-failed";
  rareBadge.textContent = "R+ fail 0";
  rarity.meta.appendChild(rareBadge);
  rarity.section.appendChild(rarityTable);

  const captured = createSection("Captured", "pha-captured-section");
  const capturedBadge = document.createElement("span");
  capturedBadge.className = "pha-section-badge";
  capturedBadge.id = "pha-current-captured-count";
  capturedBadge.textContent = "0 rows";
  captured.meta.appendChild(capturedBadge);
  captured.section.append(filters, capturedTable);

  if (rarityHeading) rarityHeading.remove();
  if (oldCapturedHead) oldCapturedHead.remove();

  current.replaceChildren(live, summary, rarity.section, captured.section);
}

function parseCount(text) {
  const raw = String(text || "").trim();
  const match = raw.match(/^([\d.,]+)/);
  if (!match) return 0;
  const normalized = match[1].replace(/\./g, "").replace(/,/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function enhanceCurrentMeta(shadow) {
  const rarityBody = shadow.getElementById("rarity-body");
  const capturedBody = shadow.getElementById("captured-body");
  const rareBadge = shadow.getElementById("pha-current-rare-failed");
  const capturedBadge = shadow.getElementById("pha-current-captured-count");

  const update = () => {
    if (rareBadge && rarityBody) {
      let failed = 0;
      for (const rarity of ["rare", "epic", "legendary", "mythical"]) {
        const row = rarityBody.querySelector(`[data-rarity="${rarity}"]`);
        failed += parseCount(row?.querySelector('[data-f="failed"]')?.textContent);
      }
      rareBadge.textContent = `R+ fail ${failed}`;
    }

    if (capturedBadge && capturedBody) {
      const rows = capturedBody.querySelectorAll("tr").length;
      capturedBadge.textContent = `${rows} ${rows === 1 ? "row" : "rows"}`;
    }
  };

  const observer = new MutationObserver(update);
  if (rarityBody) observer.observe(rarityBody, { subtree: true, childList: true, characterData: true });
  if (capturedBody) observer.observe(capturedBody, { subtree: true, childList: true, characterData: true });
  update();
}

function enhanceHud(shadow) {
  const launcher = shadow.getElementById("pha-toggle");
  if (!launcher || launcher.classList.contains("pha-hud-v13")) return;

  launcher.classList.add("pha-hud-v13");

  const sub = launcher.querySelector(".pha-hud-sub");
  if (!sub) return;

  sub.innerHTML = `
    <span>XP/h <b id="pha-hud-xp">—</b></span>
    <span>Profit <b id="pha-hud-profit">0</b></span>
    <span>R+ <b id="pha-hud-rare-failed">0</b></span>
  `;

  const xpSource = shadow.getElementById("trainer-exp-hour");
  const profitSource = shadow.getElementById("profit-total");
  const rareSource = shadow.getElementById("pha-current-rare-failed");

  const update = () => {
    const xp = shadow.getElementById("pha-hud-xp");
    const profit = shadow.getElementById("pha-hud-profit");
    const rare = shadow.getElementById("pha-hud-rare-failed");

    if (xp) xp.textContent = xpSource?.textContent || "—";
    if (profit) profit.textContent = profitSource?.textContent || "0";
    if (rare) rare.textContent = String(parseCount(rareSource?.textContent));
  };

  const observer = new MutationObserver(update);
  for (const node of [xpSource, profitSource, rareSource]) {
    if (node) observer.observe(node, { subtree: true, childList: true, characterData: true });
  }
  update();
}

function updateVersionLabel(shadow) {
  const version = shadow.querySelector(".topbar small");
  if (version) version.textContent = `Userscript ${UI_VERSION}`;
}

async function init() {
  const shadow = await waitForShadow();
  addStyles(shadow);
  reorganizeCurrent(shadow);
  enhanceCurrentMeta(shadow);
  enhanceHud(shadow);
  updateVersionLabel(shadow);
}

init().catch((error) => console.error("PokePixel Hunt Analyzer (Current UI):", error));
