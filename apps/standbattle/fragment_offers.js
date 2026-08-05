/* Fragment offer generation — GDD §6.8 (Phase 7 deliverable 4): pity
   timer, slot-starvation weighting, convergence weighting. Pure data in,
   data out -- runs at map/reward-scene layer (index.js), the same
   "content is data" discipline the sim itself follows, just outside the
   combat loop since offers happen between fights, not during one.

   `runState.fragmentsBySlot` is the run's owned build: a plain object,
   slot id -> `{id, level}` or absent. `runState.nodesSinceRare` (pity),
   `runState.slotOfferCounts` (starvation, per slot) and
   `runState.upgradePoints` (Developmental Potential, stats.js's
   resolveUpgradeSlotCount -- how many level-UPs, beyond each Fragment's
   free first copy, the whole build can spend this run) all live on
   runState so they persist and save/load with the run (index.js/save.js). */

import { FRAGMENT_LIST } from './fragments.js';
import { SLOTS } from './content_registry.js';

const OFFER_SIZE = 3;
export const PITY_THRESHOLD = 4; // GDD §6.8: "at 4, the next offer guarantees Rare+"
export const STARVATION_THRESHOLD = 6; // GDD §6.8: "empty for 6+ offers, weight it up"
const STARVATION_MULT = 3;
const CONVERGENCE_BONUS = 0.25; // GDD §6.8: "25% of offer weight biased toward tags you already hold"
const RARITY_BASE_WEIGHT = { common: 10, rare: 5, epic: 2, legendary: 1 };
const RARE_PLUS = new Set(['rare', 'epic', 'legendary']);

export function createRunFragmentState() {
  return { fragmentsBySlot: {}, nodesSinceRare: 0, slotOfferCounts: {}, upgradePoints: 0 };
}

function ownedTagSet(runState) {
  const tags = new Set();
  Object.values(runState.fragmentsBySlot).forEach(owned => {
    if (!owned) return;
    const def = FRAGMENT_LIST.find(f => f.id === owned.id);
    (def.tags || []).forEach(t => tags.add(t));
  });
  return tags;
}

/* One candidate pairs a Fragment with the level it would be taken at:
   level 1 for a slot you don't own this exact Fragment in (whether the
   slot is empty or holds a DIFFERENT donor's Fragment -- taking it
   overwrites), or current+1 if you already own it and have Developmental
   Potential left to spend. Maxed-and-owned or out-of-budget candidates
   are dropped so the offer pool never wastes a slot on a dead pick. */
function buildCandidates(runState) {
  return FRAGMENT_LIST.map(frag => {
    const owned = runState.fragmentsBySlot[frag.slot];
    if (owned && owned.id === frag.id) {
      if (owned.level >= 3 || runState.upgradePoints <= 0) return null;
      return { frag, level: owned.level + 1, isUpgrade: true };
    }
    return { frag, level: 1, isUpgrade: false };
  }).filter(Boolean);
}

function weightOf(candidate, runState, ownedTags, rarityMult) {
  let w = RARITY_BASE_WEIGHT[candidate.frag.rarity] || 1;
  if (RARE_PLUS.has(candidate.frag.rarity)) w *= rarityMult;
  const shared = (candidate.frag.tags || []).filter(t => ownedTags.has(t)).length;
  w *= 1 + CONVERGENCE_BONUS * Math.min(shared, 3); // convergence: capped so one Fragment can't dominate the whole pool
  const emptySlot = !runState.fragmentsBySlot[candidate.frag.slot];
  if (emptySlot && (runState.slotOfferCounts[candidate.frag.slot] || 0) >= STARVATION_THRESHOLD) w *= STARVATION_MULT;
  return w;
}

function weightedPickIndex(weights, idxs, rng) {
  const total = idxs.reduce((sum, i) => sum + weights[i], 0);
  if (total <= 0) return null;
  let roll = rng.random() * total;
  for (const i of idxs) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return idxs[idxs.length - 1];
}

