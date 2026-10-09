import test from "node:test";
import assert from "node:assert/strict";

import {
  installItemsJsonObserver,
  isItemsJsonUrl,
  isPageApiUrl,
  retryAfterMs
} from "../../userscript/items-json-observer.js";

test("items.json URL matching accepts query strings and rejects lookalikes", () => {
  assert.equal(isItemsJsonUrl("/data/items.json?v=42"), true);
  assert.equal(isItemsJsonUrl("https://pokepixel.nietore.com/assets/items.json#cache"), true);
  assert.equal(isItemsJsonUrl("/data/myitems.json"), false);
  assert.equal(isItemsJsonUrl("/data/items.json.backup"), false);
});

test("page API matching stays on the current origin", () => {
  assert.equal(isPageApiUrl("/api/v1/titles", "https://pokepixel.nietore.com/game"), true);
  assert.equal(isPageApiUrl("https://pokepixel.nietore.com/api/v1/species/golbat"), true);
  assert.equal(isPageApiUrl("https://example.test/api/v1/titles"), false);
  assert.equal(isPageApiUrl("/assets/api-reference.json"), false);
});

test("Retry-After accepts seconds and HTTP dates", () => {
  assert.equal(retryAfterMs("2", 1_000), 2_000);
  assert.equal(retryAfterMs("Thu, 01 Jan 1970 00:00:05 GMT", 1_000), 4_000);
  assert.equal(retryAfterMs("invalid", 1_000), null);
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

test("multiple consumers share one fetch wrapper and restore it after the last dispose", async () => {
  const payload = [{ id: "map_fragment", rarity: "raro" }];
  let nativeCalls = 0;
  const nativeFetch = async () => {
    nativeCalls += 1;
    return new Response(JSON.stringify(payload));
  };
  const windowObject = {
    location: { href: "https://pokepixel.nietore.com/game" },
    fetch: nativeFetch
  };
  let firstCalls = 0;
  let secondCalls = 0;
  const disposeFirst = installItemsJsonObserver({
    windowObject,
    onItems: () => { firstCalls += 1; }
  });
  const sharedWrapper = windowObject.fetch;
  const disposeSecond = installItemsJsonObserver({
    windowObject,
    onItems: () => { secondCalls += 1; }
  });

  assert.equal(windowObject.fetch, sharedWrapper, "second install must reuse the existing wrapper");
  await windowObject.fetch("/data/items.json");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(nativeCalls, 1);
  assert.equal(firstCalls, 1);
  assert.equal(secondCalls, 1);

  disposeFirst();
  assert.equal(windowObject.fetch, sharedWrapper, "remaining subscriber keeps the shared wrapper active");
  await windowObject.fetch("/data/items.json");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(nativeCalls, 2);
  assert.equal(firstCalls, 1);
  assert.equal(secondCalls, 2);

  disposeSecond();
  disposeSecond();
  assert.equal(windowObject.fetch, nativeFetch, "last idempotent dispose restores native fetch");
});

test("fetch observer reports same-origin API 429 without creating another request", async () => {
  let nativeCalls = 0;
  const nativeFetch = async () => {
    nativeCalls += 1;
    return new Response("rate limited", {
      status: 429,
      headers: { "Retry-After": "3" }
    });
  };
  const windowObject = {
    location: { href: "https://pokepixel.nietore.com/game" },
    fetch: nativeFetch
  };
  const observed = [];
  const dispose = installItemsJsonObserver({
    windowObject,
    onRateLimited: (event) => observed.push(event)
  });

  await windowObject.fetch("/api/v1/titles");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(nativeCalls, 1);
  assert.deepEqual(observed, [{ status: 429, retryAfterMs: 3_000 }]);

  await windowObject.fetch("https://example.test/api/v1/titles");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(nativeCalls, 2);
  assert.equal(observed.length, 1, "foreign API responses must not suppress PokePixel inventory");
  dispose();
});

test("dispose never overwrites a later third-party fetch wrapper", async () => {
  let nativeCalls = 0;
  const nativeFetch = async () => {
    nativeCalls += 1;
    return new Response("[]");
  };
  const windowObject = {
    location: { href: "https://pokepixel.nietore.com/game" },
    fetch: nativeFetch
  };
  let observedItems = 0;
  const dispose = installItemsJsonObserver({
    windowObject,
    onItems: () => { observedItems += 1; }
  });
  const analyzerWrapper = windowObject.fetch;
  const thirdPartyWrapper = function (...args) {
    return Reflect.apply(analyzerWrapper, this, args);
  };
  windowObject.fetch = thirdPartyWrapper;

  dispose();
  assert.equal(windowObject.fetch, thirdPartyWrapper);
  await windowObject.fetch("/data/items.json");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(nativeCalls, 1);
  assert.equal(observedItems, 0, "disposed subscriber must not receive a late delegated observation");

  let replacementItems = 0;
  const disposeReplacement = installItemsJsonObserver({
    windowObject,
    onItems: () => { replacementItems += 1; }
  });
  assert.equal(windowObject.fetch, thirdPartyWrapper, "reinstall must not stack over an unknown wrapper");
  await windowObject.fetch("/data/items.json");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(nativeCalls, 2);
  assert.equal(replacementItems, 1);
  disposeReplacement();
});

test("a tombstoned observer reattaches after a third-party wrapper restores native fetch", async () => {
  const nativeFetch = async () => new Response(JSON.stringify([{ id: "x" }]));
  const windowObject = {
    location: { href: "https://pokepixel.nietore.com/game" },
    fetch: nativeFetch
  };
  const disposeFirst = installItemsJsonObserver({ windowObject });
  const analyzerWrapper = windowObject.fetch;
  windowObject.fetch = function (...args) {
    return Reflect.apply(analyzerWrapper, this, args);
  };
  disposeFirst();
  windowObject.fetch = nativeFetch;

  let calls = 0;
  const disposeSecond = installItemsJsonObserver({
    windowObject,
    onItems: () => { calls += 1; }
  });
  assert.notEqual(windowObject.fetch, nativeFetch, "safe native restoration should allow the singleton to reattach");
  await windowObject.fetch("/data/items.json");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  disposeSecond();
  assert.equal(windowObject.fetch, nativeFetch);
});

test("an in-flight response is delivered only to subscribers that owned that request", async () => {
  let resolveFetch;
  const nativeFetch = () => new Promise((resolve) => { resolveFetch = resolve; });
  const windowObject = {
    location: { href: "https://pokepixel.nietore.com/game" },
    fetch: nativeFetch
  };
  let firstCalls = 0;
  let secondCalls = 0;
  const disposeFirst = installItemsJsonObserver({
    windowObject,
    onItems: () => { firstCalls += 1; }
  });
  const pending = windowObject.fetch("/data/items.json");
  disposeFirst();
  const disposeSecond = installItemsJsonObserver({
    windowObject,
    onItems: () => { secondCalls += 1; }
  });

  resolveFetch(new Response(JSON.stringify([{ id: "old" }])));
  await pending;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(firstCalls, 0);
  assert.equal(secondCalls, 0, "new subscribers must not receive a response from an older request");
  disposeSecond();
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

test("XHR observer never blocks send when listener registration is unavailable", () => {
  class ThrowingListenerXhr {
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    addEventListener() {
      throw new Error("listener blocked");
    }
    send() {
      this.sent = true;
      return "sent";
    }
  }

  const windowObject = {
    location: { href: "https://pokepixel.nietore.com/" },
    XMLHttpRequest: ThrowingListenerXhr
  };
  const dispose = installItemsJsonObserver({ windowObject });
  const xhr = new ThrowingListenerXhr();
  xhr.open("GET", "/api/v1/titles");

  assert.equal(xhr.send(), "sent");
  assert.equal(xhr.sent, true);
  dispose();
});
