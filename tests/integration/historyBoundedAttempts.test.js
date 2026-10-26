import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { createHistoryView, HISTORY_ATTEMPTS_PAGE_SIZE } from
  "../../userscript/history-view.js";
import { createUiMarkup } from "../../userscript/ui-markup.js";

function encounter(index, sessionId = "long-history") {
  return {
    encounterId: "history-" + String(index).padStart(6,"0"),
    sessionId, speciesId:"pidgey", speciesName:"Pidgey", quality:"common",
    captureResult:index % 11 === 0 ? "success" : "failed",
    captureAtMs:1_500_000 + index, updatedAtMs:1_500_000 + index,
    level:22, ivTotal:index%187, capsuleName:"Poké Ball",
    captureChance:.24, gold:1, lootItems:[], isShiny:false
  };
}
function session(id = "long-history") {
  const now=Date.now();
  return {sessionId:id, startedAtMs:now-5000, endedAtMs:now,
    status:"ended", activityKind:"hunt", accumulatedActiveMs:600_000};
}
function fixture(t, {loadSessions,loadSessionEncounters} = {}) {
  const browser=new Window({url:"https://history-bounded.invalid/"});
  const original=Object.getOwnPropertyDescriptor(globalThis,"document");
  Object.defineProperty(globalThis,"document",{value:browser.document,configurable:true});
  t.after(()=>{
    browser.close();
    if(original) Object.defineProperty(globalThis,"document",original);
    else delete globalThis.document;
  });
  const host=browser.document.createElement("div");
  const shadow=host.attachShadow({mode:"open"});
  shadow.innerHTML=createUiMarkup();
  browser.document.documentElement.appendChild(host);
  const view=createHistoryView(shadow,{
    loadSessions:loadSessions || (async()=>[session()]),
    loadSessionEncounters:loadSessionEncounters || (async()=>[])
  });
  return {browser,shadow,view};
}
const visibleRows=shadow=>[...shadow.querySelectorAll(".history-attempt-row")];
function jump(shadow, row) {
  shadow.getElementById("history-attempts-page-jump").value=String(row);
  shadow.getElementById("history-attempts-page-go").click();
}

test("History Attempts hides a useless one-page pager and restores it after Load More",async t=>{
  const latest=session("pager-latest");
  const older=session("pager-older");
  older.startedAtMs=latest.startedAtMs-100;
  let reads=0;
  const f=fixture(t,{
    loadSessions:async()=>++reads===1
      ? [latest,...Array.from({length:20},(_,i)=>session(`empty-${i}`))]
      :[older],
    loadSessionEncounters:async id=>id===latest.sessionId
      ? Array.from({length:35},(_,i)=>encounter(i,id))
      :id===older.sessionId
        ? Array.from({length:120},(_,i)=>encounter(1000+i,id)):[]
  });
  await f.view.refresh();
  f.view.setActiveSubview("attempts");
  const controls=f.shadow.getElementById("history-attempts-page-next")
    .closest(".encounter-page-controls");
  assert.equal(visibleRows(f.shadow).length,35);
  assert.equal(controls.hidden,true);
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,"1–35 de 35");
  await f.view.loadMore();
  assert.equal(controls.hidden,false,"loaded extra sessions make real paging available");
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,"1–100 de 155");
  const go=f.shadow.getElementById("history-attempts-page-go");
  go.focus();
  const rarity=f.shadow.getElementById("history-rarity");
  rarity.value="mythical";
  rarity.dispatchEvent(new f.browser.Event("change"));
  assert.equal(controls.hidden,true);
  assert.equal(f.shadow.activeElement,f.shadow.getElementById("history-tab-attempts"));
});

test("History Attempts browsing a synthetic 91,800-row Hunt never renders >100 entries",async t=>{
  const rows=Array.from({length:91800},(_,i)=>encounter(i));
  const f=fixture(t,{loadSessionEncounters:async()=>rows});
  await f.view.refresh();
  f.view.setActiveSubview("attempts");
  assert.equal(visibleRows(f.shadow).length,HISTORY_ATTEMPTS_PAGE_SIZE);
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,
    "1–100 de 91.800");
  jump(f.shadow,91401);
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,
    "91.401–91.500 de 91.800");
  assert.equal(visibleRows(f.shadow)[0].dataset.encounterId,"history-000399");
  assert.equal(visibleRows(f.shadow).length,100);
  f.shadow.getElementById("history-attempts-page-next").click();
  assert.equal(visibleRows(f.shadow).length,100);
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,
    "91.501–91.600 de 91.800");
  f.shadow.getElementById("history-attempts-page-prev").click();
  assert.equal(visibleRows(f.shadow).length,100);
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,
    "91.401–91.500 de 91.800");
  assert.equal(rows.length,91800);
});

