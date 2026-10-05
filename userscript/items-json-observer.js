const ITEMS_JSON_PATH = /(?:^|\/)items\.json$/i;

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

/**
 * Passive observer for the game's own items.json request. It never issues a
 * request itself and never changes the response consumed by the game.
 */
export function installItemsJsonObserver({
  windowObject = window,
  onItems = () => {}
} = {}) {
  const cleanups = [];
  const baseHref = windowObject?.location?.href || "https://pokepixel.nietore.com/";

  const publish = (payload) => {
    if (!Array.isArray(payload)) return;
    try {
      onItems(payload);
    } catch (error) {
      console.error("PokePixel Hunt Analyzer (items.json callback):", error);
    }
  };

  const nativeFetch = windowObject?.fetch;
  if (typeof nativeFetch === "function") {
    const observedFetch = function (...args) {
      const requestedUrl = requestUrl(args[0]);
      const result = Reflect.apply(nativeFetch, this, args);
      Promise.resolve(result).then((response) => {
        const receivedUrl = typeof response?.url === "string" ? response.url : "";
        if (!isItemsJsonUrl(receivedUrl || requestedUrl, baseHref)) return;
        let clone;
        try {
          clone = response?.clone?.();
        } catch {
          return;
        }
        Promise.resolve(clone?.json?.()).then(publish).catch(() => {});
      }).catch(() => {});
      return result;
    };

    try {
      windowObject.fetch = observedFetch;
      if (windowObject.fetch === observedFetch) {
        cleanups.push(() => {
          if (windowObject.fetch === observedFetch) windowObject.fetch = nativeFetch;
        });
      }
    } catch {
      // Fetch observation is optional when the page blocks reassignment.
    }
  }

  const Xhr = windowObject?.XMLHttpRequest;
  const prototype = Xhr?.prototype;
  if (prototype && typeof prototype.open === "function" && typeof prototype.send === "function") {
    const nativeOpen = prototype.open;
    const nativeSend = prototype.send;
    const urls = new WeakMap();

    const observedOpen = function (method, url, ...rest) {
      urls.set(this, requestUrl(url));
      return Reflect.apply(nativeOpen, this, [method, url, ...rest]);
    };
    const observedSend = function (...args) {
      const url = urls.get(this) || "";
      if (isItemsJsonUrl(url, baseHref)) {
        this.addEventListener?.("load", () => {
          if (this.responseType === "json") {
            publish(this.response);
            return;
          }
          if (this.responseType && this.responseType !== "text") return;
          publish(parseJsonText(this.responseText));
        }, { once: true });
      }
      return Reflect.apply(nativeSend, this, args);
    };

    try {
      prototype.open = observedOpen;
      prototype.send = observedSend;
      if (prototype.open === observedOpen && prototype.send === observedSend) {
        cleanups.push(() => {
          if (prototype.open === observedOpen) prototype.open = nativeOpen;
          if (prototype.send === observedSend) prototype.send = nativeSend;
        });
      }
    } catch {
      if (prototype.open === observedOpen) prototype.open = nativeOpen;
      if (prototype.send === observedSend) prototype.send = nativeSend;
    }
  }

  return () => {
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}
