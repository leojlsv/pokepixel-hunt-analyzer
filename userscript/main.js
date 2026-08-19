import { openDatabase } from "../data/db.js";
import { createSessionsRepository } from "../data/sessionsRepository.js";
import { createEncountersRepository } from "../data/encountersRepository.js";
import { createEventPipeline } from "../services/eventPipeline.js";
import { computeSessionMetrics } from "../domain/sessionMetrics.js";
import { computeGroupMetrics } from "../domain/groupMetrics.js";
import { computeRarityBreakdown } from "../domain/rarityBreakdown.js";

const APP_VERSION = "1.4.3";
const ROOT_ID = "pokepixel-hunt-analyzer-root";
const TAB_LOCK_KEY = "pokepixel_hunt_analyzer_active_tab";
const TAB_LOCK_TTL_MS = 6000;
const TAB_LOCK_REFRESH_MS = 2000;
const CLOCK_REFRESH_MS = 1000;
const tabId = crypto.randomUUID();

const RARITIES = [
  ["weak", "Weak"], ["common", "Common"], ["uncommon", "Uncommon"],
  ["rare", "Rare"], ["epic", "Epic"], ["legendary", "Legendary"],
  ["mythical", "Mythical"]
];

let db;
let pipeline;
let root;
let shadow;
let updateQueue = Promise.resolve();
let activeView = "current";
let active = false;
let compareEncounters = [];
let lastCurrentEncounters = [];

const compareFilters = { species: "*", capsule: "*", element: "*", theme: "cycle" };
const currentFilters = { rarity: "*", qualityMin: null, ivMin: null };

const numberFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function n(value) { return numberFmt.format(Number(value) || 0); }
function compact(value) {
  const num = Number(value) || 0;
  if (Math.abs(num) >= 100000) return `${n(Math.round(num / 1000))}K`;
  return n(num);
}
function rate(value) { return value == null ? "—" : `${(value * 100).toFixed(2)}%`; }
function duration(ms) {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return (h > 0 ? [h, m, s] : [m, s]).map(v => String(v).padStart(2, "0")).join(":");
}
function speciesLabel(row) {
  const raw = row.speciesName || row.speciesId || "—";
  return String(raw).split(/[\s_-]+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : "").join(" ");
}
function rarityKey(value) { return RARITIES.some(([k]) => k === value) ? value : "unknown"; }
function ivBreakdown(ivs = {}) {
  return [ivs.hp, ivs.atk, ivs.def, ivs.spa, ivs.spd, ivs.spe]
    .map(v => Number.isFinite(v) ? v : "—").join("-");
}

function readLock() {
  try { return JSON.parse(localStorage.getItem(TAB_LOCK_KEY) || "null"); }
  catch { return null; }
}
function writeLock() {
  localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ tabId, expiresAt: Date.now() + TAB_LOCK_TTL_MS }));
}
function refreshLeadership() {
  const lock = readLock();
  if (!lock || lock.tabId === tabId || lock.expiresAt <= Date.now()) {
    writeLock();
    setActive(true);
  } else {
    setActive(false);
  }
}
function setActive(next) {
  if (active === next) return;
  active = next;
  if (shadow) {
    const badge = shadow.getElementById("pha-tab-state");
    if (badge) {
      badge.textContent = active ? "ACTIVE" : "STANDBY";
      badge.className = active ? "state active" : "state standby";
    }
  }
}
window.addEventListener("beforeunload", () => {
  const lock = readLock();
  if (lock?.tabId === tabId) localStorage.removeItem(TAB_LOCK_KEY);
});

