import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { createCurrentView, CURRENT_LIST_PAGE_SIZE } from
  "../../userscript/current-view.js";
import { createUiMarkup } from "../../userscript/ui-markup.js";
import { computeSessionMetrics } from "../../domain/sessionMetrics.js";

function makeRows(size, { type = "failed" } = {}) {
  return Array.from({length: size}, (_, index) => ({
    encounterId: "row-" + index.toString().padStart(6, "0"),
    sessionId: "long-hunt",
    captureResult: type === "captured" ? "success" : "failed",
    captureAtMs: 1_000_000 + index,
    updatedAtMs: 1_000_000 + index,
    quality: index % 5 === 0 ? "rare" : "common",
    speciesId: "pidgey", speciesName: "Pidgey",
    isShiny: false, capsuleName: "Poké Ball",
    captureChance: 0.35, ivTotal: 60 + index % 100,
    ivs: {hp: 10, atk: 10, def: 10, spa: 10, spd: 10, spe: 10},
    qualityMultiplier: 1, gender: "male", nature: "Modest",
    gold: 1, lootItems: []
  }));
}

function session() {
  return {sessionId:"long-hunt", status:"running", activityKind:"hunt",
    startedAtMs:0, activeStartedAtMs:0, accumulatedActiveMs:0,
    potionsUsed:0, potionsCost:0};
}
function state(rows, version, delta = null) {
  return {sessionId:"long-hunt", encounters:rows, encounterSnapshotVersion:version,
    lootDataRevision:version, encounterDelta:delta,
    metrics:computeSessionMetrics({session:session(), encounters:rows, now:2_000_000}),
    currentSessionSpecies:rows.at(-1) || null};
}

function fixture(t) {
  const browser = new Window({url:"https://bounded-current.invalid/"});
  const globals = ["document","localStorage","HTMLInputElement","requestAnimationFrame"];
  const old = new Map();
  for (const key of globals) {
    old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,
      value:key==="requestAnimationFrame"?browser.requestAnimationFrame.bind(browser):browser[key]});
  }
  t.after(() => {
    browser.close();
    for (const [key,descriptor] of old) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  });
  const host=browser.document.createElement("div");
  const shadow=host.attachShadow({mode:"open"});
  shadow.innerHTML=createUiMarkup();
  browser.document.documentElement.append(host);
  return {browser,shadow,view:createCurrentView(shadow)};
}

async function until(check) {
  const start=Date.now();
  while(!check()){
    if(Date.now()-start>6000) throw new Error("Current bounded page never finished rendering");
    await new Promise(resolve=>setTimeout(resolve,20));
  }
}
const rowsIn=(shadow,prefix)=>[...shadow.querySelectorAll("#"+prefix+"-body tr[data-encounter-id]")];
const goto=(shadow,prefix,row)=>{
  const input=shadow.getElementById(prefix+"-page-jump");
  input.value=String(row);
  shadow.getElementById(prefix+"-page-go").click();
};

test("single-page Current lists omit redundant paging controls, then expose them when total exceeds 100",async t=>{
  const f=fixture(t);
  const rows=makeRows(100);
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"failed").length===100);
  const controls=f.shadow.getElementById("failed-page-prev")
    .closest(".encounter-page-controls");
  const capturedControls=f.shadow.getElementById("captured-page-prev")
    .closest(".encounter-page-controls");
  assert.equal(controls.hidden,true,"all 100 Failed are already visible");
  assert.equal(capturedControls.hidden,true,"empty Captured has no navigation");
  assert.equal(f.shadow.getElementById("failed-page-status").textContent,"1–100 de 100");

  const newest={...rows.at(-1),encounterId:"newest-page-101",captureAtMs:2_000_000};
  f.view.render(state([...rows,newest],2,{
    fromListVersion:1,toListVersion:2,fromRevision:1,toRevision:2,
    changes:[{previous:null,next:newest}]
  }));
  assert.equal(controls.hidden,false,"Prev/Next/Go appear when a second page is needed");
  assert.equal(f.shadow.getElementById("failed-page-status").textContent,"1–100 de 101");
  const go=f.shadow.getElementById("failed-page-go");
  go.focus();
  const filter=f.shadow.getElementById("failed-iv");
  filter.value="1000";
  filter.dispatchEvent(new f.browser.Event("input",{bubbles:true}));
  assert.equal(controls.hidden,true,"filtered empty list no longer needs paging");
  assert.equal(f.shadow.activeElement?.dataset.encounterSort,"failed",
    "hiding focused pagination moves focus to the surviving sort header");
  assert.equal(f.shadow.getElementById("failed-count").textContent,"0 Pokémons");
});

