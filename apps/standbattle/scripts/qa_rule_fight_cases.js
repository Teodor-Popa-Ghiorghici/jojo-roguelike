/* Phase 13d: the scripted-player policy and per-rule probes behind
   qa_rule_fights.js. Split out for the repo's 300-line file cap -- same
   tool, second half. Everything here is a read-only observer or an input
   driver; nothing writes sim state except through combat.setKey.

   The one thing worth reading carefully is `windowOpen`: it re-states each
   Rule Fight's own vulnerability condition rather than measuring damage,
   so a fight whose window is structurally 0% is distinguishable from one
   the scripted player merely failed to exploit. Each case cites the line in
   rule_fights*.js it mirrors, so a drift between the two is visible. */

import { ARENA_MIN, ARENA_MAX, Z_REST } from '../constants.js';

export const SHA_SPOT_X = ARENA_MIN + 50; // rule_fights.js:31
export const SHA_RADIUS = 46;             // rule_fights.js:32
export const FATE_RADIUS = 40;            // rule_fights_2.js:44

/* Edge-triggered input helper: combat.setKey is edge-sensitive for actions
   (combat.js's `down && !was` check), so a driver that re-presses every
   frame would never fire a second attack. Tracks held state and only
   forwards real transitions. */
export function makeInput(combat) {
  const held = new Map();
  return {
    set(k, down) {
      if (held.get(k) === !!down) return;
      held.set(k, !!down);
      combat.setKey(k, !!down);
    },
    clearMovement() { ['left', 'right', 'forward', 'back'].forEach(k => this.set(k, false)); }
  };
}

/* Is the boss actually damageable this frame under its fight's rule?
   Mirrors each rule's own gate; `true` for fights that never deny damage. */
export function windowOpen(combat, boss) {
  switch (combat.encounter.def.objective) {
    case 'rf_sheer_heart_attack': return !!boss.exposed;                                  // rule_fights.js:40
    case 'rf_illusos_mirror': return !!combat.player.projecting === !!boss.mirrorLayer;     // rule_fights.js:74
    case 'rf_yellow_temperance': return boss.ai.state === 'recover';                        // rule_fights_2.js:26
    default: return true;
  }
}

/* Nominal player damage for one slot under this fight's live queries. Kept
   because a rule that silently zeroes damage should read as a number, not
   be inferred from a win/lose flag. */
export function dmgScale(combat, boss, slot) {
  return combat.dispatcher.runQuery('getDamage', 10, {
    isPlayerAttacker: true, attacker: combat.player, defender: boss, slot
  });
}

export function inHitRange(combat, boss, engage) {
  return Math.abs(combat.stand.x - boss.x) <= engage && Math.abs(combat.stand.z - boss.z) <= 22;
}

/* Any non-finite or out-of-contract number left anywhere in the sim. */
export function finiteBad(combat) {
  const bad = [];
  combat.entities.concat(combat.enemies).forEach(e => {
    const id = e.def ? e.def.id : e.id;
    [e.x, e.z, e.hp, e.maxHp].forEach(v => { if (v != null && !Number.isFinite(v)) bad.push(`${id}:non-finite`); });
    if (e.hp != null && e.hp < 0) bad.push(`${id}:neg-hp`);
    if (e.hp != null && e.maxHp != null && e.hp > e.maxHp + 1e-6) bad.push(`${id}:hp>max`);
    (e.statuses || []).forEach(s => { if (s.stacks < 0 || s.timer < 0) bad.push(`${id}:${s.id}`); });
  });
  return bad;
}

function walkTo(combat, inp, gx, gz, dead) {
  const p = combat.player, d = dead == null ? 6 : dead;
  inp.set('right', p.x < gx - d);
  inp.set('left', p.x > gx + d);
  inp.set('forward', p.z > gz + d); // QA-003: 'forward' DECREASES z
  inp.set('back', p.z < gz - d);
}

/* One frame of the scripted player. `st.reckless` deliberately violates the
   fight's own rule so the failure path is exercised rather than assumed. */
export function policyFrame(combat, inp, fightId, st) {
  const p = combat.player, boss = combat.enemies.find(e => e.hp > 0) || combat.enemies[0];
  if (!boss) return;
  let goalX = boss.x - (boss.x >= p.x ? st.engage : -st.engage);
  let goalZ = boss.z;

  if (fightId === 'rf_sheer_heart_attack' && !st.reckless) {
    /* The bomb chases player.x for free (rule_fights.js's own note), so the
       lure is simply to stand past the hiding spot and let it follow. */
    goalX = SHA_SPOT_X - (boss.ai.approachRange || 74); goalZ = Z_REST;
  } else if (fightId === 'rf_illusos_mirror') {
    /* Close-Range is the only class that can move the layer at all
       (player.projecting, stand_classes.js:53) -- that asymmetry is the
       measurement, so the policy just tries and the numbers show the rest. */
    inp.set('project', st.reckless ? !boss.mirrorLayer : !!boss.mirrorLayer);
  } else if (fightId === 'rf_rolling_stones') {
    const fs = combat.encounter.fateSpot;
    if (fs) {
      if (st.reckless) { goalX = fs.x; goalZ = fs.z; }
      else if (Math.hypot(p.x - fs.x, p.z - fs.z) <= FATE_RADIUS + 20) {
        goalX = Math.min(ARENA_MAX, Math.max(ARENA_MIN, fs.x + (p.x >= fs.x ? 90 : -90)));
      }
    }
  } else if (fightId === 'rf_cheap_trick' && st.reckless) {
    goalX = p.x + (p.x >= boss.x ? 60 : -60); // keep running away: stack Doom on purpose
  }

  walkTo(combat, inp, Math.min(ARENA_MAX, Math.max(ARENA_MIN, goalX)), goalZ);

  if (st.pressed) { inp.set(st.pressed, false); st.pressed = null; return; }
  const open = st.reckless ? !windowOpen(combat, boss) : windowOpen(combat, boss);
  if (p.state === 'idle' && open && inHitRange(combat, boss, st.engage + 20)) {
    const slot = st.rotation[st.ri++ % st.rotation.length];
    inp.set(slot, true); st.pressed = slot;
  }
}
