export function buildTerminalAlert(envelope, state) {
  if (!envelope || !["capture.success", "capture.failed"].includes(envelope.type)) {
    return null;
  }

  const data = envelope.data || {};
  const wildMonsterId = data.wild_monster_id;
  const encounterId = wildMonsterId
    ? state?.activeByWildMonsterId?.get(wildMonsterId)
    : undefined;
  const existing = encounterId ? state?.inProgress?.get(encounterId) : undefined;
  const fallback = envelope.type === "capture.failed" ? data : data.creature;

  return {
    result: envelope.type === "capture.success" ? "captured" : "fled",
    rarity: existing?.quality ?? fallback?.quality ?? null,
    isShiny: (existing?.isShiny ?? fallback?.is_shiny) === true
  };
}
