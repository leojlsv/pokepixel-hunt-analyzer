import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_UI_GLOBAL,
  installPublicUiBridge
} from "../../userscript/public-ui.js";

test("public UI bridge exposes only allowlisted semantic destinations and cleans up by identity", async () => {
  const pageWindow = {};
  const destinations = [];
  const cleanup = installPublicUiBridge({
    pageWindow,
    appVersion: "1.15.1",
    navigate: async destination => {
      destinations.push(destination);
      return { ok: destination !== "history-loot", reason: "synthetic-unavailable" };
    }
  });

  const api = pageWindow[PUBLIC_UI_GLOBAL];
  assert.equal(api.protocol, 1);
  assert.equal(api.appVersion, "1.15.1");
  assert.equal(Object.isFrozen(api), true);
  assert.deepEqual(await api.navigate("current-captured"), { ok: true });
  assert.deepEqual(await api.navigate("history-loot"), { ok: false, reason: "synthetic-unavailable" });
  assert.deepEqual(await api.navigate("#captured-section"), { ok: false, reason: "unsupported-destination" });
  assert.deepEqual(destinations, ["current-captured", "history-loot"]);

  const replacement = { protocol: 99 };
  Object.defineProperty(pageWindow, PUBLIC_UI_GLOBAL, { value: replacement, configurable: true });
  cleanup();
  assert.equal(pageWindow[PUBLIC_UI_GLOBAL], replacement, "cleanup cannot delete a newer bridge");
});

test("public UI bridge contains navigation failures and does not throw across the page boundary", async () => {
  const pageWindow = {};
  installPublicUiBridge({
    pageWindow,
    appVersion: "1.15.1",
    navigate: async () => { throw new Error("synthetic failure"); }
  });
  assert.deepEqual(await pageWindow[PUBLIC_UI_GLOBAL].navigate("current"), {
    ok: false,
    reason: "navigation-failed"
  });
});
