import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MAIN_URL = new URL("../../userscript/main.js", import.meta.url);

async function mainSource() {
  return readFile(MAIN_URL, "utf8");
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in main.js`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart + 1, index);
    }
  }
  throw new Error(`${name} body is unbalanced`);
}

function blockBody(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart + 1, index);
    }
  }
  throw new Error(`${marker} block is unbalanced`);
}

test("embed Current hydration depends on repositories, not on the optional Analyzer UI", async () => {
  const source = await mainSource();
  const body = functionBody(source, "performCurrentLoad");

  assert.match(body, /!sessionsRepository\s*\|\|\s*!encountersRepository/);
  assert.doesNotMatch(body, /!ui\b/);
  assert.match(body, /publicSummary\s*=\s*createPublicSummary/);
  assert.match(body, /ui\?\.renderCurrent/);
});

test("Current refresh stays active for embed or a recent standalone public-summary reader", async () => {
  const source = await mainSource();
  const body = functionBody(source, "scheduleRefreshes");

  assert.match(body, /publicReaderActive/);
  assert.match(body, /lastPublicSummaryReadAtMs/);
  assert.match(body, /if\s*\(\s*!embedded\s*&&\s*ui\?\.getActiveView\(\)\s*!==\s*"current"\s*&&\s*!publicReaderActive\s*\)\s*return/);
  assert.match(body, /loadCurrent\(\)/);
});

test("embed mode deliberately skips UI mount without skipping initial Current hydration", async () => {
  const source = await mainSource();
  const body = functionBody(source, "initialize");

  assert.match(body, /if\s*\(\s*!embedded\s*\)\s*mountUiWhenReady\(\)/);
  assert.match(body, /if\s*\(\s*document\.documentElement\s*\)\s*await\s+loadCurrent\(\)/);
});

test("public summary and allowlisted session control are installed in embed and standalone runtime", async () => {
  const source = await mainSource();
  const body = functionBody(source, "initialize");
  assert.match(body, /disposePublicSummaryBridge\s*=\s*installPublicSummaryBridge\s*\(/);
  assert.match(body, /onRead:\s*\(\)\s*=>\s*\{\s*lastPublicSummaryReadAtMs\s*=\s*Date\.now\(\)/);
  assert.match(body, /disposePublicSessionControl\s*=\s*installPublicSessionControl\s*\(/);
  assert.doesNotMatch(body, /if\s*\(embedded\)\s*\{[\s\S]*installPublicSummaryBridge/);
});

test("startup recovery runs only after this tab has acquired analytics leadership", async () => {
  const source = await mainSource();
  const body = functionBody(source, "initialize");

  assert.match(body, /const\s+startupLeadershipActive\s*=\s*await\s+leadership\.acquire\(\)/);
  assert.match(body, /scheduleLeadershipRefresh\(\)/);
  assert.match(
    body,
    /if\s*\(\s*startupLeadershipActive\s*&&\s*leadership\.refresh\(\)\s*&&\s*leadership\.isActive\(\)\s*\)\s*\{\s*await\s+pipeline\.recoverOnStartup\(\)\s*;?\s*\}/
  );
  assert.ok(
    body.indexOf("await leadership.acquire()") < body.indexOf("pipeline.recoverOnStartup()"),
    "leadership acquisition must resolve before startup recovery can mutate IndexedDB"
  );
  assert.ok(
    body.indexOf("scheduleLeadershipRefresh()") < body.indexOf("pipeline.recoverOnStartup()"),
    "the startup lease must stay refreshed until recovery completes"
  );
});
