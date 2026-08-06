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
  generateOffer, applyOffer, ownedFragmentEntries, createRunFragmentState, PITY_THRESHOLD
} from './fragment_offers.js';
import { generateTreasureOffer, applyTreasureChoice } from './item_offers.js';
import { createStatPipeline, resolveUpgradeSlotCount } from './stats.js';
import { pickUpgradeSlot } from './rest.js';
import { fragmentPrice, healCost, rerollCost, removalCost, canAfford, spend } from './economy.js';
import { resolveEncounterBudget, tensionRarityMult } from './tension.js';
import { createTelemetryCollector, recordOffer, recordTaken, recordTension } from './telemetry.js';
import { wireCombatAudio, sfxActComplete } from './audio.js';
import { musicSetIntensity } from './music.js';
/* Phase 10 meta. Note which side of the firewall each of these sits on:
   createMenaceProfile is Track B and returns nothing but numbers; the meta
   payout itself (settleRun) moved to run_flow_combat_end.js along with
   the win/loss outcome functions that trigger it. Neither the Archive's
   unlock sets nor Fate ever reach anything below. */
import { createMenaceProfile, menaceRankOf } from './meta_menace.js';
import { createMissionCounters, attachMissionTracker, noteNodeCleared } from './mission_tracker.js';
import { defaultAspectFor } from './aspects.js';

const STALKER_BASE_CHANCE = 0.04; // GDD §4.7's "small base chance from Act 2"
const STALKER_MENACE_BONUS = 0.01; // per Menace rank

function defaultUpgradePoints(standId) {
  return resolveUpgradeSlotCount({ stand: STANDS[standId] || STANDS.star_platinum }, createStatPipeline());
}

/* `loadout` (Phase 10) is the hub's Stand-rack choice: which Aspect this
   run runs, which Keepsake (if any) it starts with, and the Menace pact
   the player opted into for this Stand. All three are chosen before the
   run and never change during it, so they live on runState and ride into
   every fight the same way standId already does. */
export function createFreshRunState(seed, rng, standId, loadout) {
  const id = standId || 'star_platinum';
  const fragState = createRunFragmentState();
  fragState.upgradePoints = defaultUpgradePoints(id);
  const lo = loadout || {};
  const aspect = lo.aspectId || (defaultAspectFor(id) || {}).id || null;
  const rs = {
    seed, standId: id, act: 1, graph: null, nodeId: null, visited: [],
    hp: 100, maxHp: 100, yen: 0, tension: 0,
    rerollsUsed: 0, removalsUsed: 0,
    aspectId: aspect,
    /* Track A's only reach into a run: a list of donor ID STRINGS, which
       fragment_offers.js uses to decide what may be offered. Strings in,
       strings out -- there is no numeric channel from the Archive to here
       (spec §7), which is the entire point of the two-track split. */
    donors: lo.donors || null,
    menacePact: lo.menacePact || {},
    missionCounters: createMissionCounters(),
    bestChain: 0,
    upgradePointsMax: fragState.upgradePoints,
    telemetry: createTelemetryCollector(),
    ruleFightsCleared: [], // GDD §10.3 Heaven Ascension's "a hidden Rule Fight cleared" leg -- see endgame.js
    ...fragState
  };
  /* A Keepsake is an ordinary owned Relic from the engine's point of view
     -- it just arrives at run start instead of from a Treasure node. */
  if (lo.keepsakeId) rs.relics = [...(rs.relics || []), lo.keepsakeId];
  enterAct(rs, rng);
  return rs;
}

/* Track B's one output, resolved once per fight from the run's pact.
   BASE_PROFILE (an empty pact) is the identity, so a player who never
   opens the Menace board gets exactly the pre-Phase-10 numbers. */
export function menaceProfileFor(runState) {
  return createMenaceProfile(runState.menacePact);
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
  /* Phase 10: the Menace profile and the chosen Aspect ride in alongside
     the build. `menace` is Track B's frozen number struct; `aspectId` is
     Track A content. combat.js consumes them through two separate seams
     that never see each other. */
  const menace = menaceProfileFor(rs);
  const menaceRank = menaceRankOf(rs.menacePact);
  const opts = {
    shakeEnabled: env.shakeEnabled, relics: rs.relics, duos: rs.duosOwned, discs: rs.discsBySlot,
    standId: rs.standId, aspectId: rs.aspectId, menace, menaceRank
  };
  /* GDD §4.7 The Stalker: "Menace-gated, plus a small base chance from Act
     2." Rolled from the run's own seeded RNG (invariant 7), on a plain
     combat node only -- never overriding an Elite/boss/objective node, so
     it reads as an intrusion into an ordinary fight, not a replacement of
     one already promised to be special. */
  const stalkerChance = rs.act >= 2 && node.type === 'combat' ? STALKER_BASE_CHANCE + menaceRank * STALKER_MENACE_BONUS : 0;
  const isStalker = stalkerChance > 0 && state.runRng.stream('stalker').chance(stalkerChance);
  let target;
  if (isStalker) { target = ENCOUNTERS.the_stalker; }
  else if (node.type === 'boss') { target = BOSSES[node.boss]; }
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
  /* Missions observe the fight through hooks.js's read-only `on` form --
     no new sim instrumentation, and nothing here can write combat state
     (invariant 8). Counters live on runState so they span the whole run. */
  attachMissionTracker(combat, rs.missionCounters);
  combat.dispatcher.fire('onFloorStart', { act: rs.act, node });
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
  /* Track B's Scarcity condition (GDD §8.3) is one clamp on the offer
     length here -- an entirely numeric change, applied where the number is
     already decided, never a change to which Fragments exist. */
  const menace = menaceProfileFor(rs);
  const full = generateOffer(state.runRng.stream('rewards'), rs, tensionRarityMult(rs.tension));
  const offer = menace.offerCountDelta ? full.slice(0, Math.max(1, full.length + menace.offerCountDelta)) : full;
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
  noteNodeCleared(rs.missionCounters, rs.graph.nodes[rs.nodeId]);
  if (state.combat) state.combat.dispatcher.fire('onNodeClear', { node: rs.graph.nodes[rs.nodeId], act: rs.act });
  if (rs.graph.nodes[rs.nodeId].type === 'boss') {
    sfxActComplete();
    if (rs.act < 4) {
      // Act clear, not run clear: same node-graph machinery generates the
      // next Act's map (map_gen.js's generateActMap, keyed on rs.act) --
      // the run continues with its build/HP/economy intact, never resets.
      rs.act += 1;
      enterAct(rs, state.runRng);
      // Pristine Condition (GDD §8.3): each new act starts capped, never healed up to it.
      const startPct = menaceProfileFor(rs).actStartHpPct;
      if (startPct < 1) rs.hp = Math.min(rs.hp, Math.round(rs.maxHp * startPct));
      state.scene = 'map';
      persistRun(state, env);
    } else {
      env.meta.cleared = true;
      finishRun(state, env, 'win', null);
    }
  } else {
    state.scene = 'map';
    persistRun(state, env);
  }
}

/* Phase 11-B: what happens once a fight settles ('win'/'lose'/'fled') --
   split into run_flow_combat_end.js (300-line cap), re-exported here so
   index.js's existing import site needs no change. */
export { onCombatFled, finishRunLoss, onCombatWin } from './run_flow_combat_end.js';
