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
import { DUO_LIST } from './duo_fragments.js';
import { SLOTS } from './content_registry.js';

const OFFER_SIZE = 3;
export const PITY_THRESHOLD = 4; // GDD §6.8: "at 4, the next offer guarantees Rare+"
export const STARVATION_THRESHOLD = 6; // GDD §6.8: "empty for 6+ offers, weight it up"
const STARVATION_MULT = 3;
const CONVERGENCE_BONUS = 0.25; // GDD §6.8: "25% of offer weight biased toward tags you already hold"
const RARITY_BASE_WEIGHT = { common: 10, rare: 5, epic: 2, legendary: 1 };
const RARE_PLUS = new Set(['rare', 'epic', 'legendary']);

export function createRunFragmentState() {
  return {
    fragmentsBySlot: {}, nodesSinceRare: 0, slotOfferCounts: {}, upgradePoints: 0,
    duosOwned: [], relics: [], discsBySlot: {} // Phase 10
  };
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

function ownedDonorSet(runState) {
  const donors = new Set();
  Object.values(runState.fragmentsBySlot).forEach(owned => {
    if (!owned) return;
    const def = FRAGMENT_LIST.find(f => f.id === owned.id);
    if (def) donors.add(def.donor);
  });
  return donors;
}

/* Duo Fragment candidates (GDD §6.1: "offered only when you hold
   Fragments from two specific donors" -- tech §3's own schema checks
   donor ownership only, not slot). Mixed into the SAME 3-choice offer
   pool as regular Fragments rather than a separate scene, matching "the
   chase": a Duo you've earned competes for the same 3 slots any other
   pick would. No level (`level: 1` is a placeholder rewards.js/shop.js
   ignore for `kind: 'duo'` candidates -- see their own rendering). */
function buildDuoCandidates(runState) {
  const owned = ownedDonorSet(runState);
  const taken = new Set(runState.duosOwned || []);
  return DUO_LIST.filter(duo => !taken.has(duo.id) && duo.requires.every(r => owned.has(r.donor)))
    .map(duo => ({ kind: 'duo', duo, level: 1, isUpgrade: false }));
}

function rarityOf(candidate) { return candidate.kind === 'duo' ? candidate.duo.rarity : candidate.frag.rarity; }
function tagsOf(candidate) { return (candidate.kind === 'duo' ? candidate.duo.tags : candidate.frag.tags) || []; }

/* Phase 10 (GDD §6.1's own Hermit Purple — Aura example: "All reward
   offers show one extra choice"): a Fragment may carry an optional
   `economyMods` field (tech §3 extension, sibling to `effects`/`queries`
   but outside the combat hook system entirely -- offer generation and
   Shop pricing happen at the map layer, which has no dispatcher). Values
   may be per-level arrays, resolved the same "Array picks (level-1)th
   entry" rule installFragment's resolveLevelData uses, just duplicated
   here in miniature since offers/economy live outside content_registry.js's
   combat-only install path. */
function resolveMod(v, level) { return Array.isArray(v) ? v[Math.min(v.length, level) - 1] : v; }
export function resolveOwnedEconomyMods(runState) {
  const mods = { extraOfferChoice: false, rerollDiscountPct: 0 };
  Object.values(runState.fragmentsBySlot).forEach(owned => {
    if (!owned) return;
    const def = FRAGMENT_LIST.find(f => f.id === owned.id);
    const em = def && def.economyMods;
    if (!em) return;
    if (em.extraOfferChoice) mods.extraOfferChoice = mods.extraOfferChoice || !!resolveMod(em.extraOfferChoice, owned.level);
    if (em.rerollDiscountPct) mods.rerollDiscountPct = Math.max(mods.rerollDiscountPct, resolveMod(em.rerollDiscountPct, owned.level) || 0);
  });
  return mods;
}

/* One candidate pairs a Fragment with the level it would be taken at:
   level 1 for a slot you don't own this exact Fragment in (whether the
   slot is empty or holds a DIFFERENT donor's Fragment -- taking it
   overwrites), or current+1 if you already own it and have Developmental
   Potential left to spend. Maxed-and-owned or out-of-budget candidates
   are dropped so the offer pool never wastes a slot on a dead pick. */
function buildCandidates(runState) {
  const frags = FRAGMENT_LIST.map(frag => {
    const owned = runState.fragmentsBySlot[frag.slot];
    if (owned && owned.id === frag.id) {
      if (owned.level >= 3 || runState.upgradePoints <= 0) return null;
      return { kind: 'fragment', frag, level: owned.level + 1, isUpgrade: true };
    }
    return { kind: 'fragment', frag, level: 1, isUpgrade: false };
  }).filter(Boolean);
  return [...frags, ...buildDuoCandidates(runState)];
}

function weightOf(candidate, runState, ownedTags, rarityMult) {
  let w = RARITY_BASE_WEIGHT[rarityOf(candidate)] || 1;
  if (RARE_PLUS.has(rarityOf(candidate))) w *= rarityMult;
  const shared = tagsOf(candidate).filter(t => ownedTags.has(t)).length;
  w *= 1 + CONVERGENCE_BONUS * Math.min(shared, 3); // convergence: capped so one Fragment can't dominate the whole pool
  if (candidate.kind === 'fragment') {
    const emptySlot = !runState.fragmentsBySlot[candidate.frag.slot];
    if (emptySlot && (runState.slotOfferCounts[candidate.frag.slot] || 0) >= STARVATION_THRESHOLD) w *= STARVATION_MULT;
  }
  return w;
}

export function weightedPickIndex(weights, idxs, rng) {
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
  // Phase 10 (Hermit Purple — Aura, GDD §6.1): "+1 extra choice" reads as
  // a bigger offer, not a 4th-choice special case -- OFFER_SIZE stays the
  // one authoritative constant, just bumped by an owned economyMods flag.
  const offerSize = OFFER_SIZE + (resolveOwnedEconomyMods(runState).extraOfferChoice ? 1 : 0);

  const chosen = [];
  if (runState.nodesSinceRare >= PITY_THRESHOLD) {
    const rareIdxs = allIdxs.filter(i => RARE_PLUS.has(rarityOf(candidates[i])));
    const pick = weightedPickIndex(weights, rareIdxs, rng);
    if (pick != null) chosen.push(pick);
  }
  while (chosen.length < offerSize && chosen.length < candidates.length) {
    const remaining = allIdxs.filter(i => !chosen.includes(i));
    const pick = weightedPickIndex(weights, remaining, rng);
    if (pick == null) break;
    chosen.push(pick);
  }
  const offer = chosen.map(i => candidates[i]);

  const gotRare = offer.some(c => RARE_PLUS.has(rarityOf(c)));
  runState.nodesSinceRare = gotRare ? 0 : runState.nodesSinceRare + 1;

  SLOTS.forEach(slot => {
    if (runState.fragmentsBySlot[slot]) return;
    const offered = offer.some(c => c.kind === 'fragment' && c.frag.slot === slot);
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
  if (candidate.kind === 'duo') { // Phase 10: no slot, no level, just owned
    runState.duosOwned.push(candidate.duo.id);
    return { overwrote: false, previous: null };
  }
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
