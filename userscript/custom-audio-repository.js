export const CUSTOM_AUDIO_DB_NAME = "pokepixel_hunt_analyzer_assets";
export const CUSTOM_AUDIO_DB_VERSION = 1;
export const CUSTOM_AUDIO_STORE = "audio";

export const CUSTOM_AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const CUSTOM_AUDIO_MAX_DURATION_SECONDS = 10;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}

export function createCustomAudioRepository(indexedDBImpl = globalThis.indexedDB) {
  let dbPromise = null;

  function open() {
    if (!indexedDBImpl) {
      return Promise.reject(new Error("IndexedDB is unavailable"));
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDBImpl.open(CUSTOM_AUDIO_DB_NAME, CUSTOM_AUDIO_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CUSTOM_AUDIO_STORE)) {
          db.createObjectStore(CUSTOM_AUDIO_STORE, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error("Unable to open custom audio database"));
      };

      request.onblocked = () => {
        dbPromise = null;
        reject(new Error("Custom audio database upgrade is blocked"));
      };
    });

    return dbPromise;
  }

  async function get(key) {
    const db = await open();
    const transaction = db.transaction(CUSTOM_AUDIO_STORE, "readonly");
    return requestToPromise(transaction.objectStore(CUSTOM_AUDIO_STORE).get(key));
  }

  async function has(key) {
    return Boolean(await get(key));
  }

  async function put(record) {
    if (!record || typeof record !== "object") throw new TypeError("Custom audio record is required");
    if (!record.key) throw new TypeError("Custom audio record key is required");
    if (!(record.data instanceof ArrayBuffer)) throw new TypeError("Custom audio data must be an ArrayBuffer");

    const db = await open();
    const transaction = db.transaction(CUSTOM_AUDIO_STORE, "readwrite");
    transaction.objectStore(CUSTOM_AUDIO_STORE).put(record);
    await transactionDone(transaction);
    return record;
  }

  async function remove(key) {
    const db = await open();
    const transaction = db.transaction(CUSTOM_AUDIO_STORE, "readwrite");
    transaction.objectStore(CUSTOM_AUDIO_STORE).delete(key);
    await transactionDone(transaction);
  }

  async function list() {
    const db = await open();
    const transaction = db.transaction(CUSTOM_AUDIO_STORE, "readonly");
    return requestToPromise(transaction.objectStore(CUSTOM_AUDIO_STORE).getAll());
  }

  return Object.freeze({ open, get, has, put, remove, list });
}
