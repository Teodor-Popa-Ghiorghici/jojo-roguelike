/* Run flow — Phase 8. Node-resolution/transition orchestration, pulled
   out of index.js so index.js can stay the thin mount/unmount + render-
   dispatch + click-dispatch shell the app contract expects (CLAUDE.md).
   Every function here takes the app's `state` object and a small `env`
   ({ctx, saveStore, meta, tsec, shakeEnabled, debugEnabled}) explicitly
   -- no hidden module state, same discipline map_gen.js's pure functions
   already follow.

   DAG node lifecycle: `runState.nodeId` is the last COMMITTED (cleared)
   node; `state.enteringNodeId` is whichever successor the player just
   clicked, not yet committed. Every node type's own "done" action calls
   `commitNode`, which moves `enteringNodeId` into `runState.nodeId` (and
   `visited`) and returns to the map -- or to `complete` if that node was
   the boss. This mirrors the old linear `advanceNode`'s job exactly, just
   over a graph instead of `nodeIndex++`. */

import { ENEMIES, ENCOUNTERS, BOSSES, MODIFIERS, EVENTS, STANDS } from './data.js';
import { createCombat } from './combat.js';
import { enterAct } from './act_flow.js';
import {
  generateOffer, applyOffer, ownedFragmentEntries, createRunFragmentState,
  skipOfferForPity, PITY_THRESHOLD
} from './fragment_offers.js';
import { generateTreasureOffer, applyTreasureChoice } from './item_offers.js';
import { createStatPipeline, resolveUpgradeSlotCount } from './stats.js';
import { pickUpgradeSlot } from './rest.js';
import {
  decideCombatRewardKind, rollCombatYen, rollEliteYenBonus, fragmentPrice,
  healCost, rerollCost, removalCost, canAfford, spend, earn
} from './economy.js';
import { raiseTension, resolveEncounterBudget, tensionRarityMult } from './tension.js';
import {
  createTelemetryCollector, recordOffer, recordTaken, recordEncounter,
  recordYen, recordTension, appendRunSummary
} from './telemetry.js';
import { wireCombatAudio, sfxActComplete } from './audio.js';
import { musicSetIntensity } from './music.js';

function defaultUpgradePoints(standId) {
  return resolveUpgradeSlotCount({ stand: STANDS[standId] || STANDS.star_platinum }, createStatPipeline());
}

export function createFreshRunState(seed, rng, standId) {
  const fragState = createRunFragmentState();
  fragState.upgradePoints = defaultUpgradePoints(standId);
  const rs = {
    seed, standId: standId || 'star_platinum', act: 1, graph: null, nodeId: null, visited: [],
    hp: 100, maxHp: 100, yen: 0, tension: 0,
    rerollsUsed: 0, removalsUsed: 0,
    telemetry: createTelemetryCollector(),
    ...fragState
  };
  enterAct(rs, rng);
  return rs;
}

export function persistRun(state, env) { env.saveStore.saveRun(state.runState); }

/* Fixed row 0/last-row content is baked into map_gen.js's `assignContent`
   (enemy: 'morioh_thug' / boss: 'killer_queen'); everything else reads
   its own `enemy`/`encounter`/`boss`/`modifier` fields the same way the
   Phase 0 prototype's hand-authored nodes did. */
function tensionScaledEncounter(def, tension) {
  if (!tension) return def;
  return { ...def, waves: def.waves.map(w => w.generate ? { ...w, generate: { ...w.generate, budget: resolveEncounterBudget(w.generate.budget, tension) } } : w) };
}

