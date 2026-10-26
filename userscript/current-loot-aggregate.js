import {
  aggregateLootHistory,
  lootItemEntries,
  safeLootAmount
} from "./loot-history-model.js";

const EMPTY_ITEMS = new Map();
const EMPTY_CONTRIBUTION = {
  directGold: 0,
  lootSellValue: 0,
  autoSellValue: 0,
  looted: false,
  items: EMPTY_ITEMS
};

function contribution(row) {
  return {
    directGold: safeLootAmount(row.gold),
    lootSellValue: safeLootAmount(row.lootSellValue),
    autoSellValue: row.autoSold === true ? safeLootAmount(row.autoSellValue) : 0,
    looted: Number.isFinite(row.lootAtMs),
    speciesId: String(row.speciesId || row.speciesName || ""),
    speciesName: row.speciesName || row.speciesId || "Unknown Pokémon",
    items: lootItemEntries(row)
  };
}

function sameContribution(left, right) {
  if (!left || !right) return left === right;
  if (left.directGold !== right.directGold
    || left.lootSellValue !== right.lootSellValue
    || left.autoSellValue !== right.autoSellValue
    || left.looted !== right.looted
    || left.speciesId !== right.speciesId
    || left.speciesName !== right.speciesName
    || left.items.size !== right.items.size) return false;
  for (const [itemId, qty] of left.items) {
    if (right.items.get(itemId) !== qty) return false;
  }
  return true;
}

function changesVisibleLoot(left, right) {
  const previous = left || EMPTY_CONTRIBUTION;
  const next = right || EMPTY_CONTRIBUTION;
  if (previous.directGold !== next.directGold
    || previous.lootSellValue !== next.lootSellValue
    || previous.autoSellValue !== next.autoSellValue
    || previous.looted !== next.looted) return true;
  const oldItems = left?.items || EMPTY_ITEMS;
  const newItems = right?.items || EMPTY_ITEMS;
  if (oldItems.size !== newItems.size) return true;
  for (const [itemId, qty] of oldItems) {
    if (newItems.get(itemId) !== qty) return true;
  }
  return oldItems.size > 0 && (left.speciesId !== right.speciesId
    || left.speciesName !== right.speciesName);
}

function recordId(row) {
  return typeof row?.encounterId === "string" && row.encounterId
    ? row.encounterId
    : null;
}

function compareLootEntries(a, b) {
  return b.qty - a.qty || b.drops - a.drops
    || a.itemId?.localeCompare(b.itemId)
    || a.speciesName?.localeCompare(b.speciesName)
    || 0;
}

/**
 * Current owns the ordered session snapshot, while the pipeline owns reliable
 * before/after transitions. Neither an unchanged clock tick nor an accepted
 * event needs another walk over the entire Hunt to aggregate Loot.
 */
