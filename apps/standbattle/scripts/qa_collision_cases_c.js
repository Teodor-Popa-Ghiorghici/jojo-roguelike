/* Phase 13f — systems-collision cases, groups 5-6.
   G5 resource edges · G6 damage routing. Same case shape and runner as
   groups 1-4; G7/G8 live in qa_collision_cases_d.js (300-line cap). */

if (typeof globalThis.window === 'undefined') globalThis.window = {};

import { MOMENTUM_MAX, gainMomentum, gainPersistence, spendPersistence, onMomentumHitTaken } from '../resources.js';
import { ENCOUNTERS } from '../data_encounters.js';
import { applyFeedbackDamage } from '../combat_stand.js';
import { PATTERNS } from '../ai.js';
import { mkCombat, stepFight, found, clean, absent } from './qa_collision_util.js';

const H = (over) => Object.assign({ seed: 'c13f', enemyId: 'knife_thug', standId: 'star_platinum' }, over);

/* ---------------- G5: resource edges ----------------------------------- */

const G5 = [{
  id: 'c5a-momentum-boundaries', group: 5, systems: ['resources', 'resolvers'],
  title: 'Momentum at exactly 0 and exactly 100 with a spend and a gain on one frame',
  run() {
    const p = { momentum: MOMENTUM_MAX, persistence: 0, framesSinceHitLanded: 0 };
    gainMomentum(p, 25); // gain at the ceiling
    if (p.momentum !== MOMENTUM_MAX) return found(`gain at ceiling left momentum=${p.momentum}`, 'c13f-unit', 0);
    onMomentumHitTaken(p); // halve on the same frame
    gainMomentum(p, 50);
    if (p.momentum > MOMENTUM_MAX || p.momentum < 0) return found(`momentum out of range: ${p.momentum}`, 'c13f-unit', 0);
    const z = { momentum: 0, framesSinceHitLanded: 0 };
    onMomentumHitTaken(z);
    if (!Object.is(z.momentum, 0)) return found(`halving 0 momentum produced ${z.momentum}`, 'c13f-unit', 0);
    return clean(`ceiling and floor both hold (${p.momentum}, ${z.momentum})`);
  }
}, {
  id: 'c5b-momentum-spend-bypasses-the-clamp-choke-point', group: 5, systems: ['resources', 'economy'],
  title: 'attemptMove decrements momentum inline instead of routing through clampMomentum',
  run() {
    // combat_player.js:106 does `player.momentum -= move.costs.momentum`
    // directly; every other momentum write goes through resources.js.
    const seed = 'c13f-mom';
    const combat = mkCombat('c5b-momentum-spend-bypasses-the-clamp-choke-point', H({ seed }));
    const p = combat.player;
    let negativeAt = null, floats = 0;
    stepFight(combat, 1200, (c, f) => {
      if (f % 5 === 0 && p.state === 'idle') { c.setKey('rush', true); c.setKey('rush', false); }
      if (f % 5 === 2) { c.setKey('rush', false); }
      p.momentum = Math.min(MOMENTUM_MAX, p.momentum + 3.3); // keep it near the gate
    }, (c, f) => {
      if (p.momentum < 0 && negativeAt == null) negativeAt = f;
      if (!Number.isInteger(p.momentum)) floats += 1;
    });
    if (negativeAt != null) {
      return found(`momentum went negative at frame ${negativeAt} (${p.momentum}) — combat_player.js:106 spends inline, outside resources.js's clamp`, seed, negativeAt);
    }
    return clean(`momentum stayed in range over 1200f (the affordability gate at combat_player.js:92 holds the floor, but the write itself is the one resource mutation not routed through resources.js — noted, not a defect today)`);
  }
}, {
  id: 'c5c-guard-break-at-exactly-zero-persistence', group: 5, systems: ['resources', 'defense'],
  title: 'guard-break fires exactly once when Persistence lands on 0, not every frame after',
  run() {
    /* Two runs: `natural` just holds Guard and lets stepGuardDrain empty
       the bar on its own; `pinned` also holds Persistence on exactly 0.
       Only a repeat in the NATURAL run is a defect -- a repeat that needs
       the pin is an artefact of the poke, and is reported as such. */
    const seed = 'c13f-gb0';
    function holdGuard(pin) {
      const combat = mkCombat('c5c-guard-break-at-exactly-zero-persistence', H({ seed }));
      const p = combat.player;
      let breaks = 0, firstAt = null; const causes = [];
      combat.dispatcher.effect('onGuardBreak', 0, ctx => {
        breaks += 1; causes.push(ctx.cause);
        if (firstAt == null) firstAt = combat.getFrame();
      });
      stepFight(combat, 1800, (c, f) => {
        c.setKey('guard', true);
        if (pin && f >= 60) p.persistence = 0;
      });
      return { breaks, firstAt, causes: [...new Set(causes)].join('/') };
    }
    const natural = holdGuard(false), pinned = holdGuard(true);
    if (natural.breaks > 1) {
      return found(
        `holding Guard until Persistence drains naturally fired onGuardBreak ${natural.breaks} times (first at frame ${natural.firstAt}, causes ${natural.causes}) — the break is re-reported every frame the bar sits on 0 instead of latching once`,
        seed, natural.firstAt, natural);
    }
    if (pinned.breaks > 1) {
      return found(
        `Persistence held at exactly 0 while guarding fires onGuardBreak every frame (${pinned.breaks} times from frame ${pinned.firstAt}, cause '${pinned.causes}') — stepGuardDrain re-reports rather than latching. Only reproducible with the resource pinned on the boundary by an external source, so the reachable question is whether any content can hold Persistence at 0 while Guard is held; the leech enemy's drainPersistenceOnHit is the nearest candidate. Natural drain fires exactly ${natural.breaks} (correct)`,
        seed, pinned.firstAt, { natural, pinned });
    }
    return clean(`natural ${natural.breaks} break(s) @${natural.firstAt}, pinned ${pinned.breaks} @${pinned.firstAt}`);
  }
}, {
  id: 'c5d-rush-on-the-frame-momentum-is-halved', group: 5, systems: ['resources', 'stand-rush'],
  title: 'Stand Rush attempted on the exact frame a hit halves Momentum',
  run() {
    const seed = 'c13f-rush-halve';
    const combat = mkCombat('c5d-rush-on-the-frame-momentum-is-halved', H({ seed }));
    const p = combat.player;
    let spentBelowZero = null, attempts = 0, starts = 0;
    stepFight(combat, 1800, (c, f) => {
      p.momentum = 60;
      if (p.state === 'idle') {
        attempts += 1;
        onMomentumHitTaken(p); // 60 -> 30, same frame as the press
        c.setKey('rush', true); c.setKey('rush', false);
        if (p.state === 'attack') starts += 1;
        if (p.momentum < 0 && spentBelowZero == null) spentBelowZero = f;
      }
    });
    if (spentBelowZero != null) {
      return found(`Rush spent Momentum past 0 (${p.momentum}) at frame ${spentBelowZero}`, seed, spentBelowZero);
    }
    return clean(`${attempts} press(es) against a halved pool, ${starts} started, momentum never negative`);
  }
}];

