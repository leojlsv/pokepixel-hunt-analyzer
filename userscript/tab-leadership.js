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
  let webLockDecision = null;
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
    if (stopped) return Promise.resolve(false);
    if (webLockDecision) return webLockDecision;
    if (webLockRequest) return Promise.resolve(isActive());

    let resolveDecision;
    webLockDecision = new Promise((resolve) => {
      resolveDecision = resolve;
    });
    const decision = webLockDecision;

    function settleDecision(value) {
      resolveDecision(value);
      if (webLockDecision === decision) webLockDecision = null;
    }

    webLockRequest = Promise.resolve()
      .then(() => lockManager.request(
        key,
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (!lock || stopped || !refreshLease()) {
            settleDecision(false);
            return;
          }

          setActive(true);
          settleDecision(true);
          await new Promise((resolve) => {
            releaseWebLock = resolve;
          });
          releaseWebLock = null;
          setActive(false);
        }
      ))
      .catch(() => {
        // A broken Web Locks implementation falls back to the same verified
        // lease used when Web Locks are unavailable.
        lockManager = null;
        const ownsLease = stopped ? false : refreshLease();
        setActive(ownsLease);
        settleDecision(ownsLease);
      })
      .finally(() => {
        webLockRequest = null;
      });

    return decision;
  }

  async function acquire() {
    if (stopped) return false;

    if (!lockManager) {
      const ownsLease = refreshLease();
      setActive(ownsLease);
      return ownsLease;
    }

    if (active) return isActive();
    return requestWebLock();
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
    acquire,
    refresh,
    release,
    isActive
  };
}
