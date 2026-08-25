import { test } from "node:test";
import assert from "node:assert/strict";

import { createRemoteImageLoader } from "../../userscript/remote-image-loader.js";

test("remote image loader caches repeated URLs without a second request", async () => {
  let requests = 0;
  const image = { id: "charizard" };
  const loader = createRemoteImageLoader({
    fetchImage: async () => {
      requests += 1;
      return image;
    },
    minIntervalMs: 0
  });

  assert.equal(await loader.load("sprite-a"), image);
  assert.equal(await loader.load("sprite-a"), image);
  assert.equal(requests, 1);
  assert.equal(loader.getCacheSize(), 1);
});

test("remote image loader deduplicates simultaneous requests for the same URL", async () => {
  let requests = 0;
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const image = { id: "mew" };
  const loader = createRemoteImageLoader({
    fetchImage: async () => {
      requests += 1;
      await pending;
      return image;
    },
    minIntervalMs: 0
  });

  const first = loader.load("sprite-a");
  const second = loader.load("sprite-a");
  release();

  assert.deepEqual(await Promise.all([first, second]), [image, image]);
  assert.equal(requests, 1);
});

test("remote image loader spaces distinct remote requests by the configured interval", async () => {
  let clock = 0;
  const startedAt = [];
  const waits = [];
  const loader = createRemoteImageLoader({
    fetchImage: async (url) => {
      startedAt.push([url, clock]);
      return { url };
    },
    now: () => clock,
    wait: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
    minIntervalMs: 2_000
  });

  await loader.load("sprite-a");
  await loader.load("sprite-b");
  await loader.load("sprite-c");

  assert.deepEqual(startedAt, [
    ["sprite-a", 0],
    ["sprite-b", 2_000],
    ["sprite-c", 4_000]
  ]);
  assert.deepEqual(waits, [2_000, 2_000]);
});

test("cache hits bypass the remote request gate", async () => {
  let clock = 0;
  let requests = 0;
  let waits = 0;
  const loader = createRemoteImageLoader({
    fetchImage: async () => {
      requests += 1;
      return { id: requests };
    },
    now: () => clock,
    wait: async (ms) => {
      waits += 1;
      clock += ms;
    },
    minIntervalMs: 2_000
  });

  await loader.load("sprite-a");
  await loader.load("sprite-a");

  assert.equal(requests, 1);
  assert.equal(waits, 0);
});

test("remote image cache uses bounded LRU eviction", async () => {
  const counts = new Map();
  const loader = createRemoteImageLoader({
    fetchImage: async (url) => {
      counts.set(url, (counts.get(url) || 0) + 1);
      return { url, request: counts.get(url) };
    },
    minIntervalMs: 0,
    maxCacheEntries: 2
  });

  await loader.load("a");
  await loader.load("b");
  await loader.load("a"); // refresh a; b becomes least-recently used
  await loader.load("c"); // evicts b
  await loader.load("b"); // must fetch again

  assert.equal(counts.get("a"), 1);
  assert.equal(counts.get("b"), 2);
  assert.equal(counts.get("c"), 1);
  assert.equal(loader.getCacheSize(), 2);
});

test("failed requests are neither cached nor left stuck in-flight", async () => {
  let requests = 0;
  const loader = createRemoteImageLoader({
    fetchImage: async () => {
      requests += 1;
      if (requests === 1) throw new Error("network failure");
      return { ok: true };
    },
    minIntervalMs: 0
  });

  await assert.rejects(() => loader.load("sprite-a"), /network failure/);
  assert.deepEqual(await loader.load("sprite-a"), { ok: true });
  assert.equal(requests, 2);
});
