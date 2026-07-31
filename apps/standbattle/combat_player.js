/* Player-side stepping: movement, the defensive triangle (Step/Guard/
   Clash, defense.js), and frame-data attack resolution (tech §2.4/§2.5).
   Split out of combat.js to keep both files under the repo's 300-line
   rule -- mirrors the existing player/enemy seam combat_enemy.js already
   established in Phase 1. Every timer here is a whole sim frame at the
   fixed 60Hz step. */

import { resolveMoveFrames, resolveDamage, applyHit, rollCrit, resolvePoiseDamage } from './resolvers.js';
import { stepMoveHitboxes } from './hitbox.js';
import { spendPersistence, gainPersistence, gainMomentum, onMomentumHitTaken, tickResources } from './resources.js';
import { applyPoiseDamage } from './poise.js';
import * as defense from './defense.js';
import { ARENA_MIN, ARENA_MAX, ARENA_Z_MIN, ARENA_Z_MAX, SIM_HZ, DEATH_ANIM_FRAMES } from './constants.js';

export const ACTION_KEYS = new Set(['light', 'medium', 'heavy', 'special', 'rush', 'dodge', 'parry']);

const HURT_FLASH_FRAMES = 9; // 150ms fade
const HITSTUN_FRAMES = 16; // 260ms
const PLAYER_IFRAME_FRAMES = 8; // GDD §3.9: i-frames after being hit, prevents crowd lock-loops
const PLAYER_SPEED_PER_FRAME = 172 / SIM_HZ;

/* Clash's counter-hit is a real hit like any other -- it goes through the
   same three resolvers as a normal move, just with a small synthetic
   hitbox descriptor instead of one drawn from moves.js (GDD §3.7 doesn't
   assign Clash a move slot, so there's nothing in moves.js to point at). */
const CLASH_COUNTER_HITBOX = { dmg: 12, poise: 14, tags: ['clash', 'melee'] };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function performAction(combat, kind) {
  if (kind === 'dodge') startDodge(combat);
  else if (kind === 'parry') defense.startClash(combat.player);
  else tryAttack(combat, kind);
}

function startDodge(combat) {
  if (!defense.startStep(combat.player, combat.enemy)) combat.dispatcher.fire('onMoveDenied', {});
}

function tryAttack(combat, kind) {
  const player = combat.player;
  if (player.state !== 'idle') return;
  const stand = player.stand;
  const id = kind === 'special' ? stand.moves.special : kind === 'rush' ? stand.standRush : stand.moves[kind];
  if (!attemptMove(combat, id)) combat.dispatcher.fire('onMoveDenied', {});
}

/* Starts (or cancels into) a move. Used both for a fresh press and for a
   cancel-window transition -- the only two ways a move ever starts. */
function attemptMove(combat, moveId) {
  const player = combat.player;
  const move = resolveMoveFrames(player, moveId);
  if (move.costs.persistence && player.persistence < move.costs.persistence) return false;
  if (move.costs.momentum && player.momentum < move.costs.momentum) return false;
  player.state = 'attack';
  player.activeMove = move;
  player.movePhase = 'windup';
  player.moveFrame = 0;
  player.hitboxSpent = new Set();
  player.hitsLanded = 0;
  player.armorConsumedThisMove = false;
  if (move.costs.persistence) spendPersistence(player, move.costs.persistence);
  if (move.costs.momentum) { player.momentum -= move.costs.momentum; }
  player.chainCounts[move.id] = (player.lastMoveId === move.id ? (player.chainCounts[move.id] || 0) : 0) + 1;
  player.lastMoveId = move.id;
  return true;
}

/* Checks the current move's data-authored cancel list against whatever is
   buffered (tech §2.4: "cancel windows are data"). Emergent strings
   (Light->Light->Light->Medium->Heavy) fall out of this generic check,
   never an authored combo list. */
function tryCancel(combat) {
  const player = combat.player;
  if (!player.bufferedAction || player.state !== 'attack') return;
  const kind = player.bufferedAction.kind;
  const move = player.activeMove;
  const entry = move.cancels.find(c =>
    player.moveFrame >= c.from && c.into.includes(kind) && (c.requires !== 'hit' || player.hitsLanded > 0));
  if (!entry) return;
  const stand = player.stand;
  const targetId = kind === 'special' ? stand.moves.special : kind === 'rush' ? stand.standRush : stand.moves[kind];
  if (entry.maxSelfChain && targetId === move.id && (player.chainCounts[move.id] || 0) >= entry.maxSelfChain) return;
  if (!attemptMove(combat, targetId)) return;
  player.bufferedAction = null;
}

