/* Generic effect/query verb library — Phase 3. Content (Fragments, Relics,
   run buffs) never writes JS logic; a content entry's `effects`/`queries`
   array names one of these functions by string plus a small data object,
   e.g. `{ hook: 'onHitResolve', fn: 'chainedDamageMult', data: { slot:
   'light', atChain: 3, mult: 1.6 } }`. content_registry.js resolves the
   `fn` string against EFFECT_LIB/QUERY_LIB at install time; an unknown
   name is a load-time validation error (deliverable 5), never a runtime
   crash from a missing function.

   This is deliberately a SMALL, reusable vocabulary (spec §0: "if you find
   yourself writing a bespoke function per content item, stop and build the
   generic mechanism instead") -- every entry here is parameterized so many
   different Fragments can share it rather than each getting its own verb. */

import { gainPersistence, gainMomentum } from './resources.js';
import { spawnHazard } from './hazards.js';
import { applyDamage } from './fighter.js';
import { AFFIX_EFFECT_LIB } from './affix_effect_lib.js';
import { ITEM_EFFECT_LIB, ITEM_QUERY_LIB } from './item_effect_lib.js';
import { ARENA_MIN, ARENA_MAX, ARENA_Z_MIN, ARENA_Z_MAX } from './constants.js';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ---- EFFECTS (mutate a hook's ctx) -------------------------------------- */

export const EFFECT_LIB = {
  /* Grants a flat amount of a named resource to ctx.entity (falls back to
     ctx.attacker for hooks that don't name an `entity`, e.g. onHitResolve).
     data: { resource: 'persistence'|'momentum', amount, slot?, moveId? }
     `slot`/`moveId` (Phase 7) optionally gate which move/slot triggers the
     grant -- e.g. "each Rush hit refunds Persistence" (slot) vs "activating
     Rush itself refunds Momentum" (moveId), the same verb either way. */
  grantResource(ctx, data) {
    if (data.slot != null && ctx.slot !== data.slot) return;
    if (data.moveId != null && (!ctx.move || ctx.move.id !== data.moveId)) return;
    const entity = ctx.entity || ctx.attacker;
    if (!entity) return;
    if (data.resource === 'persistence') gainPersistence(entity, data.amount);
    else if (data.resource === 'momentum') gainMomentum(entity, data.amount);
  },

  /* onHitLanded/onHitResolve only, and only when ctx.defender already
     carries the named status -- "grant resource X when you hit a Y-
     afflicted target" (Phase 7, Purple Haze — Special's Momentum-on-
     Virus clause), distinct from grantResource's slot/move gating. */
  grantResourceIfDefenderStatus(ctx, data) {
    const defender = ctx.defender;
    if (!defender || !defender.statuses.some(s => s.id === data.status)) return;
    const entity = ctx.entity || ctx.attacker;
    if (!entity) return;
    if (data.resource === 'persistence') gainPersistence(entity, data.amount);
    else gainMomentum(entity, data.amount);
  },

  /* onHitResolve only. Removes the target's Virus stacks entirely in
     exchange for bonus damage (per stack consumed) and, optionally,
     Persistence -- the generic shape behind "detonate the DoT for a
     payoff" (Phase 7, Purple Haze — Medium's Rotting Strike). A real
     "consume a status" + "convert a resource" clause, GDD §6.7. */
  consumeVirusForBonus(ctx, data) {
    const defender = ctx.defender;
    const inst = defender && defender.statuses && defender.statuses.find(s => s.id === 'virus');
    if (!inst) return;
    const stacks = inst.stacks;
    defender.statuses.splice(defender.statuses.indexOf(inst), 1);
    ctx.damage += stacks * (data.dmgPerStack || 0);
    if (data.persistencePerStack && ctx.attacker) gainPersistence(ctx.attacker, stacks * data.persistencePerStack);
  },

  /* onHitResolve only. Teleports the attacker (the User -- GDD §6.1's
     "Medium zips you to the target") to just in front of whatever it just
     hit, clamped to the arena. Phase 7's Sticky Fingers — Medium: a real
     rewrite of what the slot DOES, not a numeric change to what it deals. */
  teleportAttackerToTarget(ctx, data) {
    if (!ctx.attacker || !ctx.defender) return;
    const gap = data.standoff == null ? 24 : data.standoff;
    const facing = ctx.attacker.facing || 1;
    ctx.attacker.x = clamp(ctx.defender.x - facing * gap, ARENA_MIN, ARENA_MAX);
    ctx.attacker.z = clamp(ctx.defender.z, ARENA_Z_MIN, ARENA_Z_MAX);
  },

  /* onHitResolve only. GDD §6.1's own Sticky Fingers — Medium example:
     "if it hits an already-Broken enemy, it removes their armor entirely
     for the encounter." Consumes the engine's existing Perfect-Clash
     Break flag (defense.js/resolvers.js) as the "status" GDD §6.7 asks a
     Fragment to consume, and sets the generic, permanent `armorStripped`
     flag poise.js's isArmoredNow() already reads (Phase 7). */
  stripArmorIfBroken(ctx, data) {
    if (!ctx.defender || !ctx.defender.breakActive) return;
    ctx.defender.armorStripped = true;
  },

  /* onStepStart/onHitLanded/onMoveStart. Refunds Step charges -- gated
     either on the defender being Broken (`requiresBreak`, Sticky Fingers
     — Medium's L3 payoff loop with its own Step Fragment) or on a
     specific move having started (`moveId`, Sticky Fingers — Rush's L3). */
  refundStepCharge(ctx, data) {
    if (data.requiresBreak && !(ctx.defender && ctx.defender.breakActive)) return;
    if (data.moveId && (!ctx.move || ctx.move.id !== data.moveId)) return;
    const entity = ctx.entity || ctx.attacker;
    if (!entity) return;
    entity.dodgeCharges = Math.min(entity.dodgeChargeMax, entity.dodgeCharges + (data.amount || 1));
  },

  /* onStepStart/onTetherStrain. Marks the nearest `count` living enemies
     Broken (defense.js's Perfect-Clash flag, reused as a generic
     "apply-status"-shaped condition per GDD §6.7). Phase 7's Sticky
     Fingers — Step (L3) and — Aura (Live Wire, the leash-dependent
     Fragment: onTetherStrain only fires while genuinely over-extending
     the tether, so this can never trigger without the core User/Stand
     mechanic -- GDD §6.1's Red Hot Chili Pepper example is the model). */
  markNearestBroken(ctx, data) {
    if (!ctx.combat) return;
    const player = ctx.entity || ctx.combat.player;
    const alive = ctx.combat.enemies.filter(e => e.hp > 0).sort((a, b) =>
      Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
    alive.slice(0, data.count || 1).forEach(e => { e.breakActive = true; });
  },

  /* onKill only. GDD §6.1's own Purple Haze — Aura example almost
     verbatim: a target that dies carrying enough Virus leaves a spreading
     hazard (reuses hazards.js, Phase 6's generic arena-hazard system --
     zero new engine code) and the tradeoff ("you take 4 damage per
     cloud") is a direct self-damage clause, stated at pickup like every
     Arrow/Relic tradeoff must be (spec §6.3's rule extended to Fragments). */
  spawnDeathCloudIfVirused(ctx, data) {
    if (!ctx.combat || !ctx.target) return;
    const inst = ctx.target.statuses && ctx.target.statuses.find(s => s.id === 'virus');
    if (!inst || inst.stacks < (data.minStacks || 5)) return;
    spawnHazard(ctx.combat, ctx.target.x, ctx.target.z,
      { radius: data.radius, tickFrames: data.tickFrames, dmg: data.dmg, lifeFrames: data.lifeFrames });
    if (data.selfDamage && ctx.entity) applyDamage(ctx.entity, data.selfDamage);
  },

  /* onStepStart/onPerfectClash/onMoveStart. Phase 7's The World donor: the
     generic "the world pauses, the User doesn't" primitive (combat.js's
     `timeStopFrames`, stepped once per sim frame). `Math.max` rather than
     additive so two overlapping triggers extend to the longer window
     instead of compounding into an absurd stack. */
  triggerTimeStop(ctx, data) {
    if (!ctx.combat) return;
    /* onMoveStart fires for every move, not just Rush -- `data.moveId`
       (Phase 7's The World — Rush) gates it to one specific move the same
       way grantResource's does; onStepStart/onPerfectClash have no
       ctx.move at all, so the gate is a no-op there (always fires). */
    if (data.moveId && (!ctx.move || ctx.move.id !== data.moveId)) return;
    ctx.combat.timeStopFrames = Math.max(ctx.combat.timeStopFrames, data.frames || 0);
  },

  /* onHitResolve only. Multiplies ctx.damage when the hit came from a
     given move slot at a given self-chain count (or unconditionally if
     `slot`/`atChain` are omitted). This is the generic shape behind "your
     Nth <slot> in a string deals +X%" -- one function, any slot/chain/mult. */
  chainedDamageMult(ctx, data) {
    if (data.slot != null && ctx.slot !== data.slot) return;
    if (data.atChain != null && ctx.chainCount !== data.atChain) return;
    ctx.damage *= data.mult;
  },

  /* onHitLanded only. Queues a status application (ctx.statuses, per
     tech §2.1's example ctx shape) under the same slot/chain gate as
     chainedDamageMult -- the generic shape behind "your Nth <slot> applies
     N stacks of <status>". */
  chainedApplyStatus(ctx, data) {
    if (data.slot != null && ctx.slot !== data.slot) return;
    if (data.atChain != null && ctx.chainCount !== data.atChain) return;
    ctx.statuses.push({ id: data.status, stacks: data.stacks || 1 });
  },

  /* Unconditional status queue -- for hooks that don't carry a slot/chain
     (e.g. a Relic that applies a status onKill). */
  applyStatusUnconditional(ctx, data) {
    if (!ctx.statuses) return;
    ctx.statuses.push({ id: data.status, stacks: data.stacks || 1 });
  },

  /* Sets ctx.cancelled -- the generic "block this" verb any effect hook's
     contract already supports (hooks.js's runEffect stops the chain and,
     for onHitResolve, resolvers.js reads it as "this hit deals no
     damage"). data: {} (unconditional) or { slot, atChain } to gate it. */
  cancel(ctx, data) {
    if (data && data.slot != null && ctx.slot !== data.slot) return;
    ctx.cancelled = true;
  },

  /* Phase 9b affix-side verbs (drainPersistenceOnHit, healAttackerPctOfDamage,
     reflectFlatDamageToAttacker, explodeOnDeath, spawnMinionsOnDeath,
     enrageIfAllyDied) -- moved to affix_effect_lib.js and merged in below,
     purely to keep this file under the repo's 300-line cap. Still one
     EFFECT_LIB table as far as content_registry.js/installAffix are
     concerned (invariant 6). */
  ...AFFIX_EFFECT_LIB,
  /* Phase 10 item-side verbs (healEntity, healPctOfDamage, spawnFriendlyMote,
     reflectPctDamageToAttacker, cureStatus, returnToAnchor,
     applyStatusToNearby, damageNearby, consumeStatusForBonus, selfDamage)
     -- moved to item_effect_lib.js, same reason/discipline as above. */
  ...ITEM_EFFECT_LIB
};

/* ---- QUERIES (pure value reducers) -------------------------------------- */

export const QUERY_LIB = {
  /* value * data.mult, only when the query's ctx says the player is the
     attacker (the shape every player-side "+X% Power" buff needs; a
     Relic affecting enemy damage instead would gate the other way). */
  multiplyIfPlayerAttacker(value, ctx, data) {
    if (ctx && ctx.isPlayerAttacker === false) return value;
    return value * data.mult;
  },
  addFlat(value, ctx, data) { return value + data.amount; },
  multiplyFlat(value, ctx, data) { return value * data.mult; },

  /* getChainCap only. Removes a move's authored self-chain cap entirely
     when `data.slot` matches (or unconditionally if omitted) -- Phase 7's
     Purple Haze — Light (L3): "your light chain has no cap" (GDD §6.1). */
  removeCapForSlot(value, ctx, data) {
    if (data.slot != null && ctx.slot !== data.slot) return value;
    return Infinity;
  },

  /* getDamage only. A conditional damage multiplier gated on the
     defender's own Virus stack count -- Phase 7's Purple Haze — Rush.
     Deliberately categorized as pure damage shaping (VERB_CATEGORIES
     below): this clause alone would never clear GDD §6.7's bar, which is
     why every Fragment that uses it also carries a real apply/consume/
     convert/rewrite clause of its own. */
  bonusIfDefenderVirusStacks(value, ctx, data) {
    if (data.moveId && (!ctx.move || ctx.move.id !== data.moveId)) return value;
    const inst = ctx.defender && ctx.defender.statuses && ctx.defender.statuses.find(s => s.id === 'virus');
    if (!inst || inst.stacks < (data.minStacks || 1)) return value;
    return value * data.mult;
  },
  /* Phase 10 item-side query (bonusIfDefenderStatus) -- see
     item_effect_lib.js's own header for why it generalizes the verb
     above instead of duplicating it per status. */
  ...ITEM_QUERY_LIB
};

/* GDD §6.7: "Every Fragment must do at least one of: apply, amplify,
   consume or convert a status; convert a resource; rewrite a slot's
   behaviour; or change the economy. A Fragment that only adds damage is
   rejected at content review." content_registry.js's validator enforces
   this per Fragment by unioning the categories of every effect/query it
   registers against these two tables -- a verb mapped to `[]` (pure
   damage/crit arithmetic) can never, by itself, clear a Fragment's bar.
   This is the enforcement mechanism, not author judgement: adding a
   Fragment whose only effect is `chainedDamageMult` fails validation
   exactly the same way an unknown hook name does. */
export const VERB_CATEGORIES = {
  grantResource: ['convert-resource'],
  grantResourceIfDefenderStatus: ['convert-resource'],
  consumeVirusForBonus: ['consume-status', 'convert-resource'],
  teleportAttackerToTarget: ['rewrite-slot'],
  stripArmorIfBroken: ['consume-status', 'rewrite-slot'],
  refundStepCharge: ['convert-resource'],
  markNearestBroken: ['apply-status', 'rewrite-slot'],
  spawnDeathCloudIfVirused: ['consume-status'],
  triggerTimeStop: ['rewrite-slot'],
  chainedDamageMult: [],
  chainedApplyStatus: ['apply-status'],
  applyStatusUnconditional: ['apply-status'],
  cancel: ['rewrite-slot'],
  /* Phase 10 item-side verbs -- see item_effect_lib.js's own per-verb
     comments for which GDD §6.1 donor example each one generalizes. */
  healEntity: [],
  healPctOfDamage: ['convert-resource'],
  spawnFriendlyMote: ['rewrite-slot', 'convert-resource'],
  reflectPctDamageToAttacker: ['convert-resource'],
  cureStatus: ['consume-status'],
  returnToAnchor: ['rewrite-slot'],
  applyStatusToNearby: ['apply-status'],
  damageNearby: [],
  consumeStatusForBonus: ['consume-status', 'convert-resource'],
  selfDamage: []
};
export const QUERY_VERB_CATEGORIES = {
  multiplyIfPlayerAttacker: [],
  addFlat: [],
  multiplyFlat: [],
  removeCapForSlot: ['rewrite-slot'],
  bonusIfDefenderVirusStacks: [],
  bonusIfDefenderStatus: []
};
