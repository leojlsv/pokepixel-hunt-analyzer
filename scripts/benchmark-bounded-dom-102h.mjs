/**
 * TEST ONLY — real Current + History renderer in disposable Node Happy DOM.
 * No browser profile, game, authenticated endpoint or IndexedDB is accessed.
 * Measures bounded mounted DOM on synthetic 102-hour 24,480/91,800 rows;
 * page timing is Happy DOM scheduling, NEVER live Chrome/game FPS.
 *
 * node --expose-gc scripts/benchmark-bounded-dom-102h.mjs 24480 91800
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { Window } from "happy-dom";
import { createCurrentView, CURRENT_LIST_PAGE_SIZE } from "../userscript/current-view.js";
import { createHistoryView, HISTORY_ATTEMPTS_PAGE_SIZE } from "../userscript/history-view.js";
import { createUiMarkup } from "../userscript/ui-markup.js";
import { computeSessionMetrics } from "../domain/sessionMetrics.js";

const counts=process.argv.slice(2).length?process.argv.slice(2).map(Number):[24480,91800];
assert.ok(counts.length<=2 && counts.every(n=>[24480,91800].includes(n)));
const sessionId="102h-test";
const wallMs=value=>Number(value.toFixed(2));
const mib=value=>Number((value/1048576).toFixed(2));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test,context){
  const start=performance.now();
  while(!test()){
    if(performance.now()-start>9000) throw new Error("Timed out on "+context);
    await sleep(15);
  }
}
const source=(index,total)=>({
  sessionId,encounterId:"enc-"+String(index).padStart(6,"0"),
  captureAtMs:367_200_000*index/total,
  updatedAtMs:367_200_000*index/total,
  captureResult:index%11===0?"success":"failed",
  speciesId:"pidgey",speciesName:"Pidgey",
  quality:index%7===0?"rare":"common",qualityMultiplier:1,
  ivTotal:index%187,ivs:{hp:10,atk:10,spa:10,def:10,spd:10,spe:10},
  isShiny:false,gender:"male",nature:"Modest",gold:1,lootItems:[]
});
const run=async count=>{
  const browser=new Window({url:"https://bounded-dom-synthetic.invalid/"});
  const globals=["document","localStorage","HTMLInputElement","requestAnimationFrame"];
  const originals=new Map();
  for(const name of globals){
    originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
    Object.defineProperty(globalThis,name,{configurable:true,writable:true,
      value:name==="requestAnimationFrame"?browser[name].bind(browser):browser[name]});
  }
  const host=document.createElement("div");
  const shadow=host.attachShadow({mode:"open"});
  shadow.innerHTML=createUiMarkup();
  document.documentElement.append(host);
  const rows=Array.from({length:count},(_,i)=>source(i,count));
  const session={sessionId,status:"running",activityKind:"hunt",startedAtMs:0,
    activeStartedAtMs:0,accumulatedActiveMs:0};
  const historySession={...session,status:"ended",endedAtMs:367_200_000};
  const metrics=computeSessionMetrics({session,encounters:rows,now:367_200_000});
  const current=createCurrentView(shadow);
  const history=createHistoryView(shadow,{
    loadSessions:async()=>[historySession],
    loadSessionEncounters:async id=>{
      assert.equal(id,sessionId);
      return rows;
    },now:()=>367_200_000
  });
  const report={case:"bounded-dom-102h",status:"pass",synthetic:true,
    engine:"node-happy-dom",logicalHuntHours:102,canonicalRows:count,
    sourceRowsNeverRemoved:true,
    noIndexedDbNetworkOrRelease:true};
  try {
    current.render({sessionId,encounters:rows,metrics,
      encounterSnapshotVersion:1,lootDataRevision:1,
      currentSessionSpecies:rows.at(-1)});
    await until(()=>{
      const s=current.retentionSnapshot();
      return s.captured.renderedRows>0 && s.failed.renderedRows>0;
    },"Current initial page");
    const captureTotal=current.retentionSnapshot().captured.sortedRows;
    const failedTotal=current.retentionSnapshot().failed.sortedRows;
    assert.equal(captureTotal+failedTotal,count);
    const currentTimings=[];
    let maxCurrentRows=0;
    for(const prefix of ["captured","failed"]){
      const total=prefix==="captured"?captureTotal:failedTotal;
      const ranks=[1,101,1001,Math.max(1,Math.floor(total/2/100)*100+1),
        Math.floor((total-1)/100)*100+1,1];
      for(const rank of ranks){
        const start=performance.now();
        shadow.getElementById(prefix+"-page-jump").value=String(rank);
        shadow.getElementById(prefix+"-page-go").click();
        const expectedStart=Math.floor((rank-1)/100)*100;
        const expectedCount=Math.min(100,total-expectedStart);
        await until(()=>{
          const snap=current.retentionSnapshot()[prefix];
          return snap.pageStart===expectedStart && snap.renderedRows===expectedCount;
        },prefix+" jump "+rank);
        currentTimings.push(wallMs(performance.now()-start));
        const snap=current.retentionSnapshot();
        maxCurrentRows=Math.max(maxCurrentRows,snap.captured.renderedRows+snap.failed.renderedRows);
        assert.ok(snap.captured.renderedRows<=CURRENT_LIST_PAGE_SIZE);
        assert.ok(snap.failed.renderedRows<=CURRENT_LIST_PAGE_SIZE);
      }
    }
    assert.ok(maxCurrentRows<=200);
    report.current={captures:captureTotal,failed:failedTotal,
      maxMountedEncounterRows:maxCurrentRows,capPerBucket:CURRENT_LIST_PAGE_SIZE,
      measuredPageVisits:currentTimings.length,
      pageSettleWallMsMedian:currentTimings.sort((a,b)=>a-b)[Math.floor(currentTimings.length/2)]};

    await history.refresh();
    history.setActiveSubview("attempts");
    assert.equal(history.retentionSnapshot().cachedFilteredAttempts,count);
    const historyRanks=[1,101,1001,Math.floor(count/2/100)*100+1,
      Math.floor((count-1)/100)*100+1,1];
    let maxAttemptRows=0;
    const historyTimes=[];
    for(const rank of historyRanks){
      const start=performance.now();
      shadow.getElementById("history-attempts-page-jump").value=String(rank);
      shadow.getElementById("history-attempts-page-go").click();
      const snap=history.retentionSnapshot();
      maxAttemptRows=Math.max(maxAttemptRows,snap.renderedAttemptRows);
      assert.equal(snap.cachedFilteredAttempts,count);
      assert.equal(snap.attemptPageStart,Math.floor((rank-1)/100)*100);
      assert.ok(snap.renderedAttemptRows<=HISTORY_ATTEMPTS_PAGE_SIZE);
      historyTimes.push(wallMs(performance.now()-start));
    }
    assert.ok(maxAttemptRows<=100);
    assert.equal(rows.length,count);
    report.history={filteredAttemptsOfLoadedSessions:count,
      maxMountedAttemptRows:maxAttemptRows,
      cap:HISTORY_ATTEMPTS_PAGE_SIZE,measuredPageVisits:historyTimes.length,
      synchronousPageCommitMsMedian:historyTimes.sort((a,b)=>a-b)[Math.floor(historyTimes.length/2)]};
    global.gc?.();
    report.processHeapAfterBothViewsMiB=mib(process.memoryUsage().heapUsed);
    report.caveat="Synthetic Happy DOM uses actual presentation logic but no layout/paint; all Current/History source rows and O(N) maps are still retained. DOM caps are deterministic. Timings and Node heap are not browser FPS or an in-game RAM guarantee.";
    return report;
  } finally {
    host.remove();
    browser.happyDOM.abort();
    for(const [key,descriptor] of originals){
      if(descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  }
};
const results=[];
for(const count of counts) results.push(await run(count));
process.stdout.write(JSON.stringify(results,null,2)+"\n");
