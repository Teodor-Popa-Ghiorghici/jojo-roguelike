/* npm run determinism -- Phase 13a deliverable 5. Same seed must produce
   byte-identical sim state: twice in this process, twice in fresh
   processes (proves no process-local cache is doing the work), and with
   the render-adjacent juice layer (hit-stop/shake, the one system that
   deliberately stays on a non-sim clock per sim.md) attached vs detached.
   Any mismatch on the last check means render state is leaking into a sim
   stream -- an S1 per the mission brief, fix before anything else in
   Phase 13. Prints at most 20 lines on success, only the failing
   comparison on failure. */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCombatFromHeader, checksumFrame } from '../replay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = 'determinism-check';
const FRAMES = 1800;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runInProcess(shakeEnabled) {
  const combat = buildCombatFromHeader({ seed: SEED, enemyId: 'morioh_thug', standId: 'star_platinum' });
  combat.juice.shakeEnabled = shakeEnabled;
  const rng = mulberry32((SEED.length * 2654435761) >>> 0);
  const checksums = [];
  for (let f = 0; f < FRAMES && combat.outcome === 'fighting'; f++) {
    ['left', 'right'].forEach(a => combat.setKey(a, rng() < 0.5));
    if (rng() < 0.05) combat.setKey('light', true);
    combat.setKey('light', false);
    combat.step();
    checksums.push(checksumFrame(combat));
  }
  return checksums;
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i + 1;
  return a.length !== b.length ? n + 1 : null;
}

const failures = [];

// 1. Same seed, same process, twice.
const a1 = runInProcess(true);
const a2 = runInProcess(true);
const diff1 = firstDiff(a1, a2);
if (diff1 != null) failures.push(`same-process rerun diverges at frame ${diff1}`);

// 2. Same seed, two fresh child processes.
const worker = join(__dirname, '_determinism_worker.js');
const p1 = execFileSync('node', [worker, SEED, '1', String(FRAMES)], { encoding: 'utf8' });
const p2 = execFileSync('node', [worker, SEED, '1', String(FRAMES)], { encoding: 'utf8' });
if (p1 !== p2) failures.push(`fresh-process rerun mismatch (${p1} vs ${p2})`);

// 3. Render layer (juice: hit-stop/shake) attached vs detached.
const withRender = execFileSync('node', [worker, SEED, '1', String(FRAMES)], { encoding: 'utf8' });
const withoutRender = execFileSync('node', [worker, SEED, '0', String(FRAMES)], { encoding: 'utf8' });
if (withRender !== withoutRender) {
  failures.push(`S1: render layer (juice) attached (${withRender}) vs detached (${withoutRender}) diverge -- render state is leaking into a sim stream`);
}

if (failures.length === 0) {
  console.log(`OK   determinism: same-process rerun, fresh-process rerun, and render-attached/detached all match over ${FRAMES} frames (seed=${SEED})`);
} else {
  failures.forEach(f => console.log(`FAIL determinism: ${f}`));
  process.exit(1);
}
