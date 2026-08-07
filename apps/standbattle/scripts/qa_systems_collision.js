/* Phase 13f — where systems meet. Runs the cross-system collision matrix
   in qa_collision_cases{,_b,_c}.js and prints a collision map (which
   system pair produced how many findings).

   Durable QA script, same shape as qa_matrix.js / qa_run_sweep.js: at most
   ~20 lines on success, the failing/finding cases only on failure, full
   detail behind --verbose.

     node apps/standbattle/scripts/qa_systems_collision.js
     node apps/standbattle/scripts/qa_systems_collision.js --group=6
     node apps/standbattle/scripts/qa_systems_collision.js --case=c6a --verbose
     node apps/standbattle/scripts/qa_systems_collision.js --record

   --case=<id prefix> is the deterministic repro every ledger entry cites:
   a case may poke sim state on an exact frame, and state pokes are not
   part of a replay's input log, so `npm run replay` alone cannot reproduce
   one (same caveat docs/qa/replays/README.md carries for the 13c files). */

if (typeof globalThis.window === 'undefined') globalThis.window = {};

import { CASES_A } from './qa_collision_cases.js';
import { CASES_B } from './qa_collision_cases_b.js';
import { CASES_C } from './qa_collision_cases_c.js';
import { CASES_D } from './qa_collision_cases_d.js';
import { setRecording, flushRecords } from './qa_collision_util.js';

const ALL = [...CASES_A, ...CASES_B, ...CASES_C, ...CASES_D];

const arg = k => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const verbose = process.argv.includes('--verbose');
const doRecord = process.argv.includes('--record');
const only = arg('case');
const group = arg('group') ? parseInt(arg('group'), 10) : null;
setRecording(doRecord);

const cases = ALL.filter(c => (group == null || c.group === group) && (only == null || c.id.startsWith(only)));
if (!cases.length) {
  console.error(`no cases matched (group=${group}, case=${only}). ${ALL.length} cases registered.`);
  process.exit(1);
}

const findings = [], absences = [], errors = [], recorded = [];
const pairCount = new Map();

for (const c of cases) {
  let res;
  try {
    res = c.run();
  } catch (e) {
    errors.push({ c, error: e });
    if (verbose) console.error(e.stack);
    continue;
  }
  const pair = [...c.systems].sort().join(' x ');
  if (res.finding) {
    findings.push({ c, res, pair });
    pairCount.set(pair, (pairCount.get(pair) || 0) + 1);
  } else if (res.absent) {
    absences.push({ c, res });
  }
  if (verbose && !res.finding) console.log(`  ok   ${c.id}${res.detail ? ` — ${res.detail}` : ''}`);
  if (doRecord) {
    try { recorded.push(...flushRecords()); } catch (e) { errors.push({ c, error: e }); }
  }
}

const groups = [...new Set(cases.map(c => c.group))].sort();
console.log(`phase 13f systems-collision matrix — ${cases.length} cases, groups ${groups.join(',')}`);

if (errors.length) {
  console.log(`\nERRORS (${errors.length}) — a case threw:`);
  errors.forEach(({ c, error }) => console.log(`  ${c.id}: ${error.message}`));
}

if (findings.length) {
  console.log(`\nFINDINGS (${findings.length}):`);
  findings.forEach(({ c, res, pair }) => {
    console.log(`\n  [${pair}] ${c.id}`);
    console.log(`    seed ${res.seed} frame ${res.frame}`);
    console.log(`    ${res.finding}`);
    if (verbose && res.detail) console.log(`    detail: ${JSON.stringify(res.detail)}`);
  });
  console.log('\ncollision map (system pair -> findings):');
  [...pairCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`  ${n}  ${p}`));
} else {
  console.log('no findings.');
}

if (absences.length) {
  console.log(`\nSTRUCTURAL ABSENCES (${absences.length}) — the mission named a mechanic this build does not have:`);
  absences.forEach(({ c, res }) => console.log(`  ${c.id} (${res.detail || '?'}): ${verbose ? res.absent : res.absent.slice(0, 140) + '…'}`));
}

if (doRecord) console.log(`\nrecorded ${recorded.length} replay fixture(s) to docs/qa/replays/`);
console.log(`\n${cases.length - findings.length - errors.length} clean, ${findings.length} findings, ${absences.length} absences, ${errors.length} errors.`);
process.exit(errors.length ? 1 : 0);
