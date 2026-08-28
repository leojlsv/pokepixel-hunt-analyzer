const INVENTORY_REFRESH_DELAY_MS = 2_150;
const INVENTORY_FAST_REFRESH_DELAY_MS = 150;
const INVENTORY_RETRY_MS = 500;

const INVENTORY_EVENTS = Object.freeze([
  "inventory.updated",
  "capture.success",
  "capture.failed",
  "loot.received"
]);

function itemQuantity(item) {
  const value = Number(item?.qty ?? item?.quantity ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeItems(response) {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export function normalizeInventorySnapshot(response, updatedAtMs = Date.now()) {
  const items = normalizeItems(response).map((item) => ({
    ...item,
    item_id: String(item?.item_id ?? item?.id ?? ""),
    qty: itemQuantity(item),
    quantity: itemQuantity(item)
  }));

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

export function createInventoryState({
  pageWindow,
  onChange = () => {},
  retryIntervalMs = INVENTORY_RETRY_MS
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
  let bus = null;
  let disposed = false;
  let attached = false;
  let retryTimer = null;
  let refreshTimer = null;
  let refreshDueAt = 0;
  let refreshPromise = null;
  const handlers = new Map();
  const busContext = {};

  function emit() {
    onChange(snapshot);
  }

  async function refresh() {
    if (disposed || !api?.getInventory) return snapshot;
    if (refreshPromise) return refreshPromise;

    refreshPromise = Promise.resolve()
      .then(() => api.getInventory())
      .then((response) => {
        if (disposed) return snapshot;
        snapshot = normalizeInventorySnapshot(response);
        emit();
        return snapshot;
      })
      .catch((error) => {
        console.warn("PokePixel Hunt Analyzer (inventory snapshot):", error);
        return snapshot;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  function scheduleRefresh(delayMs = INVENTORY_REFRESH_DELAY_MS) {
    if (disposed || !api?.getInventory) return;
    const dueAt = Date.now() + Math.max(0, Number(delayMs) || 0);
    if (refreshTimer && refreshDueAt <= dueAt) return;

    if (refreshTimer) clearTimeout(refreshTimer);
    refreshDueAt = dueAt;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refreshDueAt = 0;
      void refresh();
    }, Math.max(0, dueAt - Date.now()));
  }

  function onBusEvent(eventName, payload) {
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
      scheduleRefresh(INVENTORY_REFRESH_DELAY_MS);
      return;
    }

    if (eventName === "inventory.updated") {
      scheduleRefresh(INVENTORY_FAST_REFRESH_DELAY_MS);
      return;
    }

    // Potion consumption is signalled by loot.received in the current game
    // client, but the payload does not always expose a stable potion item id.
    // Reconcile from the authoritative inventory snapshot instead of guessing.
    scheduleRefresh(INVENTORY_REFRESH_DELAY_MS);
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
    const nextBus = pokeIdle?.Bus;

    if (!nextApi || typeof nextApi.getInventory !== "function" || !nextBus || typeof nextBus.on !== "function") {
      retryTimer = setTimeout(tryAttach, retryIntervalMs);
      return;
    }

    api = nextApi;
    bus = nextBus;
    attached = true;

    for (const eventName of INVENTORY_EVENTS) {
      const handler = (payload) => onBusEvent(eventName, payload);
      handlers.set(eventName, handler);
      bus.on(eventName, handler, busContext);
    }

    void refresh();
  }

  function start() {
    tryAttach();
  }

  function dispose() {
    disposed = true;
    attached = false;
    if (retryTimer) clearTimeout(retryTimer);
    if (refreshTimer) clearTimeout(refreshTimer);
    retryTimer = null;
    refreshTimer = null;
    refreshDueAt = 0;
    detachBus();
  }

  return {
    start,
    refresh,
    dispose,
    getSnapshot: () => snapshot
  };
}
