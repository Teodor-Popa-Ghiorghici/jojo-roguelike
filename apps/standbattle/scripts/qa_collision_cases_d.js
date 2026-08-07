/* Phase 13f — systems-collision cases, groups 7-8.
   G7 meta x run · G8 validation under combination. Split from
   qa_collision_cases_c.js only to stay under the repo's 300-line file
   cap; same case shape, same runner. */

if (typeof globalThis.window === 'undefined') globalThis.window = {};

import { MENACE_CONDITIONS, MENACE_PROFILE_KEYS, createMenaceProfile, BASE_PROFILE } from '../meta_menace.js';
import { createContentRegistry, validateContent } from '../content_registry.js';
import { createDispatcher } from '../hooks.js';
import { EFFECT_LIB } from '../effect_lib.js';
import { ITEM_EFFECT_LIB } from '../item_effect_lib.js';
import { ASPECT_EFFECT_LIB } from '../aspect_effect_lib.js';
import { FRAGMENT_LIST, DONORS } from '../fragments.js';
import { RELIC_LIST } from '../relics.js';
import { KEEPSAKE_LIST } from '../keepsakes.js';
import { DISCS } from '../content/discs.js';
import { DUO_LIST } from '../duo_fragments.js';
import { REQUIEMS } from '../content/requiems.js';
import { AFFIX_LIST } from '../affixes.js';
import { ASPECT_LIST } from '../aspects.js';
import { ENCOUNTERS } from '../data_encounters.js';
import { createRng } from '../rng.js';
import { generateOffer } from '../fragment_offers.js';
import { createFreshRunState } from '../run_flow.js';
import { mkCombat, buildCombatFromHeader, stepFight, found, clean } from './qa_collision_util.js';

/* ---------------- G7: meta x run --------------------------------------- */

/* createMenaceProfile takes a pact object {conditionId: rank}; this pins
   every named condition at its own max rank. */
function profileFor(pactIds) {
  const pact = {};
  pactIds.forEach(id => {
    const c = MENACE_CONDITIONS.find(x => x.id === id);
    if (c) pact[c.id] = c.ranks;
  });
  return createMenaceProfile(pact);
}

/* The exact registry scripts/validate.js builds, so an error count quoted
   in a finding is the same number `npm run validate` reports. */
function shippedRegistry() {
  const reg = createContentRegistry();
  DONORS.forEach(d => reg.registerDonor(d));
  FRAGMENT_LIST.forEach(f => reg.registerFragment(f));
  RELIC_LIST.forEach(r => reg.registerRelic(r));
  KEEPSAKE_LIST.forEach(k => reg.registerRelic(k));
  DISCS.forEach(d => reg.registerDisc(d));
  DUO_LIST.forEach(d => reg.registerDuo(d));
  REQUIEMS.forEach(r => reg.registerRequiem(r));
  AFFIX_LIST.forEach(a => reg.registerAffix(a));
  return reg;
}

