const DEFAULT_LOCK_KEY = "pokepixel_hunt_analyzer_active_tab";
const DEFAULT_TTL_MS = 6_000;

export function createTabLeadership({
  storage = localStorage,
  key = DEFAULT_LOCK_KEY,
  ttlMs = DEFAULT_TTL_MS,
  tabId = crypto.randomUUID(),
  now = () => Date.now(),
  onChange = () => {},
  lockManager = globalThis.navigator?.locks ?? null
} = {}) {
  let active = false;
  let stopped = false;
  let webLockRequest = null;
  let releaseWebLock = null;

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

  function refreshLease() {
    const timestamp = now();
    const lock = readLock();

    if (!lock || lock.tabId === tabId || Number(lock.expiresAt) <= timestamp) {
      writeLock(timestamp);
      return readLock()?.tabId === tabId;
    }

    return false;
  }

  function requestWebLock() {
    if (webLockRequest || stopped) return;

    webLockRequest = Promise.resolve()
      .then(() => lockManager.request(
        key,
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (!lock || stopped || !refreshLease()) return;

          setActive(true);
          await new Promise((resolve) => {
            releaseWebLock = resolve;
          });
          releaseWebLock = null;
          setActive(false);
        }
      ))
      .catch(() => {
        // A broken Web Locks implementation falls back to the verified lease
        // on the next refresh rather than leaving the Analyzer permanently idle.
        lockManager = null;
      })
      .finally(() => {
        webLockRequest = null;
      });
  }

  function refresh() {
    if (stopped) return false;

    if (lockManager) {
      if (active && !refreshLease()) {
        releaseWebLock?.();
        setActive(false);
      }
      requestWebLock();
      return active;
    }

    const ownsLease = refreshLease();
    setActive(ownsLease);
    return ownsLease;
  }

  function isActive() {
    if (!active || stopped) return false;

    const ownsLease = readLock()?.tabId === tabId;
    if (!ownsLease) {
      releaseWebLock?.();
      setActive(false);
    }
    return ownsLease;
  }

  function release() {
    stopped = true;
    releaseWebLock?.();
    const lock = readLock();
    if (lock?.tabId === tabId) storage.removeItem(key);
    setActive(false);
  }

  return {
    refresh,
    release,
    isActive
  };
}
