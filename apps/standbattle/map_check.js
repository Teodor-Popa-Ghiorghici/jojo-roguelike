/* Map generator regression check — Phase 8 deliverable 1/4. Same
   standalone-runnable pattern as fairness_check.js/encounter_check.js/
   fragment_check.js:
     node apps/standbattle/map_check.js

   Proves, over real seeds (not a synthetic fixture): every generated
   Act I map satisfies its own declarative constraints (map_data.js's
   ACT1_CONSTRAINTS), the resample-loop retry count stays in a sane
   range (mission's own bar), and the pity guarantee still holds end to
   end once the Yen-reward branch (economy.js) can skip an offer
   entirely -- not just in isolation the way fragment_check.js already
   proves it. */

import { createRng } from './rng.js';
import { generateAct1Map } from './map_gen.js';
import { checkAll } from './map_constraints.js';
import { ACT_CONFIGS } from './map_data.js';
import { createRunFragmentState, generateOffer, skipOfferForPity, PITY_THRESHOLD } from './fragment_offers.js';
import { decideCombatRewardKind } from './economy.js';

const RARE_PLUS = new Set(['rare', 'epic', 'legendary']);

/* Walks the graph's longest generated path (the most reward-node
   opportunities, so the hardest case to keep the gap small over),
   reusing the exact same decision functions run_flow.js calls in the
   real game -- an integration check, not a re-implementation. Returns
   the worst `nodesSinceRare` value ever observed at a reward-granting
   node; the mission's bar is that this never exceeds PITY_THRESHOLD. */
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
    } else {
      return; // rest/shop/event/archive never guarantee a reward
    }
    worst = Math.max(worst, runState.nodesSinceRare);
  });
  return worst;
}

export function runMapChecks(n = 500) {
  const checks = [];
  const check = (label, cond, detail) => checks.push({ label, ok: cond, detail });

  let constraintFailures = 0;
  let noRestPath = 0, noShopPath = 0;
  let worstGapOverall = 0, repairedCount = 0;
  const attempts = [];

  for (let i = 0; i < n; i++) {
    const rng = createRng('mapcheck-' + i);
    const graph = generateAct1Map(rng.stream('map'));
    attempts.push(graph.attempts);
    if (graph.repaired) repairedCount++;
    if (!checkAll(graph, ACT_CONFIGS[1].constraints).pass) constraintFailures++;
    graph.paths.forEach(p => {
      if (!p.some(id => graph.nodes[id].type === 'rest')) noRestPath++;
      if (!p.some(id => graph.nodes[id].type === 'shop')) noShopPath++;
    });
    const gap = worstPityGap(graph, rng.stream('rewards'));
    if (gap > worstGapOverall) worstGapOverall = gap;
  }

  attempts.sort((a, b) => a - b);
  const mean = attempts.reduce((s, a) => s + a, 0) / n;
  const p95 = attempts[Math.floor(n * 0.95)];

  check(`${n} seeds all satisfy their declarative constraints`, constraintFailures === 0, `${constraintFailures} failure(s)`);
  check('no path missing a Rest', noRestPath === 0, `${noRestPath} path(s)`);
  check('no path missing a Shop', noShopPath === 0, `${noShopPath} path(s)`);
  check(`resample retry count stays sane (mean ${mean.toFixed(1)}, p95 ${p95}, max ${attempts[n - 1]})`, p95 < 40, `repair floor hit ${repairedCount}/${n} times (${(repairedCount / n * 100).toFixed(2)}%)`);
  check(`pity never exceeds ${PITY_THRESHOLD} reward-nodes without a Rare+ (worst observed: ${worstGapOverall})`, worstGapOverall <= PITY_THRESHOLD);

  const failures = checks.filter(c => !c.ok).length;
  return { pass: failures === 0, failures, checks, retryStats: { mean, p95, max: attempts[n - 1], repairedCount, n } };
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const n = (process.argv.find(a => a.startsWith('--n=')) || '').split('=')[1];
  const { pass, failures, checks } = runMapChecks(n ? parseInt(n, 10) : 500);
  checks.forEach(c => console.log((c.ok ? 'OK  ' : 'FAIL') + ' ' + c.label + (c.detail ? ' (' + c.detail + ')' : '')));
  console.log(pass ? '\nAll map generator checks pass.' : `\n${failures} FAILURE(S).`);
  if (!pass) process.exit(1);
}
