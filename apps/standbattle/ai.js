/* Shared attack-pattern module library — §9. A boss is a recombination of
   these plus exactly one bespoke signature move, not a bespoke state
   machine per enemy. This file only decides WHAT an enemy is doing and for
   how long; combat.js resolves collisions and damage against that state.

   Timing is whole frames at the sim's fixed 60Hz step (tech §5 Phase 1) --
   the ms in each comment is the pre-Phase-1 authored value, kept only for
   traceability. projectileSpeed stays authored in px/sec (content-author
   -friendly units); combat.js resolves it to a per-frame delta exactly
   once, at the moment a projectile spawns. */
export const PATTERNS = {
  sweep: {
    id: 'sweep', label: 'SWEEP', windupFrames: 20, activeFrames: 10, recoverFrames: 18, // 340/160/300ms
    range: 84, dmgMult: 1, knockback: 18, hitstopMs: 60, telegraph: '#FFFF55'
  },
  telegraphed_slam: {
    id: 'telegraphed_slam', label: 'SLAM', windupFrames: 37, activeFrames: 8, recoverFrames: 28, // 620/140/460ms
    range: 74, dmgMult: 1.9, knockback: 32, hitstopMs: 110, telegraph: '#FF5555'
  },
  projectile: {
    id: 'projectile', label: 'RANGED', windupFrames: 19, activeFrames: 54, recoverFrames: 18, // 320/900/300ms
    range: 400, dmgMult: 0.9, knockback: 11, hitstopMs: 50, telegraph: '#55FFFF',
    projectileSpeed: 440, ranged: true
  },
  sheer_heart_attack: {
    id: 'sheer_heart_attack', label: 'SHEER HEART ATTACK', windupFrames: 42, activeFrames: 72, recoverFrames: 31, // 700/1200/520ms
    range: 460, dmgMult: 1.7, knockback: 25, hitstopMs: 90, telegraph: '#FF55FF',
    projectileSpeed: 360, ranged: true, homing: true
  }
};

const MELEE_MAX_RANGE = 110;

/* Choose a pattern from the enemy's list, biased by distance: melee
   patterns need to be in range, ranged patterns are picked more often when
   the player is far away. `rng` is the run's 'ai' stream (rng.js) -- AI
   choices must be reproducible from the run seed, never Math.random(). */
export function pickPattern(patternIds, dist, rng) {
  const near = patternIds.filter(id => PATTERNS[id].range <= MELEE_MAX_RANGE || dist <= PATTERNS[id].range);
  const pool = near.length ? near : patternIds;
  const weighted = [];
  pool.forEach(id => {
    const p = PATTERNS[id];
    const farBias = p.ranged && dist > MELEE_MAX_RANGE ? 3 : 1;
    for (let i = 0; i < farBias; i++) weighted.push(id);
  });
  return weighted[Math.floor(rng.random() * weighted.length)];
}

/* The enemy must stop closing distance within its shortest MELEE pattern's
   reach, never beyond it -- otherwise it can plant itself just outside
   every pattern's actual hitbox and attack forever without ever
   connecting (and the player can't reach it either). Ranged patterns
   don't gate this: they can fire from anywhere within their own range. */
export function defaultApproachRange(patternIds) {
  const meleeRanges = patternIds.map(id => PATTERNS[id]).filter(p => !p.ranged).map(p => p.range);
  return meleeRanges.length ? Math.min(...meleeRanges) : MELEE_MAX_RANGE;
}

export function createEnemyAI(patternIds, approachRange) {
  return {
    state: 'approach', timer: 0, pattern: null,
    approachRange: approachRange || defaultApproachRange(patternIds),
    patternIds
  };
}

/* Advances the AI state machine by exactly one sim frame. Returns an event
   object for combat.js to act on ('spawnMelee' | 'spawnProjectile' | null),
   or null when nothing new happened this frame. `rng` is the run's 'ai'
   stream (rng.js). */
export function stepEnemyAI(ai, dist, rng) {
  ai.timer -= 1;
  if (ai.state === 'approach') {
    if (dist <= ai.approachRange || rng.random() < 0.002) {
      ai.pattern = PATTERNS[pickPattern(ai.patternIds, dist, rng)];
      ai.state = 'windup';
      ai.timer = ai.pattern.windupFrames;
    }
    return null;
  }
  if (ai.state === 'windup') {
    if (ai.timer <= 0) {
      ai.state = 'active';
      ai.timer = ai.pattern.activeFrames;
      return { type: ai.pattern.ranged ? 'spawnProjectile' : 'spawnMelee', pattern: ai.pattern };
    }
    return null;
  }
  if (ai.state === 'active') {
    if (ai.timer <= 0) {
      ai.state = 'recover';
      ai.timer = ai.pattern.recoverFrames;
    }
    return null;
  }
  if (ai.state === 'recover') {
    if (ai.timer <= 0) { ai.state = 'approach'; ai.pattern = null; }
    return null;
  }
  return null;
}

export function enemyIsVulnerableToStagger(ai) {
  return ai.state === 'windup' || ai.state === 'approach';
}
