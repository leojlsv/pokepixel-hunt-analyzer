/** Encounter-derived Closed HUD fields, maintained at the Current cache boundary. */
function ivTotal(row) {
  if (!row) return null;
  const value = Number(row.ivTotal);
  return Number.isFinite(value) ? value : null;
}

function ballContribution(row) {
  if (!row || (row.captureResult !== "success" && row.captureResult !== "failed")) return null;
  const itemId = String(row.capsuleItemId || "");
  if (!itemId) return null;
  const cost = Number(row.supplyCost);
  return {
    itemId,
    used: 1,
    success: row.captureResult === "success" ? 1 : 0,
    failed: row.captureResult === "failed" ? 1 : 0,
    cost: Number.isFinite(cost) ? cost : 0
  };
}

function updateIv(index, value, delta) {
  if (value === null) return;
  const count = (index.ivCounts.get(value) || 0) + delta;
  if (count > 0) index.ivCounts.set(value, count);
  else index.ivCounts.delete(value);

  if (delta > 0 && (index.highestIv === null || value > index.highestIv)) {
    index.highestIv = value;
  } else if (delta < 0 && value === index.highestIv && !index.ivCounts.has(value)) {
    let highest = null;
    for (const candidate of index.ivCounts.keys()) {
      if (highest === null || candidate > highest) highest = candidate;
    }
    index.highestIv = highest;
  }
}

function updateBall(index, contribution, delta) {
  if (!contribution) return;
  const { itemId } = contribution;
  const previous = index.ballStats.get(itemId) || { used: 0, success: 0, failed: 0, cost: 0 };
  const updated = {
    used: previous.used + delta,
    success: previous.success + contribution.success * delta,
    failed: previous.failed + contribution.failed * delta,
    cost: previous.cost + contribution.cost * delta
  };
  if (updated.used === 0) index.ballStats.delete(itemId);
  else index.ballStats.set(itemId, updated);
  index.totalBallsUsed += delta;
}

export function updateHudEncounterAggregate(index, previous, next) {
  if (!index) return;
  updateIv(index, ivTotal(previous), -1);
  updateBall(index, ballContribution(previous), -1);
  updateIv(index, ivTotal(next), 1);
  updateBall(index, ballContribution(next), 1);
}

export function createHudEncounterAggregate(encounters = []) {
  const index = { ivCounts: new Map(), highestIv: null, ballStats: new Map(), totalBallsUsed: 0 };
  for (const row of encounters) updateHudEncounterAggregate(index, null, row);
  return index;
}

export function snapshotHudEncounterAggregate(index) {
  if (!index) return null;
  const ballStats = new Map([...index.ballStats].map(([itemId, bucket]) => [itemId, { ...bucket }]));
  return {
    highestIv: index.highestIv,
    ballStats,
    totalBallsUsed: index.totalBallsUsed,
    ballUsage: new Map([...ballStats].map(([itemId, bucket]) => [itemId, bucket.used]))
  };
}