function resolveHitboxes(combat, move) {
  const player = combat.player, enemy = combat.enemy;
  if (enemy.hp <= 0) return;
  stepMoveHitboxes(player, move, player.moveFrame, player.hitboxSpent, enemy, hb => {
    player.hitsLanded++;
    const critInfo = rollCrit({ attacker: player, rng: combat.combatRng });
    const dmg = resolveDamage({ attacker: player, defender: enemy, hitbox: hb, isPlayerAttacker: true, critMult: critInfo.mult });
    const { dead } = applyHit({ defender: enemy }, dmg);
    applyPoiseDamage(enemy, resolvePoiseDamage({ hitbox: hb }));
    enemy.knockVx = (enemy.x >= player.x ? 1 : -1) * move.knockback;
    gainPersistence(player, move.gains.persistence || 0);
    gainMomentum(player, move.gains.momentum || 0);
    player.comboCount++; // flavour counter for pose/fx/audio only -- Momentum is the real resource now
    combat.juice.triggerHitstop(move.hitstopMs);
    combat.juice.triggerShake(player.facing, 0, dead ? 6 : (move.type === 'heavy' || move.type === 'rush') ? 4 : 2, 140);
    combat.juice.spawnBurst(enemy.x, 154, '#FFFF55', dead ? 18 : 6, 90, player.facing, -0.4);
    if (critInfo.crit) combat.pushLog('CRIT!');
    combat.dispatcher.fire('onHit', { moveType: move.type, combo: player.comboCount, finishing: dead, crit: critInfo.crit });
    if (dead) {
      enemy.deathTimer = DEATH_ANIM_FRAMES;
      gainMomentum(player, 15);
      combat.dispatcher.fire('onKill', { combo: player.comboCount });
      combat.outcome = 'win';
    }
  });
}

function updateAttack(combat) {
  const player = combat.player;
  const m = player.activeMove;
  player.moveFrame++;
  if (player.moveFrame <= m.windupFrames) player.movePhase = 'windup';
  else if (player.moveFrame <= m.windupFrames + m.activeFrames) player.movePhase = 'active';
  else player.movePhase = 'recover';
  /* per-phase countdown, kept only because pose_player.js (off-limits)
     reads player.stateTimer to compute animation progress -- a pure
     re-projection of moveFrame, not a second timing source. */
  if (player.movePhase === 'windup') player.stateTimer = m.windupFrames - player.moveFrame + 1;
  else if (player.movePhase === 'active') player.stateTimer = m.windupFrames + m.activeFrames - player.moveFrame + 1;
  else player.stateTimer = m.frames - player.moveFrame + 1;

  if (player.movePhase === 'active') resolveHitboxes(combat, m);
  tryCancel(combat);

  if (player.moveFrame >= m.frames) {
    player.state = 'idle'; player.activeMove = null;
    tryConsumeBuffer(combat);
  }
}

function tryConsumeBuffer(combat) {
  const player = combat.player;
  if (!player.bufferedAction) return;
  const kind = player.bufferedAction.kind;
  player.bufferedAction = null;
  if (player.state === 'idle') performAction(combat, kind);
}

/* Incoming-attack resolution against the player -- the defensive triangle
   dispatch. Order matters: Step's invulnerability beats everything, a
   live Clash window beats a raw hit, Guard mitigates what's left. Called
   by combat_enemy.js for both melee patterns and projectiles. */
export function resolveIncomingAttack(combat, pattern, atX) {
  const player = combat.player, enemy = combat.enemy, juice = combat.juice, dispatcher = combat.dispatcher;

  if (player.state === 'attack' && player.activeMove.armor && !player.armorConsumedThisMove &&
    player.moveFrame >= player.activeMove.armor.from && player.moveFrame <= player.activeMove.armor.to &&
    !(pattern.tags && pattern.tags.includes('heavy'))) {
    player.armorConsumedThisMove = true;
    combat.pushLog('ARMORED THROUGH');
    return;
  }

  if (player.invulnerable) {
    combat.pushLog('DODGED');
    juice.spawnBurst(player.x, 154, '#55FFFF', 5, 60);
    dispatcher.fire('onDodgeSuccess', {});
    return;
  }

  if (player.parryWindow) {
    const perfect = defense.resolveClashSuccess(player, enemy.ai, juice);
    if (perfect) enemy.breakActive = true;
    combat.pushLog(perfect ? 'PERFECT CLASH!' : 'CLASHED!');
    juice.triggerShake(-player.facing, 0, 6, 160);
    juice.spawnBurst(player.x, 154, '#FFFFFF', 14, 110);
    dispatcher.fire(perfect ? 'onPerfectClash' : 'onParrySuccess', {});
    const critInfo = rollCrit({ attacker: player, rng: combat.combatRng });
    const dmg = resolveDamage({ attacker: player, defender: enemy, hitbox: CLASH_COUNTER_HITBOX, isPlayerAttacker: true, critMult: critInfo.mult });
    const { dead } = applyHit({ defender: enemy }, dmg);
    applyPoiseDamage(enemy, resolvePoiseDamage({ hitbox: CLASH_COUNTER_HITBOX }));
    enemy.knockVx = (enemy.x >= player.x ? 1 : -1) * 14;
    if (dead) { enemy.deathTimer = DEATH_ANIM_FRAMES; dispatcher.fire('onKill', {}); combat.outcome = 'win'; }
    return;
  }

  if (player.guarding) {
    const heavy = pattern.tags && pattern.tags.includes('heavy');
    applyIncomingDamage(combat, pattern, atX, heavy ? 1 : defense.GUARD_DAMAGE_MULT, false);
    if (heavy) { defense.guardBreakStagger(player); combat.pushLog('GUARD BROKEN'); }
    else combat.pushLog('BLOCKED');
    return;
  }

  applyIncomingDamage(combat, pattern, atX, 1, true);
}