/* Generates one 3-choice offer. Mutates runState's pity/starvation
   counters as a side effect of GENERATING (not taking) the offer -- GDD
   §6.8's own wording ("the next offer guarantees...", "empty for N
   offers") tracks offers, not picks. Returns an array of up to 3
   candidates; fewer only in the late-run edge case where the whole pool
   is already owned-and-maxed.

   `rarityMult` (Phase 8, default 1 -- fully backward compatible)
   multiplies Rare+ base weight; the caller (run_flow.js) passes
   tension.js's `tensionRarityMult(runState.tension)` so Tension raises
   reward rarity by the same amount it raises encounter budget, without
   this file needing to know Tension exists. */
export function generateOffer(rng, runState, rarityMult = 1) {
  const candidates = buildCandidates(runState);
  const ownedTags = ownedTagSet(runState);
  const weights = candidates.map(c => weightOf(c, runState, ownedTags, rarityMult));
  const allIdxs = candidates.map((_, i) => i);

  const chosen = [];
  if (runState.nodesSinceRare >= PITY_THRESHOLD) {
    const rareIdxs = allIdxs.filter(i => RARE_PLUS.has(candidates[i].frag.rarity));
    const pick = weightedPickIndex(weights, rareIdxs, rng);
    if (pick != null) chosen.push(pick);
  }
  while (chosen.length < OFFER_SIZE && chosen.length < candidates.length) {
    const remaining = allIdxs.filter(i => !chosen.includes(i));
    const pick = weightedPickIndex(weights, remaining, rng);
    if (pick == null) break;
    chosen.push(pick);
  }
  const offer = chosen.map(i => candidates[i]);

  const gotRare = offer.some(c => RARE_PLUS.has(c.frag.rarity));
  runState.nodesSinceRare = gotRare ? 0 : runState.nodesSinceRare + 1;

  SLOTS.forEach(slot => {
    if (runState.fragmentsBySlot[slot]) return;
    const offered = offer.some(c => c.frag.slot === slot);
    runState.slotOfferCounts[slot] = offered ? 0 : (runState.slotOfferCounts[slot] || 0) + 1;
  });

  return offer;
}

/* Applies a picked candidate: fills an empty slot, OVERWRITES a
   different Fragment already in that slot (a real, clearly-surfaced cost
   -- deliverable 2 -- the caller shows `overwrote`/`previous` before
   commit), or levels up the same one. A fresh/overwritten slot is always
   free; only an upgrade spends a Developmental Potential point. */
export function applyOffer(runState, candidate) {
  const prevOwned = runState.fragmentsBySlot[candidate.frag.slot];
  const overwrote = !!(prevOwned && prevOwned.id !== candidate.frag.id);
  if (candidate.isUpgrade) runState.upgradePoints = Math.max(0, runState.upgradePoints - 1);
  runState.fragmentsBySlot[candidate.frag.slot] = { id: candidate.frag.id, level: candidate.level };
  runState.slotOfferCounts[candidate.frag.slot] = 0;
  return { overwrote, previous: prevOwned };
}

/* Phase 8: a Combat node's reward is "Fragment offer or Yen" (GDD §5.3)
   -- when economy.js's roll picks Yen, no offer is generated at all, so
   `nodesSinceRare` (this file's own field) has to advance here instead
   of inside generateOffer, or a run that keeps rolling Yen could coast
   past the pity threshold without it ever firing. Mirrors exactly what
   generateOffer does on a non-Rare+ offer -- the common case -- so the
   two code paths stay in the same units (reward-granting nodes since a
   Rare+ was last seen). economy.js forces the offer branch once this
   would already be at threshold, so pity still always pays off within
   4 reward nodes; see economy.js's `decideCombatRewardKind`. */
export function skipOfferForPity(runState) {
  runState.nodesSinceRare += 1;
}

export function ownedFragmentEntries(runState) {
  return SLOTS.map(slot => ({ slot, owned: runState.fragmentsBySlot[slot] || null }));
}
