/* Act I map layout — Phase 8 deliverable 1. "Act layouts are data": every
   knob map_gen.js reads lives here, so a future Act II-IV layout is a new
   entry in this file, never a new generator. */

import { atLeastOnePerPath, noAdjacent, maxRun } from './map_constraints.js';

export const LANES = 6;
export const MAX_ATTEMPTS = 40; // §1's resample-loop budget before the deterministic repair floor

/* Interior node types only -- row 0 is always the fixed opener ('combat'),
   the last row is always the fixed boss ('boss'). Archive-locked types
   (Rule Fight, Duel, Arrow Shrine, Gamble, Requiem Altar) are out of Act
   I's pool entirely; Archive Node itself is in, stubbed at the scene
   layer (archive_stub.js). */
export const INTERIOR_TYPES = ['combat', 'elite', 'event', 'rest', 'shop', 'treasure', 'archive'];

/* Rest/Shop deliberately do NOT vary by lean (see LEAN_MULT below) and
   carry a generous flat weight -- they're the two types the fairness
   constraints require on every single path, and leaving their density
   to lean-driven suppression (an earlier version of this table did)
   pushed the resample loop's first-attempt pass rate down under 5%,
   forcing the generator to lean on the deterministic repair floor most
   of the time instead of only rarely. "Hard road, better rewards" reads
   through combat/elite/treasure density instead, which is both truer to
   the GDD (harder fights and richer loot, not fewer checkpoints) and
   keeps resampling cheap. */
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

/* Rows: fixed opener + fixed boss + 7-9 generated interior rows. */
export const ROWS_MIN = 9;
export const ROWS_MAX = 11;
export const PATH_COUNT_MIN = 2;
export const PATH_COUNT_MAX = 4;

/* Fairness (GDD §5.2/§6.8), generation-time, not runtime hope --
   deliverable 4. `exactlyOnce('requiem_altar')` exists in
   map_constraints.js for Act III later; Act I's own list never includes
   it since the type isn't even in INTERIOR_TYPES above. */
export const ACT1_CONSTRAINTS = [
  atLeastOnePerPath('rest'),
  atLeastOnePerPath('shop'),
  noAdjacent('rest'),
  maxRun('combat', 3)
];

/* Combat/Elite/Event content pools -- which data.js entries a generated
   node of that type may draw from. Kept here (not in data.js) so the
   generator's content selection is next to the layout knobs it's paired
   with. */
export const COMBAT_POOL = [
  { enemy: 'morioh_thug' },
  { enemy: 'knife_thug' },
  { encounter: 'morioh_alley_scuffle' },
  { encounter: 'morioh_shopping_street' },
  { encounter: 'kameyu_loading_dock' }
];
export const ELITE_POOL = [{ encounter: 'budogaoka_park_elite' }];
export const EVENT_POOL = ['stray_cat', 'vending_machine', 'rokakaka_stand'];