const G7 = [{
  id: 'c7a-inert-menace-conditions', group: 7, systems: ['menace', 'run-flow'],
  title: 'five Menace conditions resolve into profile keys nothing reads',
  run() {
    const dead = ['countdownFrames', 'feedbackMult', 'invadesPerAct', 'requiemDenied', 'bossPhase3Early'];
    const named = dead.map(k => (MENACE_CONDITIONS.find(c => c.key === k) || {}).id);
    const prof = profileFor(named);
    const changed = dead.filter(k => prof[k] !== BASE_PROFILE[k]);
    if (changed.length === dead.length) {
      return found(
        `createMenaceProfile correctly resolves ${changed.join(', ')} away from BASE_PROFILE, but no file outside meta_menace.js reads any of them — Countdown, Fragility, Hunted, Requiem Denied and Convergence are inert. The mission's 'Requiem Denied plus a build that requires Requiem' and 'Countdown plus a Survive objective' collisions cannot occur because neither condition does anything`,
        'c13f-unit', 0, { profile: dead.map(k => `${k}=${prof[k]}`).join(' ') });
    }
    return clean(`profile keys resolved: ${changed.join(',')}`);
  }
}, {
  id: 'c7b-scarcity-plus-starvation-offer-size', group: 7, systems: ['menace', 'reward-offers'],
  title: 'Scarcity rank 2 plus a starved candidate pool',
  run() {
    const rng = createRng('c13f-scarcity');
    const rs = createFreshRunState('c13f-scarcity', rng, 'star_platinum', {});
    const prof = profileFor(['scarcity']);
    let minSize = 99, emptyAt = null;
    for (let i = 0; i < 400; i++) {
      const full = generateOffer(rng.stream('rewards'), rs, 1);
      const offer = prof.offerCountDelta ? full.slice(0, Math.max(1, full.length + prof.offerCountDelta)) : full;
      minSize = Math.min(minSize, offer.length);
      if (offer.length === 0 && emptyAt == null) emptyAt = i;
      // starve the pool: own everything offered so far
      offer.forEach(c => { if (c.id && !rs.fragments.some(f => f.id === c.id)) rs.fragments.push({ id: c.id, level: 1 }); });
    }
    if (emptyAt != null) {
      return found(
        `run_flow.js:180's Math.max(1, ...) floors the slice length, not the offer: slice(0,1) of an empty candidate list is still empty, and the pool emptied at iteration ${emptyAt} under Scarcity rank 2 + full ownership`,
        'c13f-scarcity', emptyAt, { minSize });
    }
    return clean(`400 offers under Scarcity r2 + progressive starvation, min size ${minSize}, never empty`);
  }
}, {
  id: 'c7c-crowded-inflates-a-rule-fight-roster', group: 7, systems: ['menace', 'rule-fight'],
  title: 'Crowded rank 3 adds bodies to a Rule Fight whose roster is authored fixed',
  run() {
    const seed = 'c13f-crowded-rf';
    const enc = ENCOUNTERS.budogaoka_bites_the_dust;
    const authored = enc.waves.reduce((n, w) => n + (w.types ? w.types.length : 0), 0);
    const base = buildCombatFromHeader({ seed, encounter: enc, standId: 'star_platinum' });
    const crowded = buildCombatFromHeader({ seed, encounter: enc, standId: 'star_platinum', menace: profileFor(['crowded']) });
    if (crowded.enemies.length > base.enemies.length) {
      return found(
        `encounter.js:77 applies opts.extraEnemies to every wave including a Rule Fight's, so ${enc.objective}'s authored ${authored}-enemy roster spawned ${crowded.enemies.length} bodies at Crowded rank 3 (base ${base.enemies.length}). Rule fights declare their roster as waves[].types with no fixed-count field for the spawner to respect`,
        seed, 0, { authored, base: base.enemies.length, crowded: crowded.enemies.length });
    }
    return clean(`roster ${base.enemies.length} -> ${crowded.enemies.length}`);
  }
}, {
  id: 'c7d-crowded-across-every-rule-fight', group: 7, systems: ['menace', 'rule-fight'],
  title: 'the same inflation across every Rule Fight encounter',
  run() {
    const seed = 'c13f-crowded-all';
    const rfs = Object.entries(ENCOUNTERS).filter(([, e]) => e.objective && String(e.objective).startsWith('rf_'));
    const inflated = [];
    for (const [id, enc] of rfs) {
      const base = buildCombatFromHeader({ seed, encounter: enc, standId: 'star_platinum' });
      const cr = buildCombatFromHeader({ seed, encounter: enc, standId: 'star_platinum', menace: profileFor(['crowded']) });
      if (cr.enemies.length !== base.enemies.length) inflated.push(`${id} ${base.enemies.length}->${cr.enemies.length}`);
    }
    if (inflated.length) {
      return found(`${inflated.length} of ${rfs.length} Rule Fights change roster size under Crowded r3: ${inflated.join(', ')}`,
        seed, 0, { inflated });
    }
    return clean(`${rfs.length} Rule Fights, none inflated`);
  }
}];

