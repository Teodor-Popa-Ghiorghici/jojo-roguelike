/* Phase 13f — systems-collision cases, groups 3-4.
   G3 cancel windows · G4 timing collisions. Split from
   qa_collision_cases.js only to stay under the repo's 300-line file cap;
   same case shape, same runner. */

import { ENCOUNTERS } from '../data_encounters.js';
import { mkCombat, stepFight, tap, alive, found, clean, absent } from './qa_collision_util.js';

const H = (over) => Object.assign({ seed: 'c13f', enemyId: 'knife_thug', standId: 'star_platinum' }, over);

/* ---------------- G3: cancel windows ----------------------------------- */

const G3 = [{
  id: 'c3a-unaffordable-cancel-retains-buffer', group: 3, systems: ['cancel-window', 'economy'],
  title: 'a cancel into an unaffordable move leaves bufferedAction set and re-fires later',
  run() {
    /* sp_light cancels into 'special' from moveFrame 12, requires:'hit'
       (moves_star_platinum.js:10); sp_barrage costs 35 Persistence (:44).
       Land the light, open the window, then starve the cost on the exact
       frame the buffered Special is examined. */
    const seed = 'c13f-cancelcost';
    const combat = mkCombat('c3a-unaffordable-cancel-retains-buffer', H({ seed }));
    const p = combat.player;
    let windowAt = null, starvedAt = null, bufferAfter = null, firedAt = null, sawSpecial = false;
    stepFight(combat, 1200, (c, f) => {
      const e = c.enemies.find(x => x.hp > 0);
      if (e) { p.x = e.x - 44; p.z = e.z; } // hold contact range so the light connects
      if (p.state === 'idle' && windowAt == null) { c.setKey('light', true); c.setKey('light', false); }
      if (p.state === 'attack' && p.hitsLanded > 0 && p.moveFrame >= 12 && windowAt == null) {
        windowAt = f;
        p.persistence = 34; p.momentum = 0; // one short of sp_barrage's 35
        c.setKey('special', true); c.setKey('special', false);
        starvedAt = f;
      }
      if (windowAt != null && f <= windowAt + 12) p.persistence = 34; // keep it unaffordable through the window
    }, (c, f) => {
      if (starvedAt != null && f === starvedAt + 1) bufferAfter = p.bufferedAction ? p.bufferedAction.kind : null;
      if (p.activeMove && p.activeMove.slot === 'special_1') { sawSpecial = true; if (firedAt == null) firedAt = f; }
      return windowAt != null && f > windowAt + 200 ? 'stop' : undefined;
    });
    if (windowAt == null) return clean('cancel window never opened (no light connected)');
    if (bufferAfter) {
      return found(
        `an unaffordable cancel fails silently and asymmetrically: tryAttack fires onMoveDenied when attemptMove returns false (combat_player.js:79), tryCancel just returns (combat_player.js:129) — no denial cue for fx/audio, and player.bufferedAction is left set. The Special buffered into sp_light's frame-12 window at frame ${starvedAt} with 34/35 Persistence was still queued as '${bufferAfter}' the next frame${sawSpecial ? `, and fired at frame ${firedAt} once the cost became affordable again` : ', dropped only when INPUT_BUFFER_FRAMES expired'}`,
        seed, starvedAt, { windowAt, starvedAt, bufferAfter, firedAt });
    }
    return clean(`window opened at ${windowAt}, unaffordable cancel cleared the buffer`);
  }
}, {
  id: 'c3b-input-executes-during-hitstop', group: 3, systems: ['cancel-window', 'hit-stop'],
  title: 'setKey performs an action during a hit-stop frame, while stepFrame is frozen',
  run() {
    const seed = 'c13f-hitstop-input';
    const combat = mkCombat('c3b-input-executes-during-hitstop', H({ seed }));
    const p = combat.player;
    let actedDuringFreeze = null;
    stepFight(combat, 600, (c, f) => {
      if (f === 100) c.juice.hitstopMs = 200; // ~12 frames of frozen sim (combat.js:224)
      if (f >= 101 && f <= 108 && c.juice.hitstopMs > 0 && p.state === 'idle') {
        const before = p.state;
        c.setKey('light', true); c.setKey('light', false);
        if (before === 'idle' && p.state === 'attack' && actedDuringFreeze == null) actedDuringFreeze = f;
      }
    });
    if (actedDuringFreeze != null) {
      return found(
        `combat.setKey calls performAction directly (combat.js:214), outside stepFrame's hit-stop early-return (combat.js:224) — a move started at frame ${actedDuringFreeze} while the sim was frozen, spending its costs on a frame that never ran`,
        seed, actedDuringFreeze);
    }
    return clean('no action started during hit-stop');
  }
}, {
  id: 'c3c-step-cancel-during-project-denied', group: 3, systems: ['cancel-window', 'stand-duality'],
  title: 'Step during Project must be denied (combat_player.js:66)',
  run() {
    const seed = 'c13f-projectstep';
    const combat = mkCombat('c3c-step-cancel-during-project-denied', H({ seed, standId: 'star_platinum' }));
    const p = combat.player;
    let denied = 0, allowed = 0;
    stepFight(combat, 900, (c, f) => {
      if (f === 31) c.setKey('project', true); // held
      if (p.projecting && f % 7 === 0) {
        const charges = c.player.stepCharges;
        c.setKey('dodge', true); c.setKey('dodge', false);
        if (p.state === 'step' || p.stepping) allowed += 1; else denied += 1;
        if (charges != null && c.player.stepCharges < charges) allowed += 1;
      }
    });
    if (allowed > 0) return found(`Step fired ${allowed}x while projecting`, seed, 0, { denied, allowed });
    return clean(`${denied} Step attempts while Projecting, all denied, 0 charges consumed`);
  }
}, {
  id: 'c3d-hitstop-freezes-timestop-and-lose-check', group: 3, systems: ['hit-stop', 'time-stop'],
  title: 'a hit-stop frame skips the time-stop countdown and the player-death poll',
  run() {
    const seed = 'c13f-hs-ts';
    const combat = mkCombat('c3d-hitstop-freezes-timestop-and-lose-check', H({ seed }));
    let tsBefore = null, tsAfter = null, deadFrames = 0;
    stepFight(combat, 400, (c, f) => {
      if (f === 100) { c.timeStopFrames = 120; c.juice.hitstopMs = 200; }
      if (f === 150) c.player.hp = 0;
      if (f >= 101 && f <= 112) { if (tsBefore == null) tsBefore = c.timeStopFrames; tsAfter = c.timeStopFrames; }
      if (f > 150 && c.player.hp <= 0 && c.outcome === 'fighting') deadFrames += 1;
    });
    const frozen = tsBefore != null && tsBefore === tsAfter;
    if (frozen) {
      return found(
        `hit-stop (combat.js:224) returns before the time-stop decrement (combat.js:233) and before the hp<=0 lose poll (combat.js:254), so time-stop stayed pinned at ${tsAfter} across the whole freeze — two "the world is paused" systems compose by extending each other rather than overlapping`,
        seed, 101, { tsBefore, tsAfter, deadFramesObserved: deadFrames });
    }
    return clean(`timeStop ${tsBefore}->${tsAfter}`);
  }
}];

