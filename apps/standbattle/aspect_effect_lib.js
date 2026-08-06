/* Aspect-side EFFECT_LIB/QUERY_LIB verbs -- Phase 10, split out of
   effect_lib.js for the repo's 300-line cap exactly as affix_effect_lib.js
   (Phase 9b) and item_effect_lib.js (Phase 10) were, and merged back into
   the one EFFECT_LIB/QUERY_LIB table there so content_registry.js still
   sees a single vocabulary (invariant 6).

   These eight verbs exist because an Aspect must REWRITE A RULE and may
   never add a stat (GDD §9.1: "nothing here makes a number bigger"). The
   existing vocabulary could already apply/consume/convert statuses and
   retime a chain, but it had no way to say "this slot costs a different
   currency", "this timing is different", "that status belongs to someone
   else now" or "that hit happens twice" -- so those are the primitives
   added, generically, once. Per .claude/rules/content.md they are engine
   primitives available to every future Fragment, Relic and Aspect, not
   per-Aspect branches: nothing below names an Aspect, a Stand or a
   specific piece of content anywhere. */

import { gainPersistence, gainMomentum, spendPersistence } from './resources.js';
import { applyDamage } from './fighter.js';
import { applyStatus } from './status.js';

function slotOf(ctx) {
  if (ctx.slot != null) return ctx.slot;
  return (ctx.move && ctx.move.slot) || null;
}

function slotGate(ctx, data) {
  if (data.slot != null && slotOf(ctx) !== data.slot) return false;
  if (data.moveId != null && (!ctx.move || ctx.move.id !== data.moveId)) return false;
  if (data.atChainAtLeast != null && (ctx.chainCount == null || ctx.chainCount < data.atChainAtLeast)) return false;
  return true;
}

/* Reads a "resource" that may be either a real resource or a status id --
   which is what lets convertResource turn Charge into Momentum with the
   same verb that turns Momentum into Persistence. */
function takeFrom(entity, name, wanted) {
  if (name === 'persistence') {
    const have = Math.min(entity.persistence || 0, wanted);
    if (have > 0) spendPersistence(entity, have);
    return have;
  }
  if (name === 'momentum') {
    const have = Math.min(entity.momentum || 0, wanted);
    if (have > 0) gainMomentum(entity, -have);
    return have;
  }
  const inst = entity.statuses && entity.statuses.find(s => s.id === name);
  if (!inst) return 0;
  const have = Math.min(inst.stacks, wanted);
  inst.stacks -= have;
  if (inst.stacks <= 0) entity.statuses.splice(entity.statuses.indexOf(inst), 1);
  return have;
}

function giveTo(entity, name, amount) {
  if (amount <= 0) return;
  if (name === 'persistence') gainPersistence(entity, amount);
  else if (name === 'momentum') gainMomentum(entity, amount);
  else applyStatus(entity, name, amount);
}

