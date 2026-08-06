/* npm run sweep -- runs the headless harness (headless_harness.js) across
   many seeds per enemy type and reports aggregate outcomes only -- never
   per-run detail, which is the whole point (a dump of N run objects costs
   tens of thousands of tokens and carries them for the rest of the
   session). Also sweeps the Act I map generator (Phase 8) over the same
   --runs=N seeds: 0-Rest/0-Shop paths, pity-gap violations, and the
   resample-retry distribution. Prints at most 20 lines on success;
   --verbose prints the full per-seed breakdown for whichever group(s)
   failed. */

import { runHeadlessFight } from '../headless_harness.js';
import { ENEMIES, BOSSES } from '../data.js';
import { createRng } from '../rng.js';
import { generateAct1Map } from '../map_gen.js';
import { checkAll } from '../map_constraints.js';
import { ACT_CONFIGS } from '../map_data.js';
import { createRunFragmentState, generateOffer, skipOfferForPity, PITY_THRESHOLD } from '../fragment_offers.js';
import { decideCombatRewardKind } from '../economy.js';

const verbose = process.argv.includes('--verbose');
const runsArg = process.argv.find(a => a.startsWith('--runs='));
const RUNS = runsArg ? parseInt(runsArg.split('=')[1], 10) : 50;

/* Phase 9d: every registered boss (data_bosses.js's BOSSES), not just
   Killer Queen -- a 10th boss added to that registry is swept for free,
   never a second line here. */
const TARGETS = [
  { id: 'morioh_thug', def: ENEMIES.morioh_thug },
  { id: 'knife_thug', def: ENEMIES.knife_thug },
  { id: 'brute', def: ENEMIES.brute },
  ...Object.entries(BOSSES).map(([id, def]) => ({ id, def }))
].filter(t => t.def);

const groups = TARGETS.map(({ id, def }) => {
  const outcomes = { win: 0, lose: 0, timeout: 0 };
  const nonDecisive = [];
  for (let i = 0; i < RUNS; i++) {
    const seed = `sweep-${id}-${i}`;
    const result = runHeadlessFight({ seed, encounter: def, frames: 3600 });
    if (result.outcome === 'fighting') {
      outcomes.timeout++;
      nonDecisive.push(seed);
    } else {
      outcomes[result.outcome] = (outcomes[result.outcome] || 0) + 1;
    }
  }
  return { id, runs: RUNS, outcomes, nonDecisive, decisive: outcomes.timeout === 0 };
});

const undecided = groups.filter(g => !g.decisive);

if (verbose) {
  groups.forEach(g => {
    console.log(`-- ${g.id} (${g.runs} runs) --`);
    console.log(`  ${JSON.stringify(g.outcomes)}`);
    if (g.nonDecisive.length) console.log(`  non-decisive seeds: ${g.nonDecisive.join(', ')}`);
  });
}

/* Phase 8: same RUNS seeds, but for the Act I map generator instead of
   combat -- the mission's own bar is "no seed with 0 Rests or 0 Shops on
   any path; no run exceeding 4 nodes without a Rare+; generator retry
   count within a sane bound (report the distribution)". Reuses
   run_flow.js's exact reward-decision functions (decideCombatRewardKind/
   skipOfferForPity) rather than re-deriving the pity rule, same as
   map_check.js. */
const RARE_PLUS = new Set(['rare', 'epic', 'legendary']);
function worstPityGap(graph, rng) {
  let path = graph.paths[0];
  graph.paths.forEach(p => { if (p.length > path.length) path = p; });
  const runState = createRunFragmentState();
  runState.upgradePoints = 3;
  let worst = 0;
  path.forEach(id => {
    const node = graph.nodes[id];
    if (node.type === 'elite' || node.type === 'boss') {
      runState.nodesSinceRare = Math.max(runState.nodesSinceRare, PITY_THRESHOLD);
      generateOffer(rng, runState);
    } else if (node.type === 'combat') {
      if (decideCombatRewardKind(rng, runState) === 'yen') skipOfferForPity(runState);
      else generateOffer(rng, runState);
    } else if (node.type === 'treasure') {
      generateOffer(rng, runState);
    } else return;
    worst = Math.max(worst, runState.nodesSinceRare);
  });
  return worst;
}

let zeroRestPaths = 0, zeroShopPaths = 0, worstPityGapOverall = 0, constraintFailures = 0, repairedCount = 0;
const attempts = [];
for (let i = 0; i < RUNS; i++) {
  const rng = createRng(`mapsweep-${i}`);
  const graph = generateAct1Map(rng.stream('map'));
  attempts.push(graph.attempts);
  if (graph.repaired) repairedCount++;
  if (!checkAll(graph, ACT_CONFIGS[1].constraints).pass) constraintFailures++;
  graph.paths.forEach(p => {
    if (!p.some(id => graph.nodes[id].type === 'rest')) zeroRestPaths++;
    if (!p.some(id => graph.nodes[id].type === 'shop')) zeroShopPaths++;
  });
  const gap = worstPityGap(graph, rng.stream('rewards'));
  if (gap > worstPityGapOverall) worstPityGapOverall = gap;
}
attempts.sort((a, b) => a - b);
const meanAttempts = attempts.reduce((s, a) => s + a, 0) / RUNS;
const mapOk = zeroRestPaths === 0 && zeroShopPaths === 0 && worstPityGapOverall <= PITY_THRESHOLD && constraintFailures === 0;

if (verbose) {
  console.log(`-- map generator (${RUNS} seeds) --`);
  console.log(`  attempts: mean ${meanAttempts.toFixed(2)}, p50 ${attempts[Math.floor(RUNS * 0.5)]}, p95 ${attempts[Math.floor(RUNS * 0.95)]}, max ${attempts[RUNS - 1]}`);
  console.log(`  repair floor hit: ${repairedCount}/${RUNS} (${(repairedCount / RUNS * 100).toFixed(3)}%)`);
}

const combatOk = undecided.length === 0;

if (combatOk) {
  groups.forEach(g => console.log(`OK   ${g.id}: ${g.runs}/${g.runs} decisive — ${JSON.stringify(g.outcomes)}`));
} else {
  undecided.forEach(g => {
    console.log(`FAIL ${g.id}: ${g.outcomes.timeout}/${g.runs} runs hit the frame cap without a decisive outcome`);
  });
}
if (mapOk) {
  console.log(`OK   map: ${RUNS}/${RUNS} satisfy constraints; 0 seeds with a 0-Rest/0-Shop path; worst pity gap ${worstPityGapOverall}/${PITY_THRESHOLD}; retry mean ${meanAttempts.toFixed(1)}, repair floor ${(repairedCount / RUNS * 100).toFixed(2)}%`);
} else {
  console.log(`FAIL map: ${constraintFailures} constraint failure(s), ${zeroRestPaths} 0-Rest path(s), ${zeroShopPaths} 0-Shop path(s), worst pity gap ${worstPityGapOverall}/${PITY_THRESHOLD}`);
}

if (combatOk && mapOk) {
  console.log('\nAll sweeps (combat decisiveness + map fairness) pass.');
} else {
  if (!combatOk) console.log(`\n${undecided.length}/${groups.length} combat target(s) had non-decisive runs.`);
  if (!mapOk) console.log('\nMap generator fairness sweep FAILED.');
  process.exit(1);
}
