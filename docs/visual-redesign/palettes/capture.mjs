/** Generate theme comparison screenshots in one isolated local Edge; never visit gameplay. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { PALETTE_PREVIEWS } from "./preview-theme.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const reference = path.resolve(here, "../reference");
const output = path.join(here, "screenshots");
const edge = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
assert.ok(existsSync(edge), `Edge not available: ${edge}`);
assert.ok(existsSync(path.join(reference, "reference.bundle.js")),
  "Build the fixture first: node docs/visual-redesign/reference/build.mjs");

const viewports = [
  { id: "desktop-415", mode: "desktop", width: 1160, height: 750, panel: 415 },
  { id: "desktop-620", mode: "desktop", width: 1160, height: 750, panel: 620 },
  { id: "mobile-320", mode: "mobile", width: 320, height: 568 },
  { id: "mobile-390", mode: "mobile", width: 390, height: 844 }
];
const palettes = Object.keys(PALETTE_PREVIEWS);
const screens = ["current", "history", "misc", "hud"];
const launcherSizes = [2, 1, 0];
const fixedTime = Date.parse("2026-09-30T12:00:00Z");
const requestedFilter = String(process.env.PALETTE_CAPTURE_FILTER || "");
const cases = palettes.flatMap((palette) => viewports.flatMap((viewport) => [
  ...screens.map((view) => ({ palette, ...viewport, view, kind: "panel", name: viewport.id + "-" + view })),
  ...launcherSizes.map((columns) => ({
    palette, ...viewport, view: "current", kind: "launcher", columns,
    name: viewport.id + "-hud-" + columns
  }))
])).filter((scenario) => !requestedFilter || (scenario.palette + "/" + scenario.name).includes(requestedFilter));
assert.ok(cases.length > 0, "No screenshot case matches " + requestedFilter);
const profile = await mkdtemp(path.join(tmpdir(), "pha-palette-preview-"));
const browser = spawn(edge, [
  "--headless=new", "--disable-gpu", "--disable-extensions", "--disable-background-networking",
  "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0",
  "--remote-allow-origins=*", "--user-data-dir=" + profile, "about:blank"
], { windowsHide: true, stdio: "ignore" });
let socket;
let nextId = 0;
const pending = new Map();

async function waitForPort() {
  const marker = path.join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 90; attempt += 1) {
    assert.equal(browser.exitCode, null, "Edge exited before DevTools was ready");
    try {
      const port = Number((await readFile(marker, "utf8")).split("\n")[0]);
      if (Number.isSafeInteger(port) && port > 0) return port;
    } catch { /* DevTools has not initialized. */ }
    await delay(100);
  }
  throw new Error("Timed out initializing isolated Edge profile");
}

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function openDevTools() {
  const port = await waitForPort();
  let pages;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      pages = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
      if (pages.some((entry) => entry.type === "page")) break;
    } catch { /* Debug endpoint has not initialized. */ }
    await delay(100);
  }
  const page = pages?.find((entry) => entry.type === "page");
  assert.ok(page?.webSocketDebuggerUrl, "Missing isolated Edge page endpoint");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener("message", ({ data }) => {
    const response = JSON.parse(String(data));
    if (!response.id) return;
    const callback = pending.get(response.id);
    if (!callback) return;
    pending.delete(response.id);
    if (response.error) callback.reject(new Error(response.error.message));
    else callback.resolve(response.result || {});
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  await call("Page.enable");
  await call("Runtime.enable");
}

async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  return result.result?.value;
}

async function waitForFixture(scenario) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate("document.documentElement.dataset.referenceReady === 'true' && document.body.dataset.previewPalette === "
      + JSON.stringify(scenario.palette))) {
      await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
      return;
    }
    await delay(100);
  }
  throw new Error("Offline fixture not ready: " + scenario.palette + "/" + scenario.name);
}

