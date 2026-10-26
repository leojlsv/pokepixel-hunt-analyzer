import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { installPrePaintLauncherGuard } from "../../userscript/closed-hud-runtime.js";

function createHost(browser) {
  const host = browser.document.createElement("div");
  host.id = "pokepixel-hunt-analyzer-root";
  const shadow = host.attachShadow({ mode: "open" });
  const launcher = browser.document.createElement("button");
  launcher.id = "pha-toggle";
  shadow.appendChild(launcher);
  return { host, launcher };
}

test("prepaint guard disconnects on first Analyzer host and ignores all later page mutations", () => {
  const browser = new Window();
  const tracked = [];
  class TrackedObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      tracked.push(this);
    }
    observe(node, options) {
      assert.equal(node, browser.document.documentElement);
      assert.deepEqual(options, { childList: true, subtree: true });
    }
    disconnect() { this.disconnected = true; }
  }
  try {
    const dispose = installPrePaintLauncherGuard({
      documentObject: browser.document, MutationObserverClass: TrackedObserver, ElementClass: browser.Element
    });
    assert.equal(tracked.length, 1);
    const { host, launcher } = createHost(browser);
    browser.document.documentElement.appendChild(host);
    tracked[0].callback([{ addedNodes: [host] }]);
    assert.equal(launcher.style.visibility, "hidden");
    assert.equal(tracked[0].disconnected, true);
    dispose();
  } finally {
    browser.close();
  }
});

test("prepaint guard sees an existing host immediately without installing an observer", () => {
  const browser = new Window();
  try {
    const { host, launcher } = createHost(browser);
    browser.document.documentElement.appendChild(host);
    let installed = false;
    class TrackedObserver { constructor() { installed = true; } }
    const dispose = installPrePaintLauncherGuard({
      documentObject: browser.document, MutationObserverClass: TrackedObserver, ElementClass: browser.Element
    });
    assert.equal(installed, false);
    assert.equal(launcher.style.visibility, "hidden");
    dispose();
  } finally {
    browser.close();
  }
});

test("prepaint guard safely skips pages with no DOM observer", () => {
  assert.doesNotThrow(() => installPrePaintLauncherGuard({
    documentObject: null, MutationObserverClass: null
  })());
});