function uiHtml() {
  return `
    <button id="pha-toggle" class="launcher" type="button" aria-label="PokePixel Hunt Analyzer">PX</button>
    <aside id="pha-panel" class="panel" hidden>
      <header class="topbar">
        <div><strong>PokePixel Hunt Analyzer</strong><small>Userscript ${APP_VERSION}</small></div>
        <span id="pha-tab-state" class="state standby">STANDBY</span>
        <button id="pha-close" class="icon" type="button">×</button>
      </header>
      <nav class="tabs">
        <button data-view="current" class="tab active" type="button">Current</button>
        <button data-view="compare" class="tab" type="button">Compare</button>
      </nav>
      <section id="view-current">
        <div class="actions">
          <button id="new-hunt">New Hunt</button><button id="pause-resume">Pause</button><button id="end-hunt">End Hunt</button>
        </div>
        <div class="statusrow"><span>Hunt</span><b id="hunt-status">Waiting</b><strong id="hunt-time">00:00</strong></div>
        <div class="cards">
          <article><span>XP/h You</span><strong id="trainer-exp-hour">—</strong><small>Total <b id="trainer-exp-total">0</b></small></article>
          <article><span>XP/h Poké</span><strong id="pokemon-exp-hour">—</strong><small>Total <b id="pokemon-exp-total">0</b></small></article>
          <article><span>Dollar</span><strong id="dollars-total">0</strong><small>$/h <b id="dollars-hour">—</b></small></article>
          <article><span>Profit</span><strong id="profit-total">0</strong><small>Expenses <b id="expenses-total">0</b></small></article>
        </div>
        <div class="summary">
          <article><span>Seen</span><strong id="seen">0</strong></article><article><span>Captured</span><strong id="captured">0</strong></article>
          <article><span>Failed</span><strong id="failed">0</strong></article><article><span>Capture</span><strong id="capture-rate">—</strong></article>
        </div>
        <h3>By Rarity</h3>
        <div class="table"><table><thead><tr><th>Rarity</th><th>Seen</th><th>Cap.</th><th>Fail</th><th>Rate</th></tr></thead><tbody id="rarity-body"></tbody></table></div>
        <div class="section-head"><h3>Captured</h3></div>
        <div class="filters">
          <label>Rarity<select id="captured-rarity"></select></label>
          <label>Quality &gt;<input id="captured-quality" type="number" step="0.01"></label>
          <label>IV &gt;<input id="captured-iv" type="number" step="1"></label>
        </div>
        <div class="table"><table><thead><tr><th>Pokémon</th><th>Nat</th><th>Qlt</th><th>HP-ATK-DEF-SATK-SDEF-SPE</th></tr></thead><tbody id="captured-body"></tbody></table></div>
      </section>
      <section id="view-compare" hidden>
        <div class="filters compare-filters">
          <label>Theme<select id="compare-theme"><option value="cycle">By Cycle</option><option value="rarity">By Rarity</option></select></label>
          <label>Pokémon<select id="compare-species"></select></label>
          <label>Capsule<select id="compare-capsule"></select></label>
          <label>Element<select id="compare-element"></select></label>
        </div>
        <div class="table"><table><thead><tr id="compare-head"></tr></thead><tbody id="compare-body"></tbody></table></div>
      </section>
    </aside>`;
}

const CSS = `
:host{all:initial;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e8edf3;font-size:12px}.launcher{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:46px;height:46px;border-radius:13px;border:1px solid #566273;background:#1b222c;color:#fff;font-weight:800;cursor:pointer;box-shadow:0 8px 24px #0008}.panel{position:fixed;z-index:2147483646;right:16px;bottom:72px;width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 96px);overflow:auto;background:#111820;border:1px solid #374452;border-radius:12px;box-shadow:0 14px 40px #000b}.topbar{position:sticky;top:0;z-index:2;display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:11px 12px;background:#171f29;border-bottom:1px solid #303b47}.topbar div{display:flex;flex-direction:column}.topbar small{color:#8d99a8}.icon{background:transparent;border:0;color:#cfd7e3;font-size:20px;cursor:pointer}.state{font-size:9px;font-weight:800;padding:3px 6px;border-radius:8px}.state.active{background:#173b2c;color:#70dfaa}.state.standby{background:#4b3520;color:#ffc477}.tabs,.actions{display:flex;gap:6px;padding:9px 10px}.tab,.actions button{border:1px solid #344250;background:#1b2530;color:#dbe3ec;padding:6px 10px;border-radius:7px;cursor:pointer}.tab.active{background:#2d4054}.statusrow{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;margin:0 10px 8px;padding:9px 10px;background:#17202a;border-radius:8px}.cards,.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:0 10px 9px}.cards article,.summary article{background:#17202a;border:1px solid #263341;border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:3px;min-width:0}.cards span,.summary span,label{color:#94a2b2}.cards strong,.summary strong{font-size:16px}.cards small{color:#8391a0}h3{font-size:12px;margin:10px}.table{overflow:auto;margin:0 10px 10px;border:1px solid #273443;border-radius:8px}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #24313d}th{color:#8998a8;font-size:10px;background:#151e27}.filters{display:flex;gap:7px;flex-wrap:wrap;padding:0 10px 9px}.filters label{display:flex;flex-direction:column;gap:3px;min-width:90px;flex:1}.filters select,.filters input{min-width:0;background:#111820;border:1px solid #344250;border-radius:6px;color:#e8edf3;padding:5px}.rarity-weak{color:#87909a}.rarity-common{color:#d5d9de}.rarity-uncommon{color:#66d58b}.rarity-rare{color:#61a7ff}.rarity-epic{color:#bf80ff}.rarity-legendary{color:#ffb24a}.rarity-mythical{color:#ff6a8a}@media(max-width:700px){.cards,.summary{grid-template-columns:repeat(2,1fr)}}`;

