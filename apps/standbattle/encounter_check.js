/* Encounter budget generator regression check — GDD §4.4's composition
   rules asserted the same way fairness_check.js/content_check.js assert
   theirs: runnable standalone, importable for a future test suite.
     node apps/standbattle/encounter_check.js */

import { createRng } from './rng.js';
import { generateEncounterBudget } from './encounter_budget.js';
import { ENEMIES } from './data.js';

const POOL = ['morioh_thug', 'knife_thug', 'brute'];
const TRIALS = 500;

export function runEncounterChecks() {
  const rng = createRng('encounter-check-seed').stream('test');
  const problems = [];
  for (let i = 0; i < TRIALS; i++) {
    const budget = 2 + Math.floor(rng.random() * 12);
    const chosen = generateEncounterBudget(rng, budget, POOL);
    if (!chosen.length) continue;
    const rangedCount = chosen.filter(id => ENEMIES[id].ranged).length;
    const callerCount = chosen.filter(id => ENEMIES[id].role === 'caller').length;
    const hasClashable = chosen.some(id => ENEMIES[id].clashable !== false);
    if (rangedCount > 2) problems.push(`trial ${i}: ${rangedCount} ranged enemies (budget ${budget})`);
    if (callerCount > 1) problems.push(`trial ${i}: ${callerCount} callers (budget ${budget})`);
    if (!hasClashable) problems.push(`trial ${i}: no Clash-able enemy in [${chosen.join(',')}] (budget ${budget})`);
  }
  return { pass: problems.length === 0, problems, trials: TRIALS };
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const { pass, problems, trials } = runEncounterChecks();
  console.log(`Ran ${trials} generated compositions.`);
  problems.forEach(p => console.log('FAIL ' + p));
  console.log(pass ? 'All compositions satisfy the fairness/composition rules.' : 'COMPOSITION VIOLATION.');
  if (!pass) process.exit(1);
}
