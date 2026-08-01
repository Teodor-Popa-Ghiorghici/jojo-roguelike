/* Compound boss hurtboxes -- GDD §4.6 Phase 3: "the boss exposes its
   User... a small, high-value hurtbox taking x3 damage that hides behind
   the Stand." Generic and data-driven (spec §0): any enemy def may carry
   a `parts` array; a plain enemy/boss with none behaves exactly as before
   (this file is a no-op for every fight that existed before Phase 6).

   A part is `{ id, label, revealAtPhase, dx, dz, w, h, dmgMult }` -- dx/dz
   are offsets from the owning enemy's own (x, z) transform (dx scaled by
   the enemy's current facing so "behind" stays behind on either side),
   w/h are the part's own small hurtbox dimensions, dmgMult multiplies
   damage into the enemy's own shared HP pool (resolvers.js's
   resolveDamage, via ctx.partMult) -- there is no separate health bar for
   a part, per the GDD's own "hides behind the Stand", not "has its own
   Stand-style HP bar" (that's Aspect of the Rite, a player-side Fragment,
   not this). Revealed once the enemy's phaseIndex reaches revealAtPhase
   (combat_enemy.js's updateEnemyPhase) and never re-hidden. */

export function initParts(enemy, def) {
  enemy.parts = (def.parts || []).map(p => ({ ...p, revealed: false, x: enemy.x, z: enemy.z, hitProxy: null }));
}

/* Called once per phase transition (combat_enemy.js). Fires onPartExposed
   (an EVENT hook, hooks.js) so fx.js/audio.js can cue the reveal
   distinctly from the phase-transition cue that always fires alongside it
   -- "get past the Stand" is a moment worth its own callout, not just
   another stat-only banner. */
export function revealPartsForPhase(combat, enemy, phaseIndex) {
  enemy.parts.forEach(part => {
    if (part.revealed || part.revealAtPhase !== phaseIndex) return;
    part.revealed = true;
    combat.dispatcher.fire('onPartExposed', { enemy, part });
  });
}

/* One sim frame: keeps every revealed part's world position glued to its
   owner, exactly the way combat_stand.js's anchorPosition glues the
   Stand to the User every frame. Unrevealed parts are skipped (no reason
   to compute a position nothing can hit yet). */
export function stepParts(enemy) {
  enemy.parts.forEach(part => {
    if (!part.revealed) return;
    part.x = enemy.x + (enemy.facing || 1) * (part.dx || 0);
    part.z = enemy.z + (part.dz || 0);
  });
}

function makePartProxy(enemy, part) {
  return {
    __isPart: true, real: enemy, part, dmgMult: part.dmgMult, label: part.label,
    get x() { return part.x; },
    get z() { return part.z; },
    get body() { return { hurtboxW: part.w, hurtboxH: part.h }; },
    get hp() { return enemy.hp; }
  };
}

/* Builds the flat list of hit-testable "defenders" for combat_player.js's
   hitbox.js's stepMoveHitboxes -- each living enemy's own body (the exact
   same object reference every frame, so hit-dedup identity is unchanged
   from before this file existed) plus a stable, cached proxy per revealed
   part. `realTargetOf`/`dmgMultOf` unwrap a hit target back into "which
   real enemy took the damage" and "what multiplier applies" -- the two
   things resolvers.js/combat_player.js need and nothing else does. */
export function collectHitTargets(enemies) {
  const targets = [];
  enemies.forEach(e => {
    if (e.hp <= 0) return;
    targets.push(e);
    e.parts.forEach(part => {
      if (!part.revealed) return;
      if (!part.hitProxy) part.hitProxy = makePartProxy(e, part);
      targets.push(part.hitProxy);
    });
  });
  return targets;
}

export function realTargetOf(target) { return target.__isPart ? target.real : target; }
export function dmgMultOf(target) { return target.__isPart ? target.dmgMult : 1; }