function mountUi() {
  if (document.getElementById(ROOT_ID)) return;
  root = document.createElement("div"); root.id = ROOT_ID;
  shadow = root.attachShadow({ mode: "open" });
  const style = document.createElement("style"); style.textContent = CSS;
  const wrapper = document.createElement("div"); wrapper.innerHTML = uiHtml();
  shadow.append(style, wrapper);
  document.documentElement.appendChild(root);

  shadow.getElementById("pha-toggle").onclick = () => { shadow.getElementById("pha-panel").hidden = false; };
  shadow.getElementById("pha-close").onclick = () => { shadow.getElementById("pha-panel").hidden = true; };
  shadow.querySelectorAll("[data-view]").forEach(button => button.onclick = () => switchView(button.dataset.view));
  shadow.getElementById("new-hunt").onclick = () => sessionAction("new");
  shadow.getElementById("end-hunt").onclick = () => sessionAction("end");
  shadow.getElementById("pause-resume").onclick = e => sessionAction(e.currentTarget.dataset.action || "pause");

  shadow.getElementById("captured-rarity").onchange = e => { currentFilters.rarity = e.target.value; renderCaptured(lastCurrentEncounters); };
  shadow.getElementById("captured-quality").oninput = e => { const v = Number(e.target.value); currentFilters.qualityMin = e.target.value && Number.isFinite(v) ? v : null; renderCaptured(lastCurrentEncounters); };
  shadow.getElementById("captured-iv").oninput = e => { const v = Number(e.target.value); currentFilters.ivMin = e.target.value && Number.isFinite(v) ? v : null; renderCaptured(lastCurrentEncounters); };

  [["compare-theme","theme"],["compare-species","species"],["compare-capsule","capsule"],["compare-element","element"]].forEach(([id,key]) => {
    shadow.getElementById(id).onchange = e => { compareFilters[key] = e.target.value; renderCompare(); };
  });
  createRarityRows();
  refreshLeadership();
}

function switchView(view) {
  activeView = view;
  shadow.getElementById("view-current").hidden = view !== "current";
  shadow.getElementById("view-compare").hidden = view !== "compare";
  shadow.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "compare") loadCompare().catch(console.error);
}

function createRarityRows() {
  const body = shadow.getElementById("rarity-body");
  body.replaceChildren();
  for (const [key,label] of RARITIES) {
    const tr = document.createElement("tr"); tr.dataset.rarity = key;
    tr.innerHTML = `<td class="rarity-${key}">${label}</td><td data-f="seen">0</td><td data-f="captured">0</td><td data-f="failed">0</td><td data-f="rate">—</td>`;
    body.appendChild(tr);
  }
}

