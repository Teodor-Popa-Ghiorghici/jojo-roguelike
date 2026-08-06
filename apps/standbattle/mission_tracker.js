/* Mission tracking — reads combat, never writes it (invariant 8).

   Missions are tracked "through existing hooks": this file subscribes to
   hooks.js's already-declared EVENT/EFFECT hooks with `bus.on()`, which is
   the read-only observer form of a subscription -- an `on` listener's
   return value is discarded and it is never given the mutable effect ctx
   the way a registered effect is. No new instrumentation was added to the
   sim to make Missions work, and nothing here can change a fight.

   The dispatcher is per-fight (created in combat.js), so counters live on
   `runState.missionCounters` and the listeners are re-attached to each new
   fight's bus. That also means a mission counts across a whole run, which
   is the granularity GDD §10.2's directives are written at. */

import { COMBAT_COUNTERS } from './mission_counters.js';
import { ownedFragmentEntries } from './fragment_offers.js';
import { FRAGMENTS } from './fragments.js';

export function createMissionCounters() {
  const c = {};
  for (const name of Object.keys(COMBAT_COUNTERS)) c[name] = 0;
  c.flawlessNodes = 0;
  c.bossKills = 0;
  c.eliteKills = 0;
  c.shopsVisited = 0;
  c.restsUsed = 0;
  c._damageAtNodeStart = 0;
  return c;
}

/* Attaches one listener per counter to this fight's dispatcher. Returns a
   detach function; combat objects are thrown away per node, so calling it
   is optional, but the Training Room reuses one bus across spawns. */
export function attachMissionTracker(combat, counters) {
  if (!combat || !combat.dispatcher || !counters) return () => {};
  const bound = [];
  for (const [name, spec] of Object.entries(COMBAT_COUNTERS)) {
    const fn = ctx => {
      if (spec.when && !(ctx && ctx[spec.when])) return;
      const add = spec.field ? Math.max(0, Math.round((ctx && ctx[spec.field]) || 0)) : 1;
      counters[name] += add;
    };
    combat.dispatcher.on(spec.hook, fn);
    bound.push([spec.hook, fn]);
  }
  return () => bound.forEach(([hook, fn]) => combat.dispatcher.off(hook, fn));
}

/* Called from run_flow.js when a node is cleared. `flawless` is derived
   from the damage counter rather than a new flag, so the sim needed no
   change to report it. */
export function noteNodeCleared(counters, node) {
  if (!counters) return;
  if (counters.damageTaken <= counters._damageAtNodeStart) counters.flawlessNodes += 1;
  counters._damageAtNodeStart = counters.damageTaken;
  if (!node) return;
  if (node.type === 'boss') counters.bossKills += 1;
  else if (node.type === 'elite') counters.eliteKills += 1;
}

/* Run-level facts, read off runState once at run end. Everything here is a
   plain read -- no counter in this function is maintained during play. */
export function runLevelCounters(runState, outcome, menaceRank) {
  const owned = ownedFragmentEntries(runState).filter(e => e.owned);
  const donorCounts = {};
  for (const entry of owned) {
    const def = FRAGMENTS[entry.owned.id];
    if (!def) continue;
    donorCounts[def.donor] = (donorCounts[def.donor] || 0) + 1;
  }
  const donorTallies = Object.values(donorCounts);
  const tel = runState.telemetry || {};
  return {
    actReached: runState.act || 1,
    actsCleared: outcome === 'win' ? 4 : Math.max(0, (runState.act || 1) - 1),
    hpAtEnd: Math.max(0, Math.round(runState.hp || 0)),
    hpPctAtEnd: runState.maxHp ? Math.max(0, runState.hp / runState.maxHp) : 0,
    yenEarned: tel.yenEarned || 0,
    yenSpent: tel.yenSpent || 0,
    tensionMax: tel.tensionMax || 0,
    menaceRank: menaceRank || 0,
    fragmentsTaken: (tel.fragmentsTaken || []).length,
    slotsFilled: owned.length,
    relicCount: (runState.relics || []).length,
    duoCount: (runState.duosOwned || []).length,
    discCount: Object.keys(runState.discsBySlot || {}).length,
    distinctDonors: donorTallies.length,
    maxDonorSlots: donorTallies.length ? Math.max(...donorTallies) : 0,
    upgradesUsed: Math.max(0, (runState.upgradePointsMax || 0) - (runState.upgradePoints || 0)),
    rerollsUsed: runState.rerollsUsed || 0,
    removalsUsed: runState.removalsUsed || 0
  };
}

/* The flat record missions.js's `missionSatisfied` reads. */
export function missionSnapshot(runState, outcome, menaceRank) {
  const counters = runState.missionCounters || createMissionCounters();
  return {
    ...counters,
    ...runLevelCounters(runState, outcome, menaceRank),
    nodesCleared: (runState.visited || []).length,
    standId: runState.standId,
    outcome
  };
}
