const DEFAULT_LOCK_KEY = "pokepixel_hunt_analyzer_active_tab";
const DEFAULT_TTL_MS = 6_000;

export function createTabLeadership({
  storage = localStorage,
  key = DEFAULT_LOCK_KEY,
  ttlMs = DEFAULT_TTL_MS,
  tabId = crypto.randomUUID(),
  now = () => Date.now(),
  onChange = () => {}
} = {}) {
  let active = false;

  function readLock() {
    try {
      const value = JSON.parse(storage.getItem(key) || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function writeLock(timestamp) {
    storage.setItem(key, JSON.stringify({
      tabId,
      expiresAt: timestamp + ttlMs
    }));
  }

  function setActive(next) {
    if (active === next) return;
    active = next;
    onChange(active);
  }

  function refresh() {
    const timestamp = now();
    const lock = readLock();

    if (!lock || lock.tabId === tabId || Number(lock.expiresAt) <= timestamp) {
      writeLock(timestamp);
      setActive(true);
      return true;
    }

    setActive(false);
    return false;
  }

  function release() {
    const lock = readLock();
    if (lock?.tabId === tabId) storage.removeItem(key);
    setActive(false);
  }

  return {
    refresh,
    release,
    isActive: () => active
  };
}