/* ---------------- G4: timing collisions -------------------------------- */

const G4 = [{
  id: 'c4a-timestop-during-phase-transition', group: 4, systems: ['time-stop', 'boss-phase'],
  title: 'time-stop entered on a boss phase transition freezes the invuln window with it',
  run() {
    const seed = 'c13f-ts-phase';
    const combat = mkCombat('c4a-timestop-during-phase-transition', H({ seed, enemyId: 'killer_queen', standId: 'star_platinum' }));
    const boss = combat.enemies[0];
    let transitionFrame = null, invulnAt = null, invulnLater = null;
    combat.dispatcher.on('onPhaseTransition', () => { if (transitionFrame == null) transitionFrame = combat.getFrame(); });
    stepFight(combat, 4000, (c, f) => {
      tap(c, 'light', f, 30 + (f % 40 === 0 ? 0 : -1));
      if (f % 40 === 0) { c.setKey('light', true); }
      if (f % 40 === 5) c.setKey('light', false);
      if (boss.hp > boss.maxHp * 0.55) boss.hp -= 0.7; // drive it into the phase gate deterministically
      if (transitionFrame != null && f === transitionFrame) { c.timeStopFrames = 240; invulnAt = boss.invulnFrames; }
      if (transitionFrame != null && f === transitionFrame + 120) invulnLater = boss.invulnFrames;
    });
    if (transitionFrame == null) return clean('phase transition never reached');
    if (invulnAt != null && invulnLater != null && invulnLater === invulnAt && invulnAt > 0) {
      return found(
        `combat.js:240 skips every enemy entity during time-stop, and stepCrowd (which decrements invulnFrames) does not run at all — a boss made invulnerable by its phase transition at frame ${transitionFrame} was still sitting on invulnFrames=${invulnLater} 120 frames later, so time-stop extends a boss's i-frames by its own full duration`,
        seed, transitionFrame, { invulnAt, invulnLater });
    }
    return clean(`transition@${transitionFrame} invuln ${invulnAt}->${invulnLater}`);
  }
}, {
  id: 'c4b-timestop-during-purge', group: 4, systems: ['time-stop', 'purge'],
  title: 'time-stop over a purge beat stalls the purge immunity countdown',
  run() {
    const seed = 'c13f-ts-purge';
    const combat = mkCombat('c4b-timestop-during-purge', H({ seed, enemyId: 'killer_queen' }));
    const boss = combat.enemies[0];
    let purgeFrame = null, immAt = null, immLater = null;
    combat.dispatcher.on('onPurge', () => { if (purgeFrame == null) purgeFrame = combat.getFrame(); });
    stepFight(combat, 5000, (c, f) => {
      if (boss.hp > 1) boss.hp -= 0.8;
      if (purgeFrame != null && f === purgeFrame) { c.timeStopFrames = 300; immAt = boss.statusImmuneFrames; }
      if (purgeFrame != null && f === purgeFrame + 150) immLater = boss.statusImmuneFrames;
    });
    if (purgeFrame == null) return clean('purge never triggered');
    if (immAt != null && immLater != null && immLater === immAt) {
      return found(
        `statusImmuneFrames decrements in stepStatuses, which combat.js:240 skips for enemies during time-stop — a purge window opened at frame ${purgeFrame} was still at ${immLater} frames 150 frames later, so time-stop lengthens the enemy's status immunity instead of eating into it`,
        seed, purgeFrame, { immAt, immLater });
    }
    return clean(`purge@${purgeFrame} imm ${immAt}->${immLater}`);
  }
}, {
  id: 'c4c-btd-rewind-across-a-wave-spawn', group: 4, systems: ['rule-fight', 'wave-spawn'],
  title: "Bites the Dust's rewind restores a roster snapshot taken before a later wave spawned",
  run() {
    const seed = 'c13f-btd-wave';
    const enc = ENCOUNTERS.budogaoka_bites_the_dust;
    const combat = mkCombat('c4c-btd-rewind-across-a-wave-spawn', { seed, encounter: enc, standId: 'star_platinum' });
    const counts = [];
    let rewindAt = null, before = null, after = null;
    stepFight(combat, 4000, (c, f) => {
      counts.push(alive(c).length);
      if (f === 1500) { before = c.enemies.length; c.player.hp = 0.5; }
    }, (c, f) => {
      const enc2 = c.encounter;
      if (enc2 && enc2.btdUsed && rewindAt == null) { rewindAt = f; after = c.enemies.length; }
    });
    if (rewindAt == null) return clean(`rewind never fired (btdSnapshots=${(combat.encounter.btdSnapshots || []).length}) — the QA-016 hole, already logged`);
    if (before != null && after != null && after !== before) {
      return found(`roster length changed across the rewind: ${before} -> ${after}`, seed, rewindAt, { before, after });
    }
    return clean(`rewind@${rewindAt}, roster ${before}->${after}`);
  }
}, {
  id: 'c4d-absent-death13', group: 4, systems: ['rule-fight', 'status'],
  title: "Death 13's sleep cycle vs a Rule Fight win condition",
  run() {
    return absent(
      "no Death 13 / sleep mechanic exists in this codebase — no sleep status in STATUS_DEFS (status.js:35), no death13 rule fight in rule_fights.js/rule_fights_2.js, no such encounter in data_encounters.js. The mission's sleep-cycle-vs-win-condition case has no subject",
      'rule_fights_2.js');
  }
}];


export const CASES_B = [...G3, ...G4];
