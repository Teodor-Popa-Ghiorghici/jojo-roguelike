/* Stand Bonds — the progress engine (GDD §9.3). bonds.js holds the
   dialogue; this file holds the only logic, and it is small on purpose:
   nine lifetime counters per Stand, and a beat unlocks when its single
   {counter, op, value} clause holds AND every earlier beat is already
   unlocked, so a track is always read in order.

   Bonds advance by USING a Stand -- clearing acts, hitting milestones,
   dying in particular ways -- which is why the counters are cumulative
   across runs and live on the meta blob rather than on runState. The
   Keepsake at beat 9 is a starting Relic, and a sidegrade by construction:
   it is authored in keepsakes.js against the ordinary Relic schema, with
   the 'risk' tag and a real tradeoff, and it enters a run through the same
   `opts.relics` list any other owned Relic uses. Track A's rule is
   untouched by all of this -- a Keepsake is content the player unlocks,
   not a number the meta makes bigger. */

import { BOND_TRACKS } from './bonds.js';
import { MISSION_OPS } from './mission_counters.js';

export const BOND_COUNTERS = Object.freeze([
  'runsWithStand', 'actsClearedWithStand', 'winsWithStand', 'lossesWithStand',
  'bossKillsWithStand', 'perfectClashesWithStand', 'flawlessNodesWithStand',
  'menaceBestWithStand', 'nodesClearedWithStand'
]);

export function defaultBondState() { return {}; }

function trackStateFor(bondsState, standId) {
  if (!bondsState[standId]) {
    const counters = {};
    for (const c of BOND_COUNTERS) counters[c] = 0;
    bondsState[standId] = { counters, beats: [], keepsakes: [] };
  }
  return bondsState[standId];
}

/* Folds one finished run into a Stand's lifetime counters. */
function accumulate(counters, snapshot, outcome) {
  counters.runsWithStand += 1;
  counters.actsClearedWithStand += snapshot.actsCleared || 0;
  counters.winsWithStand += outcome === 'win' ? 1 : 0;
  counters.lossesWithStand += outcome === 'win' ? 0 : 1;
  counters.bossKillsWithStand += snapshot.bossKills || 0;
  counters.perfectClashesWithStand += snapshot.perfectClashes || 0;
  counters.flawlessNodesWithStand += snapshot.flawlessNodes || 0;
  counters.nodesClearedWithStand += snapshot.nodesCleared || 0;
  counters.menaceBestWithStand = Math.max(counters.menaceBestWithStand, snapshot.menaceRank || 0);
}

function beatUnlocked(beat, counters) {
  const op = MISSION_OPS[beat.trigger.op];
  if (!op) return false;
  return op(counters[beat.trigger.counter] || 0, beat.trigger.value);
}

/* Called once per run end. Returns the beats that just opened (in order)
   and any Keepsake they handed over. */
export function advanceBonds(bondsState, standId, snapshot, outcome) {
  const track = BOND_TRACKS[standId];
  if (!track) return { beats: [], keepsakes: [] };
  const state = trackStateFor(bondsState, standId);
  accumulate(state.counters, snapshot, outcome);

  const beats = [];
  const keepsakes = [];
  for (const beat of track) {
    if (state.beats.includes(beat.id)) continue;
    if (!beatUnlocked(beat, state.counters)) break; // strictly in order
    state.beats.push(beat.id);
    beats.push(beat);
    if (beat.keepsake && !state.keepsakes.includes(beat.keepsake)) {
      state.keepsakes.push(beat.keepsake);
      keepsakes.push(beat.keepsake);
    }
  }
  return { beats, keepsakes };
}

/* What the Bond room shows for one Stand: every beat, with the ones
   already earned readable and the next one showing its own requirement. */
export function bondProgress(bondsState, standId) {
  const track = BOND_TRACKS[standId] || [];
  const state = (bondsState && bondsState[standId]) || { counters: {}, beats: [], keepsakes: [] };
  const earned = track.filter(b => state.beats.includes(b.id));
  const next = track.find(b => !state.beats.includes(b.id)) || null;
  return {
    total: track.length, earned, next,
    counters: state.counters,
    have: next ? (state.counters[next.trigger.counter] || 0) : 0,
    need: next ? next.trigger.value : 0,
    keepsakes: state.keepsakes
  };
}

/* Every Keepsake the player has been given, across all Stands -- the Stand
   rack's "equip a Keepsake" list. */
export function unlockedKeepsakes(bondsState) {
  const out = [];
  for (const st of Object.values(bondsState || {})) {
    for (const k of st.keepsakes || []) if (!out.includes(k)) out.push(k);
  }
  return out;
}
