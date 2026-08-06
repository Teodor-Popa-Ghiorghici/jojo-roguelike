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
  { encounter: 'kameyu_loading_dock' },
  // GDD §15 encounter objectives -- near-free variety over the same combat-node pool.
  { encounter: 'morioh_alley_ambush' },
  { encounter: 'kameyu_holdout' },
  { encounter: 'shopping_street_pinned' },
  { encounter: 'loading_dock_blaze' },
  { encounter: 'kameyu_bounty' },
  { encounter: 'morioh_sudden_death' },
  // GDD §4.5 Rule Fights (~1 in 6 combat nodes) -- weighted low relative to plain combat/objective entries below.
  { encounter: 'budogaoka_sheer_heart_attack' },
  { encounter: 'kameyu_illusos_mirror' },
  { encounter: 'alley_formaggios_shrink' },
  { encounter: 'shopping_street_baby_face' },
  { encounter: 'loading_dock_yellow_temperance' },
  { encounter: 'park_rolling_stones' },
  { encounter: 'budogaoka_bites_the_dust' },
  { encounter: 'alley_cheap_trick' }
];
/* Act I's 2nd boss (Yuya Fungami/Highway Star) is an Elite-tier fight
   leading up to the true final boss, Killer Queen -- the same "N pre-boss
   Elites -> one final boss" shape GDD §5.1's act table reads as for every
   other Act below. */
// GDD §5 Boss Reprises: yuya_fungami's own 3 variants (boss_reprise.js) mixed alongside the vanilla fight.
const ACT1_ELITE_POOL = [
  { encounter: 'budogaoka_park_elite' }, { encounter: 'yuya_fungami_elite' },
  { encounter: 'yuya_fungami_quickened' }, { encounter: 'yuya_fungami_reinforced' }, { encounter: 'yuya_fungami_scorched' }
];
const ACT1_EVENT_POOL = ['stray_cat', 'vending_machine', 'rokakaka_stand'];

const ACT2_COMBAT_POOL = [
  { enemy: 'morioh_thug' }, { enemy: 'knife_thug' },
  { encounter: 'cairo_bazaar_ambush' }, { encounter: 'nile_docks_scuffle' }, { encounter: 'train_corridor_clash' }
];
const ACT2_ELITE_POOL = [
  { encounter: 'hol_horse_elite' }, { encounter: 'ndoul_elite' },
  { encounter: 'hol_horse_quickened' }, { encounter: 'hol_horse_reinforced' }, { encounter: 'hol_horse_scorched' },
  { encounter: 'ndoul_quickened' }, { encounter: 'ndoul_reinforced' }, { encounter: 'ndoul_scorched' }
];
const ACT2_EVENT_POOL = ['cairo_market_stall', 'sphinx_riddle'];

const ACT3_COMBAT_POOL = [
  { enemy: 'morioh_thug' }, { enemy: 'knife_thug' },
  { encounter: 'piazza_gang_skirmish' }, { encounter: 'vineyard_ambush' }, { encounter: 'villa_hitmen' }
];
const ACT3_ELITE_POOL = [
  { encounter: 'formaggio_elite' }, { encounter: 'illuso_elite' },
  { encounter: 'formaggio_quickened' }, { encounter: 'formaggio_reinforced' }, { encounter: 'formaggio_scorched' },
  { encounter: 'illuso_quickened' }, { encounter: 'illuso_reinforced' }, { encounter: 'illuso_scorched' }
];
const ACT3_EVENT_POOL = ['vineyard_shrine', 'gondola_gambit'];

const ACT4_COMBAT_POOL = [
  { enemy: 'brute' }, { enemy: 'knife_thug' },
  { encounter: 'ruin_gauntlet_skirmish' }, { encounter: 'voidscape_ambush' }
];
const ACT4_ELITE_POOL = [
  { encounter: 'funny_valentine_elite' },
  { encounter: 'funny_valentine_quickened' }, { encounter: 'funny_valentine_reinforced' }, { encounter: 'funny_valentine_scorched' }
];
const ACT4_EVENT_POOL = ['reality_tear', 'echo_of_yourself'];

