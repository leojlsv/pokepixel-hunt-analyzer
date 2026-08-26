/**
 * Automatic Hunt lifecycle — session-boundary decision
 * (docs/ARCHITECTURE.md §7 "Automatic Hunt lifecycle").
 *
 * Only `combat.started` carries both `serverSessionId` (session.id) and
 * `zoneId` (enemy.zone_id) together, which is why it's the "preferred
 * authoritative confirmation" for this decision — every call site passes
 * data derived from that event only.
 *
 * Pure and side-effect free: callers (services/eventPipeline.js) turn the
 * returned action into actual session reads/writes.
 */

export function decideSessionTransition(current, observed) {
  const currentServerSessionId = current?.serverSessionId ?? null;
  const currentZoneId = current?.zoneId ?? null;
  const observedServerSessionId = observed?.serverSessionId ?? null;
  const observedZoneId = observed?.zoneId ?? null;

  // No server-provided identity to compare against — nothing to decide.
  if (!observedServerSessionId) {
    return { action: "none" };
  }

  // First combat.started this local session has ever seen.
  if (!currentServerSessionId) {
    return { action: "adopt" };
  }

  if (observedServerSessionId !== currentServerSessionId) {
    return { action: "new_hunt" };
  }

  // A confirmed encounter in a different zone is a Hunt boundary even when
  // the server keeps the same session id. This keeps one local Hunt aligned
  // with one hunting zone instead of blending metrics across target areas.
  if (currentZoneId && observedZoneId && observedZoneId !== currentZoneId) {
    return { action: "new_hunt" };
  }

  return { action: "none" };
}
