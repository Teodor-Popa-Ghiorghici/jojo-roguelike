/* Headless fight harness (tech §5 Phase 1 deliverable 1). Proves the sim
   needs no canvas, no DOM and no requestAnimationFrame: it builds a combat
   instance exactly the way index.js does and steps it frame-by-frame
   through combat.step() -- one fixed 60Hz sim frame at a time, with no
   wall clock and no rendering involved anywhere in the process.

   runHeadlessFight() is written to be imported, not just run standalone --
   this is where the tech §4 fairness assertions (telegraph duration,
   defensive floor, pity timer, ...) will run once the content registry
   they check exists (Phase 2+). */

import { createCombat } from './combat.js';
import { createRng } from './rng.js';
import { ENEMIES } from './data.js';

/* A minimal deterministic policy so the harness produces a real fight
   instead of an idle standoff: close the gap while out of the player's
   own light-attack range, tap light otherwise. This is scripted, not
   random -- the only randomness anywhere in the run is the seeded 'ai'
   stream combat.js already draws its enemy-pattern/token choices from, so
   the same seed reproduces the exact same fight, frame for frame. Targets
   whichever enemy is first alive in `combat.enemies` (Phase 5) -- for a
   single-enemy fight that's the same enemy as before; for a crowd it's a
   simple "always fight the nearest-spawned survivor" policy, enough to
   prove the crowd sim reaches a decisive, reproducible outcome headless. */
const LIGHT_RANGE = 60;
function scriptFrame(combat) {
  const p = combat.player;
  const e = combat.enemies.find(x => x.hp > 0);
  if (!e) return;
  const dist = Math.abs(e.x - p.x);
  const closing = dist > LIGHT_RANGE;
  combat.setKey('right', closing && e.x >= p.x);
  combat.setKey('left', closing && e.x < p.x);
  if (!closing && p.state === 'idle') {
    combat.setKey('light', true);
    combat.setKey('light', false);
  }
}

export function runHeadlessFight({ seed = 'harness-seed', enemyId = 'morioh_thug', encounter = null, frames = 1000 } = {}) {
  const rng = createRng(seed);
  const combat = createCombat(encounter || ENEMIES[enemyId], [], { shakeEnabled: false }, rng);
  let stepped = 0;
  for (; stepped < frames && combat.outcome === 'fighting'; stepped++) {
    scriptFrame(combat);
    combat.step();
  }
  return {
    seed, enemyId, framesRequested: frames, framesRun: stepped,
    outcome: combat.outcome,
    player: { hp: combat.player.hp, maxHp: combat.player.maxHp, x: combat.player.x, z: combat.player.z },
    enemy: { hp: combat.enemy.hp, maxHp: combat.enemy.maxHp, x: combat.enemy.x, z: combat.enemy.z },
    enemies: combat.enemies.map(e => ({ id: e.id, hp: e.hp, x: e.x, z: e.z }))
  };
}

/* `node apps/standbattle/headless_harness.js` -- steps 1000 frames with no
   canvas anywhere in the process and prints the result. Run it twice with
   the same seed to see the determinism guarantee: identical output both
   times. */
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runHeadlessFight({ frames: 1000 });
  console.log(JSON.stringify(result, null, 2));
}
