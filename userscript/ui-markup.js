import { RARITIES } from "./ui-utils.js";

const APP_VERSION = __APP_VERSION__;
export const REF_CODE = "Q4BSZJD";

function createRarityRowsMarkup() {
  return RARITIES.map(([key, label]) => `
    <tr data-rarity="${key}">
      <td class="rarity-${key}">${label}</td>
      <td data-field="seen">0</td>
      <td data-field="captured">0</td>
      <td data-field="failed">0</td>
      <td data-field="rate">—</td>
    </tr>`).join("");
}

function createHudRarityMarkup() {
  return RARITIES.map(([key, label], index) => {
    const separator = index < RARITIES.length - 1
      ? '<span class="separator" aria-hidden="true">-</span>'
      : "";
    return `<span id="hud-${key}" class="rarity-${key}" title="${label} captured">0</span>${separator}`;
  }).join("");
}

function sortableHeader(prefix, key, label, title = "") {
  const titleAttribute = title ? ` title="${title}"` : "";
  return `<th data-encounter-sort="${prefix}" data-sort-key="${key}"${titleAttribute} style="cursor:pointer;user-select:none">${label} <span data-sort-indicator="${key}" aria-hidden="true"></span></th>`;
}

function createEncounterSectionMarkup(prefix, title) {
  const filterStyle = "min-width:0";
  return `
    <section id="${prefix}-section" class="section encounter-section">
      <div class="section-head">
        <h3>${title}</h3>
        <div class="section-meta">
          <span id="${prefix}-count" class="section-badge">0 Pokémons</span>
          <button class="collapse-button" data-collapse="${prefix}" type="button" title="Collapse">▾</button>
        </div>
      </div>
      <div class="filters" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:end">
        <label style="${filterStyle}">Rarity<select id="${prefix}-rarity"></select></label>
        <label style="${filterStyle}">Shiny<select id="${prefix}-shiny"><option value="*">All (*)</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        <label style="${filterStyle}">Quality &gt;<input id="${prefix}-quality" type="number" step="0.01"></label>
        <label style="${filterStyle}">IV &gt;<input id="${prefix}-iv" type="number" step="1"></label>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            ${sortableHeader(prefix, "capturedAt", "Pokémon", "Order by capture/fail timestamp")}
            <th title="Gender">G</th>
            <th>Nat</th>
            ${sortableHeader(prefix, "quality", "Qlt", "Order by Quality")}
            ${sortableHeader(prefix, "iv", "IV", "Order by IV Total")}
          </tr></thead>
          <tbody id="${prefix}-body"></tbody>
        </table>
      </div>
    </section>`;
}

export function createUiMarkup() {
  return `
    <button id="pha-toggle" class="launcher" type="button" aria-label="PokePixel Hunt Analyzer" style="min-width:220px;width:max-content;max-width:calc(100vw - 32px)">
      <span class="hud-mark">PX</span>
      <span class="hud-content" style="min-width:160px;width:max-content">
        <span class="hud-xp"><span>0</span><strong>(—/h)</strong></span>
        <span class="hud-rarities" aria-label="Captured by rarity" style="gap:4px;justify-content:flex-start">${createHudRarityMarkup()}</span>
      </span>
    </button>

    <aside id="pha-panel" class="panel" hidden>
      <header class="topbar">
        <div class="brand">
          <strong>PokePixel Hunt Analyzer</strong>
          <span class="brand-meta">
            <span>Userscript ${APP_VERSION}</span>
            <span>· by Rhyxus ·</span>
            <button id="pha-refcode" class="refcode" type="button" title="Copy ref code ${REF_CODE}">${REF_CODE}</button>
          </span>
        </div>
        <span id="pha-tab-state" class="state standby">STANDBY</span>
        <button id="pha-alpha" class="alpha-button" type="button">α 100%</button>
        <button id="pha-close" class="icon-button" type="button" title="Minimize to HUD">−</button>
      </header>

      <nav class="tabs">
        <button data-view="current" class="tab active" type="button">Current</button>
        <button data-view="compare" class="tab" type="button">Compare</button>
        <strong id="hunt-time" class="hunt-time">00:00</strong>
      </nav>

      <section id="view-current" class="view current-view">
        <section id="hunt-section" class="live-card">
          <div class="status-row">
            <span>Hunt</span>
            <b id="hunt-status" class="hunt-status">Waiting</b>
          </div>
          <div class="actions">
            <button id="new-hunt" type="button">New Hunt</button>
            <button id="pause-resume" type="button">Pause</button>
            <button id="end-hunt" type="button">End Hunt</button>
            <button class="collapse-button" data-collapse="hunt" type="button" title="Collapse">▾</button>
          </div>
          <div class="metric-cards">
            <article><span>XP/h You</span><strong id="trainer-exp-hour">—</strong><small>Total <b id="trainer-exp-total">0</b></small></article>
            <article><span>XP/h Poké</span><strong id="pokemon-exp-hour">—</strong><small>Total <b id="pokemon-exp-total">0</b></small></article>
            <article><span>Dollar</span><strong id="dollars-total">0</strong><small>$/h <b id="dollars-hour">—</b></small></article>
            <article><span>Profit</span><strong id="profit-total">0</strong><small>Expenses <b id="expenses-total">0</b></small></article>
          </div>
        </section>

        <div class="capture-strip">
          <article><span>Seen</span><strong id="seen">0</strong></article>
          <article><span>Captured</span><strong id="captured">0</strong></article>
          <article><span>Failed</span><strong id="failed">0</strong></article>
          <article><span>Capture</span><strong id="capture-rate">—</strong></article>
        </div>

        <section id="rarity-section" class="section rarity-section">
          <div class="section-head">
            <h3>By Rarity</h3>
            <div class="section-meta">
              <span id="rare-failed-count" class="section-badge">R+ fail 0</span>
              <button class="collapse-button" data-collapse="rarity" type="button" title="Collapse">▾</button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Rarity</th><th>Seen</th><th>Cap.</th><th>Fail</th><th>Rate</th></tr></thead>
              <tbody id="rarity-body">${createRarityRowsMarkup()}</tbody>
            </table>
          </div>
        </section>

        ${createEncounterSectionMarkup("captured", "Captured")}
        ${createEncounterSectionMarkup("failed", "Failed")}
      </section>

      <section id="view-compare" class="view compare-view" hidden>
        <div class="filters">
          <label>Theme<select id="compare-theme"><option value="cycle">By Cycle</option><option value="rarity">By Rarity</option></select></label>
          <label>Pokémon<select id="compare-species"></select></label>
          <label>Capsule<select id="compare-capsule"></select></label>
          <label>Element<select id="compare-element"></select></label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr id="compare-head"></tr></thead>
            <tbody id="compare-body"></tbody>
          </table>
        </div>
      </section>
    </aside>
  `;
}
