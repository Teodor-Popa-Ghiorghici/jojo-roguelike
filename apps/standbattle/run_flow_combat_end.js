/* Combat-resolution outcomes -- split out of run_flow.js (Phase 11-B,
   300-line cap crossed once the Stalker/bestLoot/Rolling-Stones/Bounty
   branches all landed in onCombatWin). What happens once a fight settles
   ('win'/'lose'/'fled'), nothing about starting one -- that stays in
   run_flow.js, which this file imports back from. */

import {
  decideCombatRewardKind, rollCombatYen, rollEliteYenBonus, earn
} from './economy.js';
import { raiseTension } from './tension.js';
import { recordEncounter, recordYen, appendRunSummary } from './telemetry.js';
import { skipOfferForPity } from './fragment_offers.js';
import { settleRun } from './run_end.js';
import { commitNode, enterReward } from './run_flow.js';

/* GDD §9.5: a win and a loss now leave the run by the SAME door. Both pay
   Fate, Archive entries, Bond progress and Mission progress, and both land
   on the TO BE CONTINUED screen -- "death is never zero" is a property of
   there being only one exit, not of two exits that happen to agree. */
export function finishRun(state, env, outcome, killer) {
  const rs = state.runState;
  if (state.combat) state.combat.dispatcher.fire('onRunEnd', { outcome, act: rs.act });
  state.summary = settleRun(env.meta, rs, { outcome, killer });
  env.saveStore.saveMeta(env.meta);
  appendRunSummary(env.ctx, { seed: rs.seed, stand: rs.standId, actReached: rs.act, killer, collector: rs.telemetry });
  env.saveStore.clearRun();
  state.scene = 'continued';
}

/* GDD §4.7/§15: fleeing (combat.outcome === 'fled', combat.js's setKey)
   is neither a win nor a loss -- the run continues, the node is simply
   forfeited unrewarded. Reuses commitNode exactly like the plain-Yen
   reward branch below does, just with nothing earned first. */
export function onCombatFled(state, env) {
  state.runState.hp = state.combat.player.hp;
  commitNode(state, env);
}

export function finishRunLoss(state, env) {
  const rs = state.runState;
  const node = rs.graph.nodes[state.enteringNodeId || rs.nodeId];
  finishRun(state, env, 'loss', node.boss || node.encounter || node.enemy || null);
}

export function onCombatWin(state, env) {
  const rs = state.runState;
  rs.hp = state.combat.player.hp;
  const node = rs.graph.nodes[state.enteringNodeId];
  recordEncounter(rs.telemetry, (env.tsec - state.combatStartTsec) * 1000);
  const objectiveId = state.combat.encounter.def.objective;
  if (objectiveId && objectiveId.startsWith('rf_') && !rs.ruleFightsCleared.includes(objectiveId)) rs.ruleFightsCleared.push(objectiveId);
  const rewardRng = state.runRng.stream('rewards');
  if (state.combat.rollingStonesGreedy) {
    // Rolling Stones Rule Fight (GDD §4.5): "standing there... doubles rewards" -- an extra bonus roll on top, whatever the node's own reward resolves to below.
    const greedBonus = rollEliteYenBonus(rewardRng);
    earn(rs, greedBonus); recordYen(rs.telemetry, greedBonus, 0);
  }
  if (state.combat.encounter.def.bestLoot) {
    // GDD §4.7 The Stalker: "drops the best non-boss loot" -- the same guaranteed-Rare+/bonus-Yen path an Elite gets.
    const bonus = rollEliteYenBonus(rewardRng);
    earn(rs, bonus); recordYen(rs.telemetry, bonus, 0);
    enterReward(state, env, true);
  } else if (node.type === 'boss') {
    enterReward(state, env, true);
  } else if (node.type === 'elite') {
    raiseTension(rs, 1);
    const bonus = rollEliteYenBonus(rewardRng);
    earn(rs, bonus); recordYen(rs.telemetry, bonus, 0);
    enterReward(state, env, true);
  } else if (state.combat.bountyEarly) {
    // GDD §15 Bounty: "killing it ends the fight early for bonus Yen" -- the same elite bonus roll, a different trigger.
    const bonus = rollEliteYenBonus(rewardRng);
    earn(rs, bonus); recordYen(rs.telemetry, bonus, 0);
    skipOfferForPity(rs);
    commitNode(state, env);
  } else if (decideCombatRewardKind(rewardRng, rs) === 'yen') {
    const amount = rollCombatYen(rewardRng);
    earn(rs, amount); recordYen(rs.telemetry, amount, 0);
    skipOfferForPity(rs);
    commitNode(state, env);
  } else {
    enterReward(state, env, false);
  }
}