/* GDD §5.1 act table: rows 9/10/10/11, ~7/~8/~8/~9 encounters. Bosses per
   Act (§4.6/§9): row 0 opener + the fixed final-row boss are the only
   hardcoded content per Act; everything interior is weighted-random over
   that Act's own pool. "2-3 bosses per Act" (§4.6) reads as 1-2 Elite-
   tier pre-boss fights (elitePool, each wrapping a full boss def --
   data_encounters.js) plus the one true final boss in `boss` below --
   never two nodes both typed 'boss' in the same generated graph. `title`/
   `subtitle` are read by map.js's HUD banner, replacing what used to be a
   hardcoded "ACT I MORIOH" literal (Phase 9d fix -- Acts II-IV would
   otherwise have displayed Act I's own banner). */
export const ACT_CONFIGS = {
  1: {
    title: 'ACT I  MORIOH', subtitle: 'DIAMOND IS UNBREAKABLE',
    rowsMin: 9, rowsMax: 11,
    constraints: ACT1_CONSTRAINTS,
    combatPool: ACT1_COMBAT_POOL, elitePool: ACT1_ELITE_POOL, eventPool: ACT1_EVENT_POOL,
    rowZero: { enemy: 'morioh_thug', label: 'BACK ALLEY' },
    boss: { id: 'killer_queen', label: 'KAMEYU DEPARTMENT STORE' },
    scenes: { combat: 'street', elite: 'street', event: 'alley', rest: 'park', shop: 'park', treasure: 'park', archive: 'store', boss: 'store' }
  },
  2: {
    title: 'ACT II  CAIRO', subtitle: 'STARDUST CRUSADERS',
    rowsMin: 10, rowsMax: 11,
    constraints: ACT1_CONSTRAINTS,
    combatPool: ACT2_COMBAT_POOL, elitePool: ACT2_ELITE_POOL, eventPool: ACT2_EVENT_POOL,
    rowZero: { enemy: 'morioh_thug', label: 'BAZAAR OUTSKIRTS' },
    boss: { id: 'dio', label: "DIO'S MANSION" },
    scenes: { combat: 'bazaar', elite: 'train_car', event: 'nile_docks', rest: 'nile_docks', shop: 'bazaar', treasure: 'nile_docks', archive: 'train_car', boss: 'train_car' }
  },
  3: {
    title: 'ACT III  NAPLES', subtitle: 'GOLDEN WIND',
    rowsMin: 10, rowsMax: 11,
    constraints: ACT1_CONSTRAINTS,
    combatPool: ACT3_COMBAT_POOL, elitePool: ACT3_ELITE_POOL, eventPool: ACT3_EVENT_POOL,
    rowZero: { enemy: 'morioh_thug', label: 'PIAZZA OUTSKIRTS' },
    boss: { id: 'diavolo', label: "DIAVOLO'S VILLA" },
    scenes: { combat: 'piazza', elite: 'villa', event: 'vineyard', rest: 'vineyard', shop: 'piazza', treasure: 'vineyard', archive: 'villa', boss: 'villa' }
  },
  4: {
    title: 'ACT IV  THE GAUNTLET', subtitle: 'A REALITY, WARPED',
    rowsMin: 11, rowsMax: 13,
    constraints: ACT1_CONSTRAINTS,
    combatPool: ACT4_COMBAT_POOL, elitePool: ACT4_ELITE_POOL, eventPool: ACT4_EVENT_POOL,
    rowZero: { enemy: 'knife_thug', label: 'THE RUINED STREET' },
    boss: { id: 'pucci', label: 'THE END OF THE WORLD' },
    scenes: { combat: 'ruin', elite: 'voidscape', event: 'throneroom', rest: 'throneroom', shop: 'ruin', treasure: 'voidscape', archive: 'throneroom', boss: 'voidscape' }
  }
};
