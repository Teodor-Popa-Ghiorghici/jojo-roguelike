/* npm run fuzz -- --runs=N --seed=S [--profile=weighted|mash|idle|spatial]
   Headless random-input agent (Phase 13a deliverable 3/4). Drives
   combat.setKey with weighted-random inputs (biased toward realistic
   action frequencies) plus two explicit stress profiles -- mash (every
   input every frame) and idle (nothing at all) -- and checks a fixed set
   of invariants every simulated frame. Prints at most 20 lines on
   success; on any violation it prints only the seed, run profile,
   violated invariant and frame -- that seed is a ready-made bug-list
   entry (docs/qa/bugs.md), not something to paste a transcript for.

   Phase 13c adds `spatial`: not random at all -- a cycle of SCRIPTED
   corner/wall/tether/knockback/z-extreme scenarios (below), because a
   uniform-random agent almost never spends enough consecutive frames
   pinned in a corner to expose a clamp-ordering bug. Reuses this same
   file's checkInvariants (bounds/NaN/stuck-detector) unchanged -- the
   spatial profile is a different *input* policy, not a different
   monitor. */

import { ENEMIES, BOSSES } from '../data.js';
import { buildCombatFromHeader, checksumFrame } from '../replay.js';
import { resolveTetherLength } from '../resolvers.js';
import { ARENA_MIN, ARENA_MAX, ARENA_Z_MIN, ARENA_Z_MAX } from '../arena_bounds.js';

const runsArg = process.argv.find(a => a.startsWith('--runs='));
const RUNS = runsArg ? parseInt(runsArg.split('=')[1], 10) : 50;
const seedArg = process.argv.find(a => a.startsWith('--seed='));
const BASE_SEED = seedArg ? seedArg.split('=')[1] : 'fuzz';
const profileArg = process.argv.find(a => a.startsWith('--profile='));
const FORCED_PROFILE = profileArg ? profileArg.split('=')[1] : null;
const verbose = process.argv.includes('--verbose');

const FRAME_CAP = 3600; // 60s -- long enough to expose steady-state drift, bounded enough to run 200+ seeds fast
const STUCK_FRAMES = 900; // 15 real seconds at 60Hz (mission spec)
const STUCK_MOVE_EPS = 2;
const OOB_MARGIN = 40; // generous "more than one frame's movement" slack

const HELD = ['left', 'right', 'forward', 'back'];
const EDGE = ['light', 'medium', 'heavy', 'special', 'rush', 'dodge', 'parry'];
const HELD_TOGGLE = ['guard', 'project'];

const TARGETS = [
  { id: 'morioh_thug', def: ENEMIES.morioh_thug },
  { id: 'knife_thug', def: ENEMIES.knife_thug },
  { id: 'brute', def: ENEMIES.brute },
  ...Object.entries(BOSSES).map(([id, def]) => ({ id, def }))
].filter(t => t.def);

const PROFILES = ['weighted', 'mash', 'idle'];

/* ---- spatial profile (Phase 13c) -- deliberate corner/wall/tether/
   knockback/z-extreme driving, test matrix items 1/2/4/5/7 ---- */

const CORNERS = [
  { left: true, forward: true },  // x-min, z-min
  { left: false, forward: true }, // x-max, z-min (right held below)
  { left: true, forward: false }, // x-min, z-max (back held below)
  { left: false, forward: false } // x-max, z-max
];

function cornerKeys(combat, corner) {
  combat.setKey('left', corner.left);
  combat.setKey('right', !corner.left);
  combat.setKey('forward', corner.forward);
  combat.setKey('back', !corner.forward);
}

/* Drive into a corner, then hammer Project (held, toggled, and driven
   further into the wall/diagonally OOB) right at the wall -- matrix #1/#2:
   Project in every direction incl. into/through walls, Project+walk,
   Step into corner while Projecting, release Project mid-drag. */
function spatialCornerProject(combat, f, corner) {
  cornerKeys(combat, corner);
  const t = f % 180;
  combat.setKey('project', t < 150); // held most of the window, released for a stretch (mid-drag release)
  if (t >= 60 && t < 90) { combat.setKey('dodge', true); combat.setKey('dodge', false); } // Step attempt while Projecting (should be denied, never a crash)
}

/* Sit still exactly at a corner (matrix #4): knockback/launch at every
   arena edge from whatever the AI throws, plus attacks of our own so a
   Clash counter-knockback can also land at the wall. */
