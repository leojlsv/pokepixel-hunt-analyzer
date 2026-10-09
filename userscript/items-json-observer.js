const ITEMS_JSON_PATH = /(?:^|\/)items\.json$/i;
const OBSERVER_STATE_FLAG = "__POKEPIXEL_HUNT_ANALYZER_ITEMS_JSON_OBSERVER_V1__";

function urlText(value) {
  if (typeof value === "string") return value;
  if (typeof value?.href === "string") return value.href;
  return typeof value?.url === "string" ? value.url : "";
}

export function isItemsJsonUrl(value, baseHref = "https://pokepixel.nietore.com/") {
  const raw = urlText(value);
  if (typeof raw !== "string" || !raw) return false;
  try {
    return ITEMS_JSON_PATH.test(new URL(raw, baseHref).pathname);
  } catch {
    return false;
  }
}

export function isPageApiUrl(value, baseHref = "https://pokepixel.nietore.com/") {
  const raw = urlText(value);
  if (typeof raw !== "string" || !raw) return false;
  try {
    const base = new URL(baseHref);
    const target = new URL(raw, base);
    return target.origin === base.origin && /^\/api(?:\/|$)/i.test(target.pathname);
  } catch {
    return false;
  }
}

function requestUrl(input) {
  return urlText(input);
}

function parseJsonText(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function headerValue(headers, name) {
  if (!headers) return null;
  try {
    if (typeof headers.get === "function") return headers.get(name);
  } catch {
  }
  if (typeof headers !== "object") return null;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
}

export function retryAfterMs(value, nowMs = Date.now()) {
  if (value === null || value === undefined || value === "") return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, timestamp - nowMs);
}

function createObserverState(windowObject) {
  const state = {
    version: 1,
    subscribers: new Set(),
    baseHref: windowObject?.location?.href || "https://pokepixel.nietore.com/",
    nativeFetch: null,
    observedFetch: null,
    xhrPrototype: null,
    nativeOpen: null,
    nativeSend: null,
    observedOpen: null,
    observedSend: null,
    urls: new WeakMap()
  };

  function publishItems(payload, subscribers = [...state.subscribers]) {
    if (!Array.isArray(payload)) return;
    for (const subscriber of subscribers) {
      if (!subscriber.active) continue;
      try {
        subscriber.onItems(payload);
      } catch (error) {
        console.error("PokePixel Hunt Analyzer (items.json callback):", error);
      }
    }
  }

  function publishRateLimit(url, headers = null, subscribers = [...state.subscribers]) {
    if (!isPageApiUrl(url, state.baseHref)) return;
    const delayMs = retryAfterMs(headerValue(headers, "retry-after"));
    for (const subscriber of subscribers) {
      if (!subscriber.active) continue;
      try {
        subscriber.onRateLimited({
          status: 429,
          retryAfterMs: delayMs
        });
      } catch (error) {
        console.error("PokePixel Hunt Analyzer (rate-limit callback):", error);
      }
    }
  }

  const nativeFetch = windowObject?.fetch;
  if (typeof nativeFetch === "function") {
    state.nativeFetch = nativeFetch;
    state.observedFetch = function (...args) {
      const requestedUrl = requestUrl(args[0]);
      const subscribers = [...state.subscribers];
      const result = Reflect.apply(nativeFetch, this, args);
      Promise.resolve(result).then((response) => {
        const receivedUrl = typeof response?.url === "string" ? response.url : "";
        const effectiveUrl = receivedUrl || requestedUrl;
        if (response?.status === 429) publishRateLimit(effectiveUrl, response?.headers, subscribers);
        if (!isItemsJsonUrl(effectiveUrl, state.baseHref)) return;
        let clone;
        try {
          clone = response?.clone?.();
        } catch {
          return;
        }
        Promise.resolve(clone?.json?.()).then((payload) => publishItems(payload, subscribers)).catch(() => {});
      }).catch(() => {});
      return result;
    };

    try {
      windowObject.fetch = state.observedFetch;
      if (windowObject.fetch !== state.observedFetch) {
        state.nativeFetch = null;
        state.observedFetch = null;
      }
    } catch {
      state.nativeFetch = null;
      state.observedFetch = null;
    }
  }

  const Xhr = windowObject?.XMLHttpRequest;
  const prototype = Xhr?.prototype;
  if (prototype && typeof prototype.open === "function" && typeof prototype.send === "function") {
    state.xhrPrototype = prototype;
    state.nativeOpen = prototype.open;
    state.nativeSend = prototype.send;
    state.observedOpen = function (method, url, ...rest) {
      state.urls.set(this, requestUrl(url));
      return Reflect.apply(state.nativeOpen, this, [method, url, ...rest]);
    };
    state.observedSend = function (...args) {
      const url = state.urls.get(this) || "";
      const subscribers = [...state.subscribers];
      const observesItems = isItemsJsonUrl(url, state.baseHref);
      const observesApi = isPageApiUrl(url, state.baseHref);
      if (observesItems || observesApi) {
        const onLoad = () => {
          if (observesApi && this.status === 429) {
            let retryAfter = null;
            try {
              retryAfter = this.getResponseHeader?.("Retry-After");
            } catch {
            }
            publishRateLimit(
              url,
              retryAfter === null ? null : { "retry-after": retryAfter },
              subscribers
            );
          }
          if (!observesItems) return;
          if (this.responseType === "json") {
            publishItems(this.response, subscribers);
            return;
          }
          if (this.responseType && this.responseType !== "text") return;
          publishItems(parseJsonText(this.responseText), subscribers);
        };
        try {
          this.addEventListener?.("load", onLoad, { once: true });
        } catch {
          // Observation is optional; never let a nonstandard XHR block page traffic.
        }
      }
      return Reflect.apply(state.nativeSend, this, args);
    };

    try {
      prototype.open = state.observedOpen;
      prototype.send = state.observedSend;
      if (prototype.open !== state.observedOpen || prototype.send !== state.observedSend) {
        if (prototype.open === state.observedOpen) prototype.open = state.nativeOpen;
        if (prototype.send === state.observedSend) prototype.send = state.nativeSend;
        state.xhrPrototype = null;
        state.nativeOpen = null;
        state.nativeSend = null;
        state.observedOpen = null;
        state.observedSend = null;
      }
    } catch {
      if (prototype.open === state.observedOpen) prototype.open = state.nativeOpen;
      if (prototype.send === state.observedSend) prototype.send = state.nativeSend;
      state.xhrPrototype = null;
      state.nativeOpen = null;
      state.nativeSend = null;
      state.observedOpen = null;
      state.observedSend = null;
    }
  }

  return state;
}

