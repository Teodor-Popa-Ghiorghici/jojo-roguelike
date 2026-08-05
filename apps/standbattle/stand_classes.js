/* Stand Class control schemes -- GDD §3.4, Phase 9a. Close-Range (Phase 4)
   was built as unconditional logic in combat_stand.js/combat_player.js;
   this file turns "which class" into one data field (`controlScheme` on a
   STANDS entry) read through the single CONTROL_SCHEMES table below, so a
   4th class (Automatic, post-launch) is a new table entry -- nothing in
   combat_stand.js/combat_player.js/resolvers.js reopens.

   Each entry:
   - `dodgeChargeMax` -- the User's Step charge cap (combat.js stamps this
     onto `player.dodgeChargeMax` once at fight creation; defense.js/
     effect_lib.js/hud.js all read the entity field, never this table).
   - `damageMult` -- baseline damage scalar (resolvers.js's resolveDamage
     reads this table directly for player-attributed hits).
   - `updateStandPosition(combat, tetherPx)` -- one frame of Stand movement;
     must set `player.standDetached` (Warden's #12 hook, resolvers.js).
   - `stepUser(combat, keys)` -- one frame of User movement/AI.

   Deliberately imports only constants.js (a leaf module) so resolvers.js
   can import CONTROL_SCHEMES from here with no risk of a cycle back
   through combat_player.js/combat_stand.js. */

import { ARENA_MIN, ARENA_MAX, ARENA_Z_MIN, ARENA_Z_MAX, SIM_HZ, PLAYER_SPEED_PER_FRAME } from './constants.js';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function moveAxes(keys) {
  let dx = 0, dz = 0;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (keys.forward) dz -= 1;
  if (keys.back) dz += 1;
  return { dx, dz };
}

function moveEntity(entity, dx, dz, step) {
  entity.x = clamp(entity.x + dx * step, ARENA_MIN, ARENA_MAX);
  entity.z = clamp(entity.z + dz * step, ARENA_Z_MIN, ARENA_Z_MAX);
}

/* ---------- Close-Range (GDD §3.4): anchored, Project is a held button ---------- */

export const ANCHOR_OFFSET_PX = 22; // "rides ~22px in front of the User"
const PROJECT_DRIVE_PER_FRAME = 260 / SIM_HZ; // ~0.2s to cover Star Platinum's 52px tether
const PROJECT_MAX_OVEREXTEND = 1.4; // 40% past tetherPx, at most, from holding Project+movement

function anchorPosition(owner) {
  return { x: owner.x + owner.facing * ANCHOR_OFFSET_PX, z: owner.z };
}

function closeUpdateStand(combat, tetherPx) {
  const { player, stand, keys, dispatcher } = combat;
  const canProject = stand.staggerFrames <= 0;
  player.projecting = !!(keys.project && canProject);

  if (player.projecting) {
    if (!stand.wasProjecting) dispatcher.runEffect('onProjectStart', { entity: player, cancelled: false });
    let { dx, dz } = moveAxes(keys);
    if (dx === 0 && dz === 0) { dx = player.facing; dz = 0; } // default: drive straight out in front
    const len = Math.hypot(dx, dz) || 1;
    let nx = clamp(stand.x + (dx / len) * PROJECT_DRIVE_PER_FRAME, ARENA_MIN, ARENA_MAX);
    let nz = clamp(stand.z + (dz / len) * PROJECT_DRIVE_PER_FRAME, ARENA_Z_MIN, ARENA_Z_MAX);
    const rawDist = Math.hypot(nx - player.x, nz - player.z);
    const maxDist = tetherPx * PROJECT_MAX_OVEREXTEND;
    if (rawDist > maxDist) {
      const k = maxDist / rawDist;
      nx = player.x + (nx - player.x) * k;
      nz = player.z + (nz - player.z) * k;
    }
    stand.x = nx; stand.z = nz;
  } else {
    if (stand.wasProjecting) {
      dispatcher.runEffect('onProjectEnd', { entity: player, forced: stand.staggerFrames > 0, cancelled: false });
    }
    const anchor = anchorPosition(player);
    stand.x = anchor.x; stand.z = anchor.z; // instant snap, no recovery (GDD §3.4)
  }
  stand.wasProjecting = player.projecting;
  player.standDetached = player.projecting;
}

function closeStepUser(combat, keys) {
  const { player, dispatcher } = combat;
  if (player.projecting) { player.moving = false; return; } // GDD §3.4: rooted while Projecting
  const { dx, dz } = moveAxes(keys);
  player.moving = dx !== 0 || dz !== 0;
  const speedMult = dispatcher.runQuery('getMoveSpeed', 1, { entity: player });
  moveEntity(player, dx, dz, PLAYER_SPEED_PER_FRAME * speedMult);
}

/* ---------- Mid-Range (GDD §3.4): orbits, flicked out on a 2.5s timer ---------- */

