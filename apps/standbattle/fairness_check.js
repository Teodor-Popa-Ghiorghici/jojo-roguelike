/* Automated fairness assertion -- spec §5.1 / GDD §6.8: "no damage source
   may be unreactable... every attack pattern's telegraph duration >= 260ms
   after all Menace modifiers are applied." There are no Menace modifiers
   yet (that's Phase 5), so this checks the floor every pattern must clear
   before any modifier ever gets to shrink it. Written the same way
   headless_harness.js is -- importable for a future CI/test-registry
   suite (tech §2.9/§4), and runnable standalone:
     node apps/standbattle/fairness_check.js */

import { PATTERNS } from './ai.js';
import { SIM_HZ } from './constants.js';
import { resolvePatternFrames } from './resolvers.js';
import { MENACE_CONDITIONS, MENACE_MAX_RANK, createMenaceProfile } from './meta_menace.js';

const MIN_TELEGRAPH_MS = 260;

export function checkTelegraphFairness() {
  const frameMs = 1000 / SIM_HZ;
  const results = Object.values(PATTERNS).map(p => ({
    id: p.id, windupFrames: p.windupFrames, ms: p.windupFrames * frameMs, ok: p.windupFrames * frameMs >= MIN_TELEGRAPH_MS
  }));
  return { pass: results.every(r => r.ok), results };
}

/* Phase 10 — the same floor, "after all Menace modifiers are applied"
   (spec §5.1 / GDD §6.8), which is the half that could not be tested
   before Track B existed. Two complementary passes, because one alone
   would be weak:

   1. EXHAUSTIVE over the only axis that can reach a frame count. Menace's
      whole numeric vocabulary is MENACE_PROFILE_KEYS, of which exactly one
      (`enemyRecoveryMult`, from Sharpened Instinct) is read by
      resolvePatternFrames -- so every achievable pattern timeline is
      covered by walking that condition's 0..3 ranks against every pattern.
   2. FUZZ over whole pacts at the top of the ladder: random rank vectors
      summing to exactly MENACE_MAX_RANK, resolved and pushed through the
      real resolver. This is what catches a future condition that acquires
      a path to a telegraph it should not have -- the exhaustive pass would
      not notice, because it does not know the new key exists.

   Both assert on `windupFrames` after resolution, never on the authored
   value, so the test measures what the player actually reacts to. */
export function checkTelegraphFairnessAtMenace(maxRank = MENACE_MAX_RANK, samples = 20000) {
  const frameMs = 1000 / SIM_HZ;
  const patterns = Object.values(PATTERNS);
  const failures = [];
  let worst = { id: null, ms: Infinity };

  const probe = (profile, label) => {
    for (const p of patterns) {
      const resolved = resolvePatternFrames({}, p.id, profile);
      const ms = resolved.windupFrames * frameMs;
      if (ms < worst.ms) worst = { id: p.id, ms };
      if (ms < MIN_TELEGRAPH_MS) failures.push(`${p.id} ${ms.toFixed(0)}ms under ${label}`);
    }
  };

  const recovery = MENACE_CONDITIONS.find(c => c.key === 'enemyRecoveryMult');
  for (let r = 0; recovery && r <= recovery.ranks; r++) {
    probe(createMenaceProfile({ [recovery.id]: r }), `${recovery.id} rank ${r}`);
  }

  /* Deterministic LCG rather than Math.random so a failure is reproducible
     -- this is a test, not a simulation (invariant 2's discipline). */
  let seed = 0x5eed;
  const rand = n => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
  for (let s = 0; s < samples; s++) {
    const pact = {};
    let budget = maxRank;
    const order = MENACE_CONDITIONS.slice().sort(() => (rand(3) - 1));
    for (const c of order) {
      if (budget <= 0) break;
      const take = rand(Math.min(c.ranks, budget) + 1);
      if (take > 0) { pact[c.id] = take; budget -= take; }
    }
    probe(createMenaceProfile(pact), `a rank-${maxRank - budget} pact`);
    if (failures.length > 5) break;
  }

  return {
    pass: failures.length === 0, failures, worst,
    label: `telegraph floor at Menace ${maxRank} (exhaustive on recovery + ${samples} sampled pacts)`
  };
}

/* Pre-existing bug found during Phase 4 browser verification, fixed here:
   this file is imported into the live runtime (content_registry.js ->
   combat.js -> index.js), but `process` is a Node-only global -- any
   in-browser load of the app threw a ReferenceError at this line before
   the guard below, i.e. the app has been unplayable in an actual browser
   since Phase 3 wired content_registry.js in. `typeof process` first
   keeps the CLI-runnable-standalone behavior (`node .../fairness_check.js`)
   working exactly as before. */
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const { pass, results } = checkTelegraphFairness();
  results.forEach(r => console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.id.padEnd(24)} ${r.ms.toFixed(0)}ms (>= ${MIN_TELEGRAPH_MS}ms)`));
  console.log(pass ? '\nAll telegraphs clear the fairness floor.' : '\nFAIRNESS VIOLATION.');
  if (!pass) process.exit(1);
}
