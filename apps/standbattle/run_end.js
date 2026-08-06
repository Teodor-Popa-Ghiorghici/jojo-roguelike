/* Run end — the single settlement point for BOTH outcomes (GDD §9.5:
   "Death is never zero"). Before Phase 10 a win and a loss left the run by
   two different doors and neither paid anything; now both call settleRun()
   and get the same five things back: Fate, Archive entries for whatever
   was newly seen, Bond progress for the Stand used, Mission progress, and
   a "TO BE CONTINUED ->" summary carrying the build, the best combo, the
   killer and a one-line epilogue.

   Note the direction of travel: this file reads runState and writes the
   META blob only. Nothing here writes runState back (the run is over) and
   nothing here reaches the combat number pipeline -- the Fate side is
   meta_fate.js, the unlock side is meta_archive.js, and the two never meet
   (spec §7). */

import { fateForRunEnd, fateForMenaceClear, grantFate } from './meta_fate.js';
import { recordSeen } from './meta_archive.js';
import { menaceRankOf, recordMenaceClear, pactFor } from './meta_menace.js';
import { evaluateMissions } from './missions.js';
import { missionSnapshot } from './mission_tracker.js';
import { advanceBonds } from './bond_progress.js';
import { STANDS } from './data.js';
import { FRAGMENTS } from './fragments.js';
import { ownedFragmentEntries } from './fragment_offers.js';

/* One line of in-fiction epilogue, chosen by outcome and depth. Data, so
   a future Act or ending is a row rather than a branch. */
const EPILOGUES = Object.freeze({
  win: ['The Foundation logs the case closed. Morioh sleeps.',
    'The arrow is recovered. Somewhere, someone else picks one up.',
    'You walk out. The stand-users you left behind do not.',
    'It ends the way these things end: quietly, and too late for some.'],
  loss: ['They found the body at dawn. The file stays open.',
    'Speedwagon Foundation, Case 0114: subject lost in Act I.',
    'The town goes on. It is very good at going on.',
    'Deeper than most get. Not deep enough.',
    'At the last door. The Foundation will send someone else.']
});

function epilogueFor(outcome, act, rng) {
  const pool = EPILOGUES[outcome === 'win' ? 'win' : 'loss'];
  const idx = outcome === 'win' ? Math.min(pool.length - 1, act - 1)
    : Math.min(pool.length - 1, act);
  return pool[idx] || pool[0];
}

/* The player's build, as the summary screen wants to show it: slot,
   Fragment name, level, donor. */
function buildSummary(runState) {
  return ownedFragmentEntries(runState).filter(e => e.owned).map(e => {
    const def = FRAGMENTS[e.owned.id];
    return { slot: e.slot, id: e.owned.id, level: e.owned.level, name: def ? def.name : e.owned.id, donor: def ? def.donor : null };
  });
}

/* "Your best combo" without adding a combo system: the longest self-chain
   the run reached is already tracked per move by combat_player.js's
   chainCounts, and mission_tracker's `hits` gives the volume. */
function bestCombo(runState) {
  return Math.max(0, Math.round(runState.bestChain || 0));
}

/* Everything newly seen this run becomes an Archive entry (GDD §9.4).
   Enemies/bosses met are recorded as 'seen', anything killed as
   'defeated'; a Fragment carried to the end is 'mastered'. */
function recordArchiveEntries(archiveState, runState, outcome) {
  const added = [];
  const note = (id, state) => { if (id && recordSeen(archiveState, id, state)) added.push(id); };
  for (const nodeId of runState.visited || []) {
    const node = runState.graph && runState.graph.nodes[nodeId];
    if (!node) continue;
    note(node.boss, 'defeated');
    note(node.enemy, 'defeated');
    note(node.encounter, 'defeated');
  }
  const entering = runState.graph && runState.graph.nodes[runState.nodeId];
  if (entering && outcome !== 'win') {
    note(entering.boss || entering.enemy || entering.encounter, 'seen');
  }
  for (const b of buildSummary(runState)) note(b.id, b.level >= 3 ? 'mastered' : 'seen');
  note(runState.standId, outcome === 'win' ? 'mastered' : 'seen');
  return added;
}

/* THE settlement. `meta` is the save blob; it is mutated in place and the
   caller persists it. Returns the summary the TO BE CONTINUED screen
   draws -- the function has no side effect on the run or on any fight. */
export function settleRun(meta, runState, { outcome, killer }) {
  const standId = runState.standId;
  const menaceRank = menaceRankOf(pactFor(meta.menace, standId));

  let fate = grantFate(meta.fate, fateForRunEnd({ outcome, act: runState.act, menaceRank }));

  const snapshot = missionSnapshot(runState, outcome, menaceRank);
  const missionResult = evaluateMissions(meta.missions, snapshot);
  fate += grantFate(meta.fate, missionResult.fate);

  // GDD §21 Ripple Assist "blocks nothing except Menace rank records": an
  // assisted clear still pays Fate/Archive/Bonds/Missions above, it just
  // never overwrites meta.menace.best.
  const assistActive = !!(runState.assist && (runState.assist.clash || runState.assist.step || runState.assist.damage));
  let menaceResult = { improved: false, titles: [] };
  if (outcome === 'win' && menaceRank > 0 && !assistActive) {
    const prev = (meta.menace.best && meta.menace.best[standId]) || 0;
    menaceResult = recordMenaceClear(meta.menace, standId, menaceRank);
    if (menaceResult.improved) {
      fate += grantFate(meta.fate, fateForMenaceClear(prev, menaceRank));
      meta.titles = meta.titles || [];
      for (const t of menaceResult.titles) if (!meta.titles.includes(t)) meta.titles.push(t);
    }
  }

  const archiveEntries = recordArchiveEntries(meta.archive, runState, outcome);
  const bondResult = advanceBonds(meta.bonds, standId, snapshot, outcome);

  const stand = STANDS[standId];
  const summary = {
    outcome, killer, act: runState.act, standId,
    standName: stand ? stand.standName : standId,
    character: stand ? stand.character : '',
    aspectId: runState.aspectId || null,
    nodesCleared: (runState.visited || []).length,
    build: buildSummary(runState),
    bestCombo: bestCombo(runState),
    hits: snapshot.hits, perfectClashes: snapshot.perfectClashes,
    fate, menaceRank,
    titles: menaceResult.titles,
    archiveEntries,
    missions: missionResult.missions.map(m => ({ id: m.id, name: m.name, fate: m.fate })),
    bondBeats: bondResult.beats,
    keepsakes: bondResult.keepsakes,
    epilogue: epilogueFor(outcome, runState.act)
  };
  meta.lastRun = {
    outcome, killer, act: runState.act, standId,
    fate, epilogue: summary.epilogue, when: Date.now()
  };
  return summary;
}
