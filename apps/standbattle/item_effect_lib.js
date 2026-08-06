/* Item-side EFFECT_LIB/QUERY_LIB verbs -- split out of effect_lib.js
   (Phase 10, repo's 300-line cap, same reason affix_effect_lib.js was
   split in Phase 9b) purely to hold the ~10 new generic verbs Phase 10's
   5 new donors (Crazy Diamond/Gold Experience/Echoes ACT3/Red Hot Chili
   Pepper/Hermit Purple) need; merged back into EFFECT_LIB/QUERY_LIB in
   effect_lib.js so content_registry.js's validator/installer still sees
   one table each (invariant 6). Every verb here generalizes a Phase 7
   pattern (consumeVirusForBonus -> consumeStatusForBonus,
   markNearestBroken -> applyStatusToNearby, bonusIfDefenderVirusStacks ->
   bonusIfDefenderStatus) so Gravity/Charge/Mark share the same machinery
   Virus already proved, rather than three bespoke new mechanics. */

import { gainPersistence } from './resources.js';
import { applyDamage } from './fighter.js';
import { applyStatus } from './status.js';
import { spawnHazard } from './hazards.js';
import { ARENA_MIN, ARENA_MAX, ARENA_Z_MIN, ARENA_Z_MAX } from './constants.js';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function nearestEnemies(combat, x, z, count, radius) {
  return combat.enemies.filter(e => e.hp > 0 && (radius == null || Math.hypot(e.x - x, e.z - z) <= radius))
    .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))
    .slice(0, count || 1);
}

