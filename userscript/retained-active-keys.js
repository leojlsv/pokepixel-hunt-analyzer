/**
 * Reconcile currently live encounter IDs against the freshly hydrated source.
 * Do not allocate an O(all encounters) temporary Set just to retain the tiny
 * live subset. Preserve the legacy String(id || '') matching semantics.
 */
export function retainLiveActiveKeys(activeKeys, encounters) {
  const valid = new Set();
  if (!activeKeys?.size) return valid;
  for (const encounter of encounters || []) {
    const key = String(encounter?.encounterId || "");
    if (key && activeKeys.has(key)) valid.add(key);
    if (valid.size === activeKeys.size) break;
  }
  return valid;
}
