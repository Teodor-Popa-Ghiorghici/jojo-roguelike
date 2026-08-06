/* Act map layout data — Phase 8 (Act I) + Phase 9d (generalized to N Acts).
   "Act layouts are data": every knob map_gen.js reads lives here, keyed by
   act number in ACT_CONFIGS, so a new Act is a new table entry, never a
   new generator. Topology knobs (lanes/path-count/lean identities) are
   shared across every Act -- the GDD gives no reason to vary them -- only
   row-count range, fairness constraints, and content pools vary per Act. */

import { atLeastOnePerPath, noAdjacent, maxRun } from './map_constraints.js';

export const LANES = 6;
export const MAX_ATTEMPTS = 40; // §1's resample-loop budget before the deterministic repair floor

/* Interior node types only -- row 0 is always the fixed opener ('combat'),
   the last row is always the fixed boss ('boss'). Archive-locked types
   (Rule Fight, Duel, Arrow Shrine, Gamble, Requiem Altar) stay out of the
   generated pool entirely; Archive Node itself is in, stubbed at the
   scene layer (archive_stub.js). */
export const INTERIOR_TYPES = ['combat', 'elite', 'event', 'rest', 'shop', 'treasure', 'archive'];

/* Rest/Shop deliberately do NOT vary by lean (see LEAN_MULT below) and
   carry a generous flat weight -- they're the two types the fairness
   constraints require on every single path, and leaving their density
   to lean-driven suppression pushed the resample loop's first-attempt
   pass rate down under 5%. "Hard road, better rewards" reads through
   combat/elite/treasure density instead. */
const BASE_WEIGHT = { combat: 18, elite: 8, event: 14, rest: 26, shop: 22, treasure: 9, archive: 5 };

/* Path identity (§5.2): each generated path is pre-assigned one of these
   before its lane walk runs, and its lean skews every interior node it
   first visits toward a readable composition -- rest/shop excluded on
   purpose (see BASE_WEIGHT's comment above). */
export const LEAN_MULT = {
  hard: { combat: 1.3, elite: 2.4, event: 0.8, rest: 1, shop: 1, treasure: 0.6, archive: 0.6 },
  long: { combat: 0.9, elite: 0.6, event: 1.3, rest: 1, shop: 1, treasure: 1.8, archive: 1.2 },
  safe: { combat: 0.6, elite: 0.3, event: 1.7, rest: 1, shop: 1, treasure: 0.9, archive: 0.9 }
};

export const LEAN_LABEL = {
  hard: 'THE HARD ROAD — ELITES, BETTER REWARDS',
  long: 'THE LONG ROAD — MORE STOPS, MORE ECONOMY',
  safe: 'THE SAFE ROAD — RESTS AND EVENTS, FEWER REWARDS'
};

/* Which lean each of the P generated paths gets, indexed by path count
   then path index -- GDD §5.2's "hard/long/safe" trio, doubled up on
   `safe` when there's a 4th path rather than inventing a 4th lean. */
export const LEAN_BY_PATH_COUNT = {
  2: ['hard', 'safe'],
  3: ['hard', 'long', 'safe'],
  4: ['hard', 'long', 'safe', 'safe']
};

export function weightOf(type, lean) {
  return BASE_WEIGHT[type] * ((LEAN_MULT[lean] && LEAN_MULT[lean][type]) || 1);
}

export const PATH_COUNT_MIN = 2;
export const PATH_COUNT_MAX = 4;

const ACT1_CONSTRAINTS = [
  atLeastOnePerPath('rest'),
  atLeastOnePerPath('shop'),
  noAdjacent('rest'),
  maxRun('combat', 3)
];

/* Combat/Elite/Event content pools -- which data.js entries a generated
   node of that type may draw from. */
const ACT1_COMBAT_POOL = [
  { enemy: 'morioh_thug' },
  { enemy: 'knife_thug' },
  { encounter: 'morioh_alley_scuffle' },
  { encounter: 'morioh_shopping_street' },
  { encounter: 'kameyu_loading_dock' }
];
const ACT1_ELITE_POOL = [{ encounter: 'budogaoka_park_elite' }];
const ACT1_EVENT_POOL = ['stray_cat', 'vending_machine', 'rokakaka_stand'];

/* GDD §5.1 act table: rows 9/10/10/11, ~7/~8/~8/~9 encounters. Bosses per
   Act (§4.6/§9): row 0 opener + the fixed final-row boss are the only
   hardcoded content per Act; everything interior is weighted-random over
   that Act's own pool. Acts II-IV's pools/scenes are filled in by their
   own authoring batches (Phase 9d); until then they intentionally reuse
   Act I's roster/scene as inert filler so the generalized generator is
   provably correct end-to-end before any new content lands. */
export const ACT_CONFIGS = {
  1: {
    rowsMin: 9, rowsMax: 11,
    constraints: ACT1_CONSTRAINTS,
    combatPool: ACT1_COMBAT_POOL, elitePool: ACT1_ELITE_POOL, eventPool: ACT1_EVENT_POOL,
    rowZero: { enemy: 'morioh_thug', label: 'BACK ALLEY' },
    boss: { id: 'killer_queen', label: 'KAMEYU DEPARTMENT STORE' },
    scenes: { combat: 'street', elite: 'street', event: 'alley', rest: 'park', shop: 'park', treasure: 'park', archive: 'store', boss: 'store' }
  },
  2: {
    rowsMin: 10, rowsMax: 11,
    constraints: ACT1_CONSTRAINTS,
    combatPool: ACT1_COMBAT_POOL, elitePool: ACT1_ELITE_POOL, eventPool: ACT1_EVENT_POOL,
    rowZero: { enemy: 'morioh_thug', label: 'STREET' },
    boss: { id: 'killer_queen', label: 'PLACEHOLDER' },
    scenes: { combat: 'street', elite: 'street', event: 'alley', rest: 'park', shop: 'park', treasure: 'park', archive: 'store', boss: 'store' }
  },
  3: {
    rowsMin: 10, rowsMax: 11,
    constraints: ACT1_CONSTRAINTS,
    combatPool: ACT1_COMBAT_POOL, elitePool: ACT1_ELITE_POOL, eventPool: ACT1_EVENT_POOL,
    rowZero: { enemy: 'morioh_thug', label: 'STREET' },
    boss: { id: 'killer_queen', label: 'PLACEHOLDER' },
    scenes: { combat: 'street', elite: 'street', event: 'alley', rest: 'park', shop: 'park', treasure: 'park', archive: 'store', boss: 'store' }
  },
  4: {
    rowsMin: 11, rowsMax: 13,
    constraints: ACT1_CONSTRAINTS,
    combatPool: ACT1_COMBAT_POOL, elitePool: ACT1_ELITE_POOL, eventPool: ACT1_EVENT_POOL,
    rowZero: { enemy: 'morioh_thug', label: 'STREET' },
    boss: { id: 'killer_queen', label: 'PLACEHOLDER' },
    scenes: { combat: 'street', elite: 'street', event: 'alley', rest: 'park', shop: 'park', treasure: 'park', archive: 'store', boss: 'store' }
  }
};
