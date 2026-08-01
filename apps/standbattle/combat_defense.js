/* Incoming-attack resolution against the player -- the defensive triangle
   dispatch (Step/Guard/Clash, defense.js) plus the raw damage-taken path.
   Split out of combat_player.js (which was over the repo's 300-line file
   cap after Phase 3's hook wiring) rather than folded into
   combat_player.js's attack-execution half -- this is the *incoming*
   side, called by combat_enemy.js for both melee patterns and
   projectiles, and doesn't touch anything in combat_player.js's own
   move/cancel/hitbox-resolution state. */

import { resolveDamage, applyHit, rollCrit, resolvePoiseDamage } from './resolvers.js';
import { applyPoiseDamage } from './poise.js';
import { onMomentumHitTaken } from './resources.js';
import { applyFeedbackDamage, staggerStand } from './combat_stand.js';
import * as defense from './defense.js';
import { DEATH_ANIM_FRAMES } from './constants.js';

const HITSTUN_FRAMES = 16; // 260ms
const PLAYER_IFRAME_FRAMES = 8; // GDD §3.9: i-frames after being hit, prevents crowd lock-loops

/* Clash's counter-hit is a real hit like any other -- it goes through the
   same three resolvers as a normal move, just with a small synthetic
   hitbox descriptor instead of one drawn from moves.js (GDD §3.7 doesn't
   assign Clash a move slot, so there's nothing in moves.js to point at). */
const CLASH_COUNTER_HITBOX = { dmg: 12, poise: 14, tags: ['clash', 'melee'] };

/* Order matters: Step's invulnerability beats everything, a live Clash
   window beats a raw hit, Guard mitigates what's left. `target` (Phase 4,
   picked by combat_stand.js's pickAttackTarget/pickAttackTargetPoint) is
   either combat.player or combat.stand: a hit aimed at the Stand skips the
   whole defensive triangle below and routes straight through feedback —
   see combat_stand.js's file header for why. `attacker` (Phase 5) is the
   specific enemy whose pattern/projectile this is -- the crowd may hold
   several enemies mid-attack at once, so this can no longer be assumed to
   be the fixed `combat.enemy`. */
export function resolveIncomingAttack(combat, pattern, atX, target, attacker) {
  const player = combat.player, juice = combat.juice, dispatcher = combat.dispatcher;

  if (target === combat.stand) {
    applyFeedbackDamage(combat, pattern, atX, attacker);
    return;
  }

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
    const perfect = defense.resolveClashSuccess(player, attacker.ai, juice);
    if (perfect) attacker.breakActive = true;
    combat.pushLog(perfect ? 'PERFECT CLASH!' : 'CLASHED!');
    juice.triggerShake(-player.facing, 0, 6, 160);
    juice.spawnBurst(player.x, 154, '#FFFFFF', 14, 110);
    if (!perfect) dispatcher.fire('onParrySuccess', {}); // unchanged from Phase 2 -- audio/fx wiring

    /* onClashSuccess/onPerfectClash (mutable, tech §2.1): every successful
       Clash fires the former; a Perfect Clash additionally fires the
       latter. This is the hook the "Perfect Clash refunds 25 Persistence"
       test Fragment targeted (Phase 3 report). */
    const clashCtx = { entity: player, opponent: attacker, cancelled: false };
    dispatcher.runEffect('onClashSuccess', clashCtx);
    if (perfect) dispatcher.runEffect('onPerfectClash', clashCtx);
    dispatcher.runEffect('onStaggerStart', { entity: attacker, cause: 'clash', frames: defense.CLASH_STAGGER_FRAMES, mult: 1, cancelled: false });

    const critInfo = rollCrit({ attacker: player, rng: combat.combatRng, stats: combat.stats, bus: dispatcher });
    const dmg = resolveDamage({ attacker: player, defender: attacker, hitbox: CLASH_COUNTER_HITBOX, isPlayerAttacker: true, critMult: critInfo.mult, bus: dispatcher });
    const { dead } = applyHit({ defender: attacker }, dmg);
    applyPoiseDamage(attacker, resolvePoiseDamage({ hitbox: CLASH_COUNTER_HITBOX, bus: dispatcher }));
    attacker.knockVx = (attacker.x >= player.x ? 1 : -1) * 14;
    if (dead) {
      attacker.deathTimer = DEATH_ANIM_FRAMES;
      dispatcher.runEffect('onKill', { entity: player, target: attacker, combo: player.comboCount, cancelled: false });
      // Win is decided by encounter.js's stepEncounter, not here -- see combat_player.js's resolveHitboxes.
    }
    return;
  }

  if (player.guarding) {
    const heavy = pattern.tags && pattern.tags.includes('heavy');
    applyIncomingDamage(combat, pattern, atX, heavy ? 1 : defense.GUARD_DAMAGE_MULT, false, attacker);
    if (heavy) {
      defense.guardBreakStagger(player);
      dispatcher.runEffect('onGuardBreak', { entity: player, cause: 'heavy', cancelled: false });
      combat.pushLog('GUARD BROKEN');
    } else combat.pushLog('BLOCKED');
    return;
  }

  applyIncomingDamage(combat, pattern, atX, 1, true, attacker);
}

function applyIncomingDamage(combat, pattern, atX, guardMult, causesHitstun, attacker) {
  const player = combat.player, juice = combat.juice, dispatcher = combat.dispatcher;
  let dmg = resolveDamage({
    attacker, defender: player, pattern, isPlayerAttacker: false,
    guardMult: guardMult === 1 ? null : guardMult, bus: dispatcher
  });

  /* onDamageIncoming (mutable, tech §2.1): a second pass specific to
     damage about to hit the PLAYER, distinct from onHitResolve (which
     already ran generically, for either attack direction, inside
     resolveDamage above) -- the hook a defensive Fragment/Relic ("-15%
     damage taken") targets without needing to know anything about how the
     enemy's own attack was resolved. */
  const incomingCtx = { attacker, defender: player, pattern, damage: dmg, cancelled: false };
  dispatcher.runEffect('onDamageIncoming', incomingCtx);
  dmg = incomingCtx.cancelled ? 0 : incomingCtx.damage;

  const dead = applyHit({ defender: player }, dmg).dead;
  staggerStand(combat); // GDD §3.1: damage to the User (guarded chip included) staggers the Stand too
  player.knockVx = (player.x >= atX ? 1 : -1) * pattern.knockback;
  onMomentumHitTaken(player);
  juice.triggerHitstop(pattern.hitstopMs);
  juice.triggerShake(atX >= player.x ? -1 : 1, 0.3, pattern.dmgMult > 1.5 ? 7 : 4, 180);
  juice.spawnBurst(player.x, 154, '#FF5555', 10, 100);
  dispatcher.runEffect('onDamageTaken', { entity: player, attacker, dmg, heavy: pattern.dmgMult > 1.5, cancelled: false });
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
