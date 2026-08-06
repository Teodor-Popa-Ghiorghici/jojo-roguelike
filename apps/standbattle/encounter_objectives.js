/* Encounter objectives -- GDD §15: near-free variety over encounter.js's
   winCondition abstraction, not a parallel fight-outcome system. Each
   entry is a set of OPTIONAL hooks layered on top of the ordinary
   wave/killAll flow in encounter.js's stepEncounter, so an objective that
   needs no extra rule (e.g. Standard) is just an absent registry entry:
     onStart(combat, encounter, rng)  -- once, right after wave 0 spawns.
     onTick(combat, encounter, rng)   -- every sim frame after that.
     checkWin(combat, encounter)      -- if present, evaluated every frame
       BEFORE the wave-clear gate and short-circuits the fight the instant
       it's true, so a timer/target objective can end a fight while later
       waves are still pending. Absent means "defer to the existing
       waves-then-winCondition flow", i.e. Standard's behavior.

   Split out of encounter.js (300-line cap) -- the only reason this file
   and encounter.js import each other is spawnWave (Survive's drip-feed
   reuses the real spawner); neither is read at module-evaluation time on
   either side, so the cycle never actually resolves anything undefined. */

import { spawnWave } from './encounter.js';
import { spawnHazard } from './hazards.js';
import { ARENA_MIN, ARENA_MAX, Z_REST, SIM_HZ } from './constants.js';

const BOUNTY_BUFF_INTERVAL = 3 * SIM_HZ; // GDD §15: "ignoring it lets it buff the others" -- ticks, not a lump sum
const BOUNTY_BUFF_MULT = 1.12;
const BOUNTY_MAX_STACKS = 6; // caps the buff instead of an unbounded runaway on a long-ignored bounty
const PINNED_DEFAULT_FRAMES = 40 * SIM_HZ;
const SURVIVE_DEFAULT_FRAMES = 30 * SIM_HZ;