function observerState(windowObject) {
  const existing = windowObject?.[OBSERVER_STATE_FLAG];
  if (existing?.version === 1 && existing.subscribers instanceof Set) {
    reattachObserverState(windowObject, existing);
    return existing;
  }

  const state = createObserverState(windowObject);
  try {
    Object.defineProperty(windowObject, OBSERVER_STATE_FLAG, {
      value: state,
      configurable: true,
      enumerable: false,
      writable: false
    });
  } catch {
    return state;
  }
  return state;
}

function reattachObserverState(windowObject, state) {
  if (state.observedFetch && state.nativeFetch && windowObject.fetch === state.nativeFetch) {
    try {
      windowObject.fetch = state.observedFetch;
    } catch {
    }
  }

  const prototype = state.xhrPrototype;
  if (!prototype || !state.observedOpen || !state.observedSend) return;
  if (prototype.open !== state.nativeOpen || prototype.send !== state.nativeSend) return;

  try {
    prototype.open = state.observedOpen;
    prototype.send = state.observedSend;
    if (prototype.open !== state.observedOpen || prototype.send !== state.observedSend) {
      if (prototype.open === state.observedOpen) prototype.open = state.nativeOpen;
      if (prototype.send === state.observedSend) prototype.send = state.nativeSend;
    }
  } catch {
    if (prototype.open === state.observedOpen) prototype.open = state.nativeOpen;
    if (prototype.send === state.observedSend) prototype.send = state.nativeSend;
  }
}

function releaseObserverState(windowObject, state) {
  if (state.subscribers.size > 0) return;

  let fetchRestored = true;
  if (state.observedFetch && state.nativeFetch) {
    if (windowObject.fetch === state.observedFetch) windowObject.fetch = state.nativeFetch;
    else fetchRestored = false;
  }

  let xhrRestored = true;
  const prototype = state.xhrPrototype;
  if (prototype && state.observedOpen && state.observedSend) {
    if (prototype.open === state.observedOpen && prototype.send === state.observedSend) {
      prototype.open = state.nativeOpen;
      prototype.send = state.nativeSend;
    } else {
      xhrRestored = false;
    }
  }

  if (!fetchRestored || !xhrRestored) return;
  try {
    if (windowObject[OBSERVER_STATE_FLAG] === state) delete windowObject[OBSERVER_STATE_FLAG];
  } catch {
  }
}

/**
 * Passive observer for the game's own items.json request and same-origin API
 * rate-limit responses. It never issues requests or changes page responses.
 */
export function installItemsJsonObserver({
  windowObject = window,
  onItems = () => {},
  onRateLimited = () => {}
} = {}) {
  const state = observerState(windowObject);
  const subscriber = { active: true, onItems, onRateLimited };
  state.subscribers.add(subscriber);
  let disposed = false;

  return () => {
    if (disposed) return;
    disposed = true;
    subscriber.active = false;
    state.subscribers.delete(subscriber);
    releaseObserverState(windowObject, state);
  };
}
