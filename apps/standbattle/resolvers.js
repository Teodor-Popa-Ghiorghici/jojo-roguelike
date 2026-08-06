/* The resolver choke points -- tech §2.4/§2.5, GDD §3.6-3.9. Every derived
   number in the combat sim passes through exactly one of these functions
   (invariant 5); nothing else in the engine may do inline arithmetic on a
   stat. Phase 3 wraps each of them in the hooks.js effect/query pipeline
   precisely because they are the only place a number is computed -- this
   is what makes a Fragment/Relic ("your third Light deals +60%", "Perfect
   Clash refunds 25 Persistence") expressible as pure data with zero
   changes to this file ever again:

     resolveMoveFrames(entity, moveId, stats, bus) -- a player move's resolved
                                                       timeline (getMoveFrames query)
     resolvePatternFrames(enemy, id)     -- an enemy attack pattern's timeline
     resolveDamage(ctx)                  -- final damage for one hitbox hit
                                             (onHitResolve effect, getDamage query)
     applyHit(ctx)                       -- mutates health/statuses from a hit
     rollCrit(ctx)                       -- crit chance from Precision (onCritCheck effect)
     resolvePoiseDamage(ctx)             -- poise damage for one hitbox hit (getPoiseDamage query)
     resolvePersistenceCost(ctx)         -- a move's Persistence cost (getPersistenceCost query)

   resolveReach()/resolveMomentumMult() are private arithmetic these five
   call internally -- still only ever computed here, never inlined at a
   call site in combat_player.js/combat_enemy.js. */

import { MOVES } from './moves.js';
import { PATTERNS } from './ai.js';
import { applyDamage } from './fighter.js';
import { resolveSpeedScalar, resolveCritChance, resolveTetherPx, resolveFeedbackPct } from './stats.js';
import { hasStatus, STATUS_DEFS } from './status.js';
import { CONTROL_SCHEMES } from './stand_classes.js';

/* GDD §3.2: "−20% damage penalty while over-extended." Read directly off
   `ctx.attacker.strained` (combat_stand.js sets this once per frame, same
   pattern resolveDamage already uses for `defender.breakActive`/
   `defender.ai.state === 'staggered'`) so the penalty stays inside this
   one resolveDamage choke point rather than being applied at a call site. */
