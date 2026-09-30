/**
 * Screenshot the real Analyzer shell with synthetic offline data.
 * Uses one local headless Edge process and DevTools viewport emulation;
 * no gameplay URL, WebSocket interception or persistent application DB.
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createHash } from "node:crypto";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, "../../..");
const output = path.join(directory, "screenshots");
const edge = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

if (!existsSync(edge)) {
  throw new Error(`Edge not found at ${edge}; supply EDGE_PATH`);
}
if (!existsSync(path.join(directory, "reference.bundle.js"))) {
  throw new Error("Generate the offline bundle first: node docs/visual-redesign/reference/build.mjs");
}

const cases = [
  ["desktop-415-current", "desktop", "current", 1160, 750, 415],
  ["desktop-415-history", "desktop", "history", 1160, 750, 415],
  ["desktop-415-misc", "desktop", "misc", 1160, 750, 415],
  ["desktop-415-hud", "desktop", "hud", 1160, 750, 415],
  ["desktop-620-current", "desktop", "current", 1160, 750, 620],
  ["desktop-620-history", "desktop", "history", 1160, 750, 620],
  ["desktop-620-misc", "desktop", "misc", 1160, 750, 620],
  ["desktop-620-hud", "desktop", "hud", 1160, 750, 620],
  ["mobile-320-current", "mobile", "current", 320, 568],
  ["mobile-320-history", "mobile", "history", 320, 568],
  ["mobile-320-misc", "mobile", "misc", 320, 568],
  ["mobile-320-hud", "mobile", "hud", 320, 568],
  ["mobile-390-current", "mobile", "current", 390, 844],
  ["mobile-390-history", "mobile", "history", 390, 844],
  ["mobile-390-misc", "mobile", "misc", 390, 844],
  ["mobile-390-hud", "mobile", "hud", 390, 844]
];

const profile = await mkdtemp(path.join(tmpdir(), "pha-redesign-preview-"));
const browser = spawn(edge, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=0",
  "--remote-allow-origins=*",
  `--user-data-dir=${profile}`,
  "about:blank"
], { windowsHide: true, stdio: "ignore" });

let socket;
let nextId = 0;
const pending = new Map();
async function waitForPort() {
  const file = path.join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 70; attempt++) {
    if (browser.exitCode !== null) throw new Error(`Edge exited: ${browser.exitCode}`);
    try {
      const [port] = (await readFile(file, "utf8")).trim().split("\n");
      if (Number.isSafeInteger(Number(port))) return Number(port);
    } catch {
      // Browser profile has not initialized yet.
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for local headless Edge DevTools port");
}
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function waitForReference() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const evaluation = await call("Runtime.evaluate", {
      expression: "document.documentElement.dataset.referenceReady === 'true'",
      returnByValue: true
    });
    if (evaluation.result?.value === true) {
      // Allow the actual renderer's requestAnimationFrame batch to finish.
      await call("Runtime.evaluate", {
        expression: "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
        awaitPromise: true
      });
      return;
    }
    await delay(100);
  }
  throw new Error("Offline reference failed to initialize within 8 seconds");
}

const metricExpression = `(() => {
  const root = document.getElementById("pokepixel-hunt-analyzer-root")?.shadowRoot;
  const panel = root?.getElementById("pha-panel");
  const navigation = root?.querySelector(".tabs");
  const rect = (element) => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { x: Math.round(box.x), y: Math.round(box.y), right: Math.round(box.right), bottom: Math.round(box.bottom), width: Math.round(box.width), height: Math.round(box.height) };
  };
  const panelBox = rect(panel);
  return JSON.stringify({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    panel: panelBox,
    navigation: rect(navigation),
    panelOverflowsViewport: Boolean(panelBox && (panelBox.x < 0 || panelBox.right > innerWidth + 1)),
    panelScrollWidth: panel?.scrollWidth ?? null,
    panelClientWidth: panel?.clientWidth ?? null,
    navigationLabels: [...(navigation?.querySelectorAll("button") || [])].map(el => el.textContent.trim()),
    activeTabCount: navigation?.querySelectorAll('[aria-selected="true"]').length ?? 0
  });
})()`;

try {
  const port = await waitForPort();
  let targets;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (targets.some((entry) => entry.type === "page")) break;
    } catch {
      // DevTools HTTP endpoint is still initializing.
    }
    await delay(100);
  }
  const page = targets?.find((entry) => entry.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("Edge page debug endpoint unavailable");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener("message", ({ data }) => {
    const event = JSON.parse(String(data));
    if (!event.id) return;
    const callback = pending.get(event.id);
    if (!callback) return;
    pending.delete(event.id);
    if (event.error) callback.reject(new Error(`${event.error.code}: ${event.error.message}`));
    else callback.resolve(event.result || {});
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  await call("Page.enable");
  await call("Runtime.enable");
  await mkdir(output, { recursive: true });
  const browserVersion = await call("Browser.getVersion");
  const sourceFiles = [
    "package.json",
    "userscript/ui.js",
    "userscript/ui-markup.js",
    "userscript/ui-mode.js",
    "userscript/styles.js",
    "userscript/mobile-styles.js",
    "userscript/current-view.js",
    "userscript/history-view.js",
    "userscript/history-styles.js",
    "userscript/closed-hud.js",
    "userscript/closed-hud-runtime.js",
    "userscript/closed-hud-mobile-styles.js",
    "userscript/audio-alerts.js",
    "userscript/catch-gallery.js",
    "docs/visual-redesign/reference/entry.js",
    "docs/visual-redesign/reference/reference.bundle.js"
  ];
  const sha256 = {};
  for (const filename of sourceFiles) {
    const bytes = await readFile(path.join(repository, filename));
    sha256[filename] = createHash("sha256").update(bytes).digest("hex");
  }
  await writeFile(path.join(output, "manifest.json"), JSON.stringify({
    mode: "offline-synthetic-source-render",
    timestamp: new Date().toISOString(),
    browser: browserVersion.product,
    sourceSha256: sha256
  }, null, 2));
  const geometry = {};
  for (const [name, mode, view, width, height, panelWidth] of cases) {
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      screenWidth: width,
      screenHeight: height,
      deviceScaleFactor: 1,
      mobile: mode === "mobile"
    });
    await call("Emulation.setTouchEmulationEnabled", {
      enabled: mode === "mobile",
      maxTouchPoints: mode === "mobile" ? 5 : 1
    });
    const url = pathToFileURL(path.join(directory, "index.html"));
    url.searchParams.set("mode", mode);
    url.searchParams.set("view", view);
    if (panelWidth) url.searchParams.set("panel", String(panelWidth));
    await call("Page.navigate", { url: url.href });
    await waitForReference();
    const metrics = await call("Runtime.evaluate", {
      expression: metricExpression,
      returnByValue: true
    });
    geometry[name] = JSON.parse(metrics.result?.value || "{}");
    const screenshot = await call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false
    });
    await writeFile(path.join(output, `${name}.png`), Buffer.from(screenshot.data, "base64"));
    console.log(`${name}: ${geometry[name].innerWidth}×${geometry[name].innerHeight}, panel ${geometry[name].panel?.width || "-"}px`);
  }
  await writeFile(path.join(output, "geometry.json"), JSON.stringify(geometry, null, 2));
  console.log(`Saved ${cases.length} screenshots, viewport measurements and source manifest in docs/visual-redesign/reference/screenshots/`);
} finally {
  socket?.close();
  for (const task of pending.values()) task.reject(new Error("Browser closed"));
  pending.clear();
  browser.kill();
  // Keep the per-run temporary browser profile isolated from real user profiles.
}