G5.push({
  id: 'c5e-guard-break-loop-vs-a-dead-aspect-clause', group: 5,
  systems: ['defense', 'aspect'],
  title: 'the repeating guard break fires hg_barrier once a second, and its Freeze clause does nothing',
  run() {
    /* hg_barrier (aspects.js:113): "Breaking a guard Freezes everything
       around it and returns a Step charge." Two collisions meet here:
       held Guard re-breaks on a loop (c5c), and the Freeze clause is one
       of c8d's dead pairings. Nothing is poked -- one key held. */
    const seed = 'c13f-barrier-loop';
    const enc = ENCOUNTERS.morioh_shopping_street;
    const combat = mkCombat('c5e-guard-break-loop-vs-a-dead-aspect-clause', {
      seed, encounter: enc, standId: 'hierophant_green', aspectId: 'hg_barrier'
    });
    const p = combat.player;
    let breaks = 0, firstAt = null;
    combat.dispatcher.on('onGuardBreak', () => { breaks += 1; if (firstAt == null) firstAt = combat.getFrame(); });
    stepFight(combat, 3600, c => {
      const e = c.enemies.find(x => x.hp > 0);
      if (e) { p.x = e.x - 50; p.z = e.z; } // well inside hg_barrier's 130px radius
      if (c.getFrame() === 0) c.setKey('guard', true); // held
    });
    const frozen = combat.enemies.filter(e => (e.statuses || []).some(s => s.id === 'frozen')).length;
    if (breaks > 1 && frozen === 0) {
      return found(
        `holding Guard alone broke the guard ${breaks} times in 3600 frames (first at ${firstAt}, one per stagger-and-regen cycle), firing hg_barrier's onGuardBreak clauses ${breaks} times at 50px from three enemies inside its 130px radius — and ${frozen} of ${combat.enemies.length} enemies ended Frozen. Runtime confirmation of c8d: the ASPECT's headline clause is inert because the onGuardBreak ctx (combat_player.js:276) carries no \`combat\`, so applyStatusToNearby returns at its \`if (!ctx.combat)\` guard (item_effect_lib.js:101). The trigger repeating for free is the second half of the same collision — if the clause worked, one held key would permanently freeze the arena`,
        seed, firstAt, { breaks, firstAt, frozen, enemies: combat.enemies.length });
    }
    return clean(`${breaks} break(s) @${firstAt}, ${frozen}/${combat.enemies.length} frozen`);
  }
});

