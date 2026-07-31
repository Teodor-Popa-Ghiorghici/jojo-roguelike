/* Fighter runtime state factories -- the entity/component store (tech
   §2.3). A "fighter" IS an entity: `combat.js` treats the player and any
   enemy/boss generically as entries in `combat.entities`, not as two
   specially-named variables. Components below are attached as plain
   fields on the entity rather than nested objects, because the existing
   render/pose layer (pose_player.js, pose_enemy.js, render.js, hud.js --
   none of which this phase is allowed to rewrite) already reads `.x`,
   `.facing`, `.hp` etc. directly off these objects. Flattening keeps that
   contract intact while still giving every entity the full component set:

     Transform  -> `.x`, `.z`           (belt-plane position, world units)
     Body       -> `.body`              (hurtbox stub; no collision system yet)
     Health     -> `.hp`, `.maxHp`
     Poise      -> `.poise`             (stub; tech §3.9 is Phase 2)
     Statuses   -> `.statuses`          (stub array; GDD §3.10 is Phase 2)
     StandLink  -> `.standLink`         (stub; GDD §3.1 User/Stand split is Phase 2+)
     Brain      -> `.brain`             (AI profile; aliases `.ai` on enemies, null on the player)
     Frames     -> `.frames`            (stub; the real frame-data timeline is tech §2.4, Phase 2)
     Aggro      -> `.aggro`             (stub weight; meaningful once crowds exist)

   `z` defaults to Z_REST for every entity so a fight where nobody touches
   the depth axis renders exactly as it did before z existed. */

import { SIM_HZ, Z_REST } from './constants.js';

/* Step/dodge charges (GDD §3.7): a hard cap on invulnerability uptime,
   replacing the old "hold to stay safe" exploit (tech audit item #1). */
export const DODGE_CHARGE_MAX = 2;

function attachComponentStubs(entity) {
  entity.body = { hurtboxW: 30, hurtboxH: 64 }; // unused until Phase 2 hitboxes
  entity.poise = { current: Infinity, max: Infinity }; // unused until Phase 2 stagger
  entity.statuses = []; // unused until the status system exists
  entity.standLink = null; // unused until the User/Stand split exists
  entity.frames = null; // unused until the frame-data timeline exists
  entity.aggro = 1; // unused until crowds/target-selection exist
  return entity;
}

export function createPlayerFighter(stand, x, runBuffs, z) {
  const powerMult = runBuffs.reduce((m, b) => m * (b.powerMult || 1), 1);
  const speedMult = runBuffs.reduce((m, b) => m * (b.speedMult || 1), 1);
  const maxPersistence = 100 + runBuffs.reduce((s, b) => s + (b.maxPersistenceBonus || 0), 0);
  const entity = {
    id: 'player', kind: 'player', stand, x, z: z == null ? Z_REST : z, facing: 1,
    hp: 100, maxHp: 100,
    persistence: 30, maxPersistence,
    powerMult, speedMult,
    state: 'idle', stateTimer: 0, activeMove: null, hitTargetsThisSwing: null,
    invulnerable: false, parryWindow: false, parrySuccess: false,
    dodgeCharges: DODGE_CHARGE_MAX, dodgeRechargeFrames: 0,
    bufferedAction: null,
    squash: 0, hurtFlash: 0, comboCount: 0, moving: false,
    brain: null // the User is player-controlled, not AI-driven
  };
  return attachComponentStubs(entity);
}

export function createEnemyFighter(def, x, hpMult, speedMult, tint, z) {
  const speedPx = def.speedPx * (speedMult || 1);
  const entity = {
    id: def.id, kind: 'enemy', def, x, z: z == null ? Z_REST : z, facing: -1,
    hp: Math.round(def.hp * (hpMult || 1)), maxHp: Math.round(def.hp * (hpMult || 1)),
    speedPx, speedPxPerFrame: speedPx / SIM_HZ, // Speed resolves to a per-frame delta exactly once here
    tint: tint || null,
    state: 'alive', hurtFlash: 0, squash: 0, knockVx: 0, moving: false,
    ai: null, projectiles: [], phaseIndex: 0, deathTimer: 0
  };
  attachComponentStubs(entity);
  entity.brain = null; // wired to entity.ai (createEnemyAI's result) once combat.js assigns it
  return entity;
}

export function applyDamage(fighter, amount) {
  fighter.hp = Math.max(0, fighter.hp - amount);
  fighter.hurtFlash = 1;
  return fighter.hp <= 0;
}

export function clampPersistence(fighter) {
  fighter.persistence = Math.max(0, Math.min(fighter.maxPersistence, fighter.persistence));
}
