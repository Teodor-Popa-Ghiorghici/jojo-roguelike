/* npm run assert -- wraps the fairness assertions that already exist as
   standalone check modules (fairness_check.js's telegraph floor,
   encounter_check.js's composition rules, fragment_check.js's
   pity/starvation/convergence weighting, map_check.js's map-generator
   constraints/retry-distribution/pity-integration) into one summary.
   Prints at most 20 lines on success, only the failing items on
   failure. --verbose prints every individual assertion. */

import { checkTelegraphFairness, checkTelegraphFairnessAtMenace } from '../fairness_check.js';
import { runEncounterChecks } from '../encounter_check.js';
import { runFragmentChecks } from '../fragment_check.js';
import { runMapChecks } from '../map_check.js';
import { runMetaChecks } from '../meta_check.js';

const verbose = process.argv.includes('--verbose');

const groups = [];

{
  const { pass, results } = checkTelegraphFairness();
  groups.push({
    name: 'telegraph fairness floor (>=260ms)', pass,
    items: results.map(r => ({ label: `${r.id} ${r.ms.toFixed(0)}ms`, ok: r.ok }))
  });
}
{
  /* Phase 10 -- the half of spec §5.1 that could not be tested before
     Track B existed: the floor holds "after all Menace modifiers are
     applied", at the top of the ladder. */
  const r = checkTelegraphFairnessAtMenace();
  groups.push({
    name: r.label, pass: r.pass,
    items: r.pass ? [{ label: `worst telegraph ${r.worst.ms.toFixed(0)}ms (${r.worst.id})`, ok: true }]
      : r.failures.map(f => ({ label: f, ok: false }))
  });
}
{
  /* The Track A / Track B firewall (spec §7). Source-level, so it fails
     the build the moment the Archive apply path so much as names the
     combat number pipeline. */
  const { pass, results } = await runMetaChecks();
  const items = Object.entries(results).map(([name, r]) => ({
    label: name + (r.skipped ? ' (skipped: no filesystem)' : ''), ok: r.pass
  }));
  groups.push({ name: 'meta firewall (Archive writes no stat, Menace unlocks nothing)', pass, items });
}
{
  const { pass, problems, trials } = runEncounterChecks();
  groups.push({
    name: `encounter composition (${trials} trials)`, pass,
    items: pass ? [] : problems.map(p => ({ label: p, ok: false }))
  });
}
{
  // Only the pity/starvation/convergence weighting assertions here --
  // pool structural validity (§6.7 etc.) is npm run validate's job.
  const { checks } = runFragmentChecks();
  const offerChecks = checks.filter(c => !c.label.startsWith('exactly') && !c.label.startsWith('the shipped pool'));
  groups.push({
    name: 'fragment offer weighting (pity/starvation/convergence)',
    pass: offerChecks.every(c => c.ok),
    items: offerChecks.map(c => ({ label: c.label, ok: c.ok }))
  });
}
{
  const { pass, checks } = runMapChecks(500);
  groups.push({
    name: 'map generator (constraints/retry distribution/pity integration)', pass,
    items: checks.map(c => ({ label: c.label + (c.detail ? ` (${c.detail})` : ''), ok: c.ok }))
  });
}

const failedGroups = groups.filter(g => !g.pass);

if (verbose) {
  groups.forEach(g => {
    console.log(`-- ${g.name} --`);
    g.items.forEach(i => console.log((i.ok ? 'OK  ' : 'FAIL') + ' ' + i.label));
  });
}

if (failedGroups.length === 0) {
  groups.forEach(g => console.log(`OK   ${g.name}`));
  console.log('\nAll fairness assertions pass.');
} else {
  failedGroups.forEach(g => {
    console.log(`FAIL ${g.name}:`);
    g.items.filter(i => !i.ok).forEach(i => console.log('  - ' + i.label));
  });
  console.log(`\n${failedGroups.length} assertion group(s) failed.`);
  process.exit(1);
}
