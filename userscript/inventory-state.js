import { inventoryItemRarity } from "./loot-item-catalog.js";

const INVENTORY_REFRESH_DELAY_MS = 2_150;
const INVENTORY_FAST_REFRESH_DELAY_MS = 150;
const INVENTORY_RETRY_MS = 500;
const INVENTORY_MIN_REQUEST_INTERVAL_MS = 5_000;
const INVENTORY_RATE_LIMIT_BACKOFF_MS = 30_000;
const INVENTORY_TRANSIENT_BACKOFF_MS = 5_000;
const INVENTORY_MAX_BACKOFF_MS = 120_000;

const INVENTORY_EVENTS = Object.freeze([
  "inventory.updated",
  "capture.success",
  "capture.failed",
  "loot.received"
]);
const AUTH_LOGGED_IN_EVENT = "auth.loggedIn";

function itemQuantity(item) {
  const value = Number(item?.qty ?? item?.quantity ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeItems(response) {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.inventory)) return payload.inventory;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export function normalizeInventorySnapshot(response, updatedAtMs = Date.now()) {
  const items = normalizeItems(response).map((item) => {
    const metadata = item?.item;
    const rarity = inventoryItemRarity(item);
    return {
      ...item,
      item_id: String(item?.item_id ?? item?.id ?? metadata?.item_id ?? metadata?.id ?? "").trim(),
      name: item?.name || metadata?.name || "",
      type: item?.type || metadata?.type || "",
      category: item?.category || metadata?.category || "",
      rarity,
      qty: itemQuantity(item),
      quantity: itemQuantity(item)
    };
  });

  const byId = new Map();
  const capsules = [];
  const potions = [];

  for (const item of items) {
    if (!item.item_id) continue;
    byId.set(item.item_id, item);
    const type = String(item.type || item.category || "").toLowerCase();
    const category = String(item.category || item.type || "").toLowerCase();
    if (type === "capsule" || category === "capsule") capsules.push(item);
    if (type === "potion" || category === "potion") potions.push(item);
  }

  const byName = (left, right) => String(left.name || left.item_id)
    .localeCompare(String(right.name || right.item_id));
  capsules.sort(byName);
  potions.sort(byName);

  return {
    ready: true,
    items,
    byId,
    capsules,
    potions,
    updatedAtMs
  };
}

export function decrementInventoryItem(snapshot, itemId, amount = 1) {
  if (!snapshot?.ready || !itemId || !snapshot.byId?.has(itemId)) return snapshot;
  const decrement = Math.max(0, Number(amount) || 0);
  if (!decrement) return snapshot;

  const items = snapshot.items.map((item) => {
    if (item.item_id !== itemId) return item;
    const quantity = Math.max(0, itemQuantity(item) - decrement);
    return { ...item, qty: quantity, quantity };
  });

  return normalizeInventorySnapshot(items, Date.now());
}

function payloadData(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.data && typeof payload.data === "object"
    ? payload.data
    : payload.detail && typeof payload.detail === "object"
      ? payload.detail
      : payload;
}

function errorStatus(error) {
  for (const value of [
    error?.response?.status,
    error?.status,
    error?.statusCode,
    error?.cause?.response?.status,
    error?.cause?.status
  ]) {
    const status = Number(value);
    if (Number.isInteger(status) && status >= 100 && status <= 599) return status;
  }
  return null;
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

function retryAfterMsFromError(error, nowMs) {
  const value = headerValue(error?.response?.headers, "retry-after");
  if (value === null || value === undefined || value === "") return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, timestamp - nowMs);
}

function exponentialBackoff(baseMs, streak, maxMs) {
  const exponent = Math.max(0, Math.min(8, streak - 1));
  return Math.min(maxMs, baseMs * (2 ** exponent));
}

export function createInventoryState({
  pageWindow,
  onChange = () => {},
  retryIntervalMs = INVENTORY_RETRY_MS,
  minimumRequestIntervalMs = INVENTORY_MIN_REQUEST_INTERVAL_MS,
  rateLimitBackoffMs = INVENTORY_RATE_LIMIT_BACKOFF_MS,
  transientBackoffMs = INVENTORY_TRANSIENT_BACKOFF_MS,
  maximumBackoffMs = INVENTORY_MAX_BACKOFF_MS,
  isActive = () => true,
  getExternalRateLimitUntil = () => 0,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout
} = {}) {
  let snapshot = {
    ready: false,
    items: [],
    byId: new Map(),
    capsules: [],
    potions: [],
    updatedAtMs: null
  };
  let api = null;
  let auth = null;
  let bus = null;
  let disposed = false;
  let attached = false;
  let retryTimer = null;
  let refreshTimer = null;
  let refreshDueAt = 0;
  let refreshPromise = null;
  let nextEligibleAtMs = 0;
  let authBlocked = false;
  let authGeneration = 0;
  let pendingAfterFlight = false;
  let pendingCause = null;
  let rateLimitStreak = 0;
  let transientFailureStreak = 0;
  const handlers = new Map();
  const busContext = {};
  const diagnostics = {
    requestsStarted: 0,
    requestsSucceeded: 0,
    requestsFailed: 0,
    rateLimitFailures: 0,
    transientFailures: 0,
    authFailures: 0,
    authSuppressed: 0,
    inactiveSuppressed: 0,
    deferredRequests: 0,
    coalescedRequests: 0,
    coalescedEvents: 0,
    scheduledRefreshes: 0,
    staleResponsesDiscarded: 0,
    lastCause: null,
    lastRequestAtMs: null,
    lastSuccessAtMs: null,
    lastFailureAtMs: null,
    lastFailureStatus: null,
    backoffMs: 0
  };

  function emit() {
    onChange(snapshot);
  }

  function isAuthenticated() {
    try {
      return auth?.isAuthenticated?.() === true;
    } catch {
      return false;
    }
  }

  function activeForNetwork() {
    try {
      return isActive() === true;
    } catch {
      return false;
    }
  }

  function externalRateLimitUntil() {
    try {
      const value = Number(getExternalRateLimitUntil());
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    } catch {
      return 0;
    }
  }

  function networkEligibleAt() {
    return Math.max(nextEligibleAtMs, externalRateLimitUntil());
  }

  function clearRefreshTimer() {
    if (refreshTimer !== null) clearTimer(refreshTimer);
    refreshTimer = null;
    refreshDueAt = 0;
  }

  function scheduleRefresh(delayMs = INVENTORY_REFRESH_DELAY_MS, cause = "event") {
    if (disposed || !api?.getInventory) return false;
    if (!isAuthenticated() || authBlocked) {
      diagnostics.authSuppressed += 1;
      return false;
    }
    if (!activeForNetwork()) {
      diagnostics.inactiveSuppressed += 1;
      return false;
    }

    const timestamp = now();
    const requestedDueAt = timestamp + Math.max(0, Number(delayMs) || 0);
    const dueAt = Math.max(requestedDueAt, networkEligibleAt());
    if (refreshTimer !== null && refreshDueAt <= dueAt) {
      diagnostics.coalescedEvents += 1;
      return false;
    }

    clearRefreshTimer();
    refreshDueAt = dueAt;
    diagnostics.scheduledRefreshes += 1;
    refreshTimer = setTimer(() => {
      refreshTimer = null;
      refreshDueAt = 0;
      void refresh(cause);
    }, Math.max(0, dueAt - now()));
    return true;
  }

  async function refresh(cause = "manual") {
    if (disposed || !api?.getInventory) return snapshot;
    if (!isAuthenticated() || authBlocked) {
      diagnostics.authSuppressed += 1;
      return snapshot;
    }
    if (!activeForNetwork()) {
      diagnostics.inactiveSuppressed += 1;
      return snapshot;
    }
    if (refreshPromise) {
      diagnostics.coalescedRequests += 1;
      pendingAfterFlight = true;
      pendingCause = cause;
      return refreshPromise;
    }

    const timestamp = now();
    const eligibleAt = networkEligibleAt();
    if (eligibleAt > timestamp) {
      diagnostics.deferredRequests += 1;
      scheduleRefresh(eligibleAt - timestamp, cause);
      return snapshot;
    }

    const requestGeneration = authGeneration;
    diagnostics.lastCause = cause;
    refreshPromise = Promise.resolve()
      .then(async () => {
        if (disposed || requestGeneration !== authGeneration || authBlocked
          || !isAuthenticated() || !activeForNetwork()) {
          return { skipped: true };
        }

        const startedAtMs = now();
        diagnostics.requestsStarted += 1;
        diagnostics.lastRequestAtMs = startedAtMs;
        nextEligibleAtMs = Math.max(nextEligibleAtMs, startedAtMs + minimumRequestIntervalMs);
        return { skipped: false, response: await api.getInventory() };
      })
      .then((result) => {
        if (result?.skipped) return snapshot;
        if (disposed || requestGeneration !== authGeneration
          || !isAuthenticated() || !activeForNetwork()) {
          diagnostics.staleResponsesDiscarded += 1;
          return snapshot;
        }

        snapshot = normalizeInventorySnapshot(result.response, now());
        diagnostics.requestsSucceeded += 1;
        diagnostics.lastSuccessAtMs = now();
        diagnostics.lastFailureStatus = null;
        diagnostics.backoffMs = 0;
        rateLimitStreak = 0;
        transientFailureStreak = 0;
        emit();
        return snapshot;
      })
      .catch((error) => {
        if (disposed || requestGeneration !== authGeneration
          || !isAuthenticated() || !activeForNetwork()) {
          diagnostics.staleResponsesDiscarded += 1;
          return snapshot;
        }

        const failedAtMs = now();
        const status = errorStatus(error);
        diagnostics.requestsFailed += 1;
        diagnostics.lastFailureAtMs = failedAtMs;
        diagnostics.lastFailureStatus = status;

        if (status === 401 || status === 403) {
          diagnostics.authFailures += 1;
          authBlocked = true;
          clearRefreshTimer();
        } else if (status === 429) {
          diagnostics.rateLimitFailures += 1;
          rateLimitStreak += 1;
          const retryAfterMs = retryAfterMsFromError(error, failedAtMs) || 0;
          const backoffMs = Math.max(
            retryAfterMs,
            exponentialBackoff(rateLimitBackoffMs, rateLimitStreak, maximumBackoffMs)
          );
          diagnostics.backoffMs = backoffMs;
          nextEligibleAtMs = Math.max(nextEligibleAtMs, failedAtMs + backoffMs);
          scheduleRefresh(backoffMs, "rate-limit-retry");
        } else if (status === null || status === 408 || status === 425 || status >= 500) {
          diagnostics.transientFailures += 1;
          transientFailureStreak += 1;
          const backoffMs = exponentialBackoff(
            transientBackoffMs,
            transientFailureStreak,
            maximumBackoffMs
          );
          diagnostics.backoffMs = backoffMs;
          nextEligibleAtMs = Math.max(nextEligibleAtMs, failedAtMs + backoffMs);
          scheduleRefresh(backoffMs, "transient-retry");
        }

        console.warn(
          "PokePixel Hunt Analyzer (inventory snapshot):",
          status ? `HTTP ${status}` : "request failed"
        );
        return snapshot;
      })
      .finally(() => {
        refreshPromise = null;
        if (!pendingAfterFlight) return;
        const nextCause = pendingCause || "coalesced";
        pendingAfterFlight = false;
        pendingCause = null;
        scheduleRefresh(0, nextCause);
      });

    return refreshPromise;
  }

  function onBusEvent(eventName, payload) {
    if (eventName === AUTH_LOGGED_IN_EVENT) {
      authGeneration += 1;
      authBlocked = false;
      rateLimitStreak = 0;
      transientFailureStreak = 0;
      nextEligibleAtMs = 0;
      diagnostics.backoffMs = 0;
      clearRefreshTimer();
      void refresh("auth.loggedIn");
      return;
    }

    const data = payloadData(payload);

    if (eventName === "capture.success" || eventName === "capture.failed") {
      const itemId = String(data?.capsule_item_id || "");
      if (itemId) {
        const next = decrementInventoryItem(snapshot, itemId, 1);
        if (next !== snapshot) {
          snapshot = next;
          emit();
        }
      }
      scheduleRefresh(INVENTORY_REFRESH_DELAY_MS, eventName);
      return;
    }

    if (eventName === "inventory.updated") {
      scheduleRefresh(INVENTORY_FAST_REFRESH_DELAY_MS, eventName);
      return;
    }

    // Potion consumption is signalled by loot.received in the current game
    // client, but the payload does not always expose a stable potion item id.
    // Reconcile from the authoritative inventory snapshot instead of guessing.
    scheduleRefresh(INVENTORY_REFRESH_DELAY_MS, eventName);
  }

  function detachBus() {
    if (!bus) return;
    for (const [eventName, handler] of handlers) {
      try {
        if (typeof bus.off === "function") bus.off(eventName, handler, busContext);
        else if (typeof bus.removeListener === "function") bus.removeListener(eventName, handler);
      } catch {
        // Page unload/remount cleanup is best-effort.
      }
    }
    handlers.clear();
    bus = null;
  }

  function tryAttach() {
    if (disposed || attached) return;
    const pokeIdle = pageWindow?.PokeIdle;
    const nextApi = pokeIdle?.Api;
    const nextAuth = pokeIdle?.Auth;
    const nextBus = pokeIdle?.Bus;

    if (!nextApi || typeof nextApi.getInventory !== "function"
      || !nextAuth || typeof nextAuth.isAuthenticated !== "function"
      || !nextBus || typeof nextBus.on !== "function") {
      retryTimer = setTimer(tryAttach, retryIntervalMs);
      return;
    }

    api = nextApi;
    auth = nextAuth;
    bus = nextBus;
    attached = true;

    for (const eventName of [...INVENTORY_EVENTS, AUTH_LOGGED_IN_EVENT]) {
      const handler = (payload) => onBusEvent(eventName, payload);
      handlers.set(eventName, handler);
      bus.on(eventName, handler, busContext);
    }

    if (isAuthenticated()) void refresh("startup");
  }

  function start() {
    tryAttach();
  }

  function dispose() {
    disposed = true;
    attached = false;
    authGeneration += 1;
    if (retryTimer !== null) clearTimer(retryTimer);
    clearRefreshTimer();
    retryTimer = null;
    pendingAfterFlight = false;
    pendingCause = null;
    detachBus();
    auth = null;
    api = null;
  }

  function getDiagnostics() {
    return {
      ...diagnostics,
      attached,
      inFlight: Boolean(refreshPromise),
      authenticated: isAuthenticated(),
      active: activeForNetwork(),
      authBlocked,
      nextEligibleAtMs: networkEligibleAt(),
      refreshDueAtMs: refreshDueAt || null,
      rateLimitStreak,
      transientFailureStreak
    };
  }

  return {
    start,
    refresh,
    dispose,
    getSnapshot: () => snapshot,
    getDiagnostics
  };
}
