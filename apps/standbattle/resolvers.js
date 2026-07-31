/* The resolver choke points -- tech §2.4/§2.5, GDD §3.6-3.9. Every derived
   number in the combat sim passes through exactly one of these functions
   (invariant 5); nothing else in the engine may do inline arithmetic on a
   stat. Phase 3+ (Fragments/Relics) hooks into these five names precisely
   because they are the only place a number is computed:

     resolveMoveFrames(entity, moveId)   -- a player move's resolved timeline
     resolvePatternFrames(enemy, id)     -- an enemy attack pattern's timeline
     resolveDamage(ctx)                  -- final damage for one hitbox hit
     applyHit(ctx)                       -- mutates health/statuses from a hit
     rollCrit(ctx)                       -- crit chance from Precision
     resolvePoiseDamage(ctx)             -- poise damage for one hitbox hit

   resolveReach()/resolveMomentumMult() are private arithmetic these five
   call internally -- still only ever computed here, never inlined at a
   call site in combat_player.js/combat_enemy.js. */

import { MOVES } from './moves.js';
import { PATTERNS } from './ai.js';
import { applyDamage } from './fighter.js';

/* World units of move reach per point of the Stand's Range stat (spec
   §2.1). Star Platinum's Range is 2, so the base (reachMult 1.0) move
   reaches 62 units -- the exact number sp_light used before this phase,
   so the prototype's feel doesn't shift on the conversion. Every other
   move's reach is that same per-Range unit scaled by its own reachMult,
   never an independently hardcoded number (tech §2.4 deliverable 1). */
const REACH_PER_RANGE = 31;

export function resolveReach(rangeStat, reachMult) {
  return Math.round(REACH_PER_RANGE * rangeStat * (reachMult == null ? 1 : reachMult));
}

/* Momentum -> damage multiplier, GDD §3.8: +40% at 100 Momentum. */
export function resolveMomentumMult(momentum) {
  return 1 + 0.004 * Math.max(0, Math.min(100, momentum || 0));
}

/* Resolves a player move's data-authored timeline into world units: fills
   each hitbox's x/w from the Stand's Range stat, and derives the legacy
   windup/active/recover/hitCount fields the (untouched) pose/HUD layer
   still reads directly off `player.activeMove` -- a pure re-projection of
   the same timeline, not a second source of truth. */
export function resolveMoveFrames(entity, moveId) {
  const def = MOVES[moveId];
  const reach = resolveReach(entity.stand.stats.range, def.reachMult);
  const hitboxes = def.hitboxes.map(hb => ({
    ...hb, w: hb.w == null ? reach : hb.w, x: hb.x == null ? reach / 2 : hb.x
  }));
  const firstFrom = Math.min(...hitboxes.map(h => h.from));
  const lastTo = Math.max(...hitboxes.map(h => h.to));
  return {
    ...def, hitboxes, reach,
    windupFrames: firstFrom - 1,
    activeFrames: lastTo - firstFrom + 1,
    recoverFrames: def.frames - lastTo,
    hitCount: hitboxes.length
  };
}

/* Enemy attack patterns don't derive reach from a Range stat (enemies
   aren't Stands in this data model, tech §2.4 is explicit that only
   player moves must) -- but they still resolve through one function so a
   later Menace modifier (tech §2.9: "recovery frames shrink, telegraphs
   never do") has exactly one place to apply. Pass-through today. */
export function resolvePatternFrames(enemy, patternId) {
  return PATTERNS[patternId];
}

/* Precision -> crit chance (spec §2.1: "Precision — crit chance / status-
   effect accuracy"). `rng` must be the run's 'combat' stream (rng.js) --
   reserved since Phase 0 specifically for this. Crits deal x1.5. */
export function rollCrit(ctx) {
  const precision = ctx.attacker.stand ? ctx.attacker.stand.stats.precision : 0;
  const chance = Math.max(0, Math.min(0.35, precision * 0.02));
  const crit = ctx.rng ? ctx.rng.chance(chance) : false;
  return { crit, mult: crit ? 1.5 : 1 };
}

/* Final damage for one landed hitbox hit. `ctx`:
   { attacker, defender, hitbox|pattern, isPlayerAttacker, critMult, guardMult } */
export function resolveDamage(ctx) {
  let dmg;
  if (ctx.isPlayerAttacker) {
    dmg = ctx.hitbox.dmg * ctx.attacker.powerMult * (ctx.attacker.stand.stats.power / 8);
    dmg *= resolveMomentumMult(ctx.attacker.momentum);
  } else {
    dmg = ctx.pattern.dmgMult * ctx.attacker.def.power * 2;
  }
  if (ctx.critMult) dmg *= ctx.critMult;
  if (ctx.defender.breakActive) dmg *= 1.8; // Perfect Clash's Break (GDD §3.7), consumed by applyHit
  if (ctx.defender.ai && ctx.defender.ai.state === 'staggered') dmg *= ctx.defender.ai.staggerMult || 1;
  if (ctx.guardMult != null) dmg *= ctx.guardMult; // Guard's -70% / chip conversion (defense.js)
  return dmg;
}

/* Poise damage for one landed hitbox hit (GDD §3.9). A pure pass-through
   today (no Precision/status scaling yet) but kept as its own resolver so
   a future "Precision also sharpens poise damage" rule has one call site. */
export function resolvePoiseDamage(ctx) {
  return ctx.hitbox ? ctx.hitbox.poise || 0 : 0;
}

/* Mutates `defender` from a resolved hit: applies HP damage and consumes
   one-shot defender flags (Break) so no caller has to remember to. Returns
   { dead }. Poise/stagger and knockback are applied by their own systems
   (poise.js / the caller) since they aren't "damage" in the GDD sense. */
export function applyHit(ctx, dmg) {
  const dead = applyDamage(ctx.defender, dmg);
  ctx.defender.breakActive = false;
  return { dead };
}
