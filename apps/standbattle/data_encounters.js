/* Encounters (tech §3 schema, GDD §4.4) — split out of data.js (Phase 9d,
   300-line cap) now that every Act has its own pool. `winCondition:
   'killAll'` is the one implementation Phase 5 ships; a wave's enemy list
   is either a literal `types` array (ids or a raw def object, for a
   legacy solo boss/elite fight) or a `generate` budget/pool consumed by
   encounter_budget.js's composition generator at spawn time.

   Acts II-IV reuse the same 14-type roster (GDD §13: perceived variety
   through composition/weighting, not hand-authored new types) under new
   Act-flavoured labels -- the "2-3 bosses per Act" table (GDD §5.1) reads
   as one true final boss per Act (the fixed last-row node,
   map_data.js/ACT_CONFIGS) plus 1-2 more as Elite-tier fights, each
   wrapping a full boss def (phases/signature/purge/parts) in a trivial
   one-wave encounter exactly the way `budogaoka_park_elite` already
   wraps Angelo below -- zero new mechanism. */

import {
  BOSS_YUYA_FUNGAMI, BOSS_HOL_HORSE, BOSS_NDOUL, BOSS_FORMAGGIO, BOSS_ILLUSO, BOSS_FUNNY_VALENTINE
} from './data_bosses.js';
import { ENEMIES } from './data_enemies.js';
import { BOSS_REPRISES } from './boss_reprise.js';

/* GDD §15 Sudden Death: "A single enemy at 1 HP that flees; chase it
   across the arena for a Fragment." A plain enemy def with `hp: 1` and
   `flees: true` (encounter.js's spawnWave starts its AI in 'flee' --
   combat_enemy.js) -- no bespoke chase system, the existing killAll
   winCondition ends the fight the instant it's caught and hit once. */
const PANICKED_LOOTER = {
  ...ENEMIES.knife_thug, id: 'panicked_looter', name: 'PANICKED LOOTER', hp: 1,
  speedPx: ENEMIES.knife_thug.speedPx * 1.3, flees: true
};

