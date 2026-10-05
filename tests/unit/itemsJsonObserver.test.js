import test from "node:test";
import assert from "node:assert/strict";

import {
  installItemsJsonObserver,
  isItemsJsonUrl
} from "../../userscript/items-json-observer.js";

test("items.json URL matching accepts query strings and rejects lookalikes", () => {
  assert.equal(isItemsJsonUrl("/data/items.json?v=42"), true);
  assert.equal(isItemsJsonUrl("https://pokepixel.nietore.com/assets/items.json#cache"), true);
  assert.equal(isItemsJsonUrl("/data/myitems.json"), false);
  assert.equal(isItemsJsonUrl("/data/items.json.backup"), false);
});

test("fetch observer reads a clone of the game's items.json response without replacing the response", async () => {
  const payload = [{ id: "map_fragment", name: "Fragmento de Mapa", rarity: "raro" }];
  const response = new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" }
  });
  let resolveFetch;
  const originalPromise = new Promise((resolve) => { resolveFetch = resolve; });
  const nativeFetch = () => originalPromise;
  const windowObject = {
    location: { href: "https://pokepixel.nietore.com/game" },
    fetch: nativeFetch
  };
  let observed = null;
  const dispose = installItemsJsonObserver({
    windowObject,
    onItems: (items) => { observed = items; }
  });

  const gamePromise = windowObject.fetch("/data/items.json?v=42");
  assert.equal(gamePromise, originalPromise, "observer must return the game's original fetch promise");
  resolveFetch(response);
  const gameResponse = await gamePromise;
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(observed, payload);
  assert.deepEqual(await gameResponse.json(), payload, "observer must not consume the game's response body");
  dispose();
  assert.equal(windowObject.fetch, nativeFetch);
});

test("fetch observer ignores unrelated JSON responses", async () => {
  const windowObject = {
    location: { href: "https://pokepixel.nietore.com/" },
    fetch: async () => new Response("[]", { headers: { "content-type": "application/json" } })
  };
  let calls = 0;
  installItemsJsonObserver({ windowObject, onItems: () => { calls += 1; } });
  await windowObject.fetch("/data/moves.json");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 0);
});

test("XHR observer publishes JSON only for items.json", () => {
  class FakeXhr {
    constructor() {
      this.listeners = new Map();
      this.responseType = "json";
      this.response = null;
    }
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }
    send() {
      this.listeners.get("load")?.();
    }
  }

  const nativeOpen = FakeXhr.prototype.open;
  const nativeSend = FakeXhr.prototype.send;
  const windowObject = {
    location: { href: "https://pokepixel.nietore.com/" },
    XMLHttpRequest: FakeXhr
  };
  let observed = null;
  const dispose = installItemsJsonObserver({
    windowObject,
    onItems: (items) => { observed = items; }
  });
  const xhr = new FakeXhr();
  xhr.open("GET", "/assets/items.json?rev=7");
  xhr.response = [{ id: "reference_fins", rarity: "raro" }];
  xhr.send();
  assert.deepEqual(observed, xhr.response);
  dispose();
  assert.equal(FakeXhr.prototype.open, nativeOpen);
  assert.equal(FakeXhr.prototype.send, nativeSend);
});