function renderMetrics(metrics) {
  shadow.getElementById("hunt-time").textContent = duration(metrics.activeMs);
  shadow.getElementById("trainer-exp-hour").textContent = metrics.trainerExpPerHour == null ? "—" : compact(metrics.trainerExpPerHour);
  shadow.getElementById("trainer-exp-total").textContent = compact(metrics.trainerExp);
  shadow.getElementById("pokemon-exp-hour").textContent = metrics.pokemonExpPerHour == null ? "—" : compact(metrics.pokemonExpPerHour);
  shadow.getElementById("pokemon-exp-total").textContent = compact(metrics.pokemonExp);
  shadow.getElementById("dollars-total").textContent = compact(metrics.gold);
  shadow.getElementById("dollars-hour").textContent = metrics.goldPerHour == null ? "—" : compact(metrics.goldPerHour);
  shadow.getElementById("expenses-total").textContent = compact(metrics.expenses);
  shadow.getElementById("profit-total").textContent = compact(metrics.gold - metrics.expenses);
  shadow.getElementById("seen").textContent = n(metrics.seen);
  shadow.getElementById("captured").textContent = n(metrics.captured);
  shadow.getElementById("failed").textContent = n(metrics.failed);
  shadow.getElementById("capture-rate").textContent = rate(metrics.seenToCaptureRate);
  shadow.getElementById("hunt-status").textContent = metrics.status === "running" ? "Running" : metrics.status === "paused" ? "Paused" : "Waiting";

  const pause = shadow.getElementById("pause-resume");
  pause.disabled = !["running","paused"].includes(metrics.status);
  pause.dataset.action = metrics.status === "running" ? "pause" : "resume";
  pause.textContent = metrics.status === "running" ? "Pause" : "Resume";
  shadow.getElementById("end-hunt").disabled = metrics.status === "waiting";

  for (const [key] of RARITIES) {
    const row = shadow.querySelector(`[data-rarity="${key}"]`); const b = metrics.rarities[key];
    row.querySelector('[data-f="seen"]').textContent = b.shinySeen ? `${n(b.seen)} (${n(b.shinySeen)})` : n(b.seen);
    row.querySelector('[data-f="captured"]').textContent = b.shinyCaptured ? `${n(b.captured)} (${n(b.shinyCaptured)})` : n(b.captured);
    row.querySelector('[data-f="failed"]').textContent = b.shinyFailed ? `${n(b.failed)} (${n(b.shinyFailed)})` : n(b.failed);
    row.querySelector('[data-f="rate"]').textContent = rate(b.seen ? b.captured / b.seen : null);
  }
}

function populate(select, values, mapper = v => [v,v]) {
  const previous = select.value || "*"; select.replaceChildren();
  const all = document.createElement("option"); all.value = "*"; all.textContent = "All (*)"; select.appendChild(all);
  for (const value of values) { const [v,l] = mapper(value); const o = document.createElement("option"); o.value = v; o.textContent = l; select.appendChild(o); }
  select.value = [...select.options].some(o => o.value === previous) ? previous : "*";
}

