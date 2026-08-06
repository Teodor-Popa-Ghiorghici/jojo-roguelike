/* The player-choice appliers, split out of run_flow.js for the repo's
   300-line cap once Phase 10's meta wiring pushed that file over. Same
   contract as before: every function takes the app's `state` and the small
   `env` explicitly, no hidden module state, and each ends by handing back
   to run_flow.js's commitNode -- these are the "done" actions the node
   lifecycle in run_flow.js's header describes, not a second flow.

   Menace's economy conditions (Rationing, Inflation) apply here, through
   the `priced`/`healMult` reads below: numbers only, over values economy.js
   already decided, never a second pricing rule (GDD §8.3). */

import { applyOffer, generateOffer } from './fragment_offers.js';
import { applyTreasureChoice } from './item_offers.js';
import { pickUpgradeSlot } from './rest.js';
import {
  fragmentPrice, healCost, rerollCost, removalCost, canAfford, spend
} from './economy.js';
import { raiseTension, tensionRarityMult } from './tension.js';
import { recordOffer, recordTaken, recordYen } from './telemetry.js';
import { commitNode, enterReward, persistRun, menaceProfileFor } from './run_flow.js';

/* Phase 10: `kind` picks apply function AND which field holds the taken
   id -- fragment/duo offers (combat reward, Treasure was this too before
   Phase 10) vs. relic/disc offers (Treasure now, item_offers.js). */
export function applyRewardChoice(state, idx, env) {
  const cand = state.currentOffer[idx];
  const rs = state.runState;
  let takenId;
  if (cand.kind === 'relic' || cand.kind === 'disc') {
    applyTreasureChoice(rs, cand);
    takenId = cand.kind === 'relic' ? cand.relic.id : cand.disc.id;
  } else {
    applyOffer(rs, cand);
    takenId = cand.kind === 'duo' ? cand.duo.id : cand.frag.id;
  }
  recordTaken(rs.telemetry, takenId);
  state.currentOffer = null;
  commitNode(state, env);
}

export function applyEventChoice(state, idx, env) {
  const choice = state.currentEvent.choices[idx];
  if (choice.kind === 'fragment') { enterReward(state, env, false); return; }
  const rs = state.runState;
  rs.hp = Math.min(rs.maxHp, rs.hp + choice.amount);
  commitNode(state, env);
}

export function applyRestChoice(state, choiceId, env) {
  const rs = state.runState;
  if (choiceId === 'heal') {
    rs.hp = Math.min(rs.maxHp, rs.hp + rs.maxHp * 0.6 * menaceProfileFor(rs).healMult); // Rationing, GDD §8.3
  } else if (choiceId === 'upgrade') {
    const slot = pickUpgradeSlot(rs);
    if (!slot) return;
    rs.fragmentsBySlot[slot].level += 1;
    rs.upgradePoints -= 1;
    recordTaken(rs.telemetry, rs.fragmentsBySlot[slot].id);
  } else if (choiceId === 'tension') {
    raiseTension(rs, 1);
    enterReward(state, env, false);
    return;
  }
  commitNode(state, env);
}

export function applyShopAction(state, action, env) {
  const rs = state.runState;
  /* Inflation (GDD §8.3): every price in this function is already routed
     through economy.js, so the condition is one multiplier over that
     function's result rather than a second pricing rule. */
  const priceMult = menaceProfileFor(rs).shopPriceMult;
  const priced = n => Math.round(n * priceMult);
  if (action.type === 'buy') {
    const offer = state.shop.offer[0];
    const cost = priced(fragmentPrice(offer.frag.rarity));
    if (!canAfford(rs, cost)) return;
    spend(rs, cost); recordYen(rs.telemetry, 0, cost);
    applyOffer(rs, offer);
    recordTaken(rs.telemetry, offer.frag.id);
    state.shop.offer = [];
  } else if (action.type === 'heal') {
    const cost = priced(healCost(rs.maxHp - rs.hp));
    if (!canAfford(rs, cost)) return;
    spend(rs, cost); recordYen(rs.telemetry, 0, cost);
    const menace = menaceProfileFor(rs);
    rs.hp = Math.min(rs.maxHp, rs.hp + (rs.maxHp - rs.hp) * menace.healMult);
  } else if (action.type === 'reroll') {
    const cost = priced(rerollCost(rs));
    if (!canAfford(rs, cost)) return;
    spend(rs, cost); recordYen(rs.telemetry, 0, cost);
    rs.rerollsUsed += 1;
    const offer = generateOffer(state.runRng.stream('rewards'), rs, tensionRarityMult(rs.tension)).slice(0, 1);
    recordOffer(rs.telemetry, offer);
    state.shop.offer = offer;
  } else if (action.type === 'remove') {
    if (!canAfford(rs, priced(removalCost(rs)))) return;
    state.shop.removeMode = true;
  } else if (action.type === 'removeSlot') {
    const cost = priced(removalCost(rs));
    spend(rs, cost); recordYen(rs.telemetry, 0, cost);
    rs.removalsUsed += 1;
    delete rs.fragmentsBySlot[action.slot];
    state.shop.removeMode = false;
  } else if (action.type === 'removeCancel') {
    state.shop.removeMode = false;
  } else if (action.type === 'leave') {
    state.shop = null;
    commitNode(state, env);
    return;
  }
  persistRun(state, env);
}
