export const REMOTE_IMAGE_MIN_INTERVAL_MS = 2_000;
export const REMOTE_IMAGE_MAX_CACHE_ENTRIES = 32;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeBlobAsImage(blob) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode remote image"));
    };
    image.src = objectUrl;
  });
}

function fetchImageWithTampermonkey(url) {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== "function") {
      reject(new Error("Tampermonkey remote image permission is unavailable"));
      return;
    }

    GM_xmlhttpRequest({
      method: "GET",
      url,
      responseType: "blob",
      anonymous: true,
      onload: async (response) => {
        if (response.status < 200 || response.status >= 300 || !response.response) {
          reject(
            new Error(
              `Could not fetch remote image: ${url} (${response.status || "network error"})`
            )
          );
          return;
        }

        try {
          resolve(await decodeBlobAsImage(response.response));
        } catch (error) {
          reject(error);
        }
      },
      onerror: () => reject(new Error(`Could not fetch remote image: ${url}`)),
      ontimeout: () => reject(new Error(`Remote image request timed out: ${url}`))
    });
  });
}

export function createRemoteImageLoader({
  fetchImage,
  now = () => Date.now(),
  wait = sleep,
  minIntervalMs = REMOTE_IMAGE_MIN_INTERVAL_MS,
  maxCacheEntries = REMOTE_IMAGE_MAX_CACHE_ENTRIES
}) {
  if (typeof fetchImage !== "function") {
    throw new TypeError("createRemoteImageLoader: fetchImage must be a function");
  }
  if (!Number.isInteger(maxCacheEntries) || maxCacheEntries < 1) {
    throw new RangeError("createRemoteImageLoader: maxCacheEntries must be >= 1");
  }
  if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0) {
    throw new RangeError("createRemoteImageLoader: minIntervalMs must be >= 0");
  }

  const cache = new Map();
  const inFlight = new Map();
  let requestGate = Promise.resolve();
  let lastRequestStartedAt = Number.NEGATIVE_INFINITY;

  function getCached(url) {
    if (!cache.has(url)) return null;

    const image = cache.get(url);
    // Map insertion order doubles as a tiny LRU queue.
    cache.delete(url);
    cache.set(url, image);
    return image;
  }

  function remember(url, image) {
    cache.delete(url);
    cache.set(url, image);

    while (cache.size > maxCacheEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  function acquireRequestSlot() {
    const slot = requestGate
      .catch(() => undefined)
      .then(async () => {
        const elapsed = now() - lastRequestStartedAt;
        const delayMs = Math.max(0, minIntervalMs - elapsed);
        if (delayMs > 0) await wait(delayMs);
        lastRequestStartedAt = now();
      });

    requestGate = slot;
    return slot;
  }

  function load(url) {
    const cached = getCached(url);
    if (cached) return Promise.resolve(cached);

    const existingRequest = inFlight.get(url);
    if (existingRequest) return existingRequest;

    const request = acquireRequestSlot()
      .then(() => fetchImage(url))
      .then((image) => {
        remember(url, image);
        return image;
      })
      .finally(() => {
        inFlight.delete(url);
      });

    inFlight.set(url, request);
    return request;
  }

  function clear() {
    cache.clear();
  }

  return {
    load,
    clear,
    getCacheSize: () => cache.size
  };
}

const defaultRemoteImageLoader = createRemoteImageLoader({
  fetchImage: fetchImageWithTampermonkey
});

export function loadRemoteImage(url) {
  return defaultRemoteImageLoader.load(url);
}
