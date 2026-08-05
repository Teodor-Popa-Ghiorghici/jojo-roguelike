/* Generic mid-fight enemy spawn primitive -- Phase 9b finding: the roster
   needs "spawn more enemies after the fight has already started" for the
   Puppeteer/Caller behaviour profiles (GDD §4.2 #9/#14) and for the
   Mirrored/Split affixes, and nothing in encounter.js could do that yet --
   spawnWave only ever runs at wave-start. This is the one generalisation
   all four content entries share: a plain `{type, hpMult}` spawn, not four
   bespoke code paths. Position/timing stay deterministic (`rng` is the run's
   'ai' stream), matching every other AI decision (invariant 7).

   `enemy.def.summon: { type, delayFrames, intervalFrames?, max }` -- a
   one-shot summon at `delayFrames` if `intervalFrames` is omitted (Caller),
   or a repeating one every `intervalFrames` after that, capped at `max`
   simultaneously-alive summons from this source (Puppeteer). */

import { ENEMIES } from './data.js';
import { createEnemyFighter } from './fighter.js';
import { createEnemyAI } from './ai.js';
import { initPoise } from './poise.js';

const SPAWN_SPREAD = [18, -18, 34, -34, 0];

export function spawnMinions(combat, sourceTypeId, x, z, count, hpMult) {
  const def = ENEMIES[sourceTypeId];
  if (!def) return;
  for (let i = 0; i < count; i++) {
    const minion = createEnemyFighter(def, x + SPAWN_SPREAD[i % SPAWN_SPREAD.length], hpMult, 1, def.tint, z);
    minion.waveIndex = combat.encounter.waveIndex;
    minion.spawnX = minion.x;
    minion.ai = createEnemyAI(def.attackPatterns);
    minion.brain = minion.ai;
    initPoise(minion, def);
    // Summoned/split minions never carry their own rolled affixes -- they
    // are already the "weaker copy" payoff, not a second elite roll.
    combat.enemies.push(minion);
    combat.entities.push(minion);
  }
}

export function initSummonState(enemy, def) {
  if (!def.summon) return;
  enemy.summonTimer = def.summon.delayFrames;
  enemy.summonAliveIds = [];
}

/* One sim frame of one enemy's own summon timer. Called from
   combat_enemy.js alongside its other per-enemy per-frame bookkeeping. */
export function stepSummon(combat, enemy, rng) {
  const def = enemy.def;
  if (!def.summon || enemy.hp <= 0) return;
  enemy.summonAliveIds = enemy.summonAliveIds.filter(id => {
    const e = combat.entities.find(en => en.summonSourceId === id);
    return e && e.hp > 0;
  });
  if (enemy.summonAliveIds.length >= (def.summon.max || 1)) return;
  enemy.summonTimer -= 1;
  if (enemy.summonTimer > 0) return;
  enemy.summonTimer = def.summon.intervalFrames || Infinity; // one-shot (Caller) if never repeated
  const sourceId = enemy.id + ':' + combat.enemies.length + ':' + Math.floor(rng.random() * 1e6);
  const spawnDef = ENEMIES[def.summon.type];
  if (!spawnDef) return;
  const at = { x: enemy.x + (SPAWN_SPREAD[combat.enemies.length % SPAWN_SPREAD.length]), z: enemy.z };
  const minion = createEnemyFighter(spawnDef, at.x, def.summon.hpMult || 1, 1, spawnDef.tint, at.z);
  minion.waveIndex = enemy.waveIndex;
  minion.spawnX = minion.x;
  minion.summonSourceId = sourceId;
  minion.ai = createEnemyAI(spawnDef.attackPatterns);
  minion.brain = minion.ai;
  initPoise(minion, spawnDef);
  // Summoned fodder never rolls its own affixes -- "harmless alone" (Caller)/support fodder (Puppeteer) by design.
  combat.enemies.push(minion);
  combat.entities.push(minion);
  enemy.summonAliveIds.push(sourceId);
}
