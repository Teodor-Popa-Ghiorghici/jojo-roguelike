/* Rule Fights, part 2 -- see rule_fights.js's header for the shared design
   (each entry is one more `objective` id, registered directly on
   combat.dispatcher from onStart). Yellow Temperance, Rolling Stones,
   Bites the Dust, Cheap Trick. */

import { PRIORITY } from './hooks.js';
import { applyDamage } from './fighter.js';
import { gainMomentum } from './resources.js';
import { applyStatus } from './status.js';
import { ARENA_MIN, ARENA_MAX, Z_REST } from './constants.js';

/* ---- Yellow Temperance: contact damages you, not it -------------------- */
/* "Immune to physical... force it to attack, punish the open frames
   only." Immunity holds except during the boss's own post-attack
   'recover' AI state (ai.js's state machine) -- the one window GDD's
   "out" column names. Every landed player hitbox still reflects flat
   damage back regardless of whether it did anything to the boss --
   stepMoveHitboxes'/onHitLanded's own contract already fires on physical
   overlap, not on damage dealt, so "contact" is exactly that hook. */
const YT_CONTACT_DMG = 6;

export const rf_yellow_temperance = {
  onStart(combat) {
    const boss = combat.enemies[0];
    combat.dispatcher.effect('onHitResolve', PRIORITY.CLAMP, ctx => {
      if (ctx.isPlayerAttacker && ctx.defender === boss && boss.ai.state !== 'recover') ctx.cancelled = true;
    }, 'rf_yellow_temperance');
    combat.dispatcher.effect('onHitLanded', PRIORITY.ADD, ctx => {
      if (ctx.attacker === combat.player && ctx.defender === boss && combat.player.hp > 0) {
        applyDamage(combat.player, YT_CONTACT_DMG);
        if (combat.player.hp <= 0) combat.outcome = 'lose';
      }
    }, 'rf_yellow_temperance');
  }
};

/* ---- Rolling Stones: fate marker, greed check -------------------------- */
/* "A 'fate' marker predicts your death spot; standing there is lethal but
   doubles rewards." Implemented as heavy periodic damage (not a literal
   instant kill -- survivable-but-risky reads as "lethal" without a
   one-touch death the sim can't warn the player about in time) that also
   flags `combat.rollingStonesGreedy` the instant the player dares stand in
   it, read by run_flow.js's reward step for the promised doubling. */
const FATE_RADIUS = 40;
const FATE_TICK_FRAMES = 20;
const FATE_DMG = 14;

export const rf_rolling_stones = {
  onStart(combat, encounter, rng) {
    encounter.fateSpot = { x: ARENA_MIN + rng.random() * (ARENA_MAX - ARENA_MIN), z: Z_REST };
    encounter.fateTick = FATE_TICK_FRAMES;
  },
  onTick(combat, encounter) {
    const player = combat.player;
    const dist = Math.hypot(player.x - encounter.fateSpot.x, player.z - encounter.fateSpot.z);
    if (dist > FATE_RADIUS) { encounter.fateTick = FATE_TICK_FRAMES; return; }
    if (!combat.rollingStonesGreedy) {
      combat.rollingStonesGreedy = true;
      combat.banner = 'YOU FEEL FATE CLOSING IN'; combat.bannerTimer = 60;
    }
    encounter.fateTick -= 1;
    if (encounter.fateTick > 0 || player.hp <= 0) return;
    encounter.fateTick = FATE_TICK_FRAMES;
    applyDamage(player, FATE_DMG);
    if (player.hp <= 0) combat.outcome = 'lose';
  }
};

/* ---- Bites the Dust: death rewinds 20s, knowledge intact --------------- */
/* A 1s-interval snapshot ring buffer of {hp,x,z} for the player and every
   enemy, 20 entries deep (20s of history); the FIRST entry is always the
   oldest kept, i.e. ~20s back, matching GDD's literal number. Fires once
   per fight (`btdUsed`) on `combat.outcome === 'lose'` -- checked, not
   `player.hp<=0`, since combat_defense.js/hazards.js set the outcome
   directly, not just the HP field. "One free Fragment" has no mid-fight
   offer flow to interject into (no Act III/Altar-style scene exists
   mid-combat) -- a flat Momentum grant stands in; flagged in the phase
   report, not silently substituted. */
const BTD_SNAPSHOT_INTERVAL = 60;
const BTD_REWIND_SNAPSHOTS = 20;

function snapshotFighter(f) { return { hp: f.hp, x: f.x, z: f.z }; }

export const rf_bites_the_dust = {
  onStart(combat, encounter) {
    encounter.btdSnapshots = [];
    encounter.btdTimer = BTD_SNAPSHOT_INTERVAL;
    encounter.btdUsed = false;
  },
  onTick(combat, encounter) {
    if (combat.outcome === 'lose' && !encounter.btdUsed && encounter.btdSnapshots.length) {
      encounter.btdUsed = true;
      const snap = encounter.btdSnapshots[0];
      combat.player.hp = Math.max(1, Math.round(snap.player.hp));
      combat.player.x = snap.player.x; combat.player.z = snap.player.z;
      combat.enemies.forEach((e, i) => {
        const s = snap.enemies[i];
        if (s && e.hp > 0) { e.hp = s.hp; e.x = s.x; e.z = s.z; }
      });
      gainMomentum(combat.player, 30);
      combat.outcome = 'fighting';
      combat.banner = 'BITES THE DUST -- TIME LOOPS BACK'; combat.bannerTimer = 90;
      return;
    }
    encounter.btdTimer -= 1;
    if (encounter.btdTimer > 0) return;
    encounter.btdTimer = BTD_SNAPSHOT_INTERVAL;
    encounter.btdSnapshots.push({ player: snapshotFighter(combat.player), enemies: combat.enemies.map(snapshotFighter) });
    if (encounter.btdSnapshots.length > BTD_REWIND_SNAPSHOTS) encounter.btdSnapshots.shift();
  }
};

/* ---- Cheap Trick: never turn your back --------------------------------- */
/* "Facing away applies stacking doom." This belt-plane's `player.facing`
   is a derived render value (always points at the nearest enemy,
   combat_player.js), not a chosen orientation, so "turning your back"
   here is reinterpreted as sustained movement AWAY from the boss --
   running past a run-threshold stacks Doom (status.js) on a slow interval,
   standing ground or closing resets it. Flagged deviation, not silently
   resolved: see the phase report. */
const RUN_THRESHOLD_FRAMES = 24;
const STACK_INTERVAL_FRAMES = 18;

export const rf_cheap_trick = {
  onStart(combat, encounter) {
    encounter.ctBoss = combat.enemies[0];
    encounter.ctRunFrames = 0;
    encounter.ctStackTimer = 0;
    encounter.ctLastX = combat.player.x;
  },
  onTick(combat, encounter) {
    const player = combat.player, boss = encounter.ctBoss;
    if (boss.hp <= 0) return;
    const dx = player.x - encounter.ctLastX;
    encounter.ctLastX = player.x;
    const awaySign = Math.sign(player.x - boss.x) || 1;
    const runningAway = dx !== 0 && Math.sign(dx) === awaySign;
    if (!runningAway) { encounter.ctRunFrames = 0; return; }
    encounter.ctRunFrames += 1;
    if (encounter.ctRunFrames <= RUN_THRESHOLD_FRAMES) return;
    encounter.ctStackTimer -= 1;
    if (encounter.ctStackTimer <= 0) {
      encounter.ctStackTimer = STACK_INTERVAL_FRAMES;
      applyStatus(player, 'doom', 1);
    }
  }
};