const inspectExpression = String.raw`(() => {
  const shadow = document.getElementById('pokepixel-hunt-analyzer-root')?.shadowRoot;
  if (!shadow) throw Error('Real Analyzer Shadow DOM is missing');
  const panel = shadow.getElementById('pha-panel');
  const launcher = shadow.getElementById('pha-toggle');
  const rect = (element) => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom};
  };
  const css = getComputedStyle(shadow.host);
  const slots = [...shadow.querySelectorAll('.pha-hud-slot')];
  const modeControl = shadow.host.dataset.uiMode === 'mobile'
    ? shadow.querySelector('.pha-ui-mode-summary')
    : shadow.querySelector('.pha-ui-mode-select');
  const modeStyle = modeControl ? getComputedStyle(modeControl) : null;
  const textColor = (selector) => {
    const found = shadow.querySelector(selector);
    return found ? getComputedStyle(found).color : null;
  };
  return JSON.stringify({
    palette:document.body.dataset.previewPalette,
    source:shadow.querySelector('style')?.textContent?.includes('--hunt-surface-canvas') === true,
    preview: Boolean(shadow.getElementById('pha-offline-palette-preview')),
    panel:rect(panel), launcher:rect(launcher),
    launcherVisible: Boolean(launcher && !launcher.hidden
      && getComputedStyle(launcher).display !== 'none'
      && getComputedStyle(launcher).visibility === 'visible'
      && Number(getComputedStyle(launcher).opacity) > 0),
    panelScrollWidth:panel?.scrollWidth ?? null, panelClientWidth:panel?.clientWidth ?? null,
    uiMode: modeStyle ? {
      background:modeStyle.backgroundColor,
      border:modeStyle.borderTopColor,
      color:modeStyle.color,
      fontSize:modeStyle.fontSize
    } : null,
    content:panel?.textContent?.replace(/\s+/g,' ').trim() || '',
    colors:{
      canvas:css.getPropertyValue('--hunt-surface-canvas').trim(),
      raised:css.getPropertyValue('--hunt-surface-raised').trim(),
      control:css.getPropertyValue('--hunt-surface-control').trim(),
      border:css.getPropertyValue('--hunt-border-default').trim(),
      text:css.getPropertyValue('--hunt-text-primary').trim(),
      accent:css.getPropertyValue('--hunt-accent-primary').trim(),
      rare:textColor('.rarity-rare'),
      legendary:textColor('.rarity-legendary'),
      mythical:textColor('.rarity-mythical'),
      positive:textColor('.pha-hud-slot-value.positive'),
      negative:textColor('.pha-hud-slot-value.negative')
    },
    slots:slots.map((slot) => ({
      height:slot.clientHeight, scrollHeight:slot.scrollHeight,
      overflow:slot.scrollHeight > slot.clientHeight + 1,
      label:slot.querySelector('.pha-hud-slot-label')?.textContent || ''
    }))
  });
})()`;

function computedRgb(hex) {
  return `rgb(${[1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(', ')})`;
}

function clipFor(scenario, measurement) {
  const rect = scenario.kind === 'launcher' ? measurement.launcher : measurement.panel;
  assert.ok(rect && rect.width > 0 && rect.height > 0, 'Missing capture surface');
  if (scenario.kind === 'launcher') assert.ok(measurement.launcherVisible, 'Launcher is hidden');
  assert.ok(rect.x >= -0.5 && rect.y >= -0.5, 'Preview surface clipped at top/left');
  assert.ok(rect.right <= scenario.width + 1 && rect.bottom <= scenario.height + 1,
    'Preview surface clipped by viewport');
  return {
    x:Math.max(0,Math.round(rect.x)), y:Math.max(0,Math.round(rect.y)),
    width:Math.round(rect.width), height:Math.round(rect.height), scale:1
  };
}

