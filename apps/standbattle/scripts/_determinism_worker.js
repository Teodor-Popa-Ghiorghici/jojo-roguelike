/* Child-process worker for scripts/determinism.js -- runs one fight to a
   frame cap under a fixed deterministic policy and prints a single folded
   checksum. Kept as its own file (not a function determinism.js calls in-
   process) because "twice in fresh processes" is the whole point of that
   half of the determinism check: it proves nothing about process-local
   state (module caches, closures) is leaking into the result. */

import { buildCombatFromHeader, checksumFrame } from '../replay.js';

const seed = process.argv[2];
const shakeEnabled = process.argv[3] === '1';
const frames = parseInt(process.argv[4], 10) || 1800;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const combat = buildCombatFromHeader({ seed, enemyId: 'morioh_thug', standId: 'star_platinum' });
combat.juice.shakeEnabled = shakeEnabled;
const rng = mulberry32((seed.length * 2654435761) >>> 0);
let fold = 0x9E3779B9;
for (let f = 0; f < frames && combat.outcome === 'fighting'; f++) {
  ['left', 'right'].forEach(a => combat.setKey(a, rng() < 0.5));
  if (rng() < 0.05) combat.setKey('light', true);
  ['light'].forEach(a => combat.setKey(a, false));
  combat.step();
  fold = (Math.imul(fold ^ checksumFrame(combat), 0x01000193)) >>> 0;
}
process.stdout.write(String(fold));
