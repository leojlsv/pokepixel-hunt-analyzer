/** Manual deletion of Hunt analytics, preserving only Catch Gallery tickets. */
import { STORE_NAMES } from "./migrations.js";
import { archivedCatchGalleryRow } from "./catch-gallery-archive.js";
import {
  abortIfWriteGateLost,
  assertDatabaseWriteGate,
  WriteLeadershipLostError
} from "./write-gate.js";

const STORES = [
  STORE_NAMES.ENCOUNTERS,
  STORE_NAMES.SESSIONS,
  STORE_NAMES.CONFIGS,
  STORE_NAMES.META
];

export function clearAllAnalytics(db) {
  try { assertDatabaseWriteGate(db); } catch (error) { return Promise.reject(error); }

  return new Promise((resolve, reject) => {
    let tx;
    let gateLost = false;
    let failed = false;
    try {
      tx = db.transaction(STORES, "readwrite");
      let preservedGalleryCount = 0;
      function assertOwner() {
        if (!abortIfWriteGateLost(db, tx)) return true;
        gateLost = true;
        return false;
      }
      // Reading only ticket-eligible rows avoids cloning entire Hunt history.
      // All operations occur inside ONE transaction; no partial wipe or loss
      // of the gallery is possible if any clear/put request fails.
      const encounters = tx.objectStore(STORE_NAMES.ENCOUNTERS);
      const readTickets = encounters.index("captureTicketAtMs").getAll();
      readTickets.onsuccess = () => {
        if (!assertOwner()) return;
        const archived = readTickets.result
          .map(archivedCatchGalleryRow)
          .filter(Boolean);
        preservedGalleryCount = archived.length;
        for (const name of STORES) {
          const request = tx.objectStore(name).clear();
          request.onsuccess = () => { assertOwner(); };
        }
        // IndexedDB processes these puts after encounters.clear in order.
        for (const row of archived) {
          const request = encounters.put(row);
          request.onsuccess = () => { assertOwner(); };
        }
      };
      tx.oncomplete = () => resolve({
        clearedStores: [...STORES],
        preservedGalleryCount
      });
      tx.onabort = () => {
        if (failed) return;
        failed = true;
        reject(gateLost ? new WriteLeadershipLostError() : tx.error || new Error("Analytics deletion aborted"));
      };
      tx.onerror = () => {
        // Error events bubble to the transaction; its abort handler rejects.
      };
    } catch (error) {
      try { tx?.abort(); } catch {}
      if (!failed) reject(error);
    }
  });
}