function applyIncomingDamage(combat, pattern, atX, guardMult, causesHitstun) {
  const player = combat.player, juice = combat.juice, dispatcher = combat.dispatcher;
  const dmg = resolveDamage({
    attacker: combat.enemy, defender: player, pattern, isPlayerAttacker: false,
    guardMult: guardMult === 1 ? null : guardMult
  });
  const dead = applyHit({ defender: player }, dmg).dead;
  player.knockVx = (player.x >= atX ? 1 : -1) * pattern.knockback;
  onMomentumHitTaken(player);
  juice.triggerHitstop(pattern.hitstopMs);
  juice.triggerShake(atX >= player.x ? -1 : 1, 0.3, pattern.dmgMult > 1.5 ? 7 : 4, 180);
  juice.spawnBurst(player.x, 154, '#FF5555', 10, 100);
  dispatcher.fire('onDamageTaken', { dmg, heavy: pattern.dmgMult > 1.5 });
  if (causesHitstun) {
    player.state = dead ? 'dead' : 'hitstun';
    player.stateTimer = HITSTUN_FRAMES;
    player.invulnerable = !dead; // GDD §3.9: 8f of i-frames after being hit
    player.hitIframeTimer = PLAYER_IFRAME_FRAMES;
    player.parryWindow = false;
  }
  if (dead) combat.outcome = 'lose';
  return dead;
}

export function updatePlayer(combat) {
  const player = combat.player, enemy = combat.enemy, keys = combat.keys;
  if (player.hurtFlash > 0) player.hurtFlash = Math.max(0, player.hurtFlash - 1 / HURT_FLASH_FRAMES);
  if (player.knockVx) { player.x += player.knockVx; player.knockVx *= 0.8; if (Math.abs(player.knockVx) < 0.3) player.knockVx = 0; }
  player.x = clamp(player.x, ARENA_MIN, ARENA_MAX);
  player.facing = enemy.x >= player.x ? 1 : -1;
  defense.tickStepCharges(player);
  tickResources(player);
  if (player.bufferedAction) {
    player.bufferedAction.timer -= 1;
    if (player.bufferedAction.timer <= 0) player.bufferedAction = null;
  }

  if (player.state === 'idle') {
    if (keys.guard) { defense.startGuard(player); return; }
    let mv = 0, mz = 0;
    if (keys.left) mv -= 1;
    if (keys.right) mv += 1;
    if (keys.forward) mz -= 1;
    if (keys.back) mz += 1;
    player.moving = mv !== 0 || mz !== 0;
    const step = PLAYER_SPEED_PER_FRAME * player.speedMult;
    player.x = clamp(player.x + mv * step, ARENA_MIN, ARENA_MAX);
    player.z = clamp(player.z + mz * step, ARENA_Z_MIN, ARENA_Z_MAX);
    return;
  }

  player.stateTimer -= 1;
  if (player.state === 'attack') {
    updateAttack(combat);
  } else if (player.state === 'dodge') {
    const dx = defense.stepDodgeMovement(player, PLAYER_SPEED_PER_FRAME * 1.6);
    if (dx) player.x = clamp(player.x + dx, ARENA_MIN, ARENA_MAX);
    if (player.stateTimer <= 0) { player.state = 'idle'; player.invulnerable = false; tryConsumeBuffer(combat); }
  } else if (player.state === 'guard') {
    if (!keys.guard) { defense.endGuard(player); tryConsumeBuffer(combat); return; }
    if (defense.stepGuardDrain(player)) { defense.guardBreakStagger(player); combat.pushLog('GUARD BROKEN'); }
  } else if (player.state === 'parry') {
    if (player.clashPhase === 'window') {
      defense.stepClashWindow(player);
      if (player.stateTimer <= 0) {
        player.clashPhase = 'recover'; player.parryWindow = false;
        player.stateTimer = defense.CLASH_WHIFF_RECOVER_FRAMES;
      }
    } else if (player.stateTimer <= 0) {
      player.state = 'idle'; player.parrySuccess = false;
      tryConsumeBuffer(combat);
    }
  } else if (player.state === 'hitstun' || player.state === 'staggered') {
    if (player.hitIframeTimer > 0) {
      player.hitIframeTimer--;
      if (player.hitIframeTimer <= 0) player.invulnerable = false;
    }
    if (player.stateTimer <= 0) { player.state = 'idle'; tryConsumeBuffer(combat); }
  }
}
