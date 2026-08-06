/* Enemy-side stepping: AI movement, attack-pattern state machine, phase
   transitions, poise/stagger and projectiles. Split out of combat.js to
   keep both files under the repo's 300-line rule -- this follows the
   player/enemy seam combat.js already had. Every timer here is a whole
   sim frame at the fixed 60Hz step.

   Phase 5: operates on one `enemy` passed in by combat_crowd.js's
   per-frame loop over `combat.enemies`, instead of a fixed `combat.enemy`
   -- a boss/elite/solo fight is just a one-entry crowd (encounter.js), so
   this file no longer needs a separate code path for it. */

import { stepEnemyAI, defaultApproachRange } from './ai.js';
import { pickAttackTarget, pickAttackTargetPoint } from './combat_stand.js';
import { stepPoise, STAGGER_FRAMES, STAGGER_DAMAGE_MULT } from './poise.js';
import { resolveIncomingAttack } from './combat_defense.js';
import { revealPartsForPhase, stepParts } from './boss_parts.js';
import { stepPurge } from './purge.js';
import { spawnHazard } from './hazards.js';
import { stepSummon } from './summons.js';
import { ARENA_MIN, ARENA_MAX, SIM_HZ } from './constants.js';

const LEASH_RANGE = 90; // Phase 9b Leashed -- world units from its own spawn point it will not chase past

const PHASE_INVULN_FRAMES = 30; // 500ms
const PHASE_BANNER_FRAMES = 108; // 1800ms
const HURT_FLASH_FRAMES = 9; // 150ms fade -- matches combat_player.js's player-side constant
const PROJECTILE_HIT_RADIUS = 10;

export function updateEnemyPhase(combat, enemy) {
  if (!enemy.def.phases || enemy.state !== 'alive') return;
  const frac = enemy.hp / enemy.maxHp;
  const next = enemy.phaseIndex + 1;
  const phases = enemy.def.phases;
  if (next < phases.length && frac <= phases[enemy.phaseIndex].hpAbove) {
    enemy.phaseIndex = next;
    enemy.ai.patternIds = phases[next].attackPatterns;
    enemy.ai.approachRange = defaultApproachRange(phases[next].attackPatterns);
    enemy.invulnFrames = PHASE_INVULN_FRAMES;
    // each phase entry owns its own line (Phase 6) -- 'PHASE N' is the fallback for content that doesn't bother
    combat.banner = phases[next].transitionLine || ('PHASE ' + (next + 1));
    combat.bannerTimer = PHASE_BANNER_FRAMES;
    combat.juice.triggerHitstop(160);
    combat.juice.triggerShake(0, -1, 8, 260);
    combat.dispatcher.fire('onPhaseTransition', {});
    revealPartsForPhase(combat, enemy, next); // GDD §4.6 Phase 3 -- a no-op unless this phase exposes a part
  }
}

/* Advances one enemy's movement, poise, its attack-pattern AI and its
   projectiles by exactly one sim frame. Melee patterns resolve their hit
   the instant the active window opens via hitbox.js's AABB overlaps()
   (tech §2.4/§2.5) instead of the old `Math.abs(dx) <= range` scalar
   check; resolveIncomingAttack (combat_defense.js) then runs the
   defensive-triangle dispatch (Step/Guard/Clash) against it. `enemy.hasToken`
   (token.js, GDD §16) gates whether this enemy's AI may actually commit to
   a pattern this frame -- everyone still moves/poises/regens regardless. */