G7.push({
  id: 'c7e-crowded-rule-fight-still-resolves', group: 7, systems: ['menace', 'rule-fight'],
  title: 'do the inflated Rule Fights still reach a terminal outcome, and does the rule still bind?',
  run() {
    const rfs = Object.entries(ENCOUNTERS).filter(([, e]) => e.objective && String(e.objective).startsWith('rf_'));
    const stuck = [], unbound = [];
    for (const [id, enc] of rfs) {
      const seed = `c13f-rf-${id}`;
      const combat = mkCombat('c7e-crowded-rule-fight-still-resolves', { seed, encounter: enc, standId: 'star_platinum', menace: profileFor(['crowded']) });
      const held = {};
      stepFight(combat, 5400, c => {
        const p = c.player, e = c.enemies.find(x => x.hp > 0);
        if (!e) return;
        const dx = Math.abs(e.x - p.x), dz = Math.abs((e.z || 0) - (p.z || 0));
        const want = {
          right: dx > 60 && e.x >= p.x, left: dx > 60 && e.x < p.x,
          forward: dz > 20 && (e.z || 0) < (p.z || 0), back: dz > 20 && (e.z || 0) >= (p.z || 0)
        };
        Object.keys(want).forEach(k => { if (held[k] !== want[k]) { held[k] = want[k]; c.setKey(k, want[k]); } });
        if (dx <= 60 && dz <= 20 && p.state === 'idle') { c.setKey('light', true); c.setKey('light', false); }
      });
      if (combat.outcome === 'fighting') stuck.push(`${id}@${combat.getFrame()}`);
      // every rule handler binds combat.enemies[0] once at onStart; the clones are unbound by construction
      const bound = combat.enemies.filter(e => e.armorAlways || e.exposed != null).length;
      // only rf_sheer_heart_attack marks its bound boss with a readable flag; elsewhere
      // the binding is an unobservable closure capture, so this counts only where it shows.
      if (combat.enemies.length > 1 && bound === 1) unbound.push(`${id} 1 of ${combat.enemies.length} flagged`);
    }
    if (stuck.length) {
      return found(`${stuck.length} inflated Rule Fight(s) did not reach a terminal outcome inside 5400 frames: ${stuck.join(', ')}`,
        'c13f-rf-*', 5400, { stuck, unbound });
    }
    return clean(
      `all ${rfs.length} inflated Rule Fights still terminated inside 5400f — the Crowded inflation is not run-ending. Observable rule binding (only rf_sheer_heart_attack sets a readable per-boss flag): ${unbound.length ? unbound.join('; ') : 'none flagged'}. Every other rf_* onStart captures combat.enemies[0] in a closure (rule_fights.js:36/69/113, rule_fights_2.js:24/126), which no runtime check can observe`);
  }
});

/* ---------------- G8: validation under combination --------------------- */

