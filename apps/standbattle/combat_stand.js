/* The Stand — GDD §3.1-3.4, Phase 4 "User and Stand" (the core mechanic
   the tech doc's roadmap has been building toward since Phase 0). Steps
   the Stand entity one sim frame at a time: Close-Range anchoring/Project
   (§3.4), the tether and Strain (§3.2), and the aggro-weighted target
   picker + feedback-damage routing that makes the Stand a real second
   hurtbox (§3.1). Mirrors the combat_player.js/combat_enemy.js split —
   this is the third "who does what" seam the file-size rule pushes
   toward, not an arbitrary cut.

   Design calls made here that the GDD leaves open for this control scheme,
   flagged rather than silently resolved (see the phase report):
   - Step/Guard/Clash protect only the User's own hurtbox. A landed hit on
     the Stand always goes through feedback (mitigated only by the
     feedback rate), never blocked — the whole point of the mechanic is
     that the Stand is a hurtbox the User's own defensive tech doesn't
     cover.
   - Over-extension (Strain) can only actually happen by holding Project
     with movement continuing to press outward once the Stand has already
     reached tether length — anchored (non-Projecting) Stand position is
     recomputed fresh every frame from the User's own transform, so it can
     never independently drift past the tether the way a free body knocked
     around could. This keeps Project the single, legible source of the
     risk/reward decision (deliverable 4), rather than spreading it across
     knockback interactions this phase wasn't asked to design.
   - Guard/Clash are NOT disabled while Projecting (only Step is, per the
     GDD bullet list) — "fully exposed" is read here as the emergent result
     of being rooted + Step-less, not as an unstated third restriction. */

import {
  resolveTetherLength, resolveFeedbackRate, resolveDamage, applyHit
} from './resolvers.js';
import { overlaps, pointOverlaps } from './hitbox.js';
import { spendPersistence } from './resources.js';
import { PLAYER_SPEED_PER_FRAME } from './combat_player.js';
import { ARENA_MIN, ARENA_MAX, ARENA_Z_MIN, ARENA_Z_MAX, SIM_HZ } from './constants.js';

export const ANCHOR_OFFSET_PX = 22; // GDD §3.4: "rides ~22px in front of the User"
const PROJECT_DRIVE_PER_FRAME = 260 / SIM_HZ; // tuning: ~0.2s to cover Star Platinum's 52px tether
const STRAIN_DRAG_FACTOR = 0.4; // GDD §3.2: "drags the User along at 40% speed"
const STRAIN_PERSISTENCE_PER_SEC = 2; // GDD §3.2
export const STAND_STAGGER_FRAMES = 24; // tuning: matches Clash's 24f stagger (defense.js) for consistency

/* The drive itself is NOT hard-clamped to tetherPx -- "the drag must be a
   real, punishable commitment, not a soft clamp" (GDD §3.2) rules that
   out. But it also can't be left fully unbounded: the drag that's supposed
   to be the punishment is only 40% of walk speed, far slower than the
   drive, so an unbounded drive run for several seconds would fling the
   Stand across the whole arena rather than "out to tether length" (GDD
   §3.4) with a bounded, readable overextension past it. This cap is a
   safety ceiling on the drive's OWN target, not a clamp on the tether
   check below -- Strain/drag still trigger anywhere past tetherPx, this
   just stops the drive from producing distances Strain could never
   plausibly pull back from. */
const PROJECT_MAX_OVEREXTEND = 1.4; // 40% past tetherPx, at most, from holding Project+movement
const HURT_FLASH_FRAMES = 9; // matches combat_player.js/combat_enemy.js's shared fade rate

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function anchorPosition(owner) {
  return { x: owner.x + owner.facing * ANCHOR_OFFSET_PX, z: owner.z };
}

/* One sim frame of Stand movement plus the tether's Strain/drag check.
   Called BEFORE updatePlayer (combat.js's stepFrame) so player.projecting/
   .strained are fresh for this frame's movement/Step gating; the 1-frame
   lag this puts on reading player.facing (updatePlayer hasn't re-derived
   it yet this frame) is imperceptible at 60Hz and left as-is rather than
   engineered around. */
