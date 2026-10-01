/**
 * Optional runtime-only write gate. Tests and read-only consumers can use
 * repositories without one. The ACTIVE tab registers its leadership check
 * once, so every per-store mutation rechecks ownership at request success
 * (while IndexedDB still permits aborting the transaction).
 *
 * This prevents a queued IDB request from committing after a detected
 * takeover; a localStorage lease and an IDB commit are still distinct
 * coordination systems, not an atomic cross-tab fencing protocol.
 */
const gates = new WeakMap();

export class WriteLeadershipLostError extends Error {
  constructor() {
    super("The Analyzer tab no longer owns write leadership");
    this.name = "WriteLeadershipLostError";
  }
}

export function registerDatabaseWriteGate(db, isActive) {
  if (typeof isActive !== "function") {
    throw new TypeError("registerDatabaseWriteGate requires an ownership callback");
  }
  gates.set(db, isActive);
}

export function hasDatabaseWriteGate(db) {
  return gates.has(db);
}

export function assertDatabaseWriteGate(db) {
  if (gates.has(db) && !gates.get(db)()) {
    throw new WriteLeadershipLostError();
  }
}

export function abortIfWriteGateLost(db, transaction) {
  try {
    assertDatabaseWriteGate(db);
    return false;
  } catch {
    try {
      transaction.abort();
    } catch {
      // The transaction may already have committed/aborted.
    }
    return true;
  }
}

/**
 * A guarded, single-request write. Resolve only on transaction completion,
 * not on the earlier request success, and abort a pending transaction if
 * leadership was lost while its IDB operation was in progress.
 */
export function writeWithGate(db, storeName, operation) {
  try {
    assertDatabaseWriteGate(db);
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    let tx;
    let result;
    let rejectedByGate = false;
    try {
      tx = db.transaction(storeName, "readwrite");
      const request = operation(tx.objectStore(storeName));

      request.addEventListener("success", () => {
        if (abortIfWriteGateLost(db, tx)) {
          rejectedByGate = true;
          return;
        }
        result = request.result;
        tx.commit?.();
      });
      request.addEventListener("error", () => reject(request.error));
      tx.addEventListener("complete", () => resolve(result));
      tx.addEventListener("abort", () => reject(
        rejectedByGate ? new WriteLeadershipLostError() : tx.error ?? new Error("IndexedDB write aborted")
      ));
    } catch (error) {
      try { tx?.abort(); } catch {}
      reject(error);
    }
  });
}
