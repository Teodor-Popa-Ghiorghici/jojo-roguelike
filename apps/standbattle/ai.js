/* Shared attack-pattern module library — §9. A boss is a recombination of
   these plus exactly one bespoke signature move, not a bespoke state
   machine per enemy. This file only decides WHAT an enemy is doing and for
   how long; combat.js resolves collisions and damage against that state.

   Timing is whole frames at the sim's fixed 60Hz step (tech §5 Phase 1) --
   the ms in each comment is the pre-Phase-1 authored value, kept only for
   traceability. projectileSpeed stays authored in px/sec (content-author
   -friendly units); combat.js resolves it to a per-frame delta exactly
   once, at the moment a projectile spawns. */
/* `glyph` (GDD §21, Phase 2 deliverable 7): a distinct outline shape per
   telegraph so colour-blind/male-colour-deficient players (~8% per the
   GDD) still read which attack is coming -- ring = sweep, chevron = slam,
   crosshair = ranged. Drawn by arena.js's telegraph(); purely a render
   hint, the sim never reads it.

   `hitbox` (melee patterns only, tech §2.4/§2.5): the AABB rectangle
   checked once, the instant the pattern's active window opens, via
   hitbox.js's overlaps() -- replacing the old `Math.abs(dx) <= range`
   scalar test. Ranged patterns keep `range` only as an AI pattern-
   selection distance heuristic (pickPattern below); their actual hit test
   is the projectile-vs-player distance loop in combat_enemy.js, which
   applies the same tag-based depth tolerance via hitbox.js.

   `armor` (bool, GDD §3.9): true means this pattern cannot be poise-
   interrupted during its windup -- always paired with the mandatory
   telegraph, so it is firm, never unfair (poise.js checks this before
   forcing a Stagger). `tags` include 'heavy' on patterns that should
   break a held Guard (defense.js). */
