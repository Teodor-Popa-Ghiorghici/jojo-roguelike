/* Yen economy — GDD §6.5, Phase 8 deliverable 3. Pure data + small
   functions over `runState.yen`/`runState.rerollsUsed`/
   `runState.removalsUsed`; no combat/sim state touched. */

import { PITY_THRESHOLD } from './fragment_offers.js';

const COMBAT_YEN_MIN = 60, COMBAT_YEN_MAX = 140;
const ELITE_YEN_MIN = 80, ELITE_YEN_MAX = 160;
const YEN_OFFER_CHANCE = 0.4; // GDD §5.3: Combat reward is "Fragment offer (3 choices) or Yen"
const REMOVAL_BASE = 75, REMOVAL_STEP = 25; // GDD §6.5: "75¥, escalating"
const REROLL_BASE = 50, REROLL_STEP = 15;   // GDD §6.5: "50¥, escalating"
const HEAL_YEN_PER_HP = 2;
const FRAGMENT_PRICE = { common: 150, rare: 250, epic: 350, legendary: 400 };

/* 'offer' or 'yen'. Forced to 'offer' once pity is already armed --
   otherwise a run that keeps rolling Yen could coast past the pity
   threshold and never actually see the Rare+ it guaranteed (see
   fragment_offers.js's `skipOfferForPity`). */
export function decideCombatRewardKind(rng, runState) {
  if (runState.nodesSinceRare >= PITY_THRESHOLD) return 'offer';
  return rng.chance(YEN_OFFER_CHANCE) ? 'yen' : 'offer';
}

export function rollCombatYen(rng) { return Math.round(rng.range(COMBAT_YEN_MIN, COMBAT_YEN_MAX)); }
export function rollEliteYenBonus(rng) { return Math.round(rng.range(ELITE_YEN_MIN, ELITE_YEN_MAX)); }

export function fragmentPrice(rarity) { return FRAGMENT_PRICE[rarity] || FRAGMENT_PRICE.common; }
export function healCost(missingHp) { return Math.max(0, Math.ceil(missingHp * HEAL_YEN_PER_HP)); }
export function removalCost(runState) { return REMOVAL_BASE + REMOVAL_STEP * (runState.removalsUsed || 0); }
export function rerollCost(runState) { return REROLL_BASE + REROLL_STEP * (runState.rerollsUsed || 0); }

export function canAfford(runState, cost) { return runState.yen >= cost; }
export function spend(runState, cost) { runState.yen = Math.max(0, runState.yen - cost); }
export function earn(runState, amount) { runState.yen += Math.max(0, amount); }
