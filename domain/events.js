/**
 * Normalized protocol event contracts (docs/PROTOCOL_AND_ANALYTICS.md §2-5).
 *
 * Defensive, allowlist-based extraction: unknown event types and malformed
 * payloads are dropped (return null) rather than throwing. Fields keep their
 * protocol snake_case names so they plug directly into the existing domain
 * layer without a second translation step.
 *
 * Legacy PROD still provides the authoritative target snapshot through
 * combat.started. HuntSim DEV no longer does that for every encounter, so the
 * protocol adapter synthesizes combat.started with the fields the frame really
 * exposes and capture.success is allowed to enrich only fields that were
 * missing from that synthetic snapshot. creature.level remains deliberately
 * excluded because the captured creature can be rebased to a different level.
 */

export const EVENT_TYPES = Object.freeze([
  "combat.started",
  "loot.received",
  "capture.failed",
  "capture.success",
  "hunt.stopped",
  "hunt.analyzer_reset",
  "hunt.kill_closed"
]);

function str(value) {
  return typeof value === "string" ? value : null;
}

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bool(value) {
  return Boolean(value);
}

function nullableBool(value) {
  return typeof value === "boolean" ? value : null;
}

function plainObjectOrNull(value) {
  return value && typeof value === "object" ? value : null;
}

function strArrayOrNull(value) {
  if (!Array.isArray(value)) return null;
  return value.filter((item) => typeof item === "string");
}

function normalizeIvs(value) {
  const source = plainObjectOrNull(value);
  if (!source) return null;

  return {
    hp: num(source.hp),
    atk: num(source.atk),
    def: num(source.def),
    spa: num(source.spa),
    spd: num(source.spd),
    spe: num(source.spe)
  };
}

function normalizeCombatStarted(data) {
  const enemy = plainObjectOrNull(data.enemy);
  if (!enemy) return null;

  const session = plainObjectOrNull(data.session);

  return {
    enemy: {
      id: str(enemy.id),
      species_id: str(enemy.species_id),
      level: num(enemy.level),
      quality: str(enemy.quality),
      is_shiny: nullableBool(enemy.is_shiny),
      ivs: normalizeIvs(enemy.ivs),
      map_id: num(enemy.map_id),
      zone_id: str(enemy.zone_id),
      elements: strArrayOrNull(enemy.elements),
      gender: str(enemy.gender),
      nature: str(enemy.nature),
      quality_multiplier: num(enemy.quality_multiplier),
      // Internal canonical field emitted by the HuntSim adapter. Legacy wire
      // payloads do not carry it and therefore keep envelope.ts as before.
      started_at_ms: num(enemy.started_at_ms)
    },
    session: session
      ? {
          id: str(session.id),
          // Kept raw — domain/config.js normalizeAutoCapture() owns this shape.
          auto_capture: session.auto_capture ?? null
        }
      : null
  };
}

function normalizeLootReceived(data) {
  return {
    wild_monster_id: str(data.wild_monster_id),
    species_id: str(data.species_id),
    exp: num(data.exp),
    trainer_exp: num(data.trainer_exp),
    pokemon_exp: num(data.pokemon_exp),
    gold: num(data.gold),
    loot_sell_value: num(data.loot_sell_value),
    auto_potion_used: str(data.auto_potion_used),
    supply_cost: num(data.supply_cost)
  };
}

function normalizeCaptureFailed(data) {
  return {
    wild_monster_id: str(data.wild_monster_id),
    species_id: str(data.species_id),
    species_name: str(data.species_name),
    level: num(data.level),
    quality: str(data.quality),
    iv_total: num(data.iv_total),
    is_shiny: nullableBool(data.is_shiny),
    capsule_item_id: str(data.capsule_item_id),
    capsule_name: str(data.capsule_name),
    chance: num(data.chance),
    supply_cost: num(data.supply_cost)
  };
}

function normalizeCaptureSuccess(data) {
  const creature = plainObjectOrNull(data.creature);

  return {
    wild_monster_id: str(data.wild_monster_id),
    species_id: str(data.species_id),
    species_name: str(data.species_name),
    // DEV currently nests captured_by_name under creature while older payloads
    // may expose it at the event root. Accept both without changing storage.
    captured_by_name: str(data.captured_by_name) ?? str(creature?.captured_by_name),
    capsule_item_id: str(data.capsule_item_id),
    capsule_name: str(data.capsule_name),
    chance: num(data.chance),
    supply_cost: num(data.supply_cost),
    auto_sold: bool(data.auto_sold),
    auto_sell_value: num(data.auto_sell_value),
    creature: creature
      ? {
          species_id: str(creature.species_id),
          quality: str(creature.quality),
          is_shiny: nullableBool(creature.is_shiny),
          ivs: normalizeIvs(creature.ivs),
          elements: strArrayOrNull(creature.elements),
          gender: str(creature.gender),
          nature: str(creature.nature),
          quality_multiplier: num(creature.quality_multiplier),
          captured_by_name: str(creature.captured_by_name)
        }
      : null
  };
}

function normalizeSignalEvent() {
  return {};
}

function normalizeKillClosed(data) {
  return {
    wild_monster_id: str(data.wild_monster_id)
  };
}

const NORMALIZERS = Object.freeze({
  "combat.started": normalizeCombatStarted,
  "loot.received": normalizeLootReceived,
  "capture.failed": normalizeCaptureFailed,
  "capture.success": normalizeCaptureSuccess,
  "hunt.stopped": normalizeSignalEvent,
  "hunt.analyzer_reset": normalizeSignalEvent,
  "hunt.kill_closed": normalizeKillClosed
});

/**
 * Normalizes one canonical event's `data` payload for `type`. Returns null for
 * an unrecognized type or a malformed/missing payload — callers must treat
 * null as "ignore this event", not as an error.
 */
export function normalizeEvent(type, data) {
  const normalizer = NORMALIZERS[type];
  if (!normalizer) return null;
  if (!data || typeof data !== "object") return null;

  return normalizer(data);
}