test("History Attempts keyboard expansion, filters and jump remain scoped to the selected 100-row window",async t=>{
  const rows=Array.from({length:1250},(_,i)=>encounter(i));
  const f=fixture(t,{loadSessionEncounters:async()=>rows});
  await f.view.refresh();
  f.view.setActiveSubview("attempts");
  jump(f.shadow,201);
  const selected=visibleRows(f.shadow)[0];
  assert.equal(visibleRows(f.shadow).length,100);
  selected.focus();
  selected.dispatchEvent(new f.browser.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  const updated=visibleRows(f.shadow)[0];
  assert.equal(f.shadow.activeElement===updated,true);
  assert.equal(updated.getAttribute("aria-expanded"),"true");
  assert.equal(f.shadow.querySelectorAll(".history-detail-row").length,1);

  const filter=f.shadow.getElementById("history-result");
  filter.value="success";
  filter.dispatchEvent(new f.browser.Event("change"));
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,
    "1–100 de 114");
  assert.equal(visibleRows(f.shadow).length,100);
  f.shadow.getElementById("history-attempts-page-next").click();
  assert.equal(visibleRows(f.shadow).length,14);
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,
    "101–114 de 114");
});

test("History Attempts memoizes full-source filtering between page changes and invalidates on new session page",async t=>{
  const longRows=Array.from({length:2500},(_,i)=>encounter(i));
  let capturesRead=0;
  for(const row of longRows){
    const value=row.captureResult;
    Object.defineProperty(row,"captureResult",{enumerable:true,get(){ capturesRead++; return value; }});
  }
  const latest=session("latest");
  const older=session("older");
  older.startedAtMs=latest.startedAtMs-100;
  let readPages=0;
  const f=fixture(t,{
    loadSessions:async()=>{
      readPages++;
      return readPages===1?Array.from({length:21},(_,i)=>i===0?latest:session("placeholder-"+i))
        :[older];
    },
    loadSessionEncounters:async id=>id==="latest"?longRows
      :id==="older"?[encounter(99999,"older")]:[]
  });
  await f.view.refresh();
  f.view.setActiveSubview("attempts");
  const baseline=capturesRead;
  for(let index=0;index<12;index++){
    jump(f.shadow,index*100+1);
    assert.ok(visibleRows(f.shadow).length<=100);
  }
  assert.ok(capturesRead-baseline<3000,
    "paging must not repeatedly scan/sort the 2,500-row source");
  await f.view.loadMore();
  assert.equal(readPages,2);
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,
    "1.101–1.200 de 2.501");
});

test("History Attempts page navigation recovers keyboard focus and scrolls the mobile parent to the selected window",async t=>{
  const rows=Array.from({length:380},(_,i)=>encounter(i));
  const f=fixture(t,{loadSessionEncounters:async()=>rows});
  await f.view.refresh();
  f.view.setActiveSubview("attempts");
  f.shadow.host.dataset.uiMode="mobile";
  const wrap=f.shadow.getElementById("history-attempts-wrap");
  let repositioned=0;
  wrap.scrollIntoView=()=>{repositioned++;};
  const focused=visibleRows(f.shadow)[0];
  focused.focus();
  f.shadow.getElementById("history-attempts-page-next").click();
  assert.equal(visibleRows(f.shadow).length,100);
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,
    "101–200 de 380");
  assert.ok(visibleRows(f.shadow).includes(f.shadow.activeElement),
    "a removed old row cannot strand keyboard focus");
  assert.ok(repositioned>0);
});

test("History Attempts subtab and filter resets discard the prior deep-page scroll",async t=>{
  const rows=Array.from({length:380},(_,i)=>encounter(i));
  const f=fixture(t,{loadSessionEncounters:async()=>rows});
  await f.view.refresh();
  f.view.setActiveSubview("attempts");
  const wrap=f.shadow.getElementById("history-attempts-wrap");

  jump(f.shadow,201);
  wrap.scrollTop=430;
  f.view.setActiveSubview("hunts");
  f.view.setActiveSubview("attempts");
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,
    "1–100 de 380");
  assert.equal(wrap.scrollTop,0,"changing subtab resets the old attempt scroller");

  jump(f.shadow,201);
  wrap.scrollTop=520;
  const filter=f.shadow.getElementById("history-result");
  filter.value="success";
  filter.dispatchEvent(new f.browser.Event("change"));
  assert.equal(f.shadow.getElementById("history-attempts-page-status").textContent,
    "1–35 de 35");
  assert.equal(wrap.scrollTop,0,"changing filters resets the old attempt scroller");
  assert.equal(visibleRows(f.shadow).length,35);
});
