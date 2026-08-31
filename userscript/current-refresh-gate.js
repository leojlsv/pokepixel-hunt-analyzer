export function createCurrentRefreshGate(task, { now = Date.now } = {}) {
  if (typeof task !== "function") {
    throw new TypeError("createCurrentRefreshGate requires task");
  }

  let inFlight = null;
  let rerunRequested = false;
  let requests = 0;
  let runs = 0;
  let coalescedRequests = 0;
  let reruns = 0;
  let lastDurationMs = null;
  let maxDurationMs = 0;

  async function drain() {
    let isRerun = false;
    let firstError = null;

    do {
      if (isRerun) reruns += 1;
      rerunRequested = false;
      runs += 1;

      const startedAt = now();
      try {
        await task();
      } catch (error) {
        firstError ??= error;
      } finally {
        const duration = Math.max(0, now() - startedAt);
        lastDurationMs = duration;
        maxDurationMs = Math.max(maxDurationMs, duration);
      }

      isRerun = rerunRequested;
    } while (rerunRequested);

    if (firstError) throw firstError;
  }

  function run() {
    requests += 1;

    if (inFlight) {
      rerunRequested = true;
      coalescedRequests += 1;
      return inFlight;
    }

    inFlight = drain().finally(() => {
      inFlight = null;
    });

    return inFlight;
  }

  function snapshot() {
    return {
      inFlight: Boolean(inFlight),
      rerunRequested,
      requests,
      runs,
      coalescedRequests,
      reruns,
      lastDurationMs,
      maxDurationMs
    };
  }

  return { run, snapshot };
}