/* ---------------- G6: damage routing ----------------------------------- */

const G6 = [{
  id: 'c6a-feedback-kill-mid-attack', group: 6, systems: ['feedback', 'death-pipeline'],
  title: 'feedback damage kills the User while the User is mid-attack',
  run() {
    const seed = 'c13f-fb-kill';
    const combat = mkCombat('c6a-feedback-kill-mid-attack', H({ seed, standId: 'star_platinum' }));
    const p = combat.player;
    let lostAt = null, stateAtLoss = null, hpAtLoss = null, outcomeFlips = [];
    let last = 'fighting';
    stepFight(combat, 3000, (c, f) => {
      if (f === 41) c.setKey('project', true);
      if (f % 30 === 0 && p.state === 'idle') { c.setKey('light', true); c.setKey('light', false); }
      if (f > 60) p.hp = Math.min(p.hp, 1.2); // keep the User one feedback tick from death
    }, (c, f) => {
      if (c.outcome !== last) { outcomeFlips.push(`${last}->${c.outcome}@${f}`); last = c.outcome; }
      if (c.outcome === 'lose' && lostAt == null) { lostAt = f; stateAtLoss = p.state; hpAtLoss = p.hp; }
    });
    if (outcomeFlips.length > 1) {
      return found(`outcome changed more than once: ${outcomeFlips.join(', ')}`, seed, lostAt, { outcomeFlips });
    }
    if (lostAt != null && stateAtLoss === 'attack') {
      return found(
        `applyFeedbackDamage (combat_stand.js:137) set outcome='lose' at frame ${lostAt} while player.state was still 'attack' (hp ${hpAtLoss.toFixed(2)}) — the User's activeMove is left mid-swing with no teardown; nothing clears activeMove/movePhase on death, so the fight's terminal state carries a live move`,
        seed, lostAt, { stateAtLoss, hpAtLoss });
    }
    return clean(`lost at ${lostAt} in state ${stateAtLoss}`);
  }
}, {
  id: 'c6b-feedback-ignores-user-invulnerability', group: 6, systems: ['feedback', 'defense'],
  title: 'feedback damage applies while the User is invulnerable',
  run() {
    /* Driving a Stand-targeted hit through crowd geometry is unreliable
       (hitsStandOrPlayer, combat_stand.js:100-111, depends on exact
       spacing), so the routing itself is exercised directly: one real
       combat, one real enemy pattern, applyFeedbackDamage called on an
       invulnerable-and-guarding User against a control that is neither. */
    const seed = 'c13f-fb-invuln';
    const enc = ENCOUNTERS.morioh_shopping_street;
    function transfer(immune) {
      const combat = mkCombat('c6b-feedback-ignores-user-invulnerability', { seed, encounter: enc, standId: 'star_platinum' });
      stepFight(combat, 60, (c, f) => { if (f === 20) c.setKey('project', true); });
      const p = combat.player, e = combat.enemies[0];
      const pattern = PATTERNS[e.def.attackPatterns[0]];
      if (immune) {
        p.invulnerable = true; p.hitIframeTimer = 999; // fighter.js:61's real i-frame fields
        p.guarding = true; p.persistence = 100;
      }
      const before = p.hp;
      applyFeedbackDamage(combat, pattern, e.x, e);
      return { lost: before - p.hp, frame: combat.getFrame(), pattern: pattern.id };
    }
    const control = transfer(false), immune = transfer(true);
    if (control.lost <= 0) return clean('control transferred no damage — inconclusive, not a pass');
    if (immune.lost > 0) {
      return found(
        `applyFeedbackDamage (combat_stand.js:121) goes straight to applyHit with no invulnerability or Guard check — a User with player.invulnerable set AND Guard up at full Persistence took ${immune.lost.toFixed(2)} HP from pattern '${immune.pattern}' at frame ${immune.frame}, exactly what the unprotected control took (${control.lost.toFixed(2)}). Skipping Guard/Clash is documented (combat_defense.js:33, "a hit aimed at the Stand skips the whole defensive triangle"); the consequence nothing states is that Step's i-frames are skipped too, so DODGE_CHARGE_MAX's "hard cap on invulnerability uptime" (defense.js:7) caps nothing against a Stand-routed hit — a Projecting player is unable to become invulnerable at all`,
        seed, immune.frame, { controlLost: Number(control.lost.toFixed(2)), immuneLost: Number(immune.lost.toFixed(2)) });
    }
    return clean(`control lost ${control.lost.toFixed(2)}, invulnerable User lost ${immune.lost.toFixed(2)}`);
  }
}, {
  id: 'c6c-simultaneous-user-and-stand-damage', group: 6, systems: ['feedback', 'defense'],
  title: 'User and Stand damaged on the same frame',
  run() {
    const seed = 'c13f-both';
    const enc = ENCOUNTERS.morioh_shopping_street;
    const combat = mkCombat('c6c-simultaneous-user-and-stand-damage', { seed, encounter: enc, standId: 'star_platinum' });
    const p = combat.player;
    let bad = null;
    stepFight(combat, 3600, (c, f) => { if (f === 41) c.setKey('project', true); },
      (c, f) => {
        if (!Number.isFinite(p.hp)) bad = `player hp non-finite (${p.hp}) at ${f}`;
        if (p.hp > p.maxHp) bad = `player hp ${p.hp} > maxHp ${p.maxHp} at ${f}`;
        if (c.stand && c.stand.hp != null && c.stand.hp !== c.stand.maxHp) bad = `stand hp moved to ${c.stand.hp} at ${f} — the Stand is documented as having no HP of its own`;
        return bad ? 'stop' : undefined;
      });
    return bad ? found(bad, seed, combat.getFrame()) : clean('User HP stayed finite and in range across a full crowd fight under Project');
  }
}, {
  id: 'c6d-absent-separate-stand-hp', group: 6, systems: ['feedback', 'aspect'],
  title: "Aspect of the Rite's separate Stand HP vs feedback rules",
  run() {
    return absent(
      "no aspect (or any other content) gives the Stand its own HP pool — combat_stand.js:114 states it outright, and combat.stand carries no hp field. The mission's 'separate Stand HP interacting with feedback rules that assume there is none' case has no subject",
      'combat_stand.js:114');
  }
}];


export const CASES_C = [...G5, ...G6];