function startCombatForNode(state, env, node) {
  const rs = state.runState;
  // Phase 10: every owned Relic/Duo/Disc rides into the fight the same
  // way owned Fragments already did -- see combat.js's install block.
  const opts = { shakeEnabled: env.shakeEnabled, relics: rs.relics, duos: rs.duosOwned, discs: rs.discsBySlot, standId: rs.standId };
  let target;
  if (node.type === 'boss') { target = BOSSES[node.boss]; }
  else if (node.encounter) { target = tensionScaledEncounter(ENCOUNTERS[node.encounter], rs.tension); }
  else {
    target = ENEMIES[node.enemy];
    if (node.modifier) {
      const m = MODIFIERS[node.modifier];
      opts.speedMult = m.speedMult; opts.hpMult = m.hpMult; opts.tint = m.tint;
    }
  }
  const owned = ownedFragmentEntries(rs).filter(e => e.owned).map(e => ({ id: e.owned.id, level: e.owned.level }));
  const combat = createCombat(target, owned, opts, state.runRng);
  combat.player.hp = rs.hp;
  combat.player.maxHp = rs.maxHp;
  combat.debug = env.debugEnabled;
  wireCombatAudio(combat);
  musicSetIntensity(1);
  state.combat = combat;
  state.combatStartTsec = env.tsec;
  state.scene = 'combat';
}

function enterShop(state, env) {
  const rs = state.runState;
  const offer = generateOffer(state.runRng.stream('rewards'), rs, tensionRarityMult(rs.tension));
  const first = offer.slice(0, 1);
  recordOffer(rs.telemetry, first);
  state.shop = { offer: first, removeMode: false };
  state.scene = 'shop';
  persistRun(state, env);
}

/* Fires after clearing Combat/Elite/Boss, from a Treasure node, and from
   the Bizarre Encounter 'fragment' choice -- one offer/pick code path,
   same as Phase 7. `forceRarePity` is set for Elite/Boss so their
   reward always guarantees Rare+ (reuses the real pity mechanism rather
   than a parallel one -- see fragment_offers.js's PITY_THRESHOLD). */
export function enterReward(state, env, forceRarePity) {
  const rs = state.runState;
  if (forceRarePity) rs.nodesSinceRare = Math.max(rs.nodesSinceRare, PITY_THRESHOLD);
  const offer = generateOffer(state.runRng.stream('rewards'), rs, tensionRarityMult(rs.tension));
  recordOffer(rs.telemetry, offer);
  state.currentOffer = offer;
  state.scene = 'reward';
  persistRun(state, env);
}

/* Phase 10: resolves the Phase 8-flagged gap ("Rest/Treasure Relic
   options are Fragment offers -- no owned-Relic system exists yet").
   Treasure nodes now offer a real Relic or Disc (item_offers.js), reusing
   the exact same reward scene/currentOffer/applyRewardChoice path
   Fragment/Duo offers already use -- candidates just carry `kind: 'relic'
   | 'disc'` instead of `'fragment' | 'duo'`. */
function enterTreasureReward(state, env) {
  const rs = state.runState;
  const offer = generateTreasureOffer(state.runRng.stream('rewards'), rs);
  state.currentOffer = offer;
  state.scene = 'reward';
  persistRun(state, env);
}

export function resolveNodeEntry(state, targetId, env) {
  state.enteringNodeId = targetId;
  const node = state.runState.graph.nodes[targetId];
  if (node.type === 'event') { state.currentEvent = EVENTS[node.event]; state.scene = 'event'; }
  else if (node.type === 'rest') { state.scene = 'rest'; }
  else if (node.type === 'shop') { enterShop(state, env); }
  else if (node.type === 'treasure') { enterTreasureReward(state, env); }
  else if (node.type === 'archive') { state.scene = 'archive'; }
  else startCombatForNode(state, env, node);
}

/* Moves the just-resolved node from "entering" to committed, per the
   file header's lifecycle note. Boss clears end the run instead of
   returning to the map. Combat itself is never checkpointed mid-fight
   (state.combat isn't part of runState) -- max loss stays one
   encounter, unchanged from Phase 0. */
