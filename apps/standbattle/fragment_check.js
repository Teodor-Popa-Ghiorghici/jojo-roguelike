/* Fragment system regression check — GDD §6.1/§6.7/§6.8, Phase 7. Same
   standalone-runnable pattern as fairness_check.js/content_check.js/
   encounter_check.js:
     node apps/standbattle/fragment_check.js

   Proves, over the real shipped 12-Fragment pool (not a synthetic
   fixture): every entry clears §6.7's "not purely additive" bar, the
   pity timer actually forces a Rare+ once triggered, slot-starvation
   weighting actually shifts the draw toward a long-empty slot, and
   convergence weighting actually shifts the draw toward tags already
   held. */

import { createDispatcher } from './hooks.js';
import { createContentRegistry, assertContentValid } from './content_registry.js';
import { FRAGMENT_LIST, DONORS } from './fragments.js';
import { createRng } from './rng.js';
import {
  generateOffer, createRunFragmentState, PITY_THRESHOLD, STARVATION_THRESHOLD
} from './fragment_offers.js';

export function runFragmentChecks() {
  const checks = [];
  const check = (label, cond, detail) => checks.push({ label, ok: cond, detail });

  /* ---- 1. the real pool clears GDD §6.7 and every other structural rule -- */
  const registry = createContentRegistry();
  DONORS.forEach(d => registry.registerDonor(d));
  FRAGMENT_LIST.forEach(f => registry.registerFragment(f));
  const dispatcher = createDispatcher();
  let poolErrors = [];
  try {
    assertContentValid(registry, dispatcher);
  } catch (e) {
    poolErrors = e.message.split('\n').slice(1);
  }
  check('exactly 12 Fragments authored', FRAGMENT_LIST.length === 12);
  check('exactly 3 donors', DONORS.length === 3);
  check('the shipped pool validates with zero errors', poolErrors.length === 0, poolErrors);

  /* ---- 2. pity timer: forced past threshold guarantees a Rare+ ---------- */
  {
    const rng = createRng('pity-check').stream('rewards');
    const runState = createRunFragmentState();
    runState.upgradePoints = 3;
    runState.nodesSinceRare = PITY_THRESHOLD;
    const offer = generateOffer(rng, runState);
    const RARE_PLUS = new Set(['rare', 'epic', 'legendary']);
    check('pity: an offer generated at the threshold contains a Rare+',
      offer.some(c => RARE_PLUS.has(c.frag.rarity)));
    check('pity: nodesSinceRare resets once a Rare+ is offered', runState.nodesSinceRare === 0);
  }

  /* ---- 3. slot starvation: a long-empty slot gets weighted up ----------- */
  {
    const rng = createRng('starvation-check').stream('rewards');
    const runState = createRunFragmentState();
    runState.upgradePoints = 3;
    runState.slotOfferCounts.light = STARVATION_THRESHOLD; // light has gone 6 offers unfilled
    let lightOffers = 0;
    const TRIALS = 400;
    for (let i = 0; i < TRIALS; i++) {
      runState.slotOfferCounts.light = STARVATION_THRESHOLD; // hold it starved across trials
      const offer = generateOffer(rng, runState);
      if (offer.some(c => c.frag.slot === 'light')) lightOffers++;
    }
    const baselineRunState = createRunFragmentState();
    baselineRunState.upgradePoints = 3;
    let baselineOffers = 0;
    for (let i = 0; i < TRIALS; i++) {
      baselineRunState.slotOfferCounts.light = 0;
      const offer = generateOffer(rng, baselineRunState);
      if (offer.some(c => c.frag.slot === 'light')) baselineOffers++;
    }
    check(`starvation: a 6+-offers-empty slot is offered more often (${lightOffers}/${TRIALS} vs baseline ${baselineOffers}/${TRIALS})`,
      lightOffers > baselineOffers);
  }

  /* ---- 4. convergence: owning Virus tags shifts the draw toward Virus --- */
  {
    const rng = createRng('convergence-check').stream('rewards');
    /* Owned at level 1 with budget left, not maxed -- stays a real
       candidate (as an upgrade) so the pool SIZE matches the neutral case
       exactly; only the weighting differs. Owning it maxed-out would
       instead remove it from the pool and confound "fewer Virus candidates
       available" with "Virus weighted down", which is a test-design bug,
       not a statement about the convergence rule itself. */
    const virusRunState = createRunFragmentState();
    virusRunState.upgradePoints = 3;
    virusRunState.fragmentsBySlot.light = { id: 'frag_purple_haze_light', level: 1 };
    const neutralRunState = createRunFragmentState();
    neutralRunState.upgradePoints = 3;

    const TRIALS = 400;
    let virusHits = 0, neutralHits = 0;
    const isVirus = c => (c.frag.tags || []).includes('virus');
    for (let i = 0; i < TRIALS; i++) {
      if (generateOffer(rng, virusRunState).some(isVirus)) virusHits++;
      if (generateOffer(rng, neutralRunState).some(isVirus)) neutralHits++;
    }
    check(`convergence: holding a Virus Fragment is offered more Virus-tagged choices (${virusHits}/${TRIALS} vs ${neutralHits}/${TRIALS})`,
      virusHits > neutralHits);
  }

  const failures = checks.filter(c => !c.ok).length;
  return { pass: failures === 0, failures, checks };
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const { pass, failures, checks } = runFragmentChecks();
  checks.forEach(c => {
    console.log((c.ok ? 'OK  ' : 'FAIL') + ' ' + c.label);
    if (!c.ok && Array.isArray(c.detail)) c.detail.forEach(e => console.log('     ' + e));
  });
  console.log(pass ? '\nAll Fragment system checks pass.' : `\n${failures} FAILURE(S).`);
  if (!pass) process.exit(1);
}
