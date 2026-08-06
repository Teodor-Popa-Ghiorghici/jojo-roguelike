/* Fate — the Track A currency (GDD §19). Deliberately NOT part of
   economy.js: that file owns Yen, which is run-scoped and spent inside a
   run on things that change the fight. Fate lives only on the meta blob
   and is never copied onto runState, so no combat code is able to read
   it, let alone derive a number from it. Two currencies, two lifetimes,
   no shared module.

   GDD §19's earning table, verbatim:
     loss in Act I 15 / Act II 30 / Act III 50 / Act IV 70, a win 120,
     all multiplied by (1 + 0.06 x Menace Rank). Missions pay 40-150.
   Average run works out at ~60 Fate against a 4,295-Fate tree, which is
   the pacing §19 asks for. */

import { ARCHIVE_NODES, ARCHIVE_TOTAL_FATE } from './meta_archive_tree.js';
import { archiveNodeById, isAvailable, markPurchased } from './meta_archive.js';

const LOSS_BY_ACT = Object.freeze([0, 15, 30, 50, 70]); // index = act, 1-based
const WIN_FATE = 120;
const MENACE_PER_RANK = 0.06;

export { ARCHIVE_TOTAL_FATE };

/* The one place a run's Fate payout is computed. `outcome` is 'win' |
   'loss'; `act` is runState.act (1..4); `menaceRank` is Track B's rank,
   which is the single number that crosses between the tracks and it
   crosses in the harmless direction -- difficulty raising a payout, never
   a payout unlocking anything. */
export function fateForRunEnd({ outcome, act, menaceRank }) {
  const base = outcome === 'win' ? WIN_FATE : (LOSS_BY_ACT[Math.max(1, Math.min(4, act || 1))] || LOSS_BY_ACT[1]);
  const mult = 1 + MENACE_PER_RANK * Math.max(0, menaceRank || 0);
  return Math.round(base * mult);
}

/* GDD §8.3/§9.2: a new personal-best Menace Rank pays Fate and a title.
   It does NOT hand out content -- see the phase report for the flagged
   §8.3-vs-spec-§7 conflict and why spec §7 wins. */
export function fateForMenaceClear(previousBest, newBest) {
  if (newBest <= previousBest) return 0;
  return (newBest - previousBest) * 25;
}

export function defaultFateState() { return { fate: 0, lifetimeFate: 0 }; }

export function grantFate(fateState, amount) {
  const n = Math.max(0, Math.round(amount || 0));
  fateState.fate += n;
  fateState.lifetimeFate = (fateState.lifetimeFate || 0) + n;
  return n;
}

export function canAffordNode(fateState, archiveState, nodeId) {
  const node = archiveNodeById(nodeId);
  if (!node) return false;
  return isAvailable(archiveState, nodeId) && fateState.fate >= node.cost;
}

/* The purchase path. Spends Fate and records the node id -- and note that
   it never touches the unlock sets directly: those are re-derived from
   `archiveState.purchased` by meta_archive.js's applyArchiveUnlocks, so
   the purchased list is the single source of truth and a save can always
   be re-resolved from it. */
export function purchaseNode(fateState, archiveState, nodeId) {
  if (!canAffordNode(fateState, archiveState, nodeId)) return false;
  fateState.fate -= archiveNodeById(nodeId).cost;
  markPurchased(archiveState, nodeId);
  return true;
}

/* Progress readout for the Archive terminal. */
export function archiveProgress(archiveState) {
  const bought = (archiveState && archiveState.purchased) || [];
  return { purchased: bought.length, total: ARCHIVE_NODES.length, spent: bought.reduce((n, id) => {
    const node = archiveNodeById(id); return n + (node ? node.cost : 0);
  }, 0), totalCost: ARCHIVE_TOTAL_FATE };
}