test("91,800-row Failed deep jump retains 100 or fewer DOM rows while showing the full Hunt count",async t=>{
  const f=fixture(t);
  const rows=makeRows(91800);
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"failed").length===100);
  assert.equal(f.shadow.getElementById("failed-count").textContent,"91800 Pokémons");
  assert.equal(rowsIn(f.shadow,"failed").length,CURRENT_LIST_PAGE_SIZE);

  goto(f.shadow,"failed",91401);
  await until(()=>rowsIn(f.shadow,"failed")[0]?.dataset.encounterId==="row-000399");
  assert.equal(rowsIn(f.shadow,"failed").length,100);
  assert.equal(f.shadow.getElementById("failed-page-status").textContent,"91.401–91.500 de 91.800");

  f.shadow.getElementById("failed-page-next").click();
  await until(()=>f.shadow.getElementById("failed-page-status").textContent==="91.501–91.600 de 91.800"
    && rowsIn(f.shadow,"failed").length===100);
  assert.equal(rowsIn(f.shadow,"failed").length,100);
  f.shadow.getElementById("failed-page-prev").click();
  await until(()=>f.shadow.getElementById("failed-page-status").textContent==="91.401–91.500 de 91.800"
    && rowsIn(f.shadow,"failed").length===100);
  assert.equal(rowsIn(f.shadow,"failed").length,100);
  assert.equal(rows.length,91800,"rendering cannot truncate source history");
});

test("Captured page preserves full IVs, keyboard expansion and focus through same-sort correction",async t=>{
  const f=fixture(t);
  const rows=makeRows(385,{type:"captured"});
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  goto(f.shadow,"captured",201);
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="201–300 de 385"
    && rowsIn(f.shadow,"captured").length===100);
  const selected=rowsIn(f.shadow,"captured")[0];
  assert.equal(selected.dataset.encounterId,"row-000184");
  assert.match(selected.cells[4].textContent,/\(10-10-10-10-10-10\)/);
  selected.focus();
  selected.dispatchEvent(new f.browser.KeyboardEvent("keydown",{bubbles:true,key:"Enter"}));
  assert.equal(selected.getAttribute("aria-expanded"),"true");
  assert.ok(f.shadow.querySelector('[data-detail-for="row-000184"]'));
  const corrected=rows.map(row=>row.encounterId===selected.dataset.encounterId
    ? {...row,ivTotal:168,ivs:{hp:28,atk:28,spa:28,def:28,spd:28,spe:28}}
    : row);
  f.view.render(state(corrected,2));
  await until(()=>f.shadow.querySelector('[data-encounter-id="row-000184"]')
    ?.cells[4].textContent.includes("168 (28-28-28-28-28-28)"));
  const updated=f.shadow.querySelector('[data-encounter-id="row-000184"]');
  assert.equal(updated.getAttribute("aria-expanded"),"true");
  assert.equal(f.shadow.activeElement===updated,true);
  assert.ok(f.shadow.querySelector('[data-detail-for="row-000184"]'));
  assert.equal(rowsIn(f.shadow,"captured").length,100);
});

test("newest-first delta while deep in Failed retains anchor and does not re-render the whole Hunt",async t=>{
  const f=fixture(t);
  const rows=makeRows(512);
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"failed").length===100);
  goto(f.shadow,"failed",301);
  await until(()=>f.shadow.getElementById("failed-page-status").textContent==="301–400 de 512"
    && rowsIn(f.shadow,"failed")[0]?.dataset.encounterId==="row-000211");
  const first=rowsIn(f.shadow,"failed")[0];
  const newRow={...rows.at(-1),encounterId:"newest-delta",captureAtMs:2_000_000};
  const after=[...rows,newRow];
  const delta={fromListVersion:1,toListVersion:2,fromRevision:1,toRevision:2,
    changes:[{previous:null,next:newRow}]};
  f.view.render(state(after,2,delta));
  assert.equal(rowsIn(f.shadow,"failed")[0]===first,true,
    "a head insert must not invalidate a deep page's existing DOM or scroll focus");
  assert.equal(f.shadow.getElementById("failed-page-status").textContent,"302–401 de 513");
  assert.equal(f.shadow.getElementById("failed-count").textContent,"513 Pokémons");
});

