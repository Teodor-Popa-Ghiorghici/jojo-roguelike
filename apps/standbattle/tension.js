/* Tension 0-5 — GDD §5.4, Phase 8 deliverable 5. Player-driven in-run
   difficulty: raised by Elites and by opting in at Rests, raising
   encounter budget and reward rarity weight by the same amount. */

export const TENSION_MAX = 5;
const BUDGET_PER_TENSION = 1;
const RARITY_MULT_PER_TENSION = 0.15;

export function raiseTension(runState, amount = 1) {
  runState.tension = Math.min(TENSION_MAX, (runState.tension || 0) + amount);
}

/* Called where a Combat/Elite node's base `generate.budget` literal
   (data.js) is handed to encounter_budget.js's generator -- the sole
   choke point where Tension makes a fight bigger. */
export function resolveEncounterBudget(baseBudget, tension) {
  return baseBudget + Math.round((tension || 0) * BUDGET_PER_TENSION);
}

/* Passed into fragment_offers.js's generateOffer as `rarityMult`. */
export function tensionRarityMult(tension) {
  return 1 + RARITY_MULT_PER_TENSION * (tension || 0);
}