const STRAIN_DAMAGE_MULT = 0.8;

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
   each hitbox's x/w from the Stand's Range stat, scales every frame count
   by the Speed-derived timing scalar (stats.js -- 1.0 for Star Platinum,
   so this is a no-op today, see stats.js's comment), and derives the
   legacy windup/active/recover/hitCount fields the (untouched) pose/HUD
   layer still reads directly off `player.activeMove`. `bus`, if provided,
   runs the result through the getMoveFrames query (tech §2.1 minimum
   surface) as the very last step, so a Fragment can rewrite timing/reach
   generically without this function ever changing again. */
export function resolveMoveFrames(entity, moveId, stats, bus) {
  const def = MOVES[moveId];
  const scalar = stats ? resolveSpeedScalar(entity, stats) : 1;
  const scale = f => Math.max(1, Math.round(f * scalar));
  const reach = resolveReach(entity.stand.stats.range, def.reachMult);
  const hitboxes = def.hitboxes.map(hb => ({
    ...hb, w: hb.w == null ? reach : hb.w, x: hb.x == null ? reach / 2 : hb.x,
    from: scale(hb.from), to: scale(hb.to)
  }));
  const cancels = def.cancels.map(c => ({ ...c, from: scale(c.from) }));
  const armor = def.armor ? { from: scale(def.armor.from), to: scale(def.armor.to) } : null;
  const firstFrom = Math.min(...hitboxes.map(h => h.from));
  const lastTo = Math.max(...hitboxes.map(h => h.to));
  const frames = Math.max(scale(def.frames), lastTo);
  let resolved = {
    ...def, hitboxes, cancels, armor, reach, frames,
    windupFrames: firstFrom - 1,
    activeFrames: lastTo - firstFrom + 1,
    recoverFrames: frames - lastTo,
    hitCount: hitboxes.length
  };
  if (bus) resolved = bus.runQuery('getMoveFrames', resolved, { entity, moveId });
  return resolved;
}

/* Enemy attack patterns don't derive reach from a Range stat (enemies
   aren't Stands in this data model, tech §2.4 is explicit that only
   player moves must) -- but they still resolve through one function so a
   later Menace modifier (tech §2.9: "recovery frames shrink, telegraphs
   never do") has exactly one place to apply.

   Phase 10 is that later. This function was a pass-through with no callers
   until now (a finding: ai.js read PATTERNS directly, so the choke point
   the comment above promised did not actually sit on the path); ai.js now
   resolves every pattern through it. `menace` is meta_menace.js's frozen
   profile, and note precisely what is read from it: `enemyRecoveryMult`,
   applied to `recoverFrames`. `windupFrames` is copied through untouched
   and the profile has no key that could reach it, which is what makes
   spec §5.1's ">= 260ms after all Menace modifiers" a structural property
   rather than a number that happens to stay large. */
export function resolvePatternFrames(enemy, patternId, menace) {
  const def = PATTERNS[patternId];
  if (!def) return def;
  let mult = 1;
  if (menace && menace.enemyRecoveryMult !== 1) mult *= menace.enemyRecoveryMult;
  /* Phase 11-B Boss Reprises (GDD §5's "different signature timing"):
     `enemy.recoveryMult` (encounter.js's spawnWave stamps it from
     def.recoveryMult, a no-op field for every non-reprise enemy) composes
     with Menace's own recovery multiplier instead of a second bespoke
     scaling path -- still the one choke point, just two sources now. */
  if (enemy && enemy.recoveryMult && enemy.recoveryMult !== 1) mult *= enemy.recoveryMult;
  if (mult === 1) return def;
  return { ...def, recoverFrames: Math.max(1, Math.round(def.recoverFrames * mult)) };
}

/* Precision -> crit chance (spec §2.1: "Precision — crit chance / status-
   effect accuracy"). `ctx.rng` must be the run's 'combat' stream (rng.js).
   `ctx.bus`, if provided, runs onCritCheck (mutable: a Fragment may adjust
   chance/mult before the roll, or even force `crit`/`cancelled`) ahead of
   the actual roll. Crits deal x1.5 by default. */
export function rollCrit(ctx) {
  let chance = ctx.stats ? resolveCritChance(ctx.attacker, ctx.stats)
    : Math.max(0, Math.min(0.35, (ctx.attacker.stand ? ctx.attacker.stand.stats.precision : 0) * 0.02));
  let mult = 1.5;
  if (ctx.bus) {
    const hookCtx = { attacker: ctx.attacker, chance, mult, crit: false, cancelled: false };
    ctx.bus.runEffect('onCritCheck', hookCtx);
    chance = hookCtx.chance; mult = hookCtx.mult;
    if (hookCtx.cancelled) return { crit: false, mult: 1 };
  }
  const crit = ctx.rng ? ctx.rng.chance(chance) : false;
  return { crit, mult: crit ? mult : 1 };
}

/* Final damage for one landed hitbox hit. `ctx`:
   { attacker, defender, hitbox|pattern, isPlayerAttacker, critMult,
     guardMult, partMult?, move?, bus?, combat? }
   When `ctx.bus` is provided this is the single call site for both
   onHitResolve (mutable: a Fragment may multiply ctx.damage, queue
   ctx.statuses for the caller to apply on a landed hit, or cancel the hit
   outright) and the getDamage query (pure multiplier layer -- this is
   where the ported "+15% Power" run buff lives now, deliverable 6). */
export function resolveDamage(ctx) {
  let dmg;
  if (ctx.isPlayerAttacker) {
    dmg = ctx.hitbox.dmg * (ctx.attacker.stand.stats.power / 8);
    dmg *= resolveMomentumMult(ctx.attacker.momentum);
    if (ctx.attacker.strained) dmg *= STRAIN_DAMAGE_MULT; // GDD §3.2 -- Stand damage only, never incoming
    // GDD §3.4 -- Stand Class damage baseline (Long-Range's -35%); a no-op (1) for Close/Mid
    const scheme = CONTROL_SCHEMES[ctx.attacker.stand.controlScheme] || CONTROL_SCHEMES.close;
    dmg *= scheme.damageMult;
    /* Phase 9b Shielder (#4)/Phaser (#13): frontal immunity and "only
       vulnerable during its own active frames" are both generic reads of
       an optional def field, the same shape as Warden's below -- a no-op
       for every enemy without them. Frontal immunity yields to a flanking
       hit (z-offset past profiles.js's own FLANK_Z_THRESHOLD) or to a
       poise-broken Shielder, per GDD §4.2's "must be flanked or poise-
       broken". */
    if (ctx.defender.def && ctx.defender.def.frontalBlock && ctx.defender.ai &&
      ctx.defender.ai.state !== 'staggered' && Math.abs(ctx.attacker.z - ctx.defender.z) <= 20) {
      dmg = 0;
    }
    if (ctx.defender.def && ctx.defender.def.intangibleExceptActive &&
      (!ctx.defender.ai || ctx.defender.ai.state !== 'active')) {
      dmg = 0;
    }
  } else {
    dmg = ctx.pattern.dmgMult * ctx.attacker.def.power * 2;
    /* GDD §4.2 Warden (#12): "punishes you hard while your Stand is
       detached" -- bonus multiplier on its own def, gated on the generic
       standDetached flag every control scheme sets each frame
       (stand_classes.js). A no-op for every enemy without the field. */
    if (ctx.attacker.def.detachedStandPunishMult && ctx.defender.standDetached) {
      dmg *= ctx.attacker.def.detachedStandPunishMult;
    }
    /* Phase 9b: Cornered/Enraged-on-Kill/Reckless affixes -- three more
       optional multipliers on the attacking enemy, same choke point,
       same "absent field = no-op" contract as detachedStandPunishMult. */
    const affixData = ctx.attacker.affixData;
    if (affixData) {
      if (affixData.cornered && ctx.attacker.hp / ctx.attacker.maxHp < 0.3) dmg *= affixData.cornered;
      if (affixData.enraged) dmg *= affixData.enraged;
      if (affixData.reckless) dmg *= affixData.reckless.dmgMult;
    }
  }
  if (ctx.critMult) dmg *= ctx.critMult;
  if (ctx.defender.breakActive) dmg *= 1.8; // Perfect Clash's Break (GDD §3.7), consumed by applyHit
  if (ctx.defender.ai && ctx.defender.ai.state === 'staggered') dmg *= ctx.defender.ai.staggerMult || 1;
  if (ctx.guardMult != null) dmg *= ctx.guardMult; // Guard's -70% / chip conversion (defense.js)
  if (ctx.partMult) dmg *= ctx.partMult; // GDD §4.6 Phase 3 -- the exposed User's x3 multiplier (boss_parts.js)
  /* GDD §3.10's Frozen status carried a real `damageTakenMult` since Phase
     3 with no consumer ("data is real, no consumer yet, reserved" --
     status.js). Phase 7's The World — Heavy is the first content to ever
     apply Frozen; this generic, unconditional read is the actual
     consumer, wired once here (invariant 5) rather than as a per-Fragment
     special case, so any future Frozen source gets the payoff for free. */
  if (ctx.defender && hasStatus(ctx.defender, 'frozen')) dmg *= STATUS_DEFS.frozen.damageTakenMult;
  // Cheap Trick's Rule Fight (GDD §4.5): stacking Doom, same unconditional-read shape as Frozen above.
  if (ctx.defender && hasStatus(ctx.defender, 'doom')) {
    const doom = ctx.defender.statuses.find(s => s.id === 'doom');
    dmg *= 1 + doom.stacks * STATUS_DEFS.doom.damageTakenMultPerStack;
  }

  if (ctx.bus) {
    const tags = (ctx.hitbox && ctx.hitbox.tags) || (ctx.pattern && ctx.pattern.tags) || [];
    const chainCount = ctx.move && ctx.attacker.chainCounts ? (ctx.attacker.chainCounts[ctx.move.id] || 0) : 0;
    const hookCtx = {
      attacker: ctx.attacker, defender: ctx.defender, move: ctx.move || null,
      hitbox: ctx.hitbox || null, pattern: ctx.pattern || null, isPlayerAttacker: ctx.isPlayerAttacker,
      damage: dmg, tags, slot: ctx.move ? ctx.move.slot : null, chainCount, combat: ctx.combat || null,
      crit: !!(ctx.critMult && ctx.critMult > 1), statuses: [], cancelled: false
    };
    ctx.bus.runEffect('onHitResolve', hookCtx);
    dmg = hookCtx.cancelled ? 0 : hookCtx.damage;
    ctx.pendingStatuses = hookCtx.statuses; // read by the caller after a confirmed landed hit
    dmg = ctx.bus.runQuery('getDamage', dmg, hookCtx);
  }
  return dmg;
}

/* Poise damage for one landed hitbox hit (GDD §3.9). `ctx.bus`, if
   provided, runs the result through getPoiseDamage (tech §2.1 minimum
   surface) so a future "Precision also sharpens poise damage" rule has
   one call site. */
export function resolvePoiseDamage(ctx) {
  let amount = ctx.hitbox ? ctx.hitbox.poise || 0 : 0;
  if (ctx.bus) amount = ctx.bus.runQuery('getPoiseDamage', amount, ctx);
  return amount;
}

/* A move's Persistence cost (GDD §3.8). `ctx.bus`, if provided, runs it
   through getPersistenceCost so a Fragment/Relic can cheapen (or raise)
   Specials generically instead of combat_player.js reading
   `move.costs.persistence` directly (which would be exactly the "inline
   arithmetic on a stat" invariant 5 forbids). */
export function resolvePersistenceCost(ctx) {
  let cost = (ctx.move && ctx.move.costs.persistence) || 0;
  if (ctx.bus) cost = ctx.bus.runQuery('getPersistenceCost', cost, ctx);
  return cost;
}

/* Mutates `defender` from a resolved hit: applies HP damage and consumes
   one-shot defender flags (Break) so no caller has to remember to. Returns
   { dead }. Poise/stagger and knockback are applied by their own systems
   (poise.js / the caller) since they aren't "damage" in the GDD sense. */
export function applyHit(ctx, dmg) {
  const dead = applyDamage(ctx.defender, dmg);
  ctx.defender.breakActive = false;
  /* Phase 9b Requiem-Touched: a one-shot "instead of dying" branch right at
     the HP-mutation choke point, so it applies no matter which caller
     landed the killing hit (a normal combo or a Clash counter alike). */
  const affixData = ctx.defender.affixData;
  if (dead && affixData && affixData.requiem_touched && !ctx.defender.requiemUsed) {
    ctx.defender.requiemUsed = true;
    ctx.defender.hp = Math.max(1, Math.round(ctx.defender.maxHp * affixData.requiem_touched));
    return { dead: false };
  }
  return { dead };
}

/* The tether length (GDD §3.2: `26 * Range`) and the Stand/User feedback
   rate (GDD §3.3: `clamp(0.70 - 0.065*range, 0.10, 0.70)`). stats.js
   already computed both as real numbers since Phase 3 (`resolveTetherPx`/
   `resolveFeedbackPct`) but nothing consumed them -- Phase 4 is that
   consumer. Same shape as resolveMoveFrames: the stat pipeline's cached
   layered value, then the getTetherLength/getFeedbackRate query as the
   last step, so a Fragment can rewrite either generically. */
export function resolveTetherLength(entity, stats, bus) {
  let tether = resolveTetherPx(entity, stats);
  if (bus) tether = bus.runQuery('getTetherLength', tether, { entity });
  return tether;
}

export function resolveFeedbackRate(entity, stats, bus) {
  let pct = resolveFeedbackPct(entity, stats);
  if (bus) pct = bus.runQuery('getFeedbackRate', pct, { entity });
  return pct;
}

/* Ripple Assist (GDD §21, Phase 12): Step i-frames x1.3 and Clash window
   x1.5, each its own independent dial on `player.assist` -- read here so
   defense.js's timers stay the single derived-number choke point rather
   than doing the multiply inline at the call site (invariant 5). Incoming
   damage x0.7 is a third, separate dial applied via the ordinary getDamage
   query in combat.js (same seam menace's enemyDamageMult already uses). */
export function resolveStepInvulnFrames(base, assist) {
  return assist && assist.step ? Math.round(base * 1.3) : base;
}
export function resolveClashWindow(activeFrom, activeTo, assist) {
  if (!assist || !assist.clash) return { from: activeFrom, to: activeTo };
  return { from: activeFrom, to: activeFrom + Math.round((activeTo - activeFrom) * 1.5) };
}