test("captured and failed paging are independent; filters/sort update total and reset only affected window",async t=>{
  const f=fixture(t);
  const failed=makeRows(300);
  const captures=makeRows(215,{type:"captured"}).map((row,index)=>({...row,
    encounterId:"cap-"+index}));
  const rows=[...failed,...captures];
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"failed").length===100 &&
    rowsIn(f.shadow,"captured").length===100);
  goto(f.shadow,"failed",201);
  goto(f.shadow,"captured",101);
  await until(()=>f.shadow.getElementById("failed-page-status").textContent==="201–300 de 300"
    && f.shadow.getElementById("captured-page-status").textContent==="101–200 de 215"
    && rowsIn(f.shadow,"failed").length===100
    && rowsIn(f.shadow,"captured").length===100);

  f.shadow.getElementById("captured-shiny").value="yes";
  f.shadow.getElementById("captured-shiny").dispatchEvent(new f.browser.Event("change"));
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="0 de 0");
  assert.equal(rowsIn(f.shadow,"captured").length,0);
  assert.equal(f.shadow.getElementById("captured-count").textContent,"0 Pokémons");
  assert.equal(f.shadow.getElementById("failed-page-status").textContent,"201–300 de 300");
  assert.equal(rowsIn(f.shadow,"failed").length,100);
});

test("Captured expansion survives page switch; keyboard sort preserves deep-page anchor and aria-sort",async t=>{
  const f=fixture(t);
  const rows=makeRows(240,{type:"captured"});
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  goto(f.shadow,"captured",101);
  await until(()=>rowsIn(f.shadow,"captured").length===100 &&
    f.shadow.getElementById("captured-page-status").textContent==="101–200 de 240");
  const anchor=rowsIn(f.shadow,"captured")[0].dataset.encounterId;
  rowsIn(f.shadow,"captured")[0].click();
  assert.equal(f.shadow.querySelector('[data-encounter-id="'+anchor+'"]').getAttribute("aria-expanded"),"true");

  f.shadow.getElementById("captured-page-next").click();
  await until(()=>rowsIn(f.shadow,"captured").length===40);
  f.shadow.getElementById("captured-page-prev").click();
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  assert.equal(f.shadow.querySelector('[data-encounter-id="'+anchor+'"]').getAttribute("aria-expanded"),"true");
  assert.ok(f.shadow.querySelector('[data-detail-for="'+anchor+'"]'));

  const header=f.shadow.querySelector('[data-encounter-sort="captured"][data-sort-key="capturedAt"]');
  assert.equal(header.getAttribute("aria-sort"),"descending");
  header.dispatchEvent(new f.browser.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  assert.equal(header.getAttribute("aria-sort"),"ascending");
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  assert.ok(rowsIn(f.shadow,"captured").some(row=>row.dataset.encounterId===anchor),
    "deep-page logical anchor stays visible after sorting");
  assert.equal(rowsIn(f.shadow,"captured").length,100);
});

test("rapid deep page jumps are generation-fenced, and cold suspension restores only first 100",async t=>{
  const f=fixture(t);
  const rows=makeRows(1120);
  f.view.render(state(rows,1));
  goto(f.shadow,"failed",801);
  goto(f.shadow,"failed",201);
  goto(f.shadow,"failed",1001);
  await until(()=>rowsIn(f.shadow,"failed").length===100);
  assert.equal(f.shadow.getElementById("failed-page-status").textContent,"1.001–1.100 de 1.120");
  assert.equal(rowsIn(f.shadow,"failed")[0].dataset.encounterId,"row-000119");
  assert.equal(rowsIn(f.shadow,"failed").length,100);
  f.view.suspend();
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(rowsIn(f.shadow,"failed").length,0);
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"failed").length===100);
  assert.equal(f.shadow.getElementById("failed-page-status").textContent,"1–100 de 1.120");
});