export const ITEM_EFFECT_LIB = {
  /* onHitLanded/onHitResolve/onStepStart. Flat heal to ctx.entity/attacker,
     clamped to maxHp -- deliberately uncategorized (VERB_CATEGORIES below):
     a bare heal is exactly as additive as a bare damage bonus, so every
     Fragment using this alone still fails GDD §6.7 and must pair it with a
     real clause, same discipline chainedDamageMult already enforces. */
  healEntity(ctx, data) {
    const entity = ctx.entity || ctx.attacker;
    if (!entity) return;
    entity.hp = Math.min(entity.maxHp, entity.hp + (data.amount || 0));
  },

  /* onHitResolve only, after ctx.damage is resolved. Heals the attacker a
     percent of the damage just dealt -- a real resource conversion
     (damage dealt -> HP restored), Crazy Diamond — Rush's own GDD §6.1
     example ("heals for 30% of damage dealt"). */
  healPctOfDamage(ctx, data) {
    if (!ctx.attacker) return;
    ctx.attacker.hp = Math.min(ctx.attacker.maxHp, ctx.attacker.hp + Math.round((ctx.damage || 0) * (data.pct || 0)));
  },

  /* onHitLanded/onHitResolve. Plants a friendly pickup (hazards.js's
     `friendly` mote, Phase 10) at the defender's or attacker's position --
     GDD §6.1's own Gold Experience — Heavy example verbatim: the slot no
     longer just deals damage, it ALSO leaves something behind (rewrite-
     slot) that heals + grants a resource on pickup (convert-resource). */
  spawnFriendlyMote(ctx, data) {
    if (!ctx.combat) return;
    const at = data.at === 'attacker' ? ctx.attacker : ctx.defender;
    if (!at) return;
    spawnHazard(ctx.combat, at.x, at.z, {
      radius: data.radius || 20, tickFrames: 999999, lifeFrames: data.lifeFrames || 600,
      friendly: true, healAmount: data.healAmount, momentumAmount: data.momentumAmount
    });
  },

  /* onDamageTaken only. ctx.entity is the player, ctx.attacker whichever
     enemy just hit them -- reflects a percent of the incoming damage back
     (Gold Experience's "damage reflection" identity, GDD §6.1). A real
     resource conversion: damage received becomes damage dealt. */
  reflectPctDamageToAttacker(ctx, data) {
    if (ctx.attacker && ctx.attacker.hp > 0) applyDamage(ctx.attacker, Math.round((ctx.dmg || 0) * (data.pct || 0)));
  },

  /* onHitLanded/onStepStart/onHitResolve. Removes one named status from
     ctx.entity (the player) if present -- a real consume-status clause
     (Crazy Diamond's "restoration" identity curing what Purple Haze/Toxic
     put on the player, GDD §6.1). */
  cureStatus(ctx, data) {
    const entity = ctx.entity || ctx.attacker;
    if (!entity || !entity.statuses) return;
    const i = entity.statuses.findIndex(s => s.id === data.status);
    if (i >= 0) entity.statuses.splice(i, 1);
  },

  /* onStepStart/onHitResolve. Teleports the attacker back to
     combat.spawnAnchor (combat.js, Phase 10) -- Crazy Diamond — Step's
     "return-to-position" identity (GDD §6.1), a real slot rewrite (Step
     no longer just dodges, it recalls you). */
  returnToAnchor(ctx, data) {
    if (!ctx.combat || !ctx.combat.spawnAnchor) return;
    const entity = ctx.entity || ctx.attacker;
    if (!entity) return;
    entity.x = clamp(ctx.combat.spawnAnchor.x, ARENA_MIN, ARENA_MAX);
    entity.z = clamp(ctx.combat.spawnAnchor.z, ARENA_Z_MIN, ARENA_Z_MAX);
  },

  /* onStepStart/onHitLanded/onTetherStrain/onKill. Generalizes Phase 7's
     markNearestBroken (which only ever set breakActive) to apply ANY real
     status to the `count` nearest living enemies within `radius` (default
     unbounded) of the source point -- Echoes ACT3's "pulls the crowd
     together and grounds them" (Gravity) and Red Hot Chili Pepper's
     "the tether becomes a live wire" (Charge) share this one verb. */
  applyStatusToNearby(ctx, data) {
    if (!ctx.combat) return;
    /* `data.from: 'target'` means "centered on whichever enemy this hit
       named" -- but that enemy is ctx.target on onKill (combat_player.js)
       and ctx.defender everywhere else (onHitLanded/onHitResolve,
       resolvers.js/combat_player.js never set ctx.target on those hooks).
       Reading ctx.target unconditionally silently no-op'd every non-onKill
       use of this option (caught during Duo Fragment authoring) -- fixed
       here, not per call site, since every existing Fragment/Relic/Disc
       that named `from: 'target'` gets the fix for free. */
    const src = data.from === 'target' ? (ctx.target || ctx.defender) : (ctx.entity || ctx.attacker);
    if (!src) return;
    nearestEnemies(ctx.combat, src.x, src.z, data.count, data.radius).forEach(e => applyStatus(e, data.status, data.stacks));
  },

  /* onHitLanded/onHitResolve/onKill/onStepStart. Flat AoE damage to the
     `count` nearest living enemies within `radius` of the source point --
     Red Hot Chili Pepper's "chain damage" identity. Deliberately
     uncategorized (pure damage), same discipline as chainedDamageMult:
     every Fragment using this pairs it with a real apply/consume clause. */
  damageNearby(ctx, data) {
    if (!ctx.combat) return;
    // See applyStatusToNearby's comment: ctx.target only exists on onKill.
    const src = data.from === 'target' ? (ctx.target || ctx.defender) : (ctx.entity || ctx.attacker);
    if (!src) return;
    nearestEnemies(ctx.combat, src.x, src.z, data.count, data.radius).forEach(e => applyDamage(e, data.amount || 0));
  },

  /* onHitResolve only. Generalizes Phase 7's consumeVirusForBonus to any
     status id: consumes the defender's stacks of `data.status` for bonus
     ctx.damage (and optional Persistence per stack) -- the generic shape
     behind "detonate the DoT/stack for a payoff" for Charge/Mark/Gravity,
     not just Virus. */
  consumeStatusForBonus(ctx, data) {
    const defender = ctx.defender;
    const inst = defender && defender.statuses && defender.statuses.find(s => s.id === data.status);
    if (!inst) return;
    const stacks = inst.stacks;
    defender.statuses.splice(defender.statuses.indexOf(inst), 1);
    ctx.damage += stacks * (data.dmgPerStack || 0);
    if (data.persistencePerStack && ctx.attacker) gainPersistence(ctx.attacker, stacks * data.persistencePerStack);
  },

  /* onCombatTick only (tech §3's own Stone Mask example: "onCombatTick ->
     selfDamage"). Periodic flat damage to ctx.entity (the player), once
     per real sim-second (combat.js dispatches this hook at that rate) --
     the generic "this Relic costs HP over time" primitive. */
  selfDamage(ctx, data) {
    if (!ctx.entity || ctx.entity.hp <= 0) return;
    applyDamage(ctx.entity, data.perSec || 0);
    if (ctx.entity.hp <= 0 && ctx.combat) ctx.combat.outcome = 'lose';
  },

  /* onCombatTick only. Phase 10 Requiem primitive (GDD §6.2's The World
     Requiem: "Time-stop is on a passive 25s cycle"). Counts real seconds
     on ctx.combat itself (onCombatTick already fires exactly once per
     real second, combat.js) and triggers a time-stop every `cycleSec`
     ticks -- a genuine rule rewrite (time-stop no longer needs a Perfect
     Clash to happen at all), not a bigger number on an existing clause. */
  periodicTimeStop(ctx, data) {
    if (!ctx.combat) return;
    ctx.combat.requiemCycleTicks = (ctx.combat.requiemCycleTicks || 0) + 1;
    if (ctx.combat.requiemCycleTicks % (data.cycleSec || 25) === 0) {
      ctx.combat.timeStopFrames = Math.max(ctx.combat.timeStopFrames, data.frames || 60);
    }
  },

  /* onDamageIncoming only. Phase 10 Requiem primitive (GDD §6.2's Gold
     Experience Requiem, reproduced close to literally: "Enemy attacks
     that would kill you are reverted to zero, once per encounter"). The
     "once" is tracked on the player entity itself (fresh every fight,
     combat.js creates a new player each encounter), not on runState --
     this is a per-encounter save, not a run-wide charge. */
  preventLethalOnce(ctx) {
    if (!ctx.defender || ctx.defender.lethalSaveUsed) return;
    if (ctx.damage == null || ctx.damage < ctx.defender.hp) return;
    ctx.damage = 0;
    ctx.defender.lethalSaveUsed = true;
  },

  /* onMoveStart/onDamageIncoming pair -- Phase 9d, Killer Queen's Bites
     the Dust. GDD §2.3 is explicit this must be "a run-altering utility
     effect... not a raw damage tool": a Stand-level innate ability
     (STANDS.<id>.innateAbilities, installed once at combat creation via
     the same installFragment() Fragments use) rather than a Fragment
     itself, since it's the base kit's own Rush, not a reward. Separate
     verb from preventLethalOnce above (not a shared gate on it) so an
     owned Gold Experience Requiem's unconditional once-per-fight save
     never entangles with whether this fight's Rush has fired yet. */
  armLethalSaveOnRush(ctx) {
    if (ctx.move && ctx.move.slot === 'rush') ctx.entity.lethalSaveArmed = true;
  },
  preventLethalIfArmed(ctx) {
    if (!ctx.defender || !ctx.defender.lethalSaveArmed || ctx.defender.lethalSaveUsed) return;
    if (ctx.damage == null || ctx.damage < ctx.defender.hp) return;
    ctx.damage = 0;
    ctx.defender.lethalSaveUsed = true;
  }
};

export const ITEM_QUERY_LIB = {
  /* getDamage/getPoiseDamage. Generalizes Phase 7's
     bonusIfDefenderVirusStacks to any status id -- the generic "bonus
     value vs a status-afflicted target" shape Gravity/Mark/Charge all
     reuse instead of three bespoke queries. Deliberately uncategorized
     (pure damage/poise shaping), same as the Virus-specific original. */
  bonusIfDefenderStatus(value, ctx, data) {
    const inst = ctx.defender && ctx.defender.statuses && ctx.defender.statuses.find(s => s.id === data.status);
    if (!inst || inst.stacks < (data.minStacks || 1)) return value;
    return value * data.mult;
  }
};