export function createCurrentLootAccumulator() {
  let records = new Map();
  let items = new Map();
  let nextOrdinal = 0;
  let canApplyDeltas = true;
  let matchedEncounters = 0;
  let lootedEncounters = 0;
  let directGold = 0;
  let lootSellValue = 0;
  let autoSellValue = 0;
  let snapshot = null;

  function reset() {
    records = new Map();
    items = new Map();
    nextOrdinal = 0;
    canApplyDeltas = true;
    matchedEncounters = 0;
    lootedEncounters = 0;
    directGold = 0;
    lootSellValue = 0;
    autoSellValue = 0;
  }

  function refreshFirstSource(source, itemId, excludedId) {
    source.firstId = null;
    source.firstOrdinal = Infinity;
    // Corrections/removals of the oldest item source are uncommon. Reuse the
    // canonical contribution map for this exceptional scan rather than retain
    // one extra Set member for every encounter/item during a long Hunt.
    // `records` preserves increasing `ordinal`: hydrate inserts in indexed
    // encounter order, corrections keep their Map position, and newly seen
    // records append. The first eligible member is therefore authoritative.
    for (const [id, member] of records) {
      if (id === excludedId || member.value.speciesId !== source.speciesId
        || !member.value.items.has(itemId)) continue;
      source.firstId = id;
      source.firstOrdinal = member.ordinal;
      source.speciesName = member.value.speciesName;
      break;
    }
  }

  function addDrop(id, row, ordinal, itemId, qty) {
    let item = items.get(itemId);
    if (!item) {
      item = { itemId, qty: 0, drops: 0, sources: new Map() };
      items.set(itemId, item);
    }
    item.qty += qty;
    item.drops += 1;

    let source = item.sources.get(row.speciesId);
    if (!source) {
      source = {
        speciesId: row.speciesId,
        speciesName: row.speciesName,
        firstId: null,
        firstOrdinal: Infinity,
        qty: 0,
        drops: 0,
      };
      item.sources.set(row.speciesId, source);
    }
    source.qty += qty;
    source.drops += 1;
    if (ordinal < source.firstOrdinal) {
      source.firstId = id;
      source.firstOrdinal = ordinal;
      source.speciesName = row.speciesName;
    }
  }

  function removeDrop(id, row, itemId, qty) {
    const item = items.get(itemId);
    const source = item.sources.get(row.speciesId);
    item.qty -= qty;
    item.drops -= 1;
    source.qty -= qty;
    source.drops -= 1;
    if (source.drops === 0) {
      item.sources.delete(row.speciesId);
    } else if (source.firstId === id) {
      refreshFirstSource(source, itemId, id);
    }
    if (item.drops === 0) items.delete(itemId);
  }

  function replaceRecord(id, previous, next, ordinal) {
    matchedEncounters += Number(Boolean(next)) - Number(Boolean(previous));
    lootedEncounters += Number(Boolean(next?.looted)) - Number(Boolean(previous?.looted));
    directGold += (next?.directGold || 0) - (previous?.directGold || 0);
    lootSellValue += (next?.lootSellValue || 0) - (previous?.lootSellValue || 0);
    autoSellValue += (next?.autoSellValue || 0) - (previous?.autoSellValue || 0);

    const oldItems = previous?.items || EMPTY_ITEMS;
    const newItems = next?.items || EMPTY_ITEMS;
    for (const itemId of new Set([...oldItems.keys(), ...newItems.keys()])) {
      const oldQty = oldItems.get(itemId) || 0;
      const newQty = newItems.get(itemId) || 0;
      if (oldQty && newQty && previous.speciesId === next.speciesId) {
        const item = items.get(itemId);
        const source = item.sources.get(previous.speciesId);
        item.qty += newQty - oldQty;
        source.qty += newQty - oldQty;
        if (source.firstId === id) source.speciesName = next.speciesName;
        continue;
      }
      if (oldQty) removeDrop(id, previous, itemId, oldQty);
      if (newQty) addDrop(id, next, ordinal, itemId, newQty);
    }
  }

  function buildSnapshot() {
    const resultItems = [...items.values()].map((item) => ({
      itemId: item.itemId,
      qty: item.qty,
      drops: item.drops,
      sources: [...item.sources.values()].map((source) => ({
        speciesId: source.speciesId,
        speciesName: source.speciesName,
        qty: source.qty,
        drops: source.drops
      })).sort(compareLootEntries)
    })).sort(compareLootEntries);
    return {
      totals: {
        directGold,
        lootSellValue,
        autoSellValue,
        total: directGold + lootSellValue + autoSellValue
      },
      matchedEncounters,
      lootedEncounters,
      matchedSessions: matchedEncounters > 0 ? 1 : 0,
      items: resultItems
    };
  }

  function hydrate(encounters = [], { sessionId = null } = {}) {
    reset();
    const rows = sessionId == null ? [] : encounters;
    for (const row of rows) {
      const id = recordId(row);
      if (!id || records.has(id)) {
        // Legacy/malformed snapshots may have duplicate or absent IDs.
        // They retain History's exact behavior, but cannot accept key deltas.
        reset();
        canApplyDeltas = false;
        snapshot = aggregateLootHistory(
          sessionId == null ? [] : [{ session: { sessionId }, encounters: rows }]
        );
        return snapshot;
      }
      const current = contribution(row);
      const ordinal = nextOrdinal++;
      replaceRecord(id, null, current, ordinal);
      records.set(id, { ordinal, value: current });
    }
    snapshot = buildSnapshot();
    return snapshot;
  }

  function applyChanges(changes, { sessionId = null, encounterCount } = {}) {
    if (!canApplyDeltas || !Array.isArray(changes) || !Number.isSafeInteger(encounterCount)) {
      return { applied: false, changed: false, visibleChanged: false };
    }

    // Validate every before/after transition before mutating the aggregate.
    // Repeated IDs within one batch are legal if their intermediates agree.
    const proposed = new Map();
    for (const change of changes) {
      if (!change || !Object.hasOwn(change, "previous") || !Object.hasOwn(change, "next")) {
        return { applied: false, changed: false, visibleChanged: false };
      }
      const { previous, next } = change;
      const id = recordId(previous) || recordId(next);
      if (!id || (previous != null && recordId(previous) !== id)
        || (next != null && recordId(next) !== id)
        || (previous?.sessionId != null && previous.sessionId !== sessionId)
        || (next?.sessionId != null && next.sessionId !== sessionId)) {
        return { applied: false, changed: false, visibleChanged: false };
      }
      const cached = proposed.has(id)
        ? proposed.get(id)
        : records.get(id)?.value || null;
      const expected = previous == null ? null : contribution(previous);
      if (!sameContribution(cached, expected)) {
        return { applied: false, changed: false, visibleChanged: false };
      }
      proposed.set(id, next == null ? null : contribution(next));
    }

    let nextCount = records.size;
    for (const [id, value] of proposed) {
      nextCount += Number(Boolean(value)) - Number(records.has(id));
    }
    if (nextCount !== encounterCount) {
      return { applied: false, changed: false, visibleChanged: false };
    }

    let changed = false;
    let visibleChanged = false;
    for (const [id, value] of proposed) {
      const previous = records.get(id);
      if (sameContribution(previous?.value || null, value)) continue;
      if (changesVisibleLoot(previous?.value || null, value)) visibleChanged = true;
      const ordinal = previous?.ordinal ?? nextOrdinal++;
      replaceRecord(id, previous?.value || null, value, ordinal);
      if (value) records.set(id, { ordinal, value });
      else records.delete(id);
      changed = true;
    }
    if (changed) {
      snapshot = visibleChanged
        ? buildSnapshot()
        : { ...snapshot, matchedEncounters, matchedSessions: matchedEncounters > 0 ? 1 : 0 };
    }
    return { applied: true, changed, visibleChanged };
  }

  return { hydrate, applyChanges, getSummary: () => snapshot };
}