/* Design call (no player-facing UI this phase to make the radius itself
   "settable" -- that's content/UX, not engine): a class constant, wider
   than Close's 22px anchor. */
const MID_ORBIT_RADIUS_PX = 46;
const MID_FLICK_DURATION_FRAMES = Math.round(2.5 * SIM_HZ); // "flicked out on a timer (2.5s)"

function orbitPosition(owner) {
  return { x: owner.x + owner.facing * MID_ORBIT_RADIUS_PX, z: owner.z };
}

function midUpdateStand(combat, tetherPx) {
  const { player, stand, keys } = combat;
  const pressed = !!keys.project; // same key as Close's hold -- "same duality engine", read as an edge here
  const edge = pressed && !stand.prevProjectKey;
  stand.prevProjectKey = pressed;

  if (stand.flicked && stand.staggerFrames > 0) stand.flicked = false; // a landed hit force-retracts, same as Close
  if (edge && !stand.flicked && stand.staggerFrames <= 0) {
    stand.flicked = true;
    stand.flickTimer = MID_FLICK_DURATION_FRAMES;
    stand.flickTargetX = player.x + player.facing * tetherPx;
    stand.flickTargetZ = player.z;
  }

  if (stand.flicked) {
    stand.x = stand.flickTargetX; stand.z = stand.flickTargetZ;
    stand.flickTimer -= 1;
    if (stand.flickTimer <= 0) stand.flicked = false; // auto-retract, no key needed
  } else {
    const orbit = orbitPosition(player);
    stand.x = orbit.x; stand.z = orbit.z; // instant snap, same precedent as Close's release
  }
  player.standDetached = stand.flicked;
}

function midStepUser(combat, keys) {
  const { player, dispatcher } = combat;
  // GDD §3.4: "the User keeps mobility" -- never rooted, unlike Close's held Project
  const { dx, dz } = moveAxes(keys);
  player.moving = dx !== 0 || dz !== 0;
  const speedMult = dispatcher.runQuery('getMoveSpeed', 1, { entity: player });
  moveEntity(player, dx, dz, PLAYER_SPEED_PER_FRAME * speedMult);
}

/* ---------- Long-Range (GDD §3.4): permanently detached, User is AI ---------- */

const LONG_USER_RETREAT_SPEED_MULT = 0.7; // flavors "a slow, clumsy dodge" as a slower retreat, not a Step change
const LONG_COMMAND_ARRIVE_PX = 8;

function longUpdateStand(combat) {
  const { player, stand, keys, dispatcher } = combat;
  const { dx, dz } = moveAxes(keys); // GDD §3.4: "movement input drives the Stand"
  const speedMult = dispatcher.runQuery('getMoveSpeed', 1, { entity: player });
  moveEntity(stand, dx, dz, PLAYER_SPEED_PER_FRAME * speedMult);
  player.standDetached = true; // GDD §3.4: "permanently detached"
}

/* GDD §3.4: "a second body with simple retreat AI... commandable to
   reposition on a second key." One button, one well-defined order --
   regroup at the Stand's current position -- rather than an unspecified
   analog-target system the brief doesn't ask for. */
function longStepUser(combat, keys) {
  const { player, stand } = combat;
  const pressed = !!keys.command;
  if (pressed && !player.prevCommandKey) {
    player.commandTargetX = stand.x;
    player.commandTargetZ = stand.z;
  }
  player.prevCommandKey = pressed;

  let dx, dz;
  if (player.commandTargetX != null) {
    const tx = player.commandTargetX - player.x, tz = player.commandTargetZ - player.z;
    const dist = Math.hypot(tx, tz);
    if (dist <= LONG_COMMAND_ARRIVE_PX) {
      player.commandTargetX = null; player.commandTargetZ = null;
      dx = 0; dz = 0;
    } else {
      dx = tx / dist; dz = tz / dist;
    }
  } else {
    let nearest = null, bestDist = Infinity;
    for (const e of combat.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - player.x, e.z - player.z);
      if (d < bestDist) { bestDist = d; nearest = e; }
    }
    if (nearest) {
      const awayX = player.x - nearest.x, awayZ = player.z - nearest.z;
      const len = Math.hypot(awayX, awayZ) || 1;
      dx = awayX / len; dz = awayZ / len;
    } else {
      dx = 0; dz = 0;
    }
  }
  player.moving = dx !== 0 || dz !== 0;
  moveEntity(player, dx, dz, PLAYER_SPEED_PER_FRAME * LONG_USER_RETREAT_SPEED_MULT);
}

export const CONTROL_SCHEMES = {
  close: { dodgeChargeMax: 2, damageMult: 1, updateStandPosition: closeUpdateStand, stepUser: closeStepUser },
  mid: { dodgeChargeMax: 1, damageMult: 1, updateStandPosition: midUpdateStand, stepUser: midStepUser },
  long: { dodgeChargeMax: 1, damageMult: 0.65, updateStandPosition: longUpdateStand, stepUser: longStepUser }
};