try {
  await openDevTools();
  await mkdir(output, { recursive:true });
  const browserInfo = await call('Browser.getVersion');
  const snapshots = {};
  const baselineByCase = new Map();
  const baselineSemantic = new Map();
  const baselineFrames = new Map();
  let captured = 0;

  for (const scenario of cases) {
    await call('Emulation.setDeviceMetricsOverride', {
      width:scenario.width, height:scenario.height,
      screenWidth:scenario.width, screenHeight:scenario.height,
      deviceScaleFactor:1, mobile:scenario.mode === 'mobile'
    });
    await call('Emulation.setTouchEmulationEnabled', {
      enabled:scenario.mode === 'mobile', maxTouchPoints:scenario.mode === 'mobile' ? 5 : 1
    });

    const url = pathToFileURL(path.join(reference, 'index.html'));
    url.searchParams.set('mode', scenario.mode);
    url.searchParams.set('view', scenario.view);
    url.searchParams.set('palette', scenario.palette);
    url.searchParams.set('now', String(fixedTime));
    url.searchParams.set('hudFixture', 'dense');
    if (scenario.panel) url.searchParams.set('panel', String(scenario.panel));
    if (scenario.kind === 'launcher') {
      url.searchParams.set('hudColumns', String(scenario.columns));
      url.searchParams.set('showLauncher', '1');
    }
    await call('Page.navigate', {url:url.href});
    await waitForFixture(scenario);
    const measurement = JSON.parse(await evaluate(inspectExpression));
    assert.equal(measurement.palette, scenario.palette);
    assert.ok(measurement.source, 'Preview must use the real Analyzer stylesheet');
    assert.equal(measurement.preview, true, 'Approved palette must be rendered through the shared CSS');
    assert.equal(measurement.colors.canvas, PALETTE_PREVIEWS[scenario.palette].canvas);
    assert.equal(measurement.colors.text, PALETTE_PREVIEWS[scenario.palette].text);
    assert.equal(measurement.colors.accent, PALETTE_PREVIEWS[scenario.palette].accent);
    if (scenario.view === 'misc' && scenario.kind === 'panel') {
      assert.ok(measurement.uiMode, 'UI Mode control is missing from Misc');
      assert.equal(measurement.uiMode.fontSize, '12px', 'UI Mode label is too small');
      assert.equal(measurement.uiMode.color, computedRgb(measurement.colors.text), 'UI Mode text ignores palette');
      assert.equal(measurement.uiMode.border, computedRgb(measurement.colors.border), 'UI Mode border ignores palette');
      assert.equal(measurement.uiMode.background, computedRgb(scenario.mode === 'mobile'
        ? measurement.colors.canvas : measurement.colors.control), 'UI Mode background ignores palette');
    }
    const identity = scenario.name;
    const contentHash = createHash('sha256').update(measurement.content).digest('hex');
    const semantic = ['rare','legendary','mythical','positive','negative']
      .map((key) => measurement.colors[key]);
    if (scenario.palette === 'obsidian') {
      baselineByCase.set(identity, contentHash);
      baselineSemantic.set(identity, semantic);
    } else if (baselineByCase.has(identity)) {
      assert.equal(contentHash, baselineByCase.get(identity), 'Palette changed the fixture text: ' + identity);
      assert.deepEqual(semantic, baselineSemantic.get(identity), 'Palette changed semantic colors: ' + identity);
    }
    if (scenario.kind === 'launcher') {
      assert.deepEqual(measurement.slots.filter((slot) => slot.overflow).map((slot) => slot.label), [],
        'HUD has overflowing rows');
      assert.equal(Math.round(measurement.launcher.width), scenario.columns === 2 ? 220 : scenario.columns === 1 ? 145 : 52);
      assert.equal(Math.round(measurement.launcher.height), 52);
    }

    const clip = clipFor(scenario, measurement);
    const frame = {width:clip.width,height:clip.height};
    if (scenario.palette === 'obsidian') baselineFrames.set(identity, frame);
    else if (baselineFrames.has(identity))
      assert.deepEqual(frame, baselineFrames.get(identity), 'Palette changed frame geometry: ' + identity);
    const image = await call('Page.captureScreenshot', {format:'png', captureBeyondViewport:false, clip});
    const folder = path.join(output, scenario.palette);
    await mkdir(folder, {recursive:true});
    const bytes = Buffer.from(image.data, 'base64');
    await writeFile(path.join(folder, scenario.name + '.png'), bytes);
    snapshots[scenario.palette + '/' + identity] = {
      kind:scenario.kind, frame:{width:clip.width,height:clip.height},
      palette:measurement.colors, contentSha256:contentHash,
      pngSha256:createHash('sha256').update(bytes).digest('hex'),
      columns:scenario.columns ?? null, visible:measurement.launcherVisible,
      slots:measurement.slots
    };
    captured += 1;
    if (captured % 12 === 0 || captured === cases.length)
      console.log('Captured ' + captured + '/' + cases.length + ' offline palette frames');
  }

  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(snapshots,null,2));
  const provenance = {
    fixture:'real-ui/synthetic-data/isolated-browser', fixedTime, captured,
    browser:browserInfo.product, generatedAt:new Date().toISOString(),
    sources:{
      'reference/entry.js':path.resolve(reference,'entry.js'),
      'palettes/preview-theme.js':path.resolve(here,'preview-theme.js')
    }
  };
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(provenance,null,2));
  console.log('PASS: ' + captured + ' screenshots; unchanged data, semantic colors, and frame geometry relative to Obsidiana.');
} finally {
  socket?.close();
  for (const task of pending.values()) task.reject(new Error('DevTools session closed'));
  pending.clear();
  browser.kill();
}
