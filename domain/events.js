/**
 * Normalized protocol event contracts (docs/PROTOCOL_AND_ANALYTICS.md §2-5).
 *
 * Defensive, allowlist-based extraction — same spirit as `hook.js`'s
 * current parsing: unknown event types and malformed payloads are dropped
 * (return null) rather than throwing. Fields keep their protocol
 * snake_case names (enemy.species_id, session.auto_capture, ...) so they
 * plug directly into domain/config.js's `normalizeAutoCapture`, which
 * already expects that exact shape — no separate translation layer.
 *
 * `creature.quality`/`creature.is_shiny`/`creature.ivs` are normalized
 * here (they're on the wire) but domain/encounterTracker.js never uses
 * them to patch an encounter row. `creature.level`, `creature.species_id`,
 * `creature.elements`, `creature.gender`, `creature.nature` and
 * `creature.quality_multiplier` aren't even extracted. The doc explicitly
 * forbids using the captured creature's level as the target level (it can
 * be a wholly different value — e.g. an egg/baby level), and the same
 * policy extends to every other per-individual attribute the captured
 * creature carries — the target's own snapshot from `combat.started` is
 * the only source of truth for those fields.
 */

export const EVENT_TYPES = Object.freeze([
  "combat.started",
  "loot.received",
  "capture.failed",
  "capture.success",
  "hunt.stopped",
  "hunt.analyzer_reset"
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

function plainObjectOrNull(value) {
  return value && typeof value === "object" ? value : null;
}

function strArrayOrNull(value) {
  if (!Array.isArray(value)) return null;
  return value.filter((item) => typeof item === "string");
}

// domain/ivTotal.js's sumIvs() only needs the 6 stats to be numbers (or
// safely coerce to 0); this is the strict-validation layer hook.js's own
// comment refers to — each stat individually defaults to null instead of
// leaving the whole object unvalidated.
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
      is_shiny: bool(enemy.is_shiny),
      ivs: normalizeIvs(enemy.ivs),
      map_id: num(enemy.map_id),
      zone_id: str(enemy.zone_id),
      // Fase 4 subtask — confirmed in a real capture
      // (combat.started.data.enemy): array of element strings, and two
      // plain informational values (not validated against a fixed enum;
      // the game's own value set drives any UI built on top of these).
      elements: strArrayOrNull(enemy.elements),
      gender: str(enemy.gender),
      nature: str(enemy.nature),
      // Continuous quality score (e.g. 1.02), distinct from the discrete
      // `quality` tier — confirmed in a real capture. Only ever from
      // combat.started; capture.failed doesn't carry it at all.
      quality_multiplier: num(enemy.quality_multiplier)
    },
    session: session
      ? {
          id: str(session.id),
          // Kept raw — domain/config.js normalizeAutoCapture() is the one
          // place that fixes this shape.
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
    // Confirmed in real captures: loot.received without a wild_monster_id
    // but with auto_potion_used is the game auto-drinking a potion mid-fight
    // — a trainer-wide expense, not tied to any specific wild encounter.
    // supply_cost here is that potion's real cost (same field name the
    // protocol reuses on capture.failed/success for the capsule cost).
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
    is_shiny: bool(data.is_shiny),
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
    capsule_item_id: str(data.capsule_item_id),
    capsule_name: str(data.capsule_name),
    chance: num(data.chance),
    supply_cost: num(data.supply_cost),
    auto_sold: bool(data.auto_sold),
    auto_sell_value: num(data.auto_sell_value),
    creature: creature
      ? {
          quality: str(creature.quality),
          is_shiny: bool(creature.is_shiny),
          ivs: plainObjectOrNull(creature.ivs)
        }
      : null
  };
}

// hunt.stopped / hunt.analyzer_reset only matter as *signals* for the
// session clock (pause / activity) — no payload field feeds analytics
// (docs/ARCHITECTURE.md §7), so nothing is extracted from them.
function normalizeSignalEvent() {
  return {};
}

const NORMALIZERS = Object.freeze({
  "combat.started": normalizeCombatStarted,
  "loot.received": normalizeLootReceived,
  "capture.failed": normalizeCaptureFailed,
  "capture.success": normalizeCaptureSuccess,
  "hunt.stopped": normalizeSignalEvent,
  "hunt.analyzer_reset": normalizeSignalEvent
});

/**
 * Normalizes one protocol event's `data` payload for `type`. Returns null
 * for an unrecognized type or a malformed/missing payload — callers must
 * treat null as "ignore this event", not as an error.
 */
export function normalizeEvent(type, data) {
  const normalizer = NORMALIZERS[type];
  if (!normalizer) return null;
  if (!data || typeof data !== "object") return null;

  return normalizer(data);
}
