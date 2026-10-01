/**
 * Capture the standalone M1 prototype in one isolated local Edge instance.
 * Produces frame-only PNGs and computed-layout measurements for the M1 gate.
 * No game, network backend, application storage or production userscript.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const prototypeDir = path.resolve(here, "../prototype");
const screenshotsDir = path.join(here, "screenshots");
const edge = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
assert.ok(existsSync(edge), `Edge not available: ${edge}`);
const viewports = [
  ["desktop-415", 415, 700],
  ["desktop-620", 620, 700],
  ["mobile-320", 320, 568],
  ["mobile-390", 390, 844]
];
const cases = viewports.flatMap(([viewport, width, height]) => [
  ...["current", "history", "history-pokemon", "history-attempts", "misc", "hud"].map((state) =>
    ({ name: `${viewport}-${state}`, viewport, screen: state.split("-")[0],
      history: state.split("-")[1] || "hunts", width, height })
  ),
  ...[
    ["current-captured", "current", ".captured-table"],
    ["current-failed", "current", ".failed-table"],
    ["misc-gallery", "misc", ".gallery-table"]
  ].map(([state, screen, scrollTo]) => ({
    name: `${viewport}-${state}`, viewport, screen, history: "hunts",
    width, height, scrollTo
  })),
  ...[
    ["current-captured-data", "current", ".captured-table"],
    ["current-failed-data", "current", ".failed-table"],
    ["history-attempts-data", "history", ".history-attempts-table"],
    ["misc-gallery-data", "misc", ".gallery-table"]
  ].map(([state, screen, scrollTo]) => ({
    name: `${viewport}-${state}`, viewport, screen,
    history: screen === "history" ? "attempts" : "hunts", width, height,
    scrollTo, scrollAnchor: "table"
  }))
])
  .filter((scenario) => !process.env.CAPTURE_ONLY || scenario.name.includes(process.env.CAPTURE_ONLY))
  .map((scenario) => ["1", "expanded"].includes(process.env.LAYOUT_STRESS)
    ? { ...scenario, stress: process.env.LAYOUT_STRESS,
      name: scenario.name + (process.env.LAYOUT_STRESS === "expanded" ? "-expanded" : "-stress") }
    : scenario);
// A screenshot is useful for Discord only if complete, comparable records
// fit inside the visible content area. Metrics are for the synthetic fixture.
const densityTargets = Object.freeze({
  "mobile-320-current-captured": ["captured-table", 3],
  "mobile-390-current-captured": ["captured-table", 4],
  "desktop-415-current-captured": ["captured-table", 4],
  "desktop-620-current-captured": ["captured-table", 4],
  "mobile-320-current-captured-data": ["captured-table", 4],
  "mobile-390-current-captured-data": ["captured-table", 4],
  "desktop-415-current-captured-data": ["captured-table", 4],
  "desktop-620-current-captured-data": ["captured-table", 4],
  "mobile-320-history-attempts": ["history-attempts-table", 2],
  "mobile-320-history-attempts-data": ["history-attempts-table", 3],
  "mobile-320-misc-gallery": ["gallery-table", 2],
  "mobile-390-misc-gallery": ["gallery-table", 3]
});
const profile = await mkdtemp(path.join(tmpdir(), "pha-m1-screenshot-"));
const browser = spawn(edge, [
  "--headless=new", "--disable-gpu", "--disable-extensions", "--disable-background-networking",
  "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0",
  "--remote-allow-origins=*", `--user-data-dir=${profile}`, "about:blank"
], { windowsHide: true, stdio: "ignore" });
let ws;
let id = 0;
const pending = new Map();
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const request = ++id;
    pending.set(request, { resolve, reject });
    ws.send(JSON.stringify({ id: request, method, params }));
  });
}
async function waitForPort() {
  for (let attempt = 0; attempt < 70; attempt++) {
    assert.equal(browser.exitCode, null, "Edge exited before DevTools startup");
    try {
      const [port] = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).trim().split("\n");
      if (Number.isSafeInteger(Number(port))) return Number(port);
    } catch {
      // Profile is initializing.
    }
    await delay(100);
  }
  throw new Error("Local Edge DevTools startup timed out");
}
async function waitForScreen(scenario) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const answer = await call("Runtime.evaluate", {
      expression: `(() => {
        const url = new URL(location.href);
        const frame = document.getElementById("prototype");
        return document.readyState === "complete" &&
          url.searchParams.get("captureCase") === ${JSON.stringify(scenario.name)} &&
          frame?.dataset.screen === ${JSON.stringify(scenario.screen)} &&
          frame?.dataset.viewport === ${JSON.stringify(scenario.viewport)} &&
          (${JSON.stringify(scenario.screen)} !== "history" ||
            document.getElementById(${JSON.stringify("history-" + scenario.history)})?.hidden === false);
      })()`,
      returnByValue: true
    });
    if (answer.result?.value === true) {
      await call("Runtime.evaluate", {
        expression: "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
        awaitPromise: true
      });
      return;
    }
    await delay(100);
  }
  throw new Error(`Prototype screen '${scenario.name}' did not initialize`);
}
const inspect = `(() => {
  const frame = document.getElementById("prototype");
  const scroll = document.getElementById("content-scroll");
  const nav = frame?.querySelector(frame.dataset.mode === "mobile" ? ".app-nav--mobile" : ".app-nav--desktop");
  const rect = (node) => {
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return {x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom};
  };
  const tables = [...frame.querySelectorAll(".app-screen:not([hidden]) .table-scroll")].filter((node) =>
    node.getClientRects().length > 0 && node.getBoundingClientRect().width > 0
  ).map((node) => {
    const table = node.querySelector("table");
    const cells = [...(table?.querySelectorAll("tbody tr:not([hidden]) > th, tbody tr:not([hidden]) > td") || [])]
      .filter((cell) => cell.getClientRects().length && getComputedStyle(cell).display !== "none")
      .map((cell) => {
        const bounds = rect(cell);
        const container = rect(node);
        return {
          name:cell.textContent.trim().slice(0,45), bounds,
          tag:cell.tagName.toLowerCase(),
          detail:cell.closest("tr.history-detail") !== null,
          dataLabel:cell.dataset.label || "",
          pseudoLabel:getComputedStyle(cell, "::before").content,
          clippedLeft:bounds.x < container.x - 2,
          clippedRight:bounds.right > container.right + 2,
          ownOverflow:cell.scrollWidth > cell.clientWidth + 2
        };
      });
    const rows = [...(table?.querySelectorAll("tbody tr:not([hidden])") || [])]
      .filter((row) => row.getClientRects().length && getComputedStyle(row).display !== "none")
      .map((row) => ({
        cells:row.children.length,
        renderedCells:[...row.children].filter((cell) =>
          cell.getClientRects().length && getComputedStyle(cell).display !== "none"
        ).length,
        label:row.textContent.trim().slice(0,40)
      }));
    return {
      label:node.getAttribute("aria-label"),
      presentation:table?.dataset.presentation || "table",
      width:node.clientWidth,
      contentWidth:node.scrollWidth,
      overflowX:getComputedStyle(node).overflowX,
      headerDisplay:table?.tHead ? getComputedStyle(table.tHead).display : "none",
      tableWidth:table?.getBoundingClientRect().width ?? null,
      cells, rows
    };
  });
  const frameRect = rect(frame);
  const navRect = rect(nav);
  const contentRect = rect(scroll);
  const selected = [...frame.querySelectorAll('.app-tab[aria-selected="true"]')].map((node) => node.id);
  const visible = [...frame.querySelectorAll(".app-screen")].filter((node) => !node.hidden).map((node) => node.id);
  const tabs = [...nav.querySelectorAll(".app-tab")].map((node) => ({label:node.textContent.trim(), rect:rect(node)}));
  const navClock = rect(nav.querySelector(".nav-clock"));
  const capture = [...frame.querySelectorAll(".capture-grid .capture-kpi")].map((node) => rect(node));
  const capturedFailedNames = [...frame.querySelectorAll(
    ".captured-table tbody th[scope='row'],.failed-table tbody th[scope='row']"
  )].map((node) => node.textContent.trim());
  const tableVisibility = Object.fromEntries(
    [...frame.querySelectorAll(".app-screen:not([hidden]) table.data-table")]
      .filter((table) => table.getClientRects().length && table.getBoundingClientRect().width)
      .map((table) => {
        const items = [...table.tBodies[0].rows].filter((row) =>
          !row.hidden && !row.classList.contains("history-detail") &&
          row.getClientRects().length && getComputedStyle(row).display !== "none"
        );
        const within = (row) => {
          const bound = row.getBoundingClientRect();
          return bound.top >= contentRect.y - 1 && bound.bottom <= contentRect.bottom + 1;
        };
        const visible = items.filter(within);
        return [table.className.trim(), {
          totalRecords:items.length,
          fullyVisibleRecords:visible.length,
          firstHeight:items[0] ? Math.round(items[0].getBoundingClientRect().height) : null,
          maxHeight:items.length ? Math.round(Math.max(...items.map((row) => row.getBoundingClientRect().height))) : null,
          meanHeight:items.length ? Math.round(items.reduce((total,row) => total + row.getBoundingClientRect().height,0)/items.length) : null
        }];
      })
  );
  const historyPokemonLevel = Boolean(frame.querySelector("#history-pokemon .history-table thead th:nth-child(2)"));
  const attemptsPanel = frame.querySelector("#history-attempts");
  const attemptsTable = attemptsPanel?.querySelector("table");
  const historyDebug = {
    panelHidden:attemptsPanel?.hidden,
    panelRect:rect(attemptsPanel),
    tableRect:rect(attemptsTable),
    panelDisplay:attemptsPanel ? getComputedStyle(attemptsPanel).display : null,
    tableDisplay:attemptsTable ? getComputedStyle(attemptsTable).display : null,
    activeHistoryTabs:[...frame.querySelectorAll(".history-tab[aria-selected='true']")]
      .map((node) => node.dataset.history),
    tableKeys:Object.keys(tableVisibility)
  };
  return JSON.stringify({frame:frameRect,nav:navRect,content:contentRect,
    navBottomGap:Math.round(frameRect.bottom-navRect.bottom), tabs, navClock, selected, visible,
    capturedFailedNames, historyPokemonLevel, tableVisibility, historyDebug,
    tables, capture, scrollHeight:scroll.scrollHeight,scrollClientHeight:scroll.clientHeight,
    scrollWidth:scroll.scrollWidth,scrollClientWidth:scroll.clientWidth});
})()`;

try {
  const port = await waitForPort();
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  assert.equal(response.ok, true);
  const page = (await response.json()).find((target) => target.type === "page");
  assert.ok(page?.webSocketDebuggerUrl, "Edge page DevTools endpoint missing");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.addEventListener("message", ({ data }) => {
    const response = JSON.parse(String(data));
    if (!response.id) return;
    const wait = pending.get(response.id);
    if (!wait) return;
    pending.delete(response.id);
    response.error ? wait.reject(new Error(response.error.message)) : wait.resolve(response.result ?? {});
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1500, height: 1600, screenWidth: 1500, screenHeight: 1600,
    deviceScaleFactor: 1, mobile: false
  });
  await mkdir(screenshotsDir, { recursive: true });
  const layout = {};
  for (const scenario of cases) {
    const pageUrl = pathToFileURL(path.join(prototypeDir, "index.html"));
    pageUrl.searchParams.set("viewport", scenario.viewport);
    pageUrl.searchParams.set("screen", scenario.screen);
    pageUrl.searchParams.set("history", scenario.history);
    pageUrl.searchParams.set("captureCase", scenario.name);
    await call("Page.navigate", { url: pageUrl.href });
    await waitForScreen(scenario);
    if (scenario.stress) {
      const changed = await call("Runtime.evaluate", {
        expression: `(() => {
          const captured = document.querySelector(".captured-table tbody tr:first-child .record-detail-name");
          if (captured) captured.textContent = "SuperLongPokémonNameWithoutAnySpacesForWidthStressCheck";
          const failed = document.querySelector(".failed-table tbody tr:first-child");
          if (failed) {
            failed.querySelector("th[scope=row]").textContent =
              "ExtremelyLongUnbrokenWildSpeciesName";
            failed.children[2].textContent = "CustomSpecialUltraMasterBallWithoutSpaces";
            failed.children[3].textContent = "100.000%";
          }
          const gallery = document.querySelector(".gallery-table tbody tr:first-child th[scope=row]");
          if (gallery) gallery.textContent = "VeryLongCapturedPokémonNameWithoutSpaces";
          const attempts = document.querySelector("#history-attempts tbody tr:first-child");
          if (attempts) {
            attempts.children[1].textContent = "UnbrokenSpeciesNameVeryLongVeryLong";
            attempts.children[4].textContent = "100.000%";
          }
          return Boolean(captured && failed && gallery && attempts);
        })()`,
        returnByValue: true
      });
      assert.equal(changed.result?.value, true,
        `${scenario.name}: failed to construct extreme synthetic values`);
      await call("Runtime.evaluate", {
        expression: "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
        awaitPromise: true
      });
    }
    if (scenario.stress === "expanded") {
      const opened = await call("Runtime.evaluate", {
        expression: `(() => {
          const trigger = document.querySelector(".captured-table .record-detail-toggle");
          if (!trigger) return false;
          trigger.click();
          return trigger.getAttribute("aria-expanded") === "true";
        })()`,
        returnByValue: true
      });
      assert.equal(opened.result?.value, true, `${scenario.name}: captured detail did not open`);
      await call("Runtime.evaluate", {
        expression: "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
        awaitPromise: true
      });
    }
    if (scenario.scrollTo) {
      const move = await call("Runtime.evaluate", {
        expression: `(() => {
          const scroller = document.getElementById("content-scroll");
          const table = document.querySelector(${JSON.stringify(scenario.scrollTo)});
          const source = ${JSON.stringify(scenario.scrollAnchor === "table" ? "table" : "section")} === "table"
            ? table : (table?.closest("details") || table?.closest(".panel-block"));
          if (!scroller || !source) return false;
          const scrollTo = source.getBoundingClientRect().top -
            scroller.getBoundingClientRect().top + scroller.scrollTop - 4;
          scroller.scrollTop = Math.max(0, scrollTo);
          const sourceBounds = source.getBoundingClientRect();
          const area = scroller.getBoundingClientRect();
          return scroller.scrollTop > 20 ||
            (sourceBounds.top >= area.top - 2 && sourceBounds.top < area.bottom &&
             scroller.scrollHeight <= scroller.clientHeight + 2);
        })()`,
        returnByValue: true
      });
      assert.equal(move.result?.value, true,
        `${scenario.name} could not reach its table through the main vertical scroller`);
      await call("Runtime.evaluate", {
        expression: "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
        awaitPromise: true
      });
    }
    const result = await call("Runtime.evaluate", { expression: inspect, returnByValue: true });
    const measure = JSON.parse(result.result?.value ?? "{}");
    layout[scenario.name] = measure;
    assert.ok(Math.abs(measure.frame?.width - scenario.width) <= 1.5, `${scenario.name} width`);
    assert.ok(Math.abs(measure.frame?.height - scenario.height) <= 1.5, `${scenario.name} height`);
    assert.deepEqual(measure.visible, [`screen-${scenario.screen}`], `${scenario.name} view exclusivity`);
    assert.ok(measure.capturedFailedNames.length >= 7,
      `${scenario.name}: Captured and Failed sample Pokémon names are missing`);
    assert.ok(measure.capturedFailedNames.every((name) => !/\bLv\.?\s*\d+/i.test(name)),
      `${scenario.name}: a Captured/Failed sample still renders Level`);
    assert.equal(measure.historyPokemonLevel, true,
      `${scenario.name}: History Pokémon must preserve its Level field`);
    assert.equal(measure.selected.length, 1, `${scenario.name} selected tab count`);
    assert.equal(measure.tabs.length, 4, `${scenario.name} navigation destination count`);
    assert.ok(measure.scrollWidth <= measure.scrollClientWidth + 2,
      `${scenario.name}: app has unexpected horizontal scrolling`);
    for (const table of measure.tables) {
      assert.ok(table.contentWidth <= table.width + 2,
        `${scenario.name}: '${table.label}' requires horizontal scrolling (${table.contentWidth} > ${table.width})`);
      assert.notEqual(table.overflowX, "scroll",
        `${scenario.name}: '${table.label}' explicitly enables horizontal scrollbar`);
      assert.notEqual(table.overflowX, "auto",
        `${scenario.name}: '${table.label}' may create a horizontal scrollbar`);
      for (const row of table.rows) {
        assert.equal(row.renderedCells, row.cells,
          `${scenario.name}: '${table.label}' loses a visible cell in row '${row.label}'`);
      }
      for (const cell of table.cells) {
        assert.equal(cell.clippedLeft, false,
          `${scenario.name}: '${table.label}' clipped cell left: ${cell.name}`);
        assert.equal(cell.clippedRight, false,
          `${scenario.name}: '${table.label}' clipped cell right: ${cell.name}`);
        assert.equal(cell.ownOverflow, false,
          `${scenario.name}: '${table.label}' internally overflows cell: ${cell.name}`);
        if (table.presentation === "cards" && cell.tag === "td" && !cell.detail) {
          assert.ok(cell.dataLabel.length > 0,
            `${scenario.name}: '${table.label}' card datum has no human-readable label: ${cell.name}`);
          assert.notEqual(cell.pseudoLabel, "none",
            `${scenario.name}: '${table.label}' data label not visible: ${cell.dataLabel}`);
        }
      }
    }
    if (densityTargets[scenario.name]) {
      const [className, minimum] = densityTargets[scenario.name];
      const match = Object.entries(measure.tableVisibility || {})
        .find(([name]) => name.split(" ").includes(className));
      assert.ok(match, `${scenario.name}: missing screenshot density source ${className} ${JSON.stringify(measure.historyDebug)}`);
      assert.ok(match[1].fullyVisibleRecords >= minimum,
        `${scenario.name}: screenshot reveals only ${match[1].fullyVisibleRecords}/${match[1].totalRecords} complete records; expected ≥${minimum}`);
      if (className === "captured-table") {
        assert.ok(match[1].meanHeight <= 90,
          `${scenario.name}: Captured's average row height ${match[1].meanHeight}px wastes screenshot area`);
      }
    }
    for (const tab of measure.tabs) {
      assert.ok(tab.rect.width >= 40, `${scenario.name}: tab '${tab.label}' is too narrow`);
      assert.ok(tab.rect.x >= measure.nav.x - 1 && tab.rect.right <= measure.nav.right + 1,
        `${scenario.name}: tab '${tab.label}' exceeds navigation horizontally`);
      assert.ok(tab.rect.y >= measure.nav.y - 1 && tab.rect.bottom <= measure.nav.bottom + 1,
        `${scenario.name}: tab '${tab.label}' exceeds navigation vertically`);
    }
    if (scenario.viewport.startsWith("mobile")) {
      assert.ok(Math.abs(measure.navBottomGap) <= 2, `${scenario.name} bottom nav position`);
    } else if (measure.navClock) {
      assert.ok(measure.tabs.at(-1).rect.right < measure.navClock.x,
        `${scenario.name}: final navigation destination overlaps clock`);
    }
    if (scenario.screen === "current") {
      assert.equal(measure.capture.length, 4, `${scenario.name}: four capture KPIs remain visible`);
      for (const card of measure.capture) {
        assert.ok(card.x >= measure.frame.x && card.right <= measure.frame.right + 1,
          `${scenario.name}: capture KPI exceeds viewport horizontally`);
      }
      for (let j = 1; j < measure.capture.length; j++) {
        assert.ok(measure.capture[j].x >= measure.capture[j - 1].right - 1,
          `${scenario.name}: adjacent capture KPIs overlap`);
      }
    }
    const screenshot = await call("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: true,
      clip: {
        x: measure.frame.x,
        y: measure.frame.y,
        width: scenario.width,
        height: scenario.height,
        scale: 1
      }
    });
    await writeFile(path.join(screenshotsDir, `${scenario.name}.png`),
      Buffer.from(screenshot.data, "base64"));
    const density = Object.entries(measure.tableVisibility || {})
      .filter(([key]) => /captured-table|failed-table|history-attempts-table|gallery-table/.test(key))
      .map(([name, value]) => `${name.split(" ").at(-1)}: ${value.fullyVisibleRecords}/${value.totalRecords} complete, ${value.meanHeight}px/row`)
      .join("; ");
    console.log(`${scenario.name}: ${scenario.width}×${scenario.height}, selected ${measure.selected[0]}${density ? " · " + density : ""}`);
  }
  const hashes = {};
  for (const filename of ["index.html", "styles.css", "app.js", "qa.mjs"]) {
    hashes[filename] = createHash("sha256").update(await readFile(path.join(prototypeDir, filename))).digest("hex");
  }
  // A subset/stress run is diagnostic. Never overwrite the canonical full
  // 52-case geometry and hash manifest with a partial result.
  const diagnostic = [process.env.LAYOUT_STRESS, process.env.CAPTURE_ONLY]
    .filter(Boolean).join("-").replace(/[^a-z0-9-]/gi, "-").slice(0, 80);
  const suffix = diagnostic ? "-" + diagnostic : "";
  await writeFile(path.join(screenshotsDir, `geometry${suffix}.json`), JSON.stringify(layout, null, 2));
  await writeFile(path.join(screenshotsDir, `manifest${suffix}.json`), JSON.stringify({
    capturedAt: new Date().toISOString(), sources: hashes
  }, null, 2));
  console.log(`PASS: ${cases.length}/${cases.length} frame screenshots, no inner horizontal table scrolling, and navigation geometry in ${screenshotsDir}`);
} finally {
  ws?.close();
  browser.kill();
}
