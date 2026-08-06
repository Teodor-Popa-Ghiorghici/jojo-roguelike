/* Bizarre Missions — the registry (GDD §10.2). 120 named directives,
   authored as pure data in six batches of twenty (missions_01..06.js) and
   only aggregated here. Nothing in this file knows what any individual
   mission means: a mission is a Stand filter, an outcome filter and one
   to three {counter, op, value} clauses over mission_counters.js's closed
   vocabulary, so a new mission is a row in a batch file and never a code
   path (invariant 6).

   Batches by theme: 01 fundamentals, 02 defensive mastery, 03 build
   identity, 04 per-Stand identity, 05 the Menace ladder, 06 bosses,
   endurance and the loss payouts §9.5 insists on. */

import { MISSIONS_01 } from './missions_01.js';
import { MISSIONS_02 } from './missions_02.js';
import { MISSIONS_03 } from './missions_03.js';
import { MISSIONS_04 } from './missions_04.js';
import { MISSIONS_05 } from './missions_05.js';
import { MISSIONS_06 } from './missions_06.js';
import { MISSION_OPS, ALL_COUNTERS } from './mission_counters.js';

export const MISSION_LIST = Object.freeze([
  ...MISSIONS_01, ...MISSIONS_02, ...MISSIONS_03,
  ...MISSIONS_04, ...MISSIONS_05, ...MISSIONS_06
]);

export const MISSIONS = Object.freeze(Object.fromEntries(MISSION_LIST.map(m => [m.id, m])));

export function defaultMissionState() { return { completed: [] }; }

export function isComplete(missionState, id) {
  return !!missionState && Array.isArray(missionState.completed) && missionState.completed.includes(id);
}

export function completedCount(missionState) {
  return ((missionState && missionState.completed) || []).length;
}

/* One mission against one run's snapshot. `snapshot` is the flat
   counter->number record run_end.js assembles (combat counters accumulated
   by mission_tracker.js plus the run-level ones read off runState), with
   `standId` and `outcome` alongside. */
export function missionSatisfied(mission, snapshot) {
  if (mission.standId && mission.standId !== snapshot.standId) return false;
  if (mission.outcome && mission.outcome !== 'any' && mission.outcome !== snapshot.outcome) return false;
  return (mission.requires || []).every(clause => {
    const op = MISSION_OPS[clause.op];
    if (!op) return false;
    return op(snapshot[clause.counter] || 0, clause.value);
  });
}

/* Not in the GDD, and added because a 40-run pacing simulation showed the
   design failing without it: the ~20 "fundamentals" missions are all
   satisfiable by the same competent early run, so an unthrottled payout
   handed over 400 Fate on run 1 and bought 13 of the 34 Archive nodes in
   two runs -- against GDD §19's explicit target of "something unlocks
   every 1-2 runs for the first ten hours". Capping COMPLETIONS rather
   than shrinking payouts keeps each mission worth what §10.2 says it is
   worth (40-150) and keeps the cadence: the surplus stays on the board and
   lands next run. Cheapest-first, so the long-tail missions are never
   crowded out by an easy one. */
export const MISSION_COMPLETIONS_PER_RUN = 3;

/* Called once at run end. Returns the missions newly completed by this run
   and the Fate they pay, and marks them off. Already-completed missions
   never pay twice. */
export function evaluateMissions(missionState, snapshot) {
  const satisfied = MISSION_LIST
    .filter(m => !isComplete(missionState, m.id) && missionSatisfied(m, snapshot))
    .sort((a, b) => a.fate - b.fate);
  const newly = satisfied.slice(0, MISSION_COMPLETIONS_PER_RUN);
  newly.forEach(m => missionState.completed.push(m.id));
  return { missions: newly, fate: newly.reduce((n, m) => n + (m.fate || 0), 0), heldOver: satisfied.length - newly.length };
}

/* What the Mission board shows: everything still open, hardest last, with
   the Stand-locked ones for the currently-racked Stand first. */
export function openMissions(missionState, standId) {
  return MISSION_LIST
    .filter(m => !isComplete(missionState, m.id))
    .sort((a, b) => {
      const aMine = a.standId === standId ? 0 : 1;
      const bMine = b.standId === standId ? 0 : 1;
      return aMine - bMine || a.fate - b.fate;
    });
}

/* Validation surface, run by scripts/validate.js. Missions are content and
   get the same load-time treatment every other content table gets. */
export function validateMissions() {
  const errors = [];
  const seen = new Set();
  const counters = new Set(ALL_COUNTERS);
  for (const m of MISSION_LIST) {
    if (seen.has(m.id)) errors.push(`duplicate mission id "${m.id}"`);
    seen.add(m.id);
    if (!m.name || m.name.length > 24) errors.push(`${m.id}: name missing or over 24 chars`);
    if (!m.desc || m.desc.length > 78) errors.push(`${m.id}: desc missing or over 78 chars`);
    if (!(m.fate >= 40 && m.fate <= 150)) errors.push(`${m.id}: fate ${m.fate} outside GDD §10.2's 40-150`);
    if (!['win', 'loss', 'any'].includes(m.outcome)) errors.push(`${m.id}: unknown outcome "${m.outcome}"`);
    if (!Array.isArray(m.requires) || m.requires.length < 1 || m.requires.length > 3) {
      errors.push(`${m.id}: requires must hold 1-3 clauses`);
    }
    for (const c of m.requires || []) {
      if (!counters.has(c.counter)) errors.push(`${m.id}: unknown counter "${c.counter}"`);
      if (!MISSION_OPS[c.op]) errors.push(`${m.id}: unknown op "${c.op}"`);
      if (typeof c.value !== 'number') errors.push(`${m.id}: clause value must be a number`);
    }
  }
  if (MISSION_LIST.length < 110) errors.push(`only ${MISSION_LIST.length} missions, GDD §10.2 asks for ~120`);
  return { pass: errors.length === 0, errors, count: MISSION_LIST.length };
}
