/* The Stand — GDD §3.1-3.4, Phase 4 "User and Stand" (the core mechanic
   the tech doc's roadmap has been building toward since Phase 0), extended
   Phase 9a to dispatch per Stand Class instead of hardcoding Close-Range.
   Steps the Stand entity one sim frame at a time: per-class positioning
   (stand_classes.js), the tether and Strain (§3.2, shared by every class),
   and the aggro-weighted target picker + feedback-damage routing that
   makes the Stand a real second hurtbox (§3.1). Mirrors the
   combat_player.js/combat_enemy.js split — this is the third "who does
   what" seam the file-size rule pushes toward, not an arbitrary cut.

   Design calls made here that the GDD leaves open, flagged rather than
   silently resolved (see the phase report):
   - Step/Guard/Clash protect only the User's own hurtbox. A landed hit on
     the Stand always goes through feedback (mitigated only by the
     feedback rate), never blocked — the whole point of the mechanic is
     that the Stand is a hurtbox the User's own defensive tech doesn't
     cover. This is generic across all three classes: `target === combat.stand`
     is an identity check, not a `player.projecting` one.
   - The tether/Strain check below is shared, unconditional class logic:
     Close's anchored state can never drift past tetherPx (recomputed fresh
     every frame from the User's own transform), so Strain there can only
     fire during a held Project's drive. Mid/Long can genuinely overextend
     during a flick/free-roam and get dragged/penalized the same generic
     way — this is what makes Long-Range's "low feedback, big tether" GDD
     framing just a matter of a high-`range`-stat Stand's data, not new
     engine code (resolveTetherLength/resolveFeedbackRate already scale on
     `range`, stats.js).
   - Guard/Clash are NOT disabled while Projecting/flicked (only Step is,
     per the GDD bullet list) — "fully exposed" is read here as the
     emergent result of being rooted + Step-less, not as an unstated third
     restriction. */

import {
  resolveTetherLength, resolveFeedbackRate, resolveDamage, applyHit
} from './resolvers.js';
import { overlaps, pointOverlaps } from './hitbox.js';
import { spendPersistence } from './resources.js';
import { CONTROL_SCHEMES } from './stand_classes.js';
import { PLAYER_SPEED_PER_FRAME, ARENA_MIN, ARENA_MAX, ARENA_Z_MIN, ARENA_Z_MAX, SIM_HZ } from './constants.js';

const STRAIN_DRAG_FACTOR = 0.4; // GDD §3.2: "drags the User along at 40% speed"
const STRAIN_PERSISTENCE_PER_SEC = 2; // GDD §3.2
export const STAND_STAGGER_FRAMES = 24; // tuning: matches Clash's 24f stagger (defense.js) for consistency
const HURT_FLASH_FRAMES = 9; // matches combat_player.js/combat_enemy.js's shared fade rate

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* One sim frame of Stand movement (per-class, stand_classes.js) plus the
   tether's Strain/drag check (shared, every class). Called BEFORE
   updatePlayer (combat.js's stepFrame) so player.projecting/.strained/
   .standDetached are fresh for this frame's movement/Step gating; the
   1-frame lag this puts on reading player.facing (updatePlayer hasn't
   re-derived it yet this frame) is imperceptible at 60Hz and left as-is
   rather than engineered around. */
export function stepStand(combat) {
  const { player, stand, dispatcher, stats } = combat;
  if (stand.staggerFrames > 0) stand.staggerFrames--;
  if (stand.hurtFlash > 0) stand.hurtFlash = Math.max(0, stand.hurtFlash - 1 / HURT_FLASH_FRAMES);

  stand.facing = player.facing;
  const tetherPx = resolveTetherLength(player, stats, dispatcher);
  const scheme = CONTROL_SCHEMES[player.stand.controlScheme] || CONTROL_SCHEMES.close;
  scheme.updateStandPosition(combat, tetherPx);

  const dx = stand.x - player.x, dz = stand.z - player.z;
  const dist = Math.hypot(dx, dz);
  if (dist > tetherPx) {
    player.strained = true;
    spendPersistence(player, STRAIN_PERSISTENCE_PER_SEC / SIM_HZ);
    const strainCtx = { entity: player, dist, tetherPx, combat, cancelled: false };
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
   enemies weight the User and the Stand separately -- GDD §4.2's Hound
   (#7) is the first content to actually lean on this). Tests hitbox
   overlap against both hurtboxes; if only one overlaps, that's the target;
   if both do, `aiRng` (the run's deterministic 'ai' stream, rng.js) weights
   the pick by each entity's `.aggro` (fighter.js stub, defaults to 1) times
   the attacking enemy's own `def.userTargetWeightMult` (defaults to 1, so
   every enemy without the field reproduces the original even-split roll
   exactly) -- an even split until content gives one of them a reason to
   pull more attention. Returns `combat.player`, `combat.stand`, or null. */
export function pickAttackTarget(combat, enemy, hitbox, aiRng) {
  const { player, stand } = combat;
  return resolveTarget(player, stand, overlaps(enemy, hitbox, player), overlaps(enemy, hitbox, stand), aiRng, enemy);
}

export function pickAttackTargetPoint(combat, x, z, tags, radius, aiRng, enemy) {
  const { player, stand } = combat;
  return resolveTarget(player, stand,
    pointOverlaps(x, z, player, tags, radius), pointOverlaps(x, z, stand, tags, radius), aiRng, enemy);
}

function resolveTarget(player, stand, hitsPlayer, hitsStand, aiRng, attacker) {
  if (hitsPlayer && hitsStand) {
    const standW = stand.aggro || 1;
    const playerW = (player.aggro || 1) * ((attacker && attacker.def && attacker.def.userTargetWeightMult) || 1);
    return aiRng.random() * (standW + playerW) < standW ? stand : player;
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