function spatialCornerKnockback(combat, f, corner) {
  cornerKeys(combat, corner);
  const t = f % 40;
  combat.setKey('left', corner.left && t < 20);
  combat.setKey('right', !corner.left && t < 20);
  combat.setKey('forward', corner.forward && t < 20);
  combat.setKey('back', !corner.forward && t < 20);
  if (t === 25) { combat.setKey('heavy', true); }
  if (t === 26) { combat.setKey('heavy', false); }
  if (t === 30) { combat.setKey('parry', true); }
  if (t === 31) { combat.setKey('parry', false); }
}

/* z-axis extremes (matrix #5): slam forward/back repeatedly, Projecting
   through part of it so the Stand's own z-clamp gets stressed too. */
function spatialZAxis(combat, f) {
  const t = f % 120;
  combat.setKey('forward', t < 60);
  combat.setKey('back', t >= 60);
  combat.setKey('left', false); combat.setKey('right', false);
  combat.setKey('project', t % 40 < 20);
}

/* Long-Range retreat AI into a corner (matrix #7): drive the Stand (which
   is what movement keys control under 'long') straight into a corner so
   the User's own retreat AI has to run its away-from-nearest-enemy logic
   right at the wall, plus periodic 'command' presses (reposition-to-Stand)
   so that order can't become a permanent no-op. */
function spatialLongRetreat(combat, f, corner) {
  cornerKeys(combat, corner);
  if (f % 90 === 0) { combat.setKey('command', true); }
  if (f % 90 === 1) { combat.setKey('command', false); }
}

const SPATIAL_SCENARIOS = [
  { fn: spatialCornerProject, standId: 'star_platinum' }, // Close-Range, held-Project class
  { fn: spatialCornerKnockback, standId: 'star_platinum' },
  { fn: spatialZAxis, standId: 'star_platinum' },
  { fn: spatialCornerProject, standId: 'sticky_fingers' }, // Mid-Range, flicked-Project class
  { fn: spatialLongRetreat, standId: 'hierophant_green' }  // Long-Range, retreat-AI class
];

/* Weighted: movement most frames, a light/medium tap every ~20 frames,
   heavier/utility actions rarer, held toggles occasionally flipped -- not
   uniform, so this finds the bugs a mashing agent glosses over (starved
   states, buffered-action edge cases) while mash/idle find the opposite
   class (overflow, division-by-zero-shaped stalls). */
