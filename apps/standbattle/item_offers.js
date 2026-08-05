/* Relic/Disc offer generation — Treasure nodes (GDD §5.3/§6.3/§6.4).
   Phase 8 flagged "no owned-Relic system exists yet -- Treasure options
   are Fragment offers" as a known gap; Phase 10 resolves it for real.
   Deliberately simpler than fragment_offers.js: Relics/Discs have no
   slot/level, so there's no pity/starvation/convergence to track --
   just "not already owned", weighted by rarity (Relics) or uniformly
   (Discs, which GDD gives no rarity tier). */

import { RELIC_LIST } from './relics.js';
import { DISCS } from './content/discs.js';
import { weightedPickIndex } from './fragment_offers.js';

const OFFER_SIZE = 3;
const RARITY_BASE_WEIGHT = { common: 10, rare: 5, epic: 2, legendary: 1 };

function drawN(candidates, weights, rng, n) {
  const idxs = candidates.map((_, i) => i);
  const chosen = [];
  while (chosen.length < n && chosen.length < candidates.length) {
    const remaining = idxs.filter(i => !chosen.includes(i));
    const pick = weightedPickIndex(weights, remaining, rng);
    if (pick == null) break;
    chosen.push(pick);
  }
  return chosen.map(i => candidates[i]);
}

export function generateRelicOffer(rng, runState) {
  const owned = new Set(runState.relics || []);
  const candidates = RELIC_LIST.filter(r => !owned.has(r.id)).map(relic => ({ kind: 'relic', relic }));
  const weights = candidates.map(c => RARITY_BASE_WEIGHT[c.relic.rarity] || 1);
  return drawN(candidates, weights, rng, OFFER_SIZE);
}

export function applyRelicOffer(runState, candidate) {
  runState.relics.push(candidate.relic.id);
}

export function generateDiscOffer(rng, runState) {
  const owned = new Set(Object.values(runState.discsBySlot || {}));
  const candidates = DISCS.filter(d => !owned.has(d.id)).map(disc => ({ kind: 'disc', disc }));
  const weights = candidates.map(() => 1); // no rarity tier (GDD §6.4)
  return drawN(candidates, weights, rng, OFFER_SIZE);
}

export function applyDiscOffer(runState, candidate) {
  runState.discsBySlot[candidate.disc.slot] = candidate.disc.id;
}

/* Treasure nodes roll ONE of the two pools per visit (GDD §6.4's own
   sourcing note -- Discs are rarer than Relics, "one per rostered Stand"
   vs. "~55 curated"), falling back to whichever pool actually has
   unowned entries left so an empty/exhausted pool never dead-ends the
   node. */
export function generateTreasureOffer(rng, runState) {
  const wantDisc = DISCS.length > 0 && rng.chance(0.25);
  const relicOffer = () => generateRelicOffer(rng, runState);
  const discOffer = () => generateDiscOffer(rng, runState);
  if (wantDisc) {
    const offer = discOffer();
    return offer.length ? offer : relicOffer();
  }
  const offer = relicOffer();
  return offer.length ? offer : discOffer();
}

export function applyTreasureChoice(runState, candidate) {
  if (candidate.kind === 'disc') applyDiscOffer(runState, candidate);
  else applyRelicOffer(runState, candidate);
}