export function stepEnemyMovementAndAI(combat, enemy, aiRng) {
  const { player, dispatcher } = combat;
  if (enemy.hp <= 0) {
    if (enemy.deathTimer > 0) enemy.deathTimer = Math.max(0, enemy.deathTimer - 1);
    if (enemy.hurtFlash > 0) enemy.hurtFlash = Math.max(0, enemy.hurtFlash - 1 / HURT_FLASH_FRAMES);
    return;
  }
  if (enemy.hurtFlash > 0) enemy.hurtFlash = Math.max(0, enemy.hurtFlash - 1 / HURT_FLASH_FRAMES);
  if (enemy.knockVx) { enemy.x += enemy.knockVx; enemy.knockVx *= 0.82; if (Math.abs(enemy.knockVx) < 0.3) enemy.knockVx = 0; }
  enemy.x = Math.max(ARENA_MIN, Math.min(ARENA_MAX, enemy.x));
  enemy.facing = player.x >= enemy.x ? 1 : -1;
  stepParts(enemy); // GDD §4.6 Phase 3 -- keeps a revealed part glued to its owner every frame
  stepPurge(combat, enemy); // GDD §18B -- the one-shot trigger check plus the Defend Mode tint sync
  /* GDD §3.9: regen-after-no-hit and pending poise-break -> Stagger.
     stepPoise() returns true only the frame it actually enters Stagger, so
     onStaggerStart (tech §2.1, mutable) fires exactly once per break. */
  if (stepPoise(enemy)) {
    dispatcher.runEffect('onStaggerStart', { entity: enemy, cause: 'poise', frames: STAGGER_FRAMES, mult: STAGGER_DAMAGE_MULT, cancelled: false });
  }
  if (enemy.invulnFrames > 0) { enemy.invulnFrames -= 1; return; }

  const dist = Math.abs(player.x - enemy.x);
  enemy.moving = false;
  /* GDD §15 Sudden Death: a `flees: true` enemy (encounter.js's spawnWave
     starts its AI here) runs away instead of closing distance, and never
     enters the attack-pattern state machine below -- "chase it across the
     arena", not a normal fight. Also the generic escape behavior GDD §17
     wants for the Stalker later. */
  if (enemy.ai.state === 'flee') {
    const dir = player.x > enemy.x ? -1 : 1;
    enemy.x = Math.max(ARENA_MIN, Math.min(ARENA_MAX, enemy.x + dir * enemy.speedPxPerFrame));
    enemy.moving = true;
    return;
  }
  if (enemy.ai.state === 'approach') {
    const dir = player.x > enemy.x ? 1 : -1;
    // Phase 9b Leashed: never closes distance past its own spawn point, generic on the optional affix flag.
    const leashed = enemy.affixData && enemy.affixData.leashed &&
      Math.abs((enemy.x + dir * enemy.speedPxPerFrame) - (enemy.spawnX == null ? enemy.x : enemy.spawnX)) > LEASH_RANGE;
    if (dist > enemy.ai.approachRange && !leashed) { enemy.x += dir * enemy.speedPxPerFrame; enemy.moving = true; }
  }
  stepSummon(combat, enemy, aiRng); // Phase 9b Puppeteer/Caller -- a no-op for every def without a `summon` field
  const wasWindup = enemy.ai.state === 'windup';
  // GDD §4.2 Hound (#7): "ignores attack tokens" -- always eligible to commit, never gated by the crowd's pool
  const ev = stepEnemyAI(enemy.ai, dist, aiRng, enemy.hasToken || enemy.def.ignoresToken, combat.menace);
  if (!wasWindup && enemy.ai.state === 'windup') dispatcher.fire('onTelegraphStart', { pattern: enemy.ai.pattern });
  if (ev && ev.type === 'spawnMelee') {
    /* GDD §3.1/deliverable 5: the User and the Stand are separately
       targetable hurtboxes -- pickAttackTarget (combat_stand.js) tests
       overlap against both and, if both are hit, weights the pick by
       aggro using the same deterministic 'ai' rng stream as pattern
       selection. */
    const target = pickAttackTarget(combat, enemy, ev.pattern.hitbox, aiRng);
    if (target) resolveIncomingAttack(combat, ev.pattern, enemy.x, target, enemy);
  } else if (ev && ev.type === 'spawnProjectile') {
    enemy.projectiles.push({
      x: enemy.x, z: enemy.z, dir: player.x >= enemy.x ? 1 : -1, pattern: ev.pattern,
      life: ev.pattern.activeFrames, speedPerFrame: ev.pattern.projectileSpeed / SIM_HZ
    });
  }
  updateEnemyPhase(combat, enemy);

  for (let i = enemy.projectiles.length - 1; i >= 0; i--) {
    const pr = enemy.projectiles[i];
    pr.life -= 1;
    if (pr.homing === undefined) pr.homing = pr.pattern.homing;
    if (pr.homing) pr.dir = player.x >= pr.x ? 1 : -1;
    pr.x += pr.dir * pr.speedPerFrame;
    const target = pickAttackTargetPoint(combat, pr.x, pr.z, pr.pattern.tags, PROJECTILE_HIT_RADIUS, aiRng, enemy);
    if (target) {
      resolveIncomingAttack(combat, pr.pattern, pr.x, target, enemy);
      enemy.projectiles.splice(i, 1);
      continue;
    }
    if (pr.life <= 0) {
      // Phase 6 deliverable 2's "rule": a pursuit that times out without connecting still detonates
      if (pr.pattern.hazard) spawnHazard(combat, pr.x, pr.z, pr.pattern.hazard);
      enemy.projectiles.splice(i, 1);
    } else if (pr.x < ARENA_MIN - 20 || pr.x > ARENA_MAX + 20) {
      enemy.projectiles.splice(i, 1);
    }
  }
}
