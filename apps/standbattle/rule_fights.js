/* Rule Fights -- GDD §4.5: "canon JoJo fights are puzzles, not damage
   races." An encounter whose win condition is REWRITTEN, not just its
   spawn/timer shape (that's the Ambush/Survive/Hazard/etc. family in
   encounter_objectives.js). Mechanically these are exactly one more
   `objective` id -- encounter.js's stepEncounter doesn't know or care
   whether an id came from OBJECTIVES or here; `encounter.js` merges both
   registries. Split into two sibling files (300-line cap): this one has
   Sheer Heart Attack / Illuso's Mirror / Formaggio's Shrink / Baby Face,
   `rule_fights_2.js` has Yellow Temperance / Rolling Stones / Bites the
   Dust / Cheap Trick.

   Each entry registers its rule directly on `combat.dispatcher` (the same
   EFFECT_HOOKS/QUERY_HOOKS every Fragment/Relic/affix uses) from onStart
   -- bespoke closures, not EFFECT_LIB verbs, because a Rule Fight is
   authored once as engine content (like a boss signature), not rolled
   per-instance the way an affix is (content.md's verb-vocabulary rule
   governs the Fragment/Relic/Disc/Duo/Requiem/enemy POOLS; Rule Fights are
   explicitly "bespoke by nature", GDD §4.5/phase brief). Cut from the
   launch set of 12 to 8 (phase brief's own authorized floor) -- see
   docs/phase-reports/phase-11b.md for which four and why. */

import { PRIORITY } from './hooks.js';
import { ARENA_MIN, ARENA_MAX, Z_REST } from './constants.js';

/* ---- Sheer Heart Attack: invulnerable homing bomb, hidden real target -- */
/* "An invulnerable homing bomb tracks heat. The real user is hidden. Lure
   it into the hiding spot; it detonates on its owner." The boss's own
   default 'approach' AI already always closes on the player ("tracks
   heat" for free); this only adds the invulnerability-outside-the-spot
   rule and the reveal-on-arrival payoff. */
const SHA_HIDING_SPOT = { x: ARENA_MIN + 50, z: Z_REST };
const SHA_HIDING_RADIUS = 46;

export const rf_sheer_heart_attack = {
  onStart(combat, encounter) {
    const boss = combat.enemies[0];
    encounter.shaBoss = boss;
    boss.armorAlways = true; // never staggered while unexposed -- it's a bomb, not a brawler
    combat.dispatcher.effect('onHitResolve', PRIORITY.CLAMP, ctx => {
      if (ctx.isPlayerAttacker && ctx.defender === boss && !boss.exposed) ctx.cancelled = true;
    }, 'rf_sheer_heart_attack');
  },
  onTick(combat, encounter) {
    const boss = encounter.shaBoss;
    if (boss.hp <= 0) return;
    const dist = Math.hypot(boss.x - SHA_HIDING_SPOT.x, boss.z - SHA_HIDING_SPOT.z);
    boss.exposed = dist <= SHA_HIDING_RADIUS;
    if (boss.exposed && !encounter.shaBanner) {
      encounter.shaBanner = true;
      combat.banner = 'LURED IN -- HIT IT NOW'; combat.bannerTimer = 60;
    } else if (!boss.exposed) {
      encounter.shaBanner = false;
    }
  }
};

/* ---- Illuso's Mirror: dual-layer vulnerability ------------------------ */
/* "The arena has a mirror layer. Enemy only vulnerable when you're on the
   same layer. Learn the swap tell; time your Project across layers."
   Reuses `player.projecting` (GDD §3.4's existing Close-range Project
   flag, stand_classes.js) as the player's own layer toggle instead of
   inventing a second dimension-swap input -- Project already roots the
   User and is a deliberate, telegraphed choice, exactly the tell GDD
   wants "learned". */
const MIRROR_SWAP_FRAMES = 240; // 4s -- boss's own layer flips on this clock, telegraphed

export const rf_illusos_mirror = {
  onStart(combat, encounter) {
    const boss = combat.enemies[0];
    encounter.mirrorBoss = boss;
    boss.mirrorLayer = false;
    encounter.mirrorTimer = MIRROR_SWAP_FRAMES;
    combat.dispatcher.effect('onHitResolve', PRIORITY.CLAMP, ctx => {
      if (ctx.isPlayerAttacker && ctx.defender === boss && !!combat.player.projecting !== !!boss.mirrorLayer) {
        ctx.cancelled = true;
      }
    }, 'rf_illusos_mirror');
  },
  onTick(combat, encounter) {
    encounter.mirrorTimer -= 1;
    if (encounter.mirrorTimer > 0) return;
    encounter.mirrorTimer = MIRROR_SWAP_FRAMES;
    encounter.mirrorBoss.mirrorLayer = !encounter.mirrorBoss.mirrorLayer;
    combat.banner = encounter.mirrorBoss.mirrorLayer ? 'MIRROR LAYER SHIFTS' : 'MIRROR LAYER SETTLES';
    combat.bannerTimer = 60;
  }
};

/* ---- Formaggio's Shrink: -60% damage dealt, +80% Step distance -------- */
/* "You're shrunk... use hazards; you can enter spaces the enemy can't."
   Both numbers are plain resolver multipliers -- getDamage (already the
   isPlayerAttacker choke point every Fragment's damage bonus goes
   through) and getMoveSpeed (dodge distance now reads it too, see
   combat_player.js -- a real resolver gap this Rule Fight's authoring
   found and closed, not a bespoke field of its own). */
export const rf_formaggios_shrink = {
  onStart(combat) {
    combat.dispatcher.query('getDamage', PRIORITY.MULTIPLY, (value, ctx) => (ctx.isPlayerAttacker ? value * 0.4 : value), 'rf_formaggios_shrink');
    combat.dispatcher.query('getMoveSpeed', PRIORITY.MULTIPLY, value => value * 1.8, 'rf_formaggios_shrink');
  }
};

/* ---- Baby Face: learns your last move, resists a repeat --------------- */
/* "Enemy learns your last-used move and gains resistance to it. Forces
   move variety." onHitLanded already carries `slot` (mission_counters.js
   reads the same field) -- this reads it into a plain field on the boss
   and multiplies getDamage the next time that same slot lands, in that
   order (getDamage runs during resolveDamage, onHitLanded fires after --
   see combat_player.js), so the resistance is live for the very next hit
   of the repeated move, not a frame late. */
export const rf_baby_face = {
  onStart(combat) {
    const boss = combat.enemies[0];
    combat.dispatcher.query('getDamage', PRIORITY.MULTIPLY, (value, ctx) => {
      if (ctx.isPlayerAttacker && ctx.defender === boss && ctx.slot && ctx.slot === boss.babyFaceLastSlot) return value * 0.5;
      return value;
    }, 'rf_baby_face');
    combat.dispatcher.effect('onHitLanded', PRIORITY.ADD, ctx => {
      if (ctx.attacker === combat.player && ctx.defender === boss) boss.babyFaceLastSlot = ctx.slot;
    }, 'rf_baby_face');
  }
};