function renderCaptured(encounters) {
  const captured = encounters.filter(e => e.captureResult === "success");
  populate(shadow.getElementById("captured-rarity"), [...new Set(captured.map(e => e.quality).filter(Boolean))].sort());
  const body = shadow.getElementById("captured-body"); body.replaceChildren();
  for (const e of captured) {
    if (currentFilters.rarity !== "*" && e.quality !== currentFilters.rarity) continue;
    if (currentFilters.qualityMin != null && !(Number.isFinite(e.qualityMultiplier) && e.qualityMultiplier > currentFilters.qualityMin)) continue;
    if (currentFilters.ivMin != null && !(Number.isFinite(e.ivTotal) && e.ivTotal > currentFilters.ivMin)) continue;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="rarity-${rarityKey(e.quality)}"></td><td></td><td></td><td></td>`;
    tr.children[0].textContent = speciesLabel(e) + (e.isShiny ? " *" : "");
    tr.children[1].textContent = e.nature || "—";
    tr.children[2].textContent = Number.isFinite(e.qualityMultiplier) ? e.qualityMultiplier.toFixed(2) : "—";
    tr.children[3].textContent = ivBreakdown(e.ivs);
    body.appendChild(tr);
  }
}

async function loadCurrent() {
  if (!db || !shadow) return;
  const sessions = createSessionsRepository(db); const encountersRepo = createEncountersRepository(db);
  const session = await sessions.getCurrentReadOnly();
  const encounters = session ? await encountersRepo.getBySessionId(session.sessionId) : [];
  lastCurrentEncounters = encounters;
  renderMetrics(computeSessionMetrics({ session, encounters, now: Date.now() }));
  renderCaptured(encounters);
}

async function sessionAction(action) {
  if (!active) return;
  updateQueue = updateQueue.then(async () => {
    const repo = createSessionsRepository(db);
    if (action === "new") await repo.forceNewSession();
    else if (action === "pause") await repo.pauseManual();
    else if (action === "resume") await repo.resumeManual();
    else if (action === "end") await repo.endManual();
  }).then(loadCurrent).catch(console.error);
  await updateQueue;
}

function distinct(encounters, key) { return [...new Set(encounters.map(e => e[key]).filter(Boolean))].sort(); }
function distinctElements(encounters) { return [...new Set(encounters.flatMap(e => Array.isArray(e.elements) ? e.elements : []))].sort(); }
function filteredCompare() {
  return compareEncounters.filter(e =>
    (compareFilters.species === "*" || e.speciesId === compareFilters.species) &&
    (compareFilters.capsule === "*" || e.capsuleName === compareFilters.capsule) &&
    (compareFilters.element === "*" || (Array.isArray(e.elements) && e.elements.includes(compareFilters.element)))
  );
}

async function loadCompare() {
  compareEncounters = await createEncountersRepository(db).getAll();
  const species = new Map(); for (const e of compareEncounters) if (e.speciesId && !species.has(e.speciesId)) species.set(e.speciesId, speciesLabel(e));
  populate(shadow.getElementById("compare-species"), [...species.entries()].sort((a,b) => a[1].localeCompare(b[1])), ([id,label]) => [id,label]);
  populate(shadow.getElementById("compare-capsule"), distinct(compareEncounters,"capsuleName"));
  populate(shadow.getElementById("compare-element"), distinctElements(compareEncounters));
  renderCompare();
}

function renderCompare() {
  const rows = filteredCompare(); const head = shadow.getElementById("compare-head"); const body = shadow.getElementById("compare-body");
  head.replaceChildren(); body.replaceChildren();
  const headers = compareFilters.theme === "rarity" ? ["Rarity","Seen","Cap.","Fail","Rate"] : ["Pokémon","Lvl","Seen","Cap.","Fail","EXP/Cycle h","$/Cycle h"];
  for (const h of headers) { const th = document.createElement("th"); th.textContent = h; head.appendChild(th); }
  if (compareFilters.theme === "rarity") {
    const breakdown = computeRarityBreakdown(rows);
    for (const [key,label] of RARITIES) { const b = breakdown.rarities[key]; const tr = document.createElement("tr"); [label,n(b.seen),n(b.captured),n(b.failed),rate(b.seen ? b.captured/b.seen : null)].forEach((v,i) => { const td=document.createElement("td"); td.textContent=v; if(i===0) td.className=`rarity-${key}`; tr.appendChild(td); }); body.appendChild(tr); }
    return;
  }
  const groups = new Map();
  for (const e of rows) { if (!e.groupKey) continue; if (!groups.has(e.groupKey)) groups.set(e.groupKey,{ sample:e, encounters:[] }); groups.get(e.groupKey).encounters.push(e); }
  for (const {sample, encounters} of groups.values()) { const m = computeGroupMetrics(encounters); const values=[speciesLabel(sample),sample.level??"—",n(m.seen),n(m.captured),n(m.failed),m.trainerExpPerCycleHour==null?"—":n(m.trainerExpPerCycleHour),m.dollarPerCycleHour==null?"—":n(m.dollarPerCycleHour)]; const tr=document.createElement("tr"); for(const v of values){const td=document.createElement("td");td.textContent=v;tr.appendChild(td);} body.appendChild(tr); }
}

const EVENT_TYPES = new Set(["combat.started","loot.received","capture.failed","capture.success","hunt.stopped","hunt.analyzer_reset"]);
let nextSocketId = 1;
function finiteOrNull(value) { const x = Number(value); return Number.isFinite(x) ? x : null; }
function extract(type, data) {
  if (!data || typeof data !== "object") return null;
  if (type === "combat.started") {
    const e=data.enemy; if(!e || typeof e!=="object") return null; const s=data.session;
    return { enemy:{ id:e.id,species_id:e.species_id,level:e.level,quality:e.quality,is_shiny:e.is_shiny,ivs:e.ivs,map_id:e.map_id,zone_id:e.zone_id,elements:e.elements,gender:e.gender,nature:e.nature,quality_multiplier:e.quality_multiplier }, session:s&&typeof s==="object"?{id:s.id,auto_capture:s.auto_capture}:undefined };
  }
  if (type === "loot.received") return { wild_monster_id:data.wild_monster_id,species_id:data.species_id,exp:data.exp,trainer_exp:data.trainer_exp,pokemon_exp:data.pokemon_exp,gold:data.gold,loot_sell_value:data.loot_sell_value,auto_potion_used:data.auto_potion_used,supply_cost:data.supply_cost };
  if (type === "capture.failed") return { wild_monster_id:data.wild_monster_id,species_id:data.species_id,species_name:data.species_name,level:data.level,quality:data.quality,iv_total:data.iv_total,is_shiny:data.is_shiny,capsule_item_id:data.capsule_item_id,capsule_name:data.capsule_name,chance:data.chance,supply_cost:data.supply_cost };
  if (type === "capture.success") { const c=data.creature; return { wild_monster_id:data.wild_monster_id,species_id:data.species_id,species_name:data.species_name,capsule_item_id:data.capsule_item_id,capsule_name:data.capsule_name,chance:data.chance,supply_cost:data.supply_cost,auto_sold:data.auto_sold,auto_sell_value:data.auto_sell_value,creature:c&&typeof c==="object"?{quality:c.quality,is_shiny:c.is_shiny,ivs:c.ivs}:undefined }; }
  if (type === "hunt.stopped" || type === "hunt.analyzer_reset") return {};
  return null;
}
function processPayload(payload,socketId) {
  if (!active || !payload || typeof payload!=="object" || !EVENT_TYPES.has(payload.type)) return;
  const data=extract(payload.type,payload.data); if(data===null) return;
  updateQueue = updateQueue.then(() => pipeline.handle({ type:payload.type,seq:finiteOrNull(payload.seq),ts:finiteOrNull(payload.ts),socketId,data })).then(() => activeView === "current" ? loadCurrent() : undefined).catch(error => console.error("PokePixel Hunt Analyzer:",error));
}
function processMessage(data,socketId) {
  const parse = text => { try { processPayload(JSON.parse(text),socketId); } catch {} };
  if (typeof data === "string") return parse(data);
  if (data instanceof Blob) return data.text().then(parse).catch(()=>{});
  if (data instanceof ArrayBuffer) return parse(new TextDecoder().decode(data));
  if (ArrayBuffer.isView(data)) return parse(new TextDecoder().decode(new Uint8Array(data.buffer,data.byteOffset,data.byteLength)));
}
function installWebSocketHook() {
  if (window.__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__) return;
  Object.defineProperty(window,"__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__",{value:true});
  const Native=window.WebSocket; if(typeof Native!=="function") return;
  window.WebSocket=new Proxy(Native,{ construct(target,args){ const socket=Reflect.construct(target,args,target); const socketId=nextSocketId++; socket.addEventListener("message",event=>processMessage(event.data,socketId)); return socket; }});
}

async function init() {
  installWebSocketHook();
  const mount = () => { if (!shadow) mountUi(); };
  if (document.documentElement) mount(); else new MutationObserver((_,obs)=>{if(document.documentElement){obs.disconnect();mount();}}).observe(document,{childList:true,subtree:true});
  db = await openDatabase();
  pipeline = createEventPipeline(db,{appVersion:APP_VERSION});
  await pipeline.recoverOnStartup();
  await loadCurrent();
  setInterval(refreshLeadership,TAB_LOCK_REFRESH_MS);
  setInterval(() => { if(activeView==="current") loadCurrent().catch(console.error); },CLOCK_REFRESH_MS);
}

init().catch(error => console.error("PokePixel Hunt Analyzer userscript:",error));