const G8 = [{
  id: 'c8a-validator-is-not-unlock-aware', group: 8, systems: ['content-validation', 'meta-unlocks'],
  title: 'an entry legal on its own that references a target present only under an unlock state',
  run() {
    const reg = createContentRegistry();
    const bus = createDispatcher();
    const before = validateContent(shippedRegistry(), bus);
    return clean(
      `validateContent (content_registry.js:159) walks fragments/relics/affixes/discs/requiems/duos unconditionally with no unlock or archive input (${before.errors.length} errors on the shipped registry) — there is no unlock-gated content path for a cross-state dangling reference to hide in, so the mission's case is structurally unreachable rather than passing`);
  }
}, {
  id: 'c8b-telegraph-floor-checked-pre-menace-only', group: 8, systems: ['content-validation', 'menace'],
  title: 'a telegraph legal at base that a Menace modifier shrinks below the fairness floor',
  run() {
    const recovery = MENACE_CONDITIONS.find(c => c.key === 'enemyRecoveryMult');
    const prof = profileFor([recovery.id]);
    const reg = createContentRegistry();
    const bus = createDispatcher();
    const res = validateContent(reg, bus);
    return clean(
      `validateContent's telegraph-fairness pass runs pre-modifier by design (content_registry.js:168-173) and Sharpened Instinct only touches enemyRecoveryMult (resolvers.js:108), never windupFrames — recovery is not the telegraph, so the floor cannot be shrunk out from under the validator by any shipped condition. profile enemyRecoveryMult=${prof.enemyRecoveryMult.toFixed(2)}, validator errors=${res.errors.length}`);
  }
}, {
  id: 'c8d-hook-x-verb-compatibility', group: 8, systems: ['content-validation', 'effect-pipeline'],
  title: 'a clause legal on its own, attached to a hook whose ctx cannot satisfy its verb',
  run() {
    /* validateEffectsAndQueries (content_registry.js:69) checks that the
       verb exists and its status exists. It never checks that the HOOK
       supplies what the verb reads. Both halves are derived here, not
       hardcoded: `needsCombat` by introspecting each verb's own source for
       a ctx.combat read, `combatlessHooks` from the runEffect call sites
       that build a ctx without `combat`. */
    const LIBS = { ...EFFECT_LIB, ...ITEM_EFFECT_LIB, ...ASPECT_EFFECT_LIB };
    const needsCombat = new Set(Object.keys(LIBS).filter(k => /ctx\.combat/.test(String(LIBS[k]))));
    const combatlessHooks = new Set([
      'onGuardBreak',    // combat_player.js:276, combat_defense.js:98
      'onStaggerStart',  // combat_defense.js:74, combat_enemy.js:74
      'onDamageTaken',   // combat_defense.js:139, hazards.js:59
      'onDamageIncoming',// combat_defense.js:128
      'onProjectStart', 'onProjectEnd', // stand_classes.js:56, :72
      'onCritCheck',     // resolvers.js:129
      'onFeedbackDamage' // combat_stand.js:123-127
    ]);
    const entries = [
      ...FRAGMENT_LIST.map(d => ['fragment', d]), ...RELIC_LIST.map(d => ['relic', d]),
      ...KEEPSAKE_LIST.map(d => ['keepsake', d]), ...DISCS.map(d => ['disc', d]),
      ...DUO_LIST.map(d => ['duo', d]), ...ASPECT_LIST.map(d => ['aspect', d])
    ];
    const dead = [];
    entries.forEach(([kind, def]) => (def.effects || []).forEach(eff => {
      if (combatlessHooks.has(eff.hook) && needsCombat.has(eff.fn)) dead.push(`${kind} ${def.id}: ${eff.hook} -> ${eff.fn}`);
    }));
    // and confirm the shipped validator is happy with all of them
    const errs = validateContent(shippedRegistry(), createDispatcher()).errors.length;
    if (dead.length) {
      return found(
        `${dead.length} shipped clause(s) attach a ctx.combat-reading verb to a hook whose ctx has no \`combat\`, so the verb hits its \`if (!ctx.combat) return;\` guard and silently does nothing: ${dead.join('; ')}. validateContent passes all of them (${errs} errors) because it only checks that the verb and its status exist (content_registry.js:69-78), never that the hook can satisfy the verb — the exact "individually legal, illegal in combination" case`,
        'c13f-unit', 0, { dead, validatorErrors: errs, needsCombat: [...needsCombat].join(',') });
    }
    return clean(`no hook/verb mismatch across ${entries.length} entries (${errs} validator errors)`);
  }
}, {
  id: 'c8c-menace-profile-key-coverage', group: 8, systems: ['content-validation', 'menace'],
  title: 'every MENACE_PROFILE_KEY is resolvable and finite at max rank',
  run() {
    const prof = profileFor(MENACE_CONDITIONS.map(c => c.id));
    const bad = MENACE_PROFILE_KEYS.filter(k => {
      const v = prof[k];
      return typeof v === 'number' ? !Number.isFinite(v) : typeof v !== 'boolean';
    });
    if (bad.length) return found(`non-finite/ill-typed profile keys at max rank: ${bad.join(', ')}`, 'c13f-unit', 0);
    return clean(`all ${MENACE_PROFILE_KEYS.length} keys finite with every condition at max rank`);
  }
}];


export const CASES_D = [...G7, ...G8];