export const OBJECTIVES = {
  /* GDD §15: "You start surrounded, mid-arena, no opening beat." Mirrors
     half of wave 0 to the far side of a re-centered player and zeroes the
     usual 1.4s intro banner -- same enemies, same spawner, just where they
     land and when the fight actually starts. */
  ambush: {
    onStart(combat) {
      combat.bannerTimer = 0;
      const player = combat.player;
      const midX = (ARENA_MIN + ARENA_MAX) / 2;
      player.x = midX; player.z = Z_REST;
      combat.enemies.forEach((e, i) => {
        if (i % 2 === 1) e.x = Math.max(ARENA_MIN, Math.min(ARENA_MAX, midX - (e.x - midX)));
      });
    }
  },
  /* "Hold Nf against continuous spawns." Timer-gated win, independent of
     the normal wave-clear gate; `surviveSpawn` (optional) drip-feeds extra
     bodies through the same generateEncounterBudget generator combat's
     ordinary generated waves already use, on its own cadence, tagged into
     a wave-index namespace (1000+) the normal wave-clear gate never reads. */
  survive: {
    onStart(combat, encounter) {
      encounter.surviveTimer = encounter.def.surviveFrames || SURVIVE_DEFAULT_FRAMES;
      encounter.surviveSpawnTimer = encounter.def.surviveSpawn ? encounter.def.surviveSpawn.everyFrames : Infinity;
      encounter.surviveSpawnIndex = 0;
    },
    onTick(combat, encounter, rng) {
      encounter.surviveTimer -= 1;
      const spawnDef = encounter.def.surviveSpawn;
      if (!spawnDef) return;
      encounter.surviveSpawnTimer -= 1;
      if (encounter.surviveSpawnTimer <= 0) {
        encounter.surviveSpawnTimer = spawnDef.everyFrames;
        encounter.surviveSpawnIndex += 1;
        spawnWave(combat, { generate: { budget: spawnDef.budget, pool: spawnDef.pool } },
          1000 + encounter.surviveSpawnIndex, combat.spawnOpts, rng);
      }
    },
    checkWin: (combat, encounter) => encounter.surviveTimer <= 0
  },
  /* "Your User is trapped and cannot be moved -- everyone plays Long-Range
     for Nf." stand_classes.js's existing Long-Range scheme already drives
     the User by retreat AI while the player's input steers the Stand
     instead -- Pinned just forces that scheme for a window regardless of
     the equipped Stand's own class, via one field combat_player.js reads
     ahead of player.stand.controlScheme. Win stays the ordinary killAll
     gate below; the restriction lifts on its own after the window so a
     fight that runs long is never softlocked into it. */
  pinned: {
    onStart(combat, encounter) {
      encounter.pinnedTimer = encounter.def.pinnedFrames || PINNED_DEFAULT_FRAMES;
      combat.forceControlScheme = 'long';
    },
    onTick(combat, encounter) {
      if (!combat.forceControlScheme) return;
      encounter.pinnedTimer -= 1;
      if (encounter.pinnedTimer <= 0) combat.forceControlScheme = null;
    }
  },
  /* "Arena does the work" -- `def.arenaHazards` is a list of {delay,
     repeat, hazard, z?} specs; this just times them onto hazards.js's
     existing spawnHazard/stepHazards (the same mechanism a boss's own
     signature pattern already uses), never a new hazard system. */
  hazard: {
    onStart(combat, encounter) {
      encounter.hazardSpawns = (encounter.def.arenaHazards || []).map(h => ({ ...h, timer: h.delay }));
    },
    onTick(combat, encounter, rng) {
      encounter.hazardSpawns.forEach(h => {
        h.timer -= 1;
        if (h.timer <= 0) {
          const x = ARENA_MIN + rng.random() * (ARENA_MAX - ARENA_MIN);
          spawnHazard(combat, x, h.z != null ? h.z : Z_REST, h.hazard);
          h.timer = h.repeat || Infinity;
        }
      });
    }
  },
  /* "One marked enemy; killing it ends the fight early for bonus Yen,
     ignoring it lets it buff the others." The buff rides affixData.enraged
     -- resolvers.js's existing enemy-damage choke point already reads that
     field for the Enraged affix, so this is the same multiplier, applied
     from a different source, not a new one. `combat.bountyEarly` is read
     by run_flow.js's reward step to grant the bonus. */
  bounty: {
    onStart(combat, encounter) {
      const target = combat.enemies[encounter.def.bountyIndex || 0];
      if (!target) return;
      target.bounty = true;
      encounter.bountyTarget = target;
      encounter.bountyBuffTimer = BOUNTY_BUFF_INTERVAL;
      encounter.bountyStacks = 0;
    },
    onTick(combat, encounter) {
      const target = encounter.bountyTarget;
      if (!target || target.hp <= 0 || encounter.bountyStacks >= BOUNTY_MAX_STACKS) return;
      encounter.bountyBuffTimer -= 1;
      if (encounter.bountyBuffTimer > 0) return;
      encounter.bountyBuffTimer = BOUNTY_BUFF_INTERVAL;
      encounter.bountyStacks += 1;
      combat.enemies.forEach(e => {
        if (e === target || e.hp <= 0) return;
        e.affixData = e.affixData || {};
        e.affixData.enraged = (e.affixData.enraged || 1) * BOUNTY_BUFF_MULT;
      });
    },
    checkWin(combat, encounter) {
      if (encounter.bountyTarget && encounter.bountyTarget.hp <= 0) { combat.bountyEarly = true; return true; }
      return combat.enemies.every(e => e.hp <= 0);
    }
  }
  /* Sudden Death needs no entry here: a wave enemy's own `flees: true`
     field (read in encounter.js's spawnWave) plus the ordinary killAll
     winCondition is the whole objective -- see combat_enemy.js's 'flee'
     AI state. */
};