export const PATTERNS = {
  sweep: {
    id: 'sweep', label: 'SWEEP', windupFrames: 20, activeFrames: 10, recoverFrames: 18, // 340/160/300ms
    range: 84, dmgMult: 1, knockback: 18, hitstopMs: 60, telegraph: '#FFFF55', glyph: 'ring',
    armor: false, tags: ['melee', 'medium'],
    hitbox: { x: 42, z: 0, w: 84, tags: ['melee', 'medium'] }
  },
  telegraphed_slam: {
    id: 'telegraphed_slam', label: 'SLAM', windupFrames: 37, activeFrames: 8, recoverFrames: 28, // 620/140/460ms
    range: 74, dmgMult: 1.9, knockback: 32, hitstopMs: 110, telegraph: '#FF5555', glyph: 'chevron',
    armor: true, tags: ['melee', 'heavy'],
    hitbox: { x: 37, z: 0, w: 74, tags: ['melee', 'heavy'] }
  },
  projectile: {
    id: 'projectile', label: 'RANGED', windupFrames: 19, activeFrames: 54, recoverFrames: 18, // 320/900/300ms
    range: 400, dmgMult: 0.9, knockback: 11, hitstopMs: 50, telegraph: '#55FFFF', glyph: 'crosshair',
    armor: false, tags: ['ranged'],
    projectileSpeed: 440, ranged: true
  },
  /* Knife Thug's signature (GDD §4.2 #2): short, cheap, fast -- 17 frames
     (283ms) clears the spec §5.1/GDD §6.8 260ms fairness floor with a
     small margin rather than sitting right on it, since this is the
     shortest windup in the roster. */
  quick_stab: {
    id: 'quick_stab', label: 'STAB', windupFrames: 17, activeFrames: 6, recoverFrames: 14,
    range: 58, dmgMult: 0.7, knockback: 10, hitstopMs: 45, telegraph: '#FF9955', glyph: 'ring',
    armor: false, tags: ['melee', 'light'],
    hitbox: { x: 30, z: 0, w: 58, tags: ['melee', 'light'] }
  },
  /* Phase 9b additions -- three new pattern *shapes*, not three new
     mechanisms: `shield_advance`/`zone_denial`/`bomb_plant` are plain
     PATTERNS entries like every other move, differing only in their
     authored numbers plus `zone_denial`/`bomb_plant` opting into the
     existing generic `hazard` field (hazards.js) that sheer_heart_attack
     already proved out for a non-boss pattern. */
  shield_advance: {
    id: 'shield_advance', label: 'SHIELD ADVANCE', windupFrames: 30, activeFrames: 10, recoverFrames: 24, // 500/167/400ms
    range: 70, dmgMult: 1.1, knockback: 22, hitstopMs: 70, telegraph: '#5555FF', glyph: 'chevron',
    armor: true, tags: ['melee', 'heavy'],
    hitbox: { x: 35, z: 0, w: 70, tags: ['melee', 'heavy'] }
  },
  sniper_shot: {
    id: 'sniper_shot', label: 'SNIPER SHOT', windupFrames: 46, activeFrames: 40, recoverFrames: 24, // 767/667/400ms
    range: 420, dmgMult: 1.3, knockback: 14, hitstopMs: 60, telegraph: '#55FFFF', glyph: 'crosshair',
    armor: false, tags: ['ranged'],
    projectileSpeed: 520, ranged: true
  },
  zone_denial: {
    id: 'zone_denial', label: 'ZONE DENIAL', windupFrames: 34, activeFrames: 46, recoverFrames: 30, // 567/767/500ms
    range: 360, dmgMult: 0.6, knockback: 6, hitstopMs: 40, telegraph: '#AA00AA', glyph: 'crosshair',
    armor: false, tags: ['ranged'],
    projectileSpeed: 260, ranged: true,
    hazard: { radius: 46, tickFrames: 24, dmg: 4, lifeFrames: 210 }
  },
  bomb_plant: {
    id: 'bomb_plant', label: 'BOMB PLANT', windupFrames: 30, activeFrames: 30, recoverFrames: 26, // 500/500/433ms
    range: 90, dmgMult: 0.3, knockback: 4, hitstopMs: 30, telegraph: '#FF55FF', glyph: 'ring',
    armor: false, tags: ['ranged'],
    projectileSpeed: 40, ranged: true, // plants close to itself rather than truly "firing"
    hazard: { radius: 55, tickFrames: 18, dmg: 6, lifeFrames: 120 }
  },
  sheer_heart_attack: {
    id: 'sheer_heart_attack', label: 'SHEER HEART ATTACK', windupFrames: 42, activeFrames: 72, recoverFrames: 31, // 700/1200/520ms
    range: 460, dmgMult: 1.7, knockback: 25, hitstopMs: 90, telegraph: '#FF55FF', glyph: 'crosshair',
    armor: true, tags: ['ranged', 'heavy'],
    projectileSpeed: 360, ranged: true, homing: true,
    /* Phase 6 deliverable 2's "adds a rule": a pursuit that runs out its
       clock without connecting still detonates in place, leaving a
       lingering blast zone (hazards.js) -- generic data any future boss's
       own projectile pattern can opt into via this one field, not a
       second bespoke move. */
    hazard: { radius: 40, tickFrames: 20, dmg: 4, lifeFrames: 150 }
  },
  /* Phase 9d: 7 more boss signatures (2 more bosses -- Illuso, Funny
     Valentine -- use the `summon` def field, already generic since
     Phase 9b's Puppeteer/Caller, as their one bespoke signature instead
     of a new PATTERNS entry). Every windup here still clears the 260ms
     fairness floor -- canon fidelity never overrides that invariant, see
     king_crimson_erase and made_in_heaven_acceleration below, both
     "instant"-feeling canon abilities kept to a legal minimum instead of
     truly skipping the telegraph. */
  highway_star_dash: { // Yuya Fungami / Highway Star (Act I) -- extreme speed while "riding" his Stand
    id: 'highway_star_dash', label: 'HIGHWAY STAR', windupFrames: 18, activeFrames: 8, recoverFrames: 20, // 300/133/333ms
    range: 90, dmgMult: 1.6, knockback: 26, hitstopMs: 80, telegraph: '#55FF99', glyph: 'chevron',
    armor: false, tags: ['melee', 'heavy'],
    hitbox: { x: 45, z: 0, w: 90, tags: ['melee', 'heavy'] }
  },
  emperor_curveshot: { // Hol Horse / The Emperor (Act II) -- bullets that curve in midair
    id: 'emperor_curveshot', label: 'CURVING BULLET', windupFrames: 24, activeFrames: 50, recoverFrames: 22, // 400/833/367ms
    range: 420, dmgMult: 1.1, knockback: 14, hitstopMs: 55, telegraph: '#CC66FF', glyph: 'crosshair',
    armor: false, tags: ['ranged'],
    projectileSpeed: 480, ranged: true, homing: true
  },
  geb_drowning_wave: { // N'Doul / Geb (Act II) -- a sound-Stand's wide, unseen drowning pool
    id: 'geb_drowning_wave', label: 'DROWNING WAVE', windupFrames: 30, activeFrames: 40, recoverFrames: 26, // 500/667/433ms
    range: 380, dmgMult: 0.8, knockback: 10, hitstopMs: 50, telegraph: '#3399FF', glyph: 'crosshair',
    armor: false, tags: ['ranged'],
    projectileSpeed: 300, ranged: true,
    hazard: { radius: 70, tickFrames: 22, dmg: 5, lifeFrames: 240 }
  },
  the_world_time_stop: { // DIO / The World (Act II final) -- everything that "happened" during stopped time, landing at once
    id: 'the_world_time_stop', label: 'THE WORLD', windupFrames: 28, activeFrames: 10, recoverFrames: 30, // 467/167/500ms
    range: 100, dmgMult: 2.2, knockback: 30, hitstopMs: 140, telegraph: '#FFDD00', glyph: 'chevron',
    armor: true, tags: ['melee', 'heavy'],
    hitbox: { x: 50, z: 0, w: 100, tags: ['melee', 'heavy'] },
    hazard: { radius: 50, tickFrames: 20, dmg: 6, lifeFrames: 180 } // knives left where time resumed
  },
  little_feet_shrink_zone: { // Formaggio / Little Feet (Act III) -- a shrinking void that swallows anything inside
    id: 'little_feet_shrink_zone', label: 'LITTLE FEET', windupFrames: 26, activeFrames: 36, recoverFrames: 24, // 433/600/400ms
    range: 340, dmgMult: 0.7, knockback: 8, hitstopMs: 45, telegraph: '#88FF44', glyph: 'crosshair',
    armor: false, tags: ['ranged'],
    projectileSpeed: 280, ranged: true,
    hazard: { radius: 50, tickFrames: 20, dmg: 5, lifeFrames: 200 }
  },
  king_crimson_erase: { // Diavolo / King Crimson (Act III final) -- erases the seconds between windup and impact
    id: 'king_crimson_erase', label: 'EPITAPH', windupFrames: 20, activeFrames: 8, recoverFrames: 22, // 334/133/367ms -- legal minimum, not skipped
    range: 95, dmgMult: 2.0, knockback: 28, hitstopMs: 130, telegraph: '#FFD700', glyph: 'chevron',
    armor: true, tags: ['melee', 'heavy'],
    hitbox: { x: 48, z: 0, w: 95, tags: ['melee', 'heavy'] }
  },
  made_in_heaven_acceleration: { // Enrico Pucci / Made in Heaven (Act IV true final) -- the world running faster
    id: 'made_in_heaven_acceleration', label: 'ACCELERATION', windupFrames: 18, activeFrames: 8, recoverFrames: 16, // 300/133/267ms -- fastest recovery in the roster
    range: 90, dmgMult: 1.8, knockback: 24, hitstopMs: 100, telegraph: '#FFFFFF', glyph: 'chevron',
    armor: true, tags: ['melee', 'heavy'],
    hitbox: { x: 45, z: 0, w: 90, tags: ['melee', 'heavy'] }
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
    state: 'approach', timer: 0, pattern: null, staggerMult: 1,
    approachRange: approachRange || defaultApproachRange(patternIds),
    patternIds
  };
}

