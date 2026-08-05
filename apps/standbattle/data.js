/* Stand Battle Arena — content data.
   Everything here is a plain data object per docs/stand-battle-arena-spec.md
   §14.2: new content is a data entry, not a new code path. */

export { PAL } from './cga_palette.js';
import { PAL } from './cga_palette.js';

/* Stand definition — stats per §2.1 (Power/Speed/Range/Persistence/
   Precision/Developmental Potential). Range and Power lean inversely,
   per canon and per §2.1's binding constraint. */
export const STANDS = {
  star_platinum: {
    id: 'star_platinum',
    character: 'Jotaro Kujo',
    standName: 'Star Platinum',
    role: 'brawler',
    controlScheme: 'close', // GDD §3.4 (Phase 9a) -- Stand Class as a data field, stand_classes.js's CONTROL_SCHEMES
    source: 'Stardust Crusaders (Part 3)',
    stats: { power: 8, speed: 7, range: 2, persistence: 6, precision: 6, devPotential: 3 },
    moves: { light: 'sp_light', medium: 'sp_medium', heavy: 'sp_heavy', special: 'sp_barrage' },
    standRush: 'sp_ora_rush'
  }
};

/* Move definitions moved to moves.js (tech §2.4 frame-data timeline shape,
   Phase 2). Re-exported here so existing `import { MOVES } from './data.js'`
   call sites keep working without churn. */
export { MOVES } from './moves.js';

/* Enemy definitions moved to data_enemies.js (Phase 9b, roster now 14
   types + Puppeteer's summon fodder) -- re-exported here so every existing
   `import { ENEMIES } from './data.js'` call site is untouched, the same
   precedent moves.js's MOVES re-export above already set. */
export { ENEMIES } from './data_enemies.js';

/* Encounters (tech §3 schema, GDD §4.4) -- waves/spawn/win-condition data,
   consumed by encounter.js. `winCondition: 'killAll'` is the one
   implementation Phase 5 ships (see encounter.js); Rule Fights and GDD §15
   encounter objectives are future values of this same field, never a new
   field. A wave's enemy list is either a literal `types` array (ids or,
   for legacy solo boss/elite fights, a raw def object) or a `generate`
   budget/pool consumed by encounter_budget.js's composition generator at
   spawn time (the run's seed, not data, decides the actual pick). */
export const ENCOUNTERS = {
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
  /* Phase 8 deliverable 1: the map generator needs more than one Combat
     shape to draw from across 7-9 interior rows -- both entries are pure
     data over the same three Phase-5 enemies, no new engine path. */
  morioh_alley_scuffle: {
    id: 'morioh_alley_scuffle', label: 'ALLEYWAY SCUFFLE', winCondition: 'killAll',
    waves: [{ generate: { budget: 3, pool: ['morioh_thug', 'knife_thug'] } }]
  },
  kameyu_loading_dock: {
    id: 'kameyu_loading_dock', label: 'LOADING DOCK', winCondition: 'killAll',
    waves: [{ generate: { budget: 6, pool: ['morioh_thug', 'knife_thug', 'brute'] } }]
  }
};

/* Modifiers apply at node-spawn time for perceived variety without
   hand-authoring new enemy types, per §13. */
export const MODIFIERS = {
  aggressive: { label: '(AGGRESSIVE)', hpMult: 1, speedMult: 1.35, tint: PAL.lred }
};

/* Boss — one bespoke signature move (sheer_heart_attack) layered on the
   shared pattern library, phase transition tied to an explicit cue per §9.

   Phase 6 (GDD §4.6): 3 phases, each testing something different.
   Phase 1 is pattern reading (the existing sweep/slam/projectile trio).
   Phase 2 debuts the one bespoke signature AND a rule (ai.js's `hazard`
   field on sheer_heart_attack, resolved generically by hazards.js).
   Phase 3 exposes Kira himself (boss_parts.js's `parts`) -- the design
   payoff, a positioning puzzle on the belt plane's existing depth axis,
   not a fourth attack pattern. Each phase entry owns its own
   `transitionLine` (combat_enemy.js) so the two separate transitions read
   as two distinct in-character beats instead of sharing one string. */