test("group correction moves one row without changing total Hunt Seen; last page clamps input and scroll advancement stays bounded",async t=>{
  const f=fixture(t);
  const rows=makeRows(233);
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"failed").length===100);
  goto(f.shadow,"failed",999999);
  await until(()=>rowsIn(f.shadow,"failed").length===33);
  assert.equal(f.shadow.getElementById("failed-page-status").textContent,"201–233 de 233");

  const previous=rows[3];
  const moved={...previous,captureResult:"success",updatedAtMs:999999};
  const corrected=rows.map(row=>row.encounterId===previous.encounterId?moved:row);
  f.view.render(state(corrected,2));
  await until(()=>rowsIn(f.shadow,"failed").length===100);
  assert.equal(f.shadow.getElementById("seen").textContent,"233");
  assert.equal(f.shadow.getElementById("captured-count").textContent,"1 Pokémon");
  assert.equal(f.shadow.getElementById("failed-count").textContent,"232 Pokémons");
  assert.equal(f.shadow.getElementById("failed-page-status").textContent,"1–100 de 232");

  const scroller=f.shadow.getElementById("failed-body").closest(".table-wrap");
  scroller.scrollTop=150;
  scroller.dispatchEvent(new f.browser.Event("scroll"));
  await until(()=>rowsIn(f.shadow,"failed").length===100 &&
    f.shadow.getElementById("failed-page-status").textContent==="101–200 de 232");
  assert.equal(rowsIn(f.shadow,"failed").length,100);
});

test("a terminal event must not overwrite a keyboard user's unfinished Go-to-row input",async t=>{
  const f=fixture(t);
  const rows=makeRows(540);
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"failed").length===100);
  const input=f.shadow.getElementById("failed-page-jump");
  input.focus();
  input.value="412";
  const newest={...rows.at(-1),encounterId:"typed-delta",captureAtMs:2_000_000};
  const delta={fromListVersion:1,toListVersion:2,fromRevision:1,toRevision:2,
    changes:[{previous:null,next:newest}]};
  f.view.render(state([...rows,newest],2,delta));
  assert.equal(input.value,"412","new capture must not corrupt in-progress navigation");
  input.dispatchEvent(new f.browser.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  await until(()=>rowsIn(f.shadow,"failed").length===100 &&
    f.shadow.getElementById("failed-page-status").textContent==="401–500 de 541");
  assert.equal(input.value,"401");
});

test("a new capture evicts at most the last visible row and restores its keyboard focus to an adjacent survivor",async t=>{
  const f=fixture(t);
  const rows=makeRows(101,{type:"captured"});
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  const tail=rowsIn(f.shadow,"captured").at(-1);
  assert.equal(tail.dataset.encounterId,"row-000001");
  tail.focus();
  const next={...rows.at(-1),encounterId:"new-capture",captureAtMs:2_000_000};
  f.view.render(state([...rows,next],2,{
    fromListVersion:1,toListVersion:2,fromRevision:1,toRevision:2,
    changes:[{previous:null,next}]
  }));
  assert.equal(rowsIn(f.shadow,"captured").length,100);
  assert.equal(f.shadow.querySelector('[data-encounter-id="row-000001"]'),null);
  assert.equal(f.shadow.activeElement?.dataset.encounterId,"row-000002");
});

test("a deferred page frame never steals focus from a newly selected control, and mobile paging scrolls the real view owner",async t=>{
  const f=fixture(t);
  const rows=makeRows(290,{type:"captured"});
  f.shadow.host.dataset.uiMode="mobile";
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  const oldRow=rowsIn(f.shadow,"captured")[0];
  oldRow.focus();
  const tableWrap=f.shadow.getElementById("captured-body").closest(".table-wrap");
  let scrollIntoViewCalls=0;
  tableWrap.scrollIntoView=()=>{scrollIntoViewCalls++;};
  f.shadow.getElementById("captured-page-next").click();
  const go=f.shadow.getElementById("captured-page-go");
  go.focus();
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  assert.equal(f.shadow.activeElement===go,true,
    "an older row must not steal focus from a new control during rAF");
  assert.ok(scrollIntoViewCalls>=1,
    "mobile page change must reposition the parent vertical scroller");
});

test("head insertion on a partial final page preserves a non-aligned cursor through Prev and Next without overlap",async t=>{
  const f=fixture(t);
  const rows=makeRows(250,{type:"captured"});
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  goto(f.shadow,"captured",201);
  await until(()=>rowsIn(f.shadow,"captured").length===50);
  const originalIds=rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId);

  const newRow={...rows.at(-1),encounterId:"newest-anchored-tail",captureAtMs:2_000_000};
  f.view.render(state([...rows,newRow],2,{
    fromListVersion:1,toListVersion:2,fromRevision:1,toRevision:2,
    changes:[{previous:null,next:newRow}]
  }));
  assert.equal(f.shadow.getElementById("captured-page-status").textContent,
    "202–251 de 251");
  assert.deepEqual(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId),originalIds);
  f.shadow.getElementById("captured-page-prev").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="102–201 de 251"
    && rowsIn(f.shadow,"captured").length===100);
  const priorIds=new Set(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId));
  f.shadow.getElementById("captured-page-next").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="202–251 de 251"
    && rowsIn(f.shadow,"captured").length===50);
  assert.deepEqual(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId),originalIds);
  assert.ok(originalIds.every(id=>!priorIds.has(id)),
    "relative paging from an anchored tail must not duplicate encounters across pages");

  goto(f.shadow,"captured",999999);
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="201–251 de 251"
    && rowsIn(f.shadow,"captured").length===51);
});