/* Forces the AI into a Stagger (GDD §3.9's poise-break, or a successful
   Clash's 24f free-punish window, GDD §3.7) -- whatever pattern it was
   mid-execution is abandoned. `mult` scales damage taken while staggered
   (x1.5 on a poise break; 1 -- no bonus -- on a Clash stagger, which is a
   punish window, not extra damage). */
export function enterStagger(ai, frames, mult) {
  ai.state = 'staggered';
  ai.timer = frames;
  ai.pattern = null;
  ai.staggerMult = mult == null ? 1 : mult;
}

/* Advances the AI state machine by exactly one sim frame. Returns an event
   object for combat.js to act on ('spawnMelee' | 'spawnProjectile' | null),
   or null when nothing new happened this frame. `rng` is the run's 'ai'
   stream (rng.js). `canCommit` (GDD §16, token.js) gates only the
   approach->windup transition: an enemy without the attack token keeps
   circling/holding spacing (the existing 'approach' branch already does
   that) but may never actually throw out a pattern. Omitted/undefined
   behaves as `true` -- a solo fight (boss/elite) has exactly one candidate
   against 2 token slots and is always granted one, so this gate is a no-op
   for every encounter that existed before Phase 5. */
export function stepEnemyAI(ai, dist, rng, canCommit) {
  ai.timer -= 1;
  if (ai.state === 'staggered') {
    if (ai.timer <= 0) { ai.state = 'approach'; ai.staggerMult = 1; }
    return null;
  }
  if (ai.state === 'approach') {
    if (canCommit === false) return null;
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
