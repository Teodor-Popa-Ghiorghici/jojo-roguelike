/* npm run sweep -- runs the headless harness (headless_harness.js) across
   many seeds per enemy type and reports aggregate outcomes only -- never
   per-run detail, which is the whole point (a dump of N run objects costs
   tens of thousands of tokens and carries them for the rest of the
   session). Prints at most 20 lines on success; --verbose prints the full
   per-seed breakdown for whichever group(s) failed to reach a decisive
   outcome every time. */

import { runHeadlessFight } from '../headless_harness.js';
import { ENEMIES, BOSS_KILLER_QUEEN } from '../data.js';

const verbose = process.argv.includes('--verbose');
const runsArg = process.argv.find(a => a.startsWith('--runs='));
const RUNS = runsArg ? parseInt(runsArg.split('=')[1], 10) : 50;

const TARGETS = [
  { id: 'morioh_thug', def: ENEMIES.morioh_thug },
  { id: 'knife_thug', def: ENEMIES.knife_thug },
  { id: 'brute', def: ENEMIES.brute },
  { id: 'killer_queen', def: BOSS_KILLER_QUEEN }
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

if (undecided.length === 0) {
  groups.forEach(g => console.log(`OK   ${g.id}: ${g.runs}/${g.runs} decisive — ${JSON.stringify(g.outcomes)}`));
  console.log('\nAll sweeps reached a decisive outcome every run.');
} else {
  undecided.forEach(g => {
    console.log(`FAIL ${g.id}: ${g.outcomes.timeout}/${g.runs} runs hit the frame cap without a decisive outcome`);
  });
  console.log(`\n${undecided.length}/${groups.length} target(s) had non-decisive runs.`);
  process.exit(1);
}