test("shifted deep-page origin partitions the leading short page without overlapping Prev/Next",async t=>{
  const f=fixture(t);
  const rows=makeRows(150,{type:"captured"});
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  goto(f.shadow,"captured",101);
  await until(()=>rowsIn(f.shadow,"captured").length===50);
  const tailBefore=rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId);

  const inserted={...rows.at(-1),encounterId:"new-head-at-origin",captureAtMs:2_000_000};
  f.view.render(state([...rows,inserted],2,{
    fromListVersion:1,toListVersion:2,fromRevision:1,toRevision:2,
    changes:[{previous:null,next:inserted}]
  }));
  assert.equal(f.shadow.getElementById("captured-page-status").textContent,"102–151 de 151");
  assert.deepEqual(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId),tailBefore);
  const ids=[tailBefore];
  f.shadow.getElementById("captured-page-prev").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="2–101 de 151"
    && rowsIn(f.shadow,"captured").length===100);
  ids.unshift(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId));
  f.shadow.getElementById("captured-page-prev").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="1–1 de 151"
    && rowsIn(f.shadow,"captured").length===1);
  ids.unshift(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId));

  const all=ids.flat();
  assert.equal(all.length,151);
  assert.equal(new Set(all).size,151,"every source encounter must occupy exactly one shifted page");
  assert.equal(f.shadow.getElementById("captured-page-prev").disabled,true);
  f.shadow.getElementById("captured-page-next").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="2–101 de 151"
    && rowsIn(f.shadow,"captured").length===100);
  assert.deepEqual(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId),ids[1]);
  f.shadow.getElementById("captured-page-next").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="102–151 de 151"
    && rowsIn(f.shadow,"captured").length===50);
  assert.deepEqual(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId),tailBefore);
});

test("reversing a 250-row sort keeps the anchor within a meaningful last block, not a one-row tail",async t=>{
  const f=fixture(t);
  const rows=makeRows(250,{type:"captured"});
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  const first=rowsIn(f.shadow,"captured")[0].dataset.encounterId;
  const header=f.shadow.querySelector('[data-encounter-sort="captured"][data-sort-key="capturedAt"]');
  header.dispatchEvent(new f.browser.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="201–250 de 250"
    && rowsIn(f.shadow,"captured").length===50);
  assert.ok(rowsIn(f.shadow,"captured").some(row=>row.dataset.encounterId===first));
  assert.equal(header.getAttribute("aria-sort"),"ascending");
});

test("late correction removing a shifted deep-page anchor restores canonical 100-row navigation",async t=>{
  const f=fixture(t);
  const rows=makeRows(250,{type:"captured"});
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  const ivFilter=f.shadow.getElementById("captured-iv");
  ivFilter.value="50";
  ivFilter.dispatchEvent(new f.browser.Event("input",{bubbles:true}));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  goto(f.shadow,"captured",101);
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="101–200 de 250"
    && rowsIn(f.shadow,"captured").length===100);

  const newHead={...rows.at(-1),encounterId:"new-head-while-filtered",captureAtMs:2_000_000};
  const afterAdd=[...rows,newHead];
  f.view.render(state(afterAdd,2,{
    fromListVersion:1,toListVersion:2,fromRevision:1,toRevision:2,
    changes:[{previous:null,next:newHead}]
  }));
  assert.equal(f.shadow.getElementById("captured-page-status").textContent,
    "102–201 de 251");
  const goneId=rowsIn(f.shadow,"captured")[0].dataset.encounterId;
  const corrected=afterAdd.map(row=>row.encounterId===goneId
    ? {...row,ivTotal:10,updatedAtMs:row.updatedAtMs+1} : row);
  f.view.render(state(corrected,3));
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="101–200 de 250"
    && rowsIn(f.shadow,"captured").length===100);
  assert.ok(!rowsIn(f.shadow,"captured").some(row=>row.dataset.encounterId===goneId));
  const second=new Set(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId));
  f.shadow.getElementById("captured-page-prev").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="1–100 de 250"
    && rowsIn(f.shadow,"captured").length===100);
  const first=rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId);
  assert.ok(first.every(id=>!second.has(id)),"the first and second pages may not overlap");
  f.shadow.getElementById("captured-page-next").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="101–200 de 250"
    && rowsIn(f.shadow,"captured").length===100);
  assert.deepEqual(new Set(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId)),second);
});

