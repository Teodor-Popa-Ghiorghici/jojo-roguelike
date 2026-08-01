/* Encounter: waves, spawn scheduling, win conditions — GDD §4.4, tech
   §2.3 deliverable 1. A legacy single enemy def (boss/elite/solo combat)
   is normalized into a trivial one-wave encounter here, so createCombat
   (combat.js) has exactly one entity-creation path: a boss fight is an
   N=1 crowd, not a separate code path.

   `winCondition` is a DATA FIELD (tech §2.3 deliverable 1) looked up in
   WIN_CONDITIONS -- 'killAll' is the only implementation today. Rule
   Fights and GDD §15's encounter objectives are entirely future entries
   in this same lookup; adding one is a registry entry, never a rewrite of
   how a fight decides it's over. */

import { ENEMIES } from './data.js';
import { createEnemyFighter } from './fighter.js';
import { createEnemyAI } from './ai.js';
import { initPoise } from './poise.js';
import { initParts } from './boss_parts.js';
import { initPurge } from './purge.js';
import { generateEncounterBudget } from './encounter_budget.js';
import { ARENA_MAX, Z_REST } from './constants.js';

export const WAVE_TELEGRAPH_FRAMES = 90; // 1.5s, GDD §4.4: "later waves telegraph 1.5s before arriving"

const SPAWN_BASE_X = ARENA_MAX - 60;
const SPAWN_STEP_X = 46;
const SPAWN_Z_OFFSETS = [0, -26, 26, -13, 13]; // deterministic spread across the belt plane's depth axis

export const WIN_CONDITIONS = {
  killAll: combat => combat.enemies.every(e => e.hp <= 0)
};

function resolveEnemyDef(t) { return typeof t === 'string' ? ENEMIES[t] : t; }

/* Accepts either a real encounter def (`{ waves, winCondition }`) or a
   legacy raw enemy def (boss/elite/single combat node) and always returns
   an encounter def, so every caller downstream only ever sees one shape. */
export function normalizeEncounter(defOrSingleEnemy) {
  if (defOrSingleEnemy && defOrSingleEnemy.waves) return defOrSingleEnemy;
  return { id: defOrSingleEnemy.id, winCondition: 'killAll', waves: [{ types: [defOrSingleEnemy] }] };
}

function spawnPosition(index) {
  return { x: SPAWN_BASE_X - index * SPAWN_STEP_X, z: Z_REST + SPAWN_Z_OFFSETS[index % SPAWN_Z_OFFSETS.length] };
}

function resolveWaveTypes(waveDef, rng) {
  if (waveDef.types) return waveDef.types;
  return generateEncounterBudget(rng, waveDef.generate.budget, waveDef.generate.pool);
}

export function createEncounter(def) {
  return { def, waveIndex: -1, telegraphing: false, telegraphTimer: 0 };
}

function spawnWave(combat, waveDef, waveIndex, opts, rng) {
  resolveWaveTypes(waveDef, rng).forEach((t, i) => {
    const def = resolveEnemyDef(t);
    const pos = spawnPosition(combat.enemies.length);
    /* A run modifier's tint (opts.tint, data.js's MODIFIERS) wins if
       present; otherwise a crowd type's own inherent tint (def.tint) reads
       it apart from its neighbours at a glance with zero new sprite art. */
    const tint = opts.tint || def.tint || null;
    const enemy = createEnemyFighter(def, pos.x, opts.hpMult, opts.speedMult, tint, pos.z);
    enemy.waveIndex = waveIndex;
    enemy.ai = createEnemyAI(def.phases ? def.phases[0].attackPatterns : def.attackPatterns);
    enemy.brain = enemy.ai;
    initPoise(enemy, def);
    initParts(enemy, def); // Phase 6 -- a no-op array for every def without a `parts` field
    initPurge(enemy); // Phase 6 -- a no-op until `purgeAtHpFrac` is set
    combat.enemies.push(enemy);
    combat.entities.push(enemy);
  });
}

/* One sim frame of encounter bookkeeping: spawns wave 0 the first time
   it's called (also used once, synchronously, by combat.js at fight
   creation so the opening wave exists on frame 0 exactly like the old
   single-enemy setup did), telegraphs and spawns later waves once the
   current wave is fully cleared, and only then checks the win condition --
   checking it before every wave has actually spawned would falsely read
   "all (zero) remaining enemies dead" the instant an earlier wave clears. */
export function stepEncounter(combat, encounter, opts, rng) {
  const waves = encounter.def.waves;
  if (encounter.waveIndex === -1) {
    spawnWave(combat, waves[0], 0, opts, rng);
    encounter.waveIndex = 0;
    return;
  }

  const moreWaves = encounter.waveIndex + 1 < waves.length;
  if (moreWaves) {
    const waveAlive = combat.enemies.some(e => e.waveIndex === encounter.waveIndex && e.hp > 0);
    if (!waveAlive) {
      if (!encounter.telegraphing) {
        encounter.telegraphing = true;
        encounter.telegraphTimer = WAVE_TELEGRAPH_FRAMES;
        combat.banner = 'REINFORCEMENTS INCOMING';
        combat.bannerTimer = WAVE_TELEGRAPH_FRAMES;
      } else {
        encounter.telegraphTimer--;
        if (encounter.telegraphTimer <= 0) {
          encounter.waveIndex++;
          spawnWave(combat, waves[encounter.waveIndex], encounter.waveIndex, opts, rng);
          encounter.telegraphing = false;
        }
      }
    }
    return;
  }

  if (combat.outcome === 'fighting' && WIN_CONDITIONS[encounter.def.winCondition](combat)) {
    combat.outcome = 'win';
  }
}