export const BOSS_KILLER_QUEEN = {
  id: 'killer_queen', character: 'Yoshikage Kira', standName: 'Killer Queen',
  source: 'Diamond is Unbreakable (Part 4)',
  hp: 200, power: 9, speedPx: 140, precision: 8, poise: 70,
  phases: [
    { hpAbove: 0.66, attackPatterns: ['sweep', 'telegraphed_slam', 'projectile'] },
    {
      hpAbove: 0.33, attackPatterns: ['sweep', 'telegraphed_slam', 'projectile', 'sheer_heart_attack'],
      transitionLine: 'KIRA: "I JUST WANT TO LIVE QUIETLY."'
    },
    {
      hpAbove: 0, attackPatterns: ['sweep', 'telegraphed_slam', 'projectile', 'sheer_heart_attack'],
      transitionLine: 'KIRA: "...THEN I\'LL FINISH THIS MYSELF."'
    }
  ],
  /* GDD §18B deliverable 4: fixed HP fraction, independent of the phase
     boundaries above, so it lands as its own beat (mid-Phase-2 here)
     rather than doubling up with a phase-transition banner. Sheer Heart
     Attack's canon "Defend Mode" (curls into an invulnerable steel ball)
     is the in-fiction hook for "clears own statuses, 6s immunity". */
  purgeAtHpFrac: 0.5,
  purgeLine: 'KILLER QUEEN: SHEER HEART ATTACK -- DEFEND MODE',
  /* Deliverable 2's exposed User: Kira himself, a small hurtbox hiding
     directly behind Killer Queen on the depth axis (dz, world units) --
     reachable only by a player who repositions in z, not by trading blows
     at the resting depth. Same shared HP pool as the Stand, at x3. */
  parts: [
    { id: 'kira', label: 'KIRA', revealAtPhase: 2, dx: 0, dz: 56, w: 14, h: 30, dmgMult: 3 }
  ]
};

/* RUN_BUFFS (the prototype's placeholder "taste of Build Diversity" --
   three bespoke flat multipliers) is retired as of Phase 7: fragments.js's
   real 12-Fragment pool is the actual system it was standing in for. The
   cat event's 'PET IT' choice now routes into the same Fragment offer
   flow every combat/elite/boss node clear does (index.js), rather than
   an instant no-choice grant. */
export const EVENTS = {
  stray_cat: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A cat watches you from the alley mouth. Its front paw glints — not fur. Metal.',
    choices: [
      { label: 'PET IT', kind: 'fragment', flavor: 'The cat purrs static. Something in your Stand feels sharper.' },
      { label: 'WALK AWAY', kind: 'heal', amount: 12, flavor: 'Nothing happens. You catch your breath instead.' }
    ]
  },
  /* Phase 8: a map with 2-3 Bizarre Encounter nodes per run needs more
     than one event so they don't all read as the same cat. */
  vending_machine: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A vending machine hums a tune that was never recorded. It takes no coins, only intent.',
    choices: [
      { label: 'FEED IT INTENT', kind: 'fragment', flavor: 'Something drops. It was never in the machine to begin with.' },
      { label: 'UNPLUG IT', kind: 'heal', amount: 12, flavor: 'The hum stops. You feel steadier for it.' }
    ]
  },
  rokakaka_stand: {
    title: 'BIZARRE ENCOUNTER',
    text: 'A fruit stand sells something that looks like a durian but definitely isn’t.',
    choices: [
      { label: 'TASTE IT', kind: 'fragment', flavor: 'The world resets by exactly one wrong decision. Yours, apparently.' },
      { label: 'WALK ON', kind: 'heal', amount: 12, flavor: 'Morioh stays quiet. You keep walking.' }
    ]
  }
};

/* Act 1 — Morioh streets (Diamond is Unbreakable), §3. As of Phase 8 this
   is just the act's identity/flavour; the node graph itself is generated
   per seed by map_gen.js/map_data.js, never authored here. */
export const ACT1_MORIOH = {
  id: 'morioh', name: 'MORIOH — DIAMOND IS UNBREAKABLE'
};

export const NODE_ICON_COLOR = {
  combat: PAL.lred, elite: PAL.yellow, event: PAL.lcyan,
  rest: PAL.lgreen, boss: PAL.lmagenta, treasure: PAL.yellow,
  shop: PAL.lgreen, archive: PAL.dgray
};