export const ASPECT_EFFECT_LIB = {
  /* Any effect hook. Charges a resource for whatever just happened, and
     CANCELS the action when the entity can't pay. The generic shape behind
     "this slot now costs something it didn't" -- a real economy rewrite,
     not a damage number, and the reason a chain can be uncapped without
     being free. data: { resource, amount, slot?, moveId?, atChainAtLeast? } */
  payResource(ctx, data) {
    if (!slotGate(ctx, data)) return;
    const entity = ctx.entity || ctx.attacker;
    if (!entity) return;
    const paid = takeFrom(entity, data.resource, data.amount || 0);
    if (paid < (data.amount || 0)) ctx.cancelled = true;
  },

  /* Any effect hook. Moves value from one currency to another, where
     either end may be a resource OR a status id (Charge -> Momentum,
     Momentum -> Persistence, Persistence -> Mark, ...). `ratio` is how
     much of `to` each unit of `from` buys. data: { from, to, ratio, max? } */
  convertResource(ctx, data) {
    const entity = ctx.entity || ctx.attacker;
    if (!entity) return;
    const took = takeFrom(entity, data.from, data.max == null ? 99 : data.max);
    giveTo(entity, data.to, Math.round(took * (data.ratio == null ? 1 : data.ratio)));
  },

  /* onMoveStart/onStepStart/onHitResolve. Pays a percentage of CURRENT hp
     (never lethal -- floors at 1) for a resource. The "costs blood, not
     stamina" rewrite; distinct from selfDamage, which is a flat cost with
     nothing bought. data: { hpPct, resource, amount, slot?, moveId? } */
  spendHpForResource(ctx, data) {
    if (!slotGate(ctx, data)) return;
    const entity = ctx.entity || ctx.attacker;
    if (!entity) return;
    const cost = Math.min(Math.max(0, entity.hp - 1), Math.floor(entity.hp * (data.hpPct || 0)));
    if (cost > 0) applyDamage(entity, cost);
    giveTo(entity, data.resource, data.amount || 0);
  },

  /* Any effect hook. Applies a status to the ACTING entity rather than the
     target -- the whole existing status vocabulary is defender-facing
     (chainedApplyStatus queues onto ctx.statuses), so self-buff and
     self-curse content had no verb at all before this.
     data: { status, stacks?, slot?, moveId? } */
  applyStatusToSelf(ctx, data) {
    if (!slotGate(ctx, data)) return;
    const entity = ctx.entity || ctx.attacker;
    if (!entity) return;
    applyStatus(entity, data.status, data.stacks || 1);
  },

  /* onHitResolve/onHitLanded/onKill. Strips a status off the target and
     re-applies it to the nearest OTHER living enemy -- consume + apply in
     one, and a genuine rewrite of what a slot is for (a slot that spreads
     a condition rather than dealing with it). data: { status, radius?,
     slot?, moveId? } */
  transferStatusToNearest(ctx, data) {
    if (!slotGate(ctx, data)) return;
    const from = ctx.target || ctx.defender;
    if (!ctx.combat || !from || !from.statuses) return;
    const inst = from.statuses.find(s => s.id === data.status);
    if (!inst) return;
    const stacks = inst.stacks;
    from.statuses.splice(from.statuses.indexOf(inst), 1);
    const others = ctx.combat.enemies
      .filter(e => e !== from && e.hp > 0 && (data.radius == null || Math.hypot(e.x - from.x, e.z - from.z) <= data.radius))
      .sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
    if (others.length) applyStatus(others[0], data.status, stacks);
  },

  /* onHitResolve only. Every Nth landed hit resolves at `mult` instead of
     once -- "the hit happens twice" as a timing rule rather than a flat
     damage bonus, counted on the attacker so it survives across moves.
     data: { everyN, mult, slot? } */
  echoNthHit(ctx, data) {
    if (!slotGate(ctx, data)) return;
    const entity = ctx.attacker;
    if (!entity) return;
    entity.echoCount = (entity.echoCount || 0) + 1;
    if (entity.echoCount % (data.everyN || 2) !== 0) return;
    ctx.damage *= (data.mult == null ? 2 : data.mult);
  }
};

export const ASPECT_QUERY_LIB = {
  /* getPersistenceCost only. Drops a slot's cost to zero outright -- the
     query half of payResource/spendHpForResource, so "this slot is paid
     for differently now" is expressible without any per-content branch.
     data: { slot? } (unconditional when omitted) */
  zeroCostForSlot(value, ctx, data) {
    if (data.slot != null && slotOf(ctx || {}) !== data.slot) return value;
    return 0;
  },

  /* getMoveFrames only. Rescales a PLAYER move's windup and/or recovery in
     place, leaving its active window and hitboxes exactly as authored.
     Player-side only by construction: enemy patterns never pass through
     getMoveFrames (they resolve through resolvePatternFrames), so this
     verb cannot reach an enemy telegraph -- the spec §5.1 floor is out of
     its reach the same way it is out of Track B's.
     data: { slot?, windupMult?, recoverMult? } */
  rewriteSlotFrames(value, ctx, data) {
    if (!value || typeof value !== 'object') return value;
    if (data.slot != null && value.slot !== data.slot) return value;
    const scale = (n, m) => Math.max(1, Math.round(n * m));
    const out = { ...value };
    if (data.windupMult != null) out.windupFrames = scale(out.windupFrames, data.windupMult);
    if (data.recoverMult != null) out.recoverFrames = scale(out.recoverFrames, data.recoverMult);
    out.frames = out.windupFrames + out.activeFrames + out.recoverFrames;
    return out;
  }
};

/* GDD §6.7 categories for the eight verbs above. Every one of them is a
   real apply/consume/convert/rewrite clause -- there is deliberately no
   pure-arithmetic verb in this file, because an Aspect that only moved a
   number would be exactly the power creep spec §7 forbids. */
export const ASPECT_VERB_CATEGORIES = {
  payResource: ['convert-resource', 'rewrite-slot'],
  convertResource: ['convert-resource'],
  spendHpForResource: ['convert-resource'],
  applyStatusToSelf: ['apply-status'],
  transferStatusToNearest: ['consume-status', 'apply-status'],
  echoNthHit: ['rewrite-slot']
};

export const ASPECT_QUERY_VERB_CATEGORIES = {
  zeroCostForSlot: ['rewrite-slot'],
  rewriteSlotFrames: ['rewrite-slot']
};