test("100 batched head inserts wrap the deep-page offset back to a canonical grid",async t=>{
  const f=fixture(t);
  const rows=makeRows(250,{type:"captured"});
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  goto(f.shadow,"captured",101);
  await until(()=>rowsIn(f.shadow,"captured")[0]?.dataset.encounterId==="row-000149");
  const original=rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId);
  const additions=Array.from({length:100},(_,index)=>({
    ...rows.at(-1),encounterId:`batch-head-${index}`,captureAtMs:2_000_000+index
  }));
  f.view.render(state([...rows,...additions],2,{
    fromListVersion:1,toListVersion:2,fromRevision:1,toRevision:2,
    changes:additions.map(next=>({previous:null,next}))
  }));
  assert.equal(f.shadow.getElementById("captured-page-status").textContent,"201–300 de 350");
  assert.deepEqual(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId),original);
  assert.equal(f.view.retentionSnapshot().captured.pageOrigin,0);

  f.shadow.getElementById("captured-page-prev").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="101–200 de 350"
    && rowsIn(f.shadow,"captured").length===100);
  const before=new Set(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId));
  assert.ok(original.every(id=>!before.has(id)));
  f.shadow.getElementById("captured-page-next").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="201–300 de 350"
    && rowsIn(f.shadow,"captured").length===100);
  assert.deepEqual(rowsIn(f.shadow,"captured").map(row=>row.dataset.encounterId),original);
});

test("99-to-0 leading-page offset rollover grows to exactly 100 rows without overlap",async t=>{
  const f=fixture(t);
  const rows=makeRows(150,{type:"captured"});
  f.view.render(state(rows,1));
  await until(()=>rowsIn(f.shadow,"captured").length===100);
  goto(f.shadow,"captured",101);
  await until(()=>rowsIn(f.shadow,"captured").length===50);
  const additions=Array.from({length:99},(_,index)=>({
    ...rows.at(-1),encounterId:`leading-head-${index}`,captureAtMs:2_000_000+index
  }));
  let current=[...rows,...additions];
  f.view.render(state(current,2,{
    fromListVersion:1,toListVersion:2,fromRevision:1,toRevision:2,
    changes:additions.map(next=>({previous:null,next}))
  }));
  assert.equal(f.view.retentionSnapshot().captured.pageOrigin,99);
  f.shadow.getElementById("captured-page-prev").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="100–199 de 249"
    && rowsIn(f.shadow,"captured").length===100);
  f.shadow.getElementById("captured-page-prev").click();
  await until(()=>f.shadow.getElementById("captured-page-status").textContent==="1–99 de 249"
    && rowsIn(f.shadow,"captured").length===99);
  const last={...rows.at(-1),encounterId:"leading-head-rollover",captureAtMs:2_000_999};
  current=[...current,last];
  f.view.render(state(current,3,{
    fromListVersion:2,toListVersion:3,fromRevision:2,toRevision:3,
    changes:[{previous:null,next:last}]
  }));
  assert.equal(f.view.retentionSnapshot().captured.pageOrigin,0);
  assert.equal(f.shadow.getElementById("captured-page-status").textContent,"1–100 de 250");
  assert.equal(rowsIn(f.shadow,"captured").length,100);
  const seen=new Set();
  for(let i=0;i<3;i++){
    for(const row of rowsIn(f.shadow,"captured")){
      assert.equal(seen.has(row.dataset.encounterId),false,"page windows must not overlap");
      seen.add(row.dataset.encounterId);
    }
    if(i<2){
      f.shadow.getElementById("captured-page-next").click();
      await until(()=>f.shadow.getElementById("captured-page-status").textContent===
        (i===0?"101–200 de 250":"201–250 de 250") &&
        rowsIn(f.shadow,"captured").length===(i===0?100:50));
    }
  }
  assert.equal(seen.size,250);
});
