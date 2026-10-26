import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { computeSessionMetrics } from "../../domain/sessionMetrics.js";
import { createCurrentView } from "../../userscript/current-view.js";
import { createHistoryView } from "../../userscript/history-view.js";
import { createUiMarkup } from "../../userscript/ui-markup.js";

const until = async check => {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > 6000) throw new Error("Bounded precision fixture did not settle");
    await new Promise(resolve => setTimeout(resolve, 15));
  }
};

test("v1.15.8 Catch Chance precision survives v1.15.9 deep paging, focus, expansion, and History re-render", async t => {
  const browser = new Window({url:"https://precision-bounded.invalid/"});
  const globals = ["document", "localStorage", "HTMLInputElement", "requestAnimationFrame"];
  const originals = new Map();
  for (const key of globals) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true, writable: true,
      value: key === "requestAnimationFrame"
        ? browser.requestAnimationFrame.bind(browser) : browser[key]
    });
  }
  t.after(() => {
    browser.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  const host = browser.document.createElement("div");
  const shadow = host.attachShadow({mode:"open"});
  shadow.innerHTML = createUiMarkup();
  browser.document.documentElement.appendChild(host);

  let decimals = 3;
  const getter = () => decimals;
  const current = createCurrentView(shadow, {getCatchChanceDecimals:getter});
  const now = Date.now();
  const session = {sessionId:"precision-hunt",status:"running",activityKind:"hunt",
    startedAtMs:now-100000, activeStartedAtMs:now-100000,
    accumulatedActiveMs:0,potionsUsed:0,potionsCost:0};
  const rows = Array.from({length:560},(_,index)=>({
    sessionId:session.sessionId, encounterId:`compat-${String(index).padStart(4,"0")}`,
    speciesId:"pidgey",speciesName:"Pidgey", quality:index%5===0?"epic":"common",
    captureResult:index%2===0?"success":"failed",isShiny:false,
    captureAtMs:now-100000+index,updatedAtMs:now-100000+index,
    captureChance:0.00004,capsuleName:"Great Ball",qualityMultiplier:1.1,
    ivTotal:60,ivs:{hp:10,atk:10,spa:10,def:10,spd:10,spe:10},
    gender:"male",nature:"brave",trainerExp:1,pokemonExp:2,gold:1,lootItems:[]
  }));
  const metrics = computeSessionMetrics({session,encounters:rows,now});
  current.render({sessionId:session.sessionId,encounters:rows,metrics,
    encounterSnapshotVersion:1,lootDataRevision:1});
  const mainRows = id => [...shadow.getElementById(`${id}-body`)
    .querySelectorAll("tr[data-encounter-id]")];
  await until(()=>mainRows("captured").length===100 && mainRows("failed").length===100);

  const jump=(prefix,rank)=>{
    shadow.getElementById(`${prefix}-page-jump`).value=String(rank);
    shadow.getElementById(`${prefix}-page-go`).click();
  };
  jump("captured",201);
  jump("failed",201);
  await until(()=>mainRows("captured").length===80 && mainRows("failed").length===80);
  const captured = mainRows("captured")[0];
  const capturedId=captured.dataset.encounterId;
  captured.focus();
  captured.click();
  const detail=()=>shadow.querySelector(`[data-detail-for="${capturedId}"] [data-catch-chance-detail]`);
  assert.match(detail()?.textContent || "", /Chance: 0\.004%/);
  const failed=mainRows("failed")[0];
  const pageBefore=shadow.getElementById("failed-page-status").textContent;

  decimals=6;
  current.refreshCatchChance();
  assert.equal(mainRows("captured")[0],captured,"precision changes must not replace a focused encounter node");
  assert.equal(mainRows("failed")[0],failed,"precision changes must not rebuild the failed viewport");
  assert.equal(shadow.activeElement,captured);
  assert.equal(captured.getAttribute("aria-expanded"),"true");
  assert.equal(detail()?.textContent,"Chance: 0.004000%");
  assert.equal(failed.querySelector(".chance-cell").textContent,"0.004000%");
  assert.equal(shadow.getElementById("failed-page-status").textContent,pageBefore);
  assert.equal(metrics.seen,560);
  assert.equal(mainRows("captured").length,80);
  assert.equal(mainRows("failed").length,80);

  const ended={...session,status:"ended",endedAtMs:now};
  const history=createHistoryView(shadow,{
    loadSessions:async()=>[ended],
    loadSessionEncounters:async()=>rows,
    getCatchChanceDecimals:getter,
    now:()=>now
  });
  await history.refresh();
  history.setActiveSubview("attempts");
  jump("history-attempts",501);
  assert.equal(shadow.getElementById("history-attempts-page-status").textContent,
    "501–560 de 560");
  let attempts=[...shadow.querySelectorAll("#history-attempts-body .history-attempt-row")];
  assert.equal(attempts.length,60);
  assert.equal(attempts[0].cells[4].textContent,"0.004000%");
  attempts[0].click();
  assert.match(shadow.querySelector("#history-attempts-body .history-detail-row")
    .textContent,/Chance: 0\.004000%/);

  decimals=0;
  current.refreshCatchChance();
  history.refreshCatchChance();
  attempts=[...shadow.querySelectorAll("#history-attempts-body .history-attempt-row")];
  assert.equal(attempts.length,60);
  assert.equal(attempts[0].cells[4].textContent,"<1%");
  assert.match(shadow.querySelector("#history-attempts-body .history-detail-row")
    .textContent,/Chance: <1%/);
  assert.equal(detail()?.textContent,"Chance: <1%");
  assert.equal(failed.querySelector(".chance-cell").textContent,"<1%");
  assert.equal(shadow.getElementById("failed-count").textContent,"280 Pokémons");

  history.setActiveSubview("hunts");
  const huntRow=shadow.querySelector(".history-hunt-row");
  huntRow.click();
  const notable=shadow.querySelector(".history-notable-button:not(:disabled)");
  assert.ok(notable,"fixture includes Epic notables");
  notable.click();
  const notableChance=()=>shadow.querySelector(".history-notable-list tbody tr td:nth-child(5)")?.textContent;
  assert.equal(notableChance(),"<1%");
  decimals=6;
  history.refreshCatchChance();
  assert.equal(notableChance(),"0.004000%","expanded Hunt notable follows precision without new History load");
});
