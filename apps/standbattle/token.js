/* Attack-token pool — GDD §16, the rule that makes crowd combat readable
   instead of a pile-on. Only a token holder may commit to an attack (leave
   ai.js's 'approach' state); everyone else keeps circling/holding spacing,
   which ai.js's existing 'approach' branch already does on its own. A
   token is held for the duration of one full pattern (windup->active->
   recover) and then goes on a cooldown before reassignment, so pressure
   arrives in readable pulses instead of every free slot recommitting the
   instant it frees up.

   Ranged enemies draw from a separate, smaller pool (`tokenPool: 'ranged'`
   on the enemy def, default 'melee') so a sniper can't fire during a melee
   commitment -- reserved capacity for a future ranged crowd type; none of
   Phase 5's three shipped enemies use it.

   A solo fight (boss, elite) has exactly one candidate against 2 melee
   token slots, so it is always granted one immediately -- this whole
   system is a no-op for every encounter that existed before Phase 5. */

import { scoreForToken } from './profiles.js';
import { canHoldAttackToken } from './ai.js';

const TOKEN_COOLDOWN_MIN_FRAMES = 36; // 0.6s
const TOKEN_COOLDOWN_MAX_FRAMES = 72; // 1.2s

function makeSlot(pool) { return { pool, holder: null, committed: false, cooldownFrames: 0 }; }

export function createTokenSystem(meleeCount, rangedCount) {
  const slots = [];
  for (let i = 0; i < meleeCount; i++) slots.push(makeSlot('melee'));
  for (let i = 0; i < (rangedCount || 0); i++) slots.push(makeSlot('ranged'));
  return { slots };
}

function poolOf(enemy) { return enemy.def.tokenPool === 'ranged' ? 'ranged' : 'melee'; }

function weightedPick(candidates, player, rng) {
  const scores = candidates.map(e => Math.max(0.01, scoreForToken(e, player)));
  const total = scores.reduce((a, b) => a + b, 0);
  let roll = rng.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= scores[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function releaseSlot(slot, aiRng) {
  if (slot.holder) slot.holder.hasToken = false;
  slot.holder = null;
  slot.committed = false;
  slot.cooldownFrames = TOKEN_COOLDOWN_MIN_FRAMES +
    Math.floor(aiRng.random() * (TOKEN_COOLDOWN_MAX_FRAMES - TOKEN_COOLDOWN_MIN_FRAMES));
}

/* One sim frame: releases slots whose holder finished its committed
   pattern (or died), ticks cooldowns, and reassigns free/off-cooldown
   slots. Call before stepping any enemy's AI so `enemy.hasToken` is
   current for this frame's stepEnemyAI gate (ai.js). */
export function stepTokens(tokenSystem, enemies, player, aiRng) {
  const alive = enemies.filter(e => e.hp > 0);

  tokenSystem.slots.forEach(slot => {
    if (slot.holder) {
      /* Phase 13d (QA-009): subsumes the old `hp <= 0` check. A holder that
         is dead OR parked in a state the AI machine can never advance out of
         (ai.js's canHoldAttackToken) gives the slot straight back -- it can
         never satisfy the committed->'approach' release below, so without
         this the whole melee pool stalls for the rest of the encounter. */
      if (!canHoldAttackToken(slot.holder)) { releaseSlot(slot, aiRng); return; }
      if (!slot.committed && slot.holder.ai.state !== 'approach') {
        slot.committed = true;
      } else if (slot.committed && slot.holder.ai.state === 'approach') {
        releaseSlot(slot, aiRng);
      }
      return;
    }
    if (slot.cooldownFrames > 0) { slot.cooldownFrames--; return; }
    // GDD §4.2 Hound (#7): "ignores attack tokens" -- never competes for or holds a slot
    const candidates = alive.filter(e => !e.hasToken && !e.def.ignoresToken && poolOf(e) === slot.pool &&
      e.ai.state !== 'staggered' && canHoldAttackToken(e));
    if (!candidates.length) return;
    const chosen = weightedPick(candidates, player, aiRng);
    chosen.hasToken = true;
    slot.holder = chosen;
    slot.committed = false;
  });
}