export function stepStand(combat) {
  const { player, stand, keys, dispatcher, stats } = combat;
  if (stand.staggerFrames > 0) stand.staggerFrames--;
  if (stand.hurtFlash > 0) stand.hurtFlash = Math.max(0, stand.hurtFlash - 1 / HURT_FLASH_FRAMES);

  const canProject = stand.staggerFrames <= 0;
  player.projecting = !!(keys.project && canProject);
  stand.facing = player.facing;
  const tetherPx = resolveTetherLength(player, stats, dispatcher);

  if (player.projecting) {
    if (!stand.wasProjecting) {
      const ctx = { entity: player, cancelled: false };
      dispatcher.runEffect('onProjectStart', ctx);
    }
    let dirX = 0, dirZ = 0;
    if (keys.left) dirX -= 1;
    if (keys.right) dirX += 1;
    if (keys.forward) dirZ -= 1;
    if (keys.back) dirZ += 1;
    if (dirX === 0 && dirZ === 0) { dirX = player.facing; dirZ = 0; } // default: drive straight out in front
    const len = Math.hypot(dirX, dirZ) || 1;
    let nx = clamp(stand.x + (dirX / len) * PROJECT_DRIVE_PER_FRAME, ARENA_MIN, ARENA_MAX);
    let nz = clamp(stand.z + (dirZ / len) * PROJECT_DRIVE_PER_FRAME, ARENA_Z_MIN, ARENA_Z_MAX);
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

  const dx = stand.x - player.x, dz = stand.z - player.z;
  const dist = Math.hypot(dx, dz);
  if (dist > tetherPx) {
    player.strained = true;
    spendPersistence(player, STRAIN_PERSISTENCE_PER_SEC / SIM_HZ);
    const strainCtx = { entity: player, dist, tetherPx, cancelled: false };
    dispatcher.runEffect('onTetherStrain', strainCtx);
    if (!strainCtx.cancelled) {
      const dragLen = dist || 1;
      player.x = clamp(player.x + (dx / dragLen) * PLAYER_SPEED_PER_FRAME * STRAIN_DRAG_FACTOR, ARENA_MIN, ARENA_MAX);
      player.z = clamp(player.z + (dz / dragLen) * PLAYER_SPEED_PER_FRAME * STRAIN_DRAG_FACTOR, ARENA_Z_MIN, ARENA_Z_MAX);
    }
  } else {
    player.strained = false;
  }
}

/* Aggro-weighted target picker (GDD §3.1 "second hurtbox" / deliverable 5:
   enemies weight the User and the Stand separately). Tests hitbox overlap
   against both hurtboxes; if only one overlaps, that's the target; if both
   do, `aiRng` (the run's deterministic 'ai' stream, rng.js) weights the
   pick by each entity's `.aggro` (fighter.js stub, defaults to 1 -- an
   even split until content gives one of them a reason to pull more
   attention). Returns `combat.player`, `combat.stand`, or null. */
export function pickAttackTarget(combat, enemy, hitbox, aiRng) {
  const { player, stand } = combat;
  return resolveTarget(player, stand, overlaps(enemy, hitbox, player), overlaps(enemy, hitbox, stand), aiRng);
}

export function pickAttackTargetPoint(combat, x, z, tags, radius, aiRng) {
  const { player, stand } = combat;
  return resolveTarget(player, stand,
    pointOverlaps(x, z, player, tags, radius), pointOverlaps(x, z, stand, tags, radius), aiRng);
}

function resolveTarget(player, stand, hitsPlayer, hitsStand, aiRng) {
  if (hitsPlayer && hitsStand) {
    const total = (player.aggro || 1) + (stand.aggro || 1);
    return aiRng.random() * total < (stand.aggro || 1) ? stand : player;
  }
  if (hitsStand) return stand;
  if (hitsPlayer) return player;
  return null;
}

/* Damage-to-Stand routing (GDD §3.1/§3.3): the Stand has no HP of its own
   — a hit on it transfers to the User's HP at the feedback rate instead of
   applying directly, and never runs through Step/Guard/Clash (see file
   header: the defensive triangle is the User's own body's toolkit). No
   crit roll here, matching combat_defense.js's existing incoming-attack
   path (enemy attacks never crit against the player in this engine).
   `attacker` (Phase 5) is whichever specific crowd enemy landed the hit. */
export function applyFeedbackDamage(combat, pattern, atX, attacker) {
  const { player, stand, juice, dispatcher, stats } = combat;
  const raw = resolveDamage({ attacker, defender: stand, pattern, isPlayerAttacker: false, bus: dispatcher });
  const feedbackPct = resolveFeedbackRate(player, stats, dispatcher);
  const ctx = {
    entity: player, stand, attacker, pattern,
    rawDamage: raw, feedbackPct, damage: raw * feedbackPct, cancelled: false
  };
  dispatcher.runEffect('onFeedbackDamage', ctx);
  const transferred = ctx.cancelled ? 0 : ctx.damage;
  const { dead } = applyHit({ defender: player }, transferred);
  stand.hurtFlash = 1;
  juice.triggerHitstop(Math.round((pattern.hitstopMs || 60) * 0.6));
  juice.triggerShake(atX >= stand.x ? -1 : 1, 0.2, pattern.dmgMult > 1.5 ? 5 : 3, 150);
  juice.spawnBurst(stand.x, 154, '#B98BFF', 8, 90);
  combat.pushLog('STAND HIT · ' + Math.round(feedbackPct * 100) + '% FED BACK');
  if (dead) combat.outcome = 'lose';
  return dead;
}

/* Damage-to-User routing side effect (GDD §3.1: "damage to the User...
   additionally staggers the Stand"). Forces an immediate Project release
   (no recovery, same as a voluntary release — stepStand's `else` branch
   snaps it back the very next frame) and blocks re-Projecting for
   STAND_STAGGER_FRAMES. */
export function staggerStand(combat) {
  combat.stand.staggerFrames = STAND_STAGGER_FRAMES;
}