export const ENCOUNTERS = {
  /* ---- Act I -- Morioh --------------------------------------------- */
  morioh_shopping_street: {
    id: 'morioh_shopping_street', label: 'SHOPPING STREET SCUFFLE', winCondition: 'killAll',
    waves: [
      { generate: { budget: 5, pool: ['morioh_thug', 'knife_thug'] } },
      { types: ['brute'] }
    ]
  },
  budogaoka_park_elite: {
    id: 'budogaoka_park_elite', label: 'ANGELO', winCondition: 'killAll',
    waves: [{ types: ['angelo', 'morioh_thug'] }]
  },
  morioh_alley_scuffle: {
    id: 'morioh_alley_scuffle', label: 'ALLEYWAY SCUFFLE', winCondition: 'killAll',
    waves: [{ generate: { budget: 3, pool: ['morioh_thug', 'knife_thug'] } }]
  },
  kameyu_loading_dock: {
    id: 'kameyu_loading_dock', label: 'LOADING DOCK', winCondition: 'killAll',
    waves: [{ generate: { budget: 6, pool: ['morioh_thug', 'knife_thug', 'brute'] } }]
  },
  yuya_fungami_elite: {
    id: 'yuya_fungami_elite', label: 'HIGHWAY STAR', winCondition: 'killAll',
    waves: [{ types: [BOSS_YUYA_FUNGAMI] }]
  },

  /* ---- GDD §15 encounter objectives -- Act I --------------------------- */
  morioh_alley_ambush: {
    id: 'morioh_alley_ambush', label: 'CAUGHT IN THE ALLEY', objective: 'ambush', winCondition: 'killAll',
    waves: [{ types: ['morioh_thug', 'knife_thug', 'morioh_thug'] }]
  },
  kameyu_holdout: {
    id: 'kameyu_holdout', label: 'HOLD THE FLOOR', objective: 'survive', winCondition: 'killAll', fleeable: true,
    surviveSpawn: { everyFrames: 300, budget: 2, pool: ['morioh_thug', 'knife_thug'] }, // every 5s
    waves: [{ types: ['morioh_thug'] }]
  },
  shopping_street_pinned: {
    id: 'shopping_street_pinned', label: 'PINNED DOWN', objective: 'pinned', winCondition: 'killAll',
    waves: [{ types: ['knife_thug', 'knife_thug'] }]
  },
  loading_dock_blaze: {
    id: 'loading_dock_blaze', label: 'LOADING DOCK BLAZE', objective: 'hazard', winCondition: 'killAll',
    arenaHazards: [
      { delay: 90, repeat: 240, hazard: { radius: 50, tickFrames: 20, dmg: 5, lifeFrames: 180 } },
      { delay: 210, repeat: 240, hazard: { radius: 44, tickFrames: 20, dmg: 5, lifeFrames: 180 } }
    ],
    waves: [{ types: ['morioh_thug', 'knife_thug'] }]
  },
  kameyu_bounty: {
    id: 'kameyu_bounty', label: 'MARKED MAN', objective: 'bounty', winCondition: 'killAll',
    waves: [{ types: ['brute', 'morioh_thug', 'knife_thug'] }] // bountyIndex defaults to 0 -- the Brute
  },
  morioh_sudden_death: {
    id: 'morioh_sudden_death', label: 'GRAB THE LOOT', winCondition: 'killAll',
    waves: [{ types: [PANICKED_LOOTER] }]
  },

  /* GDD §4.7 The Stalker: "an invading Stand user... announced by a
     screen-wide ゴゴゴゴ and a distinct motif... ALWAYS fleeable." One
     generic def reused across every Act from run_flow.js's node-entry
     roll (never a fixed map node of its own, matching "enters a node
     uninvited") -- `fleeable: true` is the same field Survive opts into
     (encounter.js's spawnWave/combat.js's setKey), `bestLoot: true` is
     read by run_flow.js's onCombatWin to route the drop through the same
     guaranteed-Rare+ reward path an Elite/boss already gets. */
  the_stalker: {
    id: 'the_stalker', label: 'ゴゴゴゴゴゴゴゴ', winCondition: 'killAll', fleeable: true, bestLoot: true,
    waves: [{
      types: [{
        id: 'the_stalker', name: 'THE STALKER', baseType: 'elite',
        hp: 140, power: 8, speedPx: 150, precision: 7, poise: 60,
        attackPatterns: ['sweep', 'projectile', 'telegraphed_slam']
      }]
    }]
  },

  /* ---- GDD §4.5 Rule Fights -- launch set, Act I dressing --------------
     Authored once each (rule_fights.js/rule_fights_2.js); "re-appears with
     different enemy compositions" (GDD) means later Acts wrap the same 8
     `objective` ids around their own roster, not new rule code. */
  budogaoka_sheer_heart_attack: {
    id: 'budogaoka_sheer_heart_attack', label: 'SHEER HEART ATTACK', objective: 'rf_sheer_heart_attack', winCondition: 'killAll',
    waves: [{ types: ['brute'] }]
  },
  kameyu_illusos_mirror: {
    id: 'kameyu_illusos_mirror', label: "ILLUSO'S MIRROR", objective: 'rf_illusos_mirror', winCondition: 'killAll',
    waves: [{ types: ['knife_thug'] }]
  },
  alley_formaggios_shrink: {
    id: 'alley_formaggios_shrink', label: "FORMAGGIO'S SHRINK", objective: 'rf_formaggios_shrink', winCondition: 'killAll',
    waves: [{ types: ['morioh_thug'] }]
  },
  shopping_street_baby_face: {
    id: 'shopping_street_baby_face', label: 'BABY FACE', objective: 'rf_baby_face', winCondition: 'killAll',
    waves: [{ types: ['knife_thug'] }]
  },
  loading_dock_yellow_temperance: {
    id: 'loading_dock_yellow_temperance', label: 'YELLOW TEMPERANCE', objective: 'rf_yellow_temperance', winCondition: 'killAll',
    waves: [{ types: ['brute'] }]
  },
  park_rolling_stones: {
    id: 'park_rolling_stones', label: 'ROLLING STONES', objective: 'rf_rolling_stones', winCondition: 'killAll',
    waves: [{ types: ['morioh_thug'] }]
  },
  budogaoka_bites_the_dust: {
    id: 'budogaoka_bites_the_dust', label: 'BITES THE DUST', objective: 'rf_bites_the_dust', winCondition: 'killAll',
    waves: [{ types: ['knife_thug'] }]
  },
  alley_cheap_trick: {
    id: 'alley_cheap_trick', label: 'CHEAP TRICK', objective: 'rf_cheap_trick', winCondition: 'killAll',
    waves: [{ types: ['morioh_thug'] }]
  },

  /* ---- Act II -- Cairo pursuit --------------------------------------- */
  cairo_bazaar_ambush: {
    id: 'cairo_bazaar_ambush', label: 'BAZAAR AMBUSH', winCondition: 'killAll',
    waves: [{ generate: { budget: 5, pool: ['morioh_thug', 'knife_thug'] } }]
  },
  nile_docks_scuffle: {
    id: 'nile_docks_scuffle', label: 'DOCKSIDE SCUFFLE', winCondition: 'killAll',
    waves: [{ generate: { budget: 4, pool: ['morioh_thug', 'knife_thug'] } }]
  },
  train_corridor_clash: {
    id: 'train_corridor_clash', label: 'TRAIN CORRIDOR CLASH', winCondition: 'killAll',
    waves: [{ generate: { budget: 6, pool: ['morioh_thug', 'knife_thug', 'brute'] } }]
  },
  hol_horse_elite: {
    id: 'hol_horse_elite', label: 'HOL HORSE', winCondition: 'killAll',
    waves: [{ types: [BOSS_HOL_HORSE] }]
  },
  ndoul_elite: {
    id: 'ndoul_elite', label: "N'DOUL", winCondition: 'killAll',
    waves: [{ types: [BOSS_NDOUL] }]
  },

  /* ---- Act III -- Naples vineyard ------------------------------------ */
  piazza_gang_skirmish: {
    id: 'piazza_gang_skirmish', label: 'PIAZZA SKIRMISH', winCondition: 'killAll',
    waves: [{ generate: { budget: 6, pool: ['morioh_thug', 'knife_thug'] } }]
  },
  vineyard_ambush: {
    id: 'vineyard_ambush', label: 'VINEYARD AMBUSH', winCondition: 'killAll',
    waves: [{ generate: { budget: 4, pool: ['morioh_thug', 'knife_thug'] } }]
  },
  villa_hitmen: {
    id: 'villa_hitmen', label: 'VILLA HITMEN', winCondition: 'killAll',
    waves: [{ generate: { budget: 7, pool: ['morioh_thug', 'knife_thug', 'brute'] } }]
  },
  formaggio_elite: {
    id: 'formaggio_elite', label: 'FORMAGGIO', winCondition: 'killAll',
    waves: [{ types: [BOSS_FORMAGGIO] }]
  },
  illuso_elite: {
    id: 'illuso_elite', label: 'ILLUSO', winCondition: 'killAll',
    waves: [{ types: [BOSS_ILLUSO] }]
  },

  /* ---- Act IV -- reality-warped finale -------------------------------- */
  ruin_gauntlet_skirmish: {
    id: 'ruin_gauntlet_skirmish', label: 'RUINED STREETS', winCondition: 'killAll',
    waves: [{ generate: { budget: 6, pool: ['morioh_thug', 'knife_thug', 'brute'] } }]
  },
  voidscape_ambush: {
    id: 'voidscape_ambush', label: 'VOIDSCAPE AMBUSH', winCondition: 'killAll',
    waves: [{ generate: { budget: 7, pool: ['morioh_thug', 'knife_thug', 'brute'] } }]
  },
  funny_valentine_elite: {
    id: 'funny_valentine_elite', label: 'FUNNY VALENTINE -- THE GAUNTLET', winCondition: 'killAll',
    waves: [{ types: [BOSS_FUNNY_VALENTINE] }]
  },

  // GDD §5's Boss Reprises -- 30 generated variant encounters (boss_reprise.js), id-keyed alongside everything above.
  ...BOSS_REPRISES
};
