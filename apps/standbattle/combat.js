/* Combat engine — §2.1/§2.3/§5. Orchestrates the player Stand and one
   enemy/boss on the belt plane (x, z). Telegraphs every enemy heavy
   attack, keeps dodge (i-frames) and parry (tight counter window) as
   distinct mechanics, and routes hit/kill/damage events through the hook
   dispatcher so future content (Arrows, evolutions) never needs to touch
   this file.

   Phase 1 (tech §5): the sim now steps in whole frames at a fixed 60Hz
   rate (sim_loop.js) instead of being driven directly by rAF's variable
   ms delta, and `combat.entities` holds every fighter generically
   (fighter.js's entity/component store) instead of two hardcoded
   variables. The fight logic itself is unchanged -- still exactly one
   player vs one enemy, hit detection still one axis -- because Phase 1
   explicitly excludes hitboxes, frame-data timelines and crowd combat;
   those are tech §5 Phase 2. Enemy-side stepping lives in
   combat_enemy.js, split out to keep both files under the repo's
   300-line rule. */

import { MOVES, STANDS } from './data.js';
import { createEnemyAI } from './ai.js';
import { createPlayerFighter, createEnemyFighter, applyDamage, clampPersistence, DODGE_CHARGE_MAX } from './fighter.js';
import { createDispatcher } from './hooks.js';
import { createJuice } from './juice.js';
import { createFixedStepLoop } from './sim_loop.js';
import { stepEnemyMovementAndAI, updateEnemyPhase } from './combat_enemy.js';
import { ARENA_MIN, ARENA_MAX, ARENA_Z_MIN, ARENA_Z_MAX, SIM_HZ, FRAME_MS, DEATH_ANIM_FRAMES } from './constants.js';

/* Every timer below is a whole sim frame at SIM_HZ (60), not milliseconds
   (tech §5 Phase 1: "convert all remaining ms-based timing to frames").
   The ms comment on each is the pre-Phase-1 authored value. */
