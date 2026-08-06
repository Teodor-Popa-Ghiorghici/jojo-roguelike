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
  },
  /* Phase 9d: the remaining 3 launch Stands (spec §2.2), each plugging
     into an existing stand_classes.js CONTROL_SCHEMES entry -- a 4th
     Stand is never a new class, just a pick among close/mid/long. */
  silver_chariot: {
    id: 'silver_chariot',
    character: 'Jean Pierre Polnareff',
    standName: 'Silver Chariot',
    role: 'rapier',
    controlScheme: 'mid',
    source: 'Stardust Crusaders (Part 3)',
    stats: { power: 6, speed: 9, range: 4, persistence: 6, precision: 9, devPotential: 3 },
    moves: { light: 'sc_light', medium: 'sc_medium', heavy: 'sc_heavy', special: 'sc_special' },
    standRush: 'sc_hora_rush',
    /* No bespoke sprite yet (same flagged gap as boss art, phase-6.md):
       render.js reuses Star Platinum/Jotaro's silhouette for every Stand,
       tinted per this field -- the same generic `.tint` silhouette-wash
       mechanism enemy/boss defs already use, not a new one. */
    tint: '#8FB8E8'
  },
  hierophant_green: {
    id: 'hierophant_green',
    character: 'Noriaki Kakyoin',
    standName: 'Hierophant Green',
    role: 'puppeteer',
    controlScheme: 'long',
    source: 'Stardust Crusaders (Part 3)',
    stats: { power: 4, speed: 5, range: 9, persistence: 7, precision: 6, devPotential: 3 },
    moves: { light: 'hg_light', medium: 'hg_medium', heavy: 'hg_heavy', special: 'hg_special' },
    standRush: 'hg_rush',
    tint: '#4FE07A'
  },
  /* Same character/Stand id as data_bosses.js's BOSS_KILLER_QUEEN --
     separate registries (STANDS vs BOSSES), no collision, and exactly the
     "playable AND story boss" case spec §2.2 calls out by name. */
  killer_queen: {
    id: 'killer_queen',
    character: 'Yoshikage Kira',
    standName: 'Killer Queen',
    role: 'trickster',
    controlScheme: 'mid',
    source: 'Diamond is Unbreakable (Part 4)',
    stats: { power: 6, speed: 6, range: 5, persistence: 7, precision: 7, devPotential: 4 },
    moves: { light: 'kq_light', medium: 'kq_medium', heavy: 'kq_heavy', special: 'kq_special' },
    standRush: 'kq_bites_the_dust',
    tint: '#FF6BA0',
    /* GDD §2.3: Bites the Dust must be a run-altering utility effect, not
       a raw damage tool -- combat.js installs this once per fight through
       the same seam a Fragment uses (installFragment), see
       item_effect_lib.js's armLethalSaveOnRush/preventLethalIfArmed. */
    innateAbilities: [
      { hook: 'onMoveStart', fn: 'armLethalSaveOnRush', data: {} },
      { hook: 'onDamageIncoming', fn: 'preventLethalIfArmed', data: {} }
    ]
  },
  /* Phase 10 (GDD §9.1): Stands 5-8, the Archive's headline unlocks. Each
     one is composition over the Phase 9d engine exactly as 9d was
     composition over 9a's -- a CONTROL_SCHEMES pick, its own stat line,
     its own innate ability, and a tint. FLAGGED GAP, inherited from 9d
     rather than introduced here: they reuse an existing moveset family
     (close -> Star Platinum's, mid -> Silver Chariot's, long -> Hierophant
     Green's) instead of carrying four bespoke ones, so they differ by
     stats, innate and Aspect rather than by animation. Authoring four more
     `moves_<id>.js` sets is a roster phase's work, not a meta phase's. */
  crazy_diamond: {
    id: 'crazy_diamond',
    character: 'Josuke Higashikata',
    standName: 'Crazy Diamond',
    role: 'restorer',
    controlScheme: 'close',
    source: 'Diamond is Unbreakable (Part 4)',
    stats: { power: 8, speed: 6, range: 2, persistence: 7, precision: 5, devPotential: 4 },
    moves: { light: 'sp_light', medium: 'sp_medium', heavy: 'sp_heavy', special: 'sp_barrage' },
    standRush: 'sp_ora_rush',
    tint: '#B7A0FF',
    /* "Return it to how it was" as a utility, never a heal-on-demand:
       combat.js's spawnAnchor is the only restore point that exists. */
    innateAbilities: [
      { hook: 'onPerfectClash', fn: 'returnToAnchor', data: {} }
    ]
  },
  gold_experience: {
    id: 'gold_experience',
    character: 'Giorno Giovanna',
    standName: 'Gold Experience',
    role: 'creator',
    controlScheme: 'close',
    source: 'Golden Wind (Part 5)',
    stats: { power: 6, speed: 7, range: 3, persistence: 8, precision: 6, devPotential: 5 },
    moves: { light: 'sp_light', medium: 'sp_medium', heavy: 'sp_heavy', special: 'sp_barrage' },
    standRush: 'sp_ora_rush',
    tint: '#FFD24A',
    innateAbilities: [
      { hook: 'onDamageTaken', fn: 'reflectPctDamageToAttacker', data: { pct: 0.2 } }
    ]
  },
  sticky_fingers: {
    id: 'sticky_fingers',
    character: 'Bruno Bucciarati',
    standName: 'Sticky Fingers',
    role: 'infiltrator',
    controlScheme: 'mid',
    source: 'Golden Wind (Part 5)',
    stats: { power: 7, speed: 7, range: 4, persistence: 6, precision: 7, devPotential: 4 },
    moves: { light: 'sc_light', medium: 'sc_medium', heavy: 'sc_heavy', special: 'sc_special' },
    standRush: 'sc_hora_rush',
    tint: '#3FC8D8',
    innateAbilities: [
      { hook: 'onHitResolve', fn: 'stripArmorIfBroken', data: {} }
    ]
  },
  hermit_purple: {
    id: 'hermit_purple',
    character: 'Joseph Joestar',
    standName: 'Hermit Purple',
    role: 'diviner',
    controlScheme: 'long',
    source: 'Stardust Crusaders (Part 3)',
    stats: { power: 3, speed: 6, range: 9, persistence: 8, precision: 8, devPotential: 5 },
    moves: { light: 'hg_light', medium: 'hg_medium', heavy: 'hg_heavy', special: 'hg_special' },
    standRush: 'hg_rush',
    tint: '#A64FD0',
    innateAbilities: [
      { hook: 'onProjectStart', fn: 'applyStatusToNearby', data: { status: 'mark', stacks: 1, count: 2, radius: 240 } }
    ]
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

/* Encounters moved to data_encounters.js (Phase 9d, 300-line cap, now one
   pool per Act) -- re-exported here so every existing
   `import { ENCOUNTERS } from './data.js'` call site is untouched. */
export { ENCOUNTERS } from './data_encounters.js';

/* Modifiers apply at node-spawn time for perceived variety without
   hand-authoring new enemy types, per §13. */
export const MODIFIERS = {
  aggressive: { label: '(AGGRESSIVE)', hpMult: 1, speedMult: 1.35, tint: PAL.lred }
};

/* Boss definitions moved to data_bosses.js (Phase 9d, roster headed to
   10) -- re-exported here so every existing `import { BOSS_KILLER_QUEEN }
   from './data.js'` call site is untouched, the same precedent moves.js/
   data_enemies.js's re-exports above already set. */
export { BOSS_KILLER_QUEEN, BOSSES } from './data_bosses.js';

/* Events moved to data_events.js (Phase 9d, 300-line cap, now one new
   event per Act) -- re-exported here so every existing
   `import { EVENTS } from './data.js'` call site is untouched. RUN_BUFFS
   (the prototype's placeholder "taste of Build Diversity") is retired as
   of Phase 7: fragments.js's real Fragment pool is the actual system it
   was standing in for. */
export { EVENTS } from './data_events.js';

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