function weightedFrame(combat, rng) {
  HELD.forEach(a => combat.setKey(a, rng() < 0.5));
  if (rng() < 0.05) combat.setKey('light', true);
  else if (rng() < 0.02) combat.setKey('medium', true);
  else if (rng() < 0.01) combat.setKey('heavy', true);
  else if (rng() < 0.015) combat.setKey('dodge', true);
  else if (rng() < 0.008) combat.setKey('special', true);
  else if (rng() < 0.008) combat.setKey('rush', true);
  else if (rng() < 0.01) combat.setKey('parry', true);
  EDGE.forEach(a => combat.setKey(a, false));
  if (rng() < 0.03) HELD_TOGGLE.forEach(a => combat.setKey(a, rng() < 0.5));
}
function mashFrame(combat) {
  HELD.concat(HELD_TOGGLE).forEach(a => combat.setKey(a, true));
  EDGE.forEach(a => { combat.setKey(a, true); combat.setKey(a, false); });
}
function idleFrame(combat) {
  HELD.concat(EDGE).concat(HELD_TOGGLE).forEach(a => combat.setKey(a, false));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function checkInvariants(combat, stuckState) {
  const violations = [];
  const all = combat.entities.concat(combat.enemies);
  all.forEach(e => {
    [e.x, e.z, e.hp, e.maxHp, e.persistence, e.momentum].forEach(v => {
      if (v != null && (Number.isNaN(v) || !Number.isFinite(v))) violations.push(`NaN/Infinity on ${e.id}`);
    });
    if (e.poise && Number.isFinite(e.poise.current) && Number.isFinite(e.poise.max)) {
      if (Number.isNaN(e.poise.current)) violations.push(`NaN poise on ${e.id}`);
    }
    if (e.hp != null && e.hp < 0) violations.push(`negative HP persisting on ${e.id}`);
    if (e.hp != null && e.maxHp != null && e.hp > e.maxHp + 0.001) violations.push(`HP above max on ${e.id}`);
    if (e.x < ARENA_MIN - OOB_MARGIN || e.x > ARENA_MAX + OOB_MARGIN) violations.push(`${e.id} out of x-bounds (${e.x.toFixed(1)})`);
    if (e.z != null && (e.z < ARENA_Z_MIN - OOB_MARGIN || e.z > ARENA_Z_MAX + OOB_MARGIN)) violations.push(`${e.id} out of z-bounds (${e.z.toFixed(1)})`);
    (e.statuses || []).forEach(s => {
      if (s.stacks < 0) violations.push(`negative stacks (${s.id}) on ${e.id}`);
      if (s.timer < 0) violations.push(`negative duration (${s.id}) on ${e.id}`);
    });
  });
  const dist = Math.hypot(combat.stand.x - combat.player.x, combat.stand.z - combat.player.z);
  const maxTether = resolveTetherLength(combat.player, combat.stats, combat.dispatcher) * 1.4 + 1;
  if (dist > maxTether) violations.push(`tether over max (${dist.toFixed(1)} > ${maxTether.toFixed(1)})`);

  // stuck detector: no HP change and no entity moved > STUCK_MOVE_EPS since the last check
  let moved = false, hpChanged = false;
  all.forEach(e => {
    const prev = stuckState.prev.get(e.id);
    if (!prev) return;
    if (Math.hypot(e.x - prev.x, (e.z || 0) - prev.z) > STUCK_MOVE_EPS) moved = true;
    if (e.hp != null && e.hp !== prev.hp) hpChanged = true;
  });
  all.forEach(e => stuckState.prev.set(e.id, { x: e.x, z: e.z || 0, hp: e.hp }));
  if (moved || hpChanged) stuckState.stillSince = combat.getFrame();
  else if (combat.getFrame() - stuckState.stillSince >= STUCK_FRAMES) {
    violations.push(`probable softlock (no HP change / no movement > ${STUCK_MOVE_EPS}px for ${STUCK_FRAMES} frames)`);
    stuckState.stillSince = combat.getFrame(); // don't re-report every subsequent frame
  }
  return violations;
}

function runOne(seed, target, profile, spatial) {
  const header = { seed, enemyId: target.id, standId: (spatial && spatial.standId) || 'star_platinum' };
  const combat = buildCombatFromHeader(header);
  const rng = mulberry32((seed.length * 2654435761) >>> 0);
  const stuckState = { prev: new Map(), stillSince: 0 };
  let lastFrame = 0;
  for (let f = 0; f < FRAME_CAP && combat.outcome === 'fighting'; f++) {
    if (profile === 'spatial') spatial.fn(combat, f, spatial.corner);
    else if (profile === 'weighted') weightedFrame(combat, rng);
    else if (profile === 'mash') mashFrame(combat);
    else idleFrame(combat);
    combat.step();
    if (combat.getFrame() !== lastFrame + 1) {
      return { seed, target: target.id, profile, frame: combat.getFrame(), violation: 'frame counter not monotonic (skip or double-step)' };
    }
    lastFrame = combat.getFrame();
    const violations = checkInvariants(combat, stuckState);
    if (violations.length) {
      return { seed, target: target.id, profile, frame: combat.getFrame(), violation: violations[0] };
    }
  }
  return null;
}

const failures = [];
for (let i = 0; i < RUNS; i++) {
  const target = TARGETS[i % TARGETS.length];
  const profile = FORCED_PROFILE || PROFILES[i % 10 < 7 ? 0 : (i % 10 < 8 ? 1 : 2)]; // ~70% weighted, ~10% mash, ~20% idle
  const seed = `${BASE_SEED}-${i}`;
  let spatial = null;
  if (profile === 'spatial') {
    const scenario = SPATIAL_SCENARIOS[i % SPATIAL_SCENARIOS.length];
    spatial = { fn: scenario.fn, standId: scenario.standId, corner: CORNERS[i % CORNERS.length] };
  }
  const result = runOne(seed, target, profile, spatial);
  if (result) failures.push(result);
}

if (failures.length === 0) {
  console.log(`OK   fuzz: ${RUNS} runs (targets: ${TARGETS.map(t => t.id).join(', ')}), 0 invariant violations`);
} else {
  failures.slice(0, 20).forEach(f => {
    console.log(`FAIL seed=${f.seed} target=${f.target} profile=${f.profile} frame=${f.frame}: ${f.violation}`);
  });
  if (failures.length > 20) console.log(`... ${failures.length - 20} more`);
  process.exit(1);
}
if (verbose) console.log(`profiles: ${PROFILES.join(', ')}; frame cap ${FRAME_CAP}; targets ${TARGETS.length}`);