export function commitNode(state, env) {
  const rs = state.runState;
  rs.nodeId = state.enteringNodeId;
  if (!rs.visited.includes(rs.nodeId)) rs.visited.push(rs.nodeId);
  state.enteringNodeId = null;
  musicSetIntensity(0);
  recordTension(rs.telemetry, rs.tension);
  if (rs.graph.nodes[rs.nodeId].type === 'boss') {
    sfxActComplete();
    if (rs.act < 4) {
      // Act clear, not run clear: same node-graph machinery generates the
      // next Act's map (map_gen.js's generateActMap, keyed on rs.act) --
      // the run continues with its build/HP/economy intact, never resets.
      rs.act += 1;
      enterAct(rs, state.runRng);
      state.scene = 'map';
      persistRun(state, env);
    } else {
      state.scene = 'complete';
      env.meta.cleared = true;
      env.saveStore.saveMeta(env.meta);
      appendRunSummary(env.ctx, { seed: rs.seed, stand: rs.standId, actReached: rs.act, killer: null, collector: rs.telemetry });
      env.saveStore.clearRun();
    }
  } else {
    state.scene = 'map';
    persistRun(state, env);
  }
}

export function finishRunLoss(state, env) {
  const rs = state.runState;
  const node = rs.graph.nodes[state.enteringNodeId || rs.nodeId];
  const killer = node.boss || node.encounter || node.enemy || null;
  appendRunSummary(env.ctx, { seed: rs.seed, stand: rs.standId, actReached: rs.act, killer, collector: rs.telemetry });
  env.saveStore.clearRun();
  state.scene = 'title';
}

export function onCombatWin(state, env) {
  const rs = state.runState;
  rs.hp = state.combat.player.hp;
  const node = rs.graph.nodes[state.enteringNodeId];
  recordEncounter(rs.telemetry, (env.tsec - state.combatStartTsec) * 1000);
  const rewardRng = state.runRng.stream('rewards');
  if (node.type === 'boss') {
    enterReward(state, env, true);
  } else if (node.type === 'elite') {
    raiseTension(rs, 1);
    const bonus = rollEliteYenBonus(rewardRng);
    earn(rs, bonus); recordYen(rs.telemetry, bonus, 0);
    enterReward(state, env, true);
  } else if (decideCombatRewardKind(rewardRng, rs) === 'yen') {
    const amount = rollCombatYen(rewardRng);
    earn(rs, amount); recordYen(rs.telemetry, amount, 0);
    skipOfferForPity(rs);
    commitNode(state, env);
  } else {
    enterReward(state, env, false);
  }
}

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
    rs.hp = Math.min(rs.maxHp, rs.hp + rs.maxHp * 0.6);
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
  if (action.type === 'buy') {
    const offer = state.shop.offer[0];
    const cost = fragmentPrice(offer.frag.rarity);
    if (!canAfford(rs, cost)) return;
    spend(rs, cost); recordYen(rs.telemetry, 0, cost);
    applyOffer(rs, offer);
    recordTaken(rs.telemetry, offer.frag.id);
    state.shop.offer = [];
  } else if (action.type === 'heal') {
    const cost = healCost(rs.maxHp - rs.hp);
    if (!canAfford(rs, cost)) return;
    spend(rs, cost); recordYen(rs.telemetry, 0, cost);
    rs.hp = rs.maxHp;
  } else if (action.type === 'reroll') {
    const cost = rerollCost(rs);
    if (!canAfford(rs, cost)) return;
    spend(rs, cost); recordYen(rs.telemetry, 0, cost);
    rs.rerollsUsed += 1;
    const offer = generateOffer(state.runRng.stream('rewards'), rs, tensionRarityMult(rs.tension)).slice(0, 1);
    recordOffer(rs.telemetry, offer);
    state.shop.offer = offer;
  } else if (action.type === 'remove') {
    if (!canAfford(rs, removalCost(rs))) return;
    state.shop.removeMode = true;
  } else if (action.type === 'removeSlot') {
    const cost = removalCost(rs);
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
