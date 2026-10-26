/**
 * Exact, bounded comparison of persisted before-images against the Current
 * cache. JSON.stringify is NOT suitable for this integrity check: it
 * serializes NaN/Infinity as null, omits undefined properties, and throws for
 * BigInt. On an unsupported structured-clone type, cycle, shared reference,
 * accessor, or excessive nesting, return false so callers reload from IDB.
 *
 * This is an in-process cache consistency guard, NOT an authentication or
 * writer-authority mechanism.
 */
export function sameEncounterCacheImage(left, right) {
  const seenLeft = new WeakSet();
  const seenRight = new WeakSet();
  let budget = 20_000;
  function equals(a, b, depth) {
    if (--budget < 0 || depth > 64) return false;
    if (a === null || b === null ||
        typeof a !== "object" || typeof b !== "object") {
      return Object.is(a, b);
    }
    if (Array.isArray(a) !== Array.isArray(b) ||
        seenLeft.has(a) || seenRight.has(b)) return false;
    // IndexedDB and userscript sandbox objects can come from different JS
    // realms: their Object.prototype is not this realm's Object.prototype.
    // A plain object has a null prototype's prototype in any realm.
    const supported = value => {
      if (Array.isArray(value)) return true;
      const prototype = Object.getPrototypeOf(value);
      return prototype === null ||
        (Object.getPrototypeOf(prototype) === null &&
          Object.prototype.toString.call(value) === "[object Object]");
    };
    if (!supported(a) || !supported(b)) return false;
    seenLeft.add(a);
    seenRight.add(b);
    if (Array.isArray(a) && a.length !== b.length) return false;
    if (Object.getOwnPropertySymbols(a).length ||
        Object.getOwnPropertySymbols(b).length) return false;
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) return false;
      const da = Object.getOwnPropertyDescriptor(a, keysA[i]);
      const db = Object.getOwnPropertyDescriptor(b, keysB[i]);
      if (!da || !db || !("value" in da) || !("value" in db) ||
          !equals(da.value, db.value, depth + 1)) return false;
    }
    return true;
  }
  try {
    return equals(left, right, 0);
  } catch {
    // Revoked/proxied or otherwise exotic input must trigger IDB recovery,
    // never abort processing of an already committed encounter transition.
    return false;
  }
}