const DODGE_FRAMES = 16, DODGE_IFRAME_FRAMES = 12, PARRY_FRAMES = 12; // 260/200/200ms
const DODGE_RECHARGE_FRAMES = 84; // GDD §3.7: 2 charges, 1.4s recharge each -- 1400ms
const INPUT_BUFFER_FRAMES = 9; // 150ms -- matches tech §3.6's "9-frame buffer" exactly
const HURT_FLASH_FRAMES = 9; // 150ms fade
const PARRY_SUCCESS_RECOVER_FRAMES = 4; // 60ms -- tight parry rewards a fast return to idle
const PARRY_WHIFF_RECOVER_FRAMES = 9; // 150ms -- punishable, unlike a dodge's clean exit
const HITSTUN_FRAMES = 16; // 260ms
const PLAYER_SPEED_PER_FRAME = 172 / SIM_HZ; // 172px/sec authored speed, resolved once
const ACTION_KEYS = new Set(['light', 'medium', 'heavy', 'special', 'rush', 'dodge', 'parry']);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function createCombat(enemyDef, runBuffs, opts, rng) {
  opts = opts || {};
  const stand = STANDS.star_platinum;
  const player = createPlayerFighter(stand, ARENA_MIN + 122, runBuffs);
  const enemy = createEnemyFighter(enemyDef, ARENA_MAX - 72, opts.hpMult, opts.speedMult, opts.tint);
  const isBoss = !!enemyDef.phases;
  const aiRng = rng.stream('ai');
  enemy.ai = createEnemyAI(isBoss ? enemyDef.phases[0].attackPatterns : enemyDef.attackPatterns);
  enemy.brain = enemy.ai; // Brain component (tech §2.3): the AI profile/module list fighter.js reserved

  const dispatcher = createDispatcher();
  const juice = createJuice(opts.shakeEnabled);
  const keys = {};
  /* combat.entities is the arena's real entity store (tech §2.3): "the
     arena holds N entities, not player + enemy". combat.player/.enemy
     stay as named references into it so the render/pose/HUD/audio layers
     -- none of which this phase touches -- keep working unmodified. */
  const combat = {
    player, enemy, entities: [player, enemy], juice, dispatcher, isBoss,
    outcome: 'fighting', banner: enemyDef.name || enemyDef.standName, bannerTimer: 84, // 1400ms
    log: []
  };

  function push(msg) { combat.log.unshift(msg); combat.log.length = Math.min(4, combat.log.length); }

  function performAction(kind) {
    if (kind === 'dodge') startDodge();
    else if (kind === 'parry') startParry();
    else tryAttack(kind);
  }

  /* Edge-triggered: an action fires once per physical key-down, never on
     hold (tech audit item #1 -- dodge used to re-fire every frame it was
     held). A press made while busy is buffered instead of dropped (item #2). */
  combat.setKey = (code, down) => {
    const was = keys[code];
    keys[code] = down;
    if (down && !was && ACTION_KEYS.has(code)) {
      if (player.state === 'idle') performAction(code);
      else player.bufferedAction = { kind: code, timer: INPUT_BUFFER_FRAMES };
    }
  };

  function startPlayerMove(move) {
    player.state = 'attack';
    player.activeMove = move;
    player.movePhase = 'windup';
    player.stateTimer = move.windupFrames;
    player.hitsLanded = 0;
    if (move.persistenceCost) { player.persistence -= move.persistenceCost; clampPersistence(player); }
  }

  function tryAttack(kind) {
    if (player.state !== 'idle') return;
    const id = kind === 'special' ? stand.moves.special : kind === 'rush' ? stand.standRush : stand.moves[kind];
    const move = MOVES[id];
    if (move.persistenceCost && player.persistence < move.persistenceCost) { dispatcher.fire('onMoveDenied', {}); return; }
    startPlayerMove(move);
  }

  function startDodge() {
    if (player.state !== 'idle') return;
    if (player.dodgeCharges <= 0) { dispatcher.fire('onMoveDenied', {}); return; }
    player.dodgeCharges--;
    player.state = 'dodge';
    player.stateTimer = DODGE_FRAMES;
    player.invulnerable = true;
    player.dodgeDir = enemy.x > player.x ? -1 : 1;
  }

  function updateDodgeCharges() {
    if (player.dodgeCharges < DODGE_CHARGE_MAX) {
      player.dodgeRechargeFrames++;
      if (player.dodgeRechargeFrames >= DODGE_RECHARGE_FRAMES) {
        player.dodgeRechargeFrames -= DODGE_RECHARGE_FRAMES;
        player.dodgeCharges++;
      }
    } else {
      player.dodgeRechargeFrames = 0;
    }
  }

  function tryConsumeBuffer() {
    if (!player.bufferedAction) return;
    const kind = player.bufferedAction.kind;
    player.bufferedAction = null;
    if (player.state === 'idle') performAction(kind);
  }
  function startParry() {
    if (player.state !== 'idle') return;
    player.state = 'parry';
    player.stateTimer = PARRY_FRAMES;
    player.parryWindow = true;
  }

  function resolvePlayerHitWindow() {
    const m = player.activeMove;
    const hitEvery = m.activeFrames / m.hitCount;
    const elapsed = m.activeFrames - player.stateTimer;
    const shouldHave = Math.min(m.hitCount, Math.floor(elapsed / hitEvery) + 1);
    while (player.hitsLanded < shouldHave) {
      player.hitsLanded++;
      const dist = Math.abs(enemy.x - player.x);
      if (dist <= m.range && enemy.hp > 0) {
        const dmg = m.damage * player.powerMult * (stand.stats.power / 8);
        const dead = applyDamage(enemy, dmg);
        enemy.knockVx = (enemy.x >= player.x ? 1 : -1) * m.knockback;
        player.persistence += m.persistenceGain;
        clampPersistence(player);
        player.comboCount++;
        juice.triggerHitstop(m.hitstopMs);
        juice.triggerShake(player.facing, 0, dead ? 6 : m.type === 'heavy' || m.type === 'rush' ? 4 : 2, 140);
        juice.spawnBurst(enemy.x, 154, '#FFFF55', dead ? 18 : 6, 90, player.facing, -0.4);
        dispatcher.fire('onHit', { moveType: m.type, combo: player.comboCount, finishing: dead });
        if (dead) {
          enemy.deathTimer = DEATH_ANIM_FRAMES;
          dispatcher.fire('onKill', { combo: player.comboCount });
          combat.outcome = 'win';
        }
      }
    }
  }

  /* Player-side hit resolution against an incoming enemy attack (melee or
     projectile). Kept here rather than in combat_enemy.js because it
     needs the player's full state (dodge/parry/hp), not just the enemy's;
     combat_enemy.js calls it back as a callback. */
  function resolveIncomingHit(pattern, atX) {
    const dist = Math.abs(atX - player.x);
    if (dist > pattern.range) return;
    if (player.invulnerable) {
      push('DODGED');
      juice.spawnBurst(player.x, 154, '#55FFFF', 5, 60);
      dispatcher.fire('onDodgeSuccess', {});
      return;
    }
    if (player.parryWindow) {
      push('PARRIED!');
      player.parrySuccess = true;
      player.parryWindow = false;
      player.stateTimer = PARRY_SUCCESS_RECOVER_FRAMES;
      juice.triggerHitstop(120);
      juice.triggerShake(-player.facing, 0, 6, 160);
      juice.spawnBurst(player.x, 154, '#FFFFFF', 14, 110);
      dispatcher.fire('onParrySuccess', {});
      const dmg = 12 * player.powerMult;
      const dead = applyDamage(enemy, dmg);
      enemy.knockVx = (enemy.x >= player.x ? 1 : -1) * 14;
      if (dead) {
        enemy.deathTimer = DEATH_ANIM_FRAMES;
        dispatcher.fire('onKill', { combo: player.comboCount });
        combat.outcome = 'win';
      }
      return;
    }
    const dmg = pattern.dmgMult * enemyDef.power * 2;
    const dead = applyDamage(player, dmg);
    player.knockVx = (player.x >= atX ? 1 : -1) * pattern.knockback;
    player.comboCount = 0;
    juice.triggerHitstop(pattern.hitstopMs);
    juice.triggerShake(atX >= player.x ? -1 : 1, 0.3, pattern.dmgMult > 1.5 ? 7 : 4, 180);
    juice.spawnBurst(player.x, 154, '#FF5555', 10, 100);
    dispatcher.fire('onDamageTaken', { dmg, heavy: pattern.dmgMult > 1.5 });
    player.state = dead ? 'dead' : 'hitstun';
    player.stateTimer = HITSTUN_FRAMES;
    player.invulnerable = false;
    player.parryWindow = false;
    if (dead) { combat.outcome = 'lose'; }
  }

  function updatePlayer() {
    if (player.hurtFlash > 0) player.hurtFlash = Math.max(0, player.hurtFlash - 1 / HURT_FLASH_FRAMES);
    if (player.knockVx) { player.x += player.knockVx; player.knockVx *= 0.8; if (Math.abs(player.knockVx) < 0.3) player.knockVx = 0; }
    player.x = clamp(player.x, ARENA_MIN, ARENA_MAX);
    player.facing = enemy.x >= player.x ? 1 : -1;
    updateDodgeCharges();
    if (player.bufferedAction) {
      player.bufferedAction.timer -= 1;
      if (player.bufferedAction.timer <= 0) player.bufferedAction = null;
    }

    if (player.state === 'idle') {
      let mv = 0, mz = 0;
      if (keys.left) mv -= 1;
      if (keys.right) mv += 1;
      if (keys.forward) mz -= 1; // belt plane depth (tech §5 Phase 1): toward the camera
      if (keys.back) mz += 1; // away from the camera
      player.moving = mv !== 0 || mz !== 0;
      const step = PLAYER_SPEED_PER_FRAME * player.speedMult;
      player.x = clamp(player.x + mv * step, ARENA_MIN, ARENA_MAX);
      player.z = clamp(player.z + mz * step, ARENA_Z_MIN, ARENA_Z_MAX);
      return;
    }
    player.stateTimer -= 1;
    if (player.state === 'attack') {
      const m = player.activeMove;
      if (player.movePhase === 'windup' && player.stateTimer <= 0) {
        player.movePhase = 'active'; player.stateTimer = m.activeFrames;
      } else if (player.movePhase === 'active') {
        resolvePlayerHitWindow();
        if (player.stateTimer <= 0) { player.movePhase = 'recover'; player.stateTimer = m.recoverFrames; }
      } else if (player.movePhase === 'recover' && player.stateTimer <= 0) {
        player.state = 'idle'; player.activeMove = null;
        tryConsumeBuffer();
      }
    } else if (player.state === 'dodge') {
      if (DODGE_FRAMES - player.stateTimer < DODGE_IFRAME_FRAMES) {
        player.x = clamp(player.x + player.dodgeDir * PLAYER_SPEED_PER_FRAME * 1.6, ARENA_MIN, ARENA_MAX);
      }
      if (DODGE_FRAMES - player.stateTimer >= DODGE_IFRAME_FRAMES) player.invulnerable = false;
      if (player.stateTimer <= 0) {
        player.state = 'idle'; player.invulnerable = false;
        tryConsumeBuffer();
      }
    } else if (player.state === 'parry') {
      if (player.parryWindow && player.stateTimer <= 0) {
        // window closed with no incoming hit -- a whiffed parry earns a
        // short punishable recovery, unlike a dodge's clean "safe" exit
        player.parryWindow = false;
        player.stateTimer = PARRY_WHIFF_RECOVER_FRAMES;
      } else if (!player.parryWindow && player.stateTimer <= 0) {
        player.state = 'idle'; player.parrySuccess = false;
        tryConsumeBuffer();
      }
    } else if (player.state === 'hitstun') {
      if (player.stateTimer <= 0) {
        player.state = 'idle';
        tryConsumeBuffer();
      }
    }
  }

  /* One whole sim frame. No canvas, no DOM, no rAF -- headless_harness.js
     drives this same function directly through combat.step(). */
  function stepFrame() {
    if (combat.outcome !== 'fighting') return;
    if (combat.bannerTimer > 0) combat.bannerTimer -= 1;
    if (juice.update(FRAME_MS)) return; // hit-stop freezes the sim; see the Phase 1 report
    updatePlayer();
    stepEnemyMovementAndAI(combat, enemyDef, aiRng, resolveIncomingHit);
    if (player.hp <= 0 && combat.outcome === 'fighting') combat.outcome = 'lose';
  }

  const loop = createFixedStepLoop(stepFrame);
  /* Real usage (index.js's rAF loop): feed real elapsed ms, the fixed
     accumulator turns it into zero or more whole-frame steps. */
  combat.update = dtMs => { loop.advance(dtMs); };
  /* Headless/testing usage: advance exactly one frame, no wall clock. */
  combat.step = () => loop.stepOnce();

  return combat;
}
