function candidateFromEncounter(encounter) {
  if (!encounter || !["success", "failed"].includes(encounter.captureResult)) return null;
  const chance = encounter.captureChance;
  const atMs = encounter.captureAtMs;
  if (!Number.isFinite(chance) || chance < 0 || chance > 1 || !Number.isFinite(atMs)) return null;
  return {
    chance,
    atMs,
    tieKey: String(encounter.encounterId || "")
  };
}

export function updateLatestCaptureAttempt(current, encounter) {
  const candidate = candidateFromEncounter(encounter);
  if (!candidate) return current || null;
  if (!current) return candidate;
  if (candidate.atMs > current.atMs) return candidate;
  if (candidate.atMs < current.atMs) return current;
  return candidate.tieKey >= String(current.tieKey || "") ? candidate : current;
}

export function latestCaptureAttemptFromRows(encounters = []) {
  let latest = null;
  for (const encounter of encounters || []) {
    latest = updateLatestCaptureAttempt(latest, encounter);
  }
  return latest;
}
