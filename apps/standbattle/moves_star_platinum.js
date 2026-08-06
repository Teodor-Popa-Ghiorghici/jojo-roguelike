/* Star Platinum move definitions — split out of moves.js (Phase 9d) now
   that the roster is 4 Stands; see moves.js's header for the full frame-
   data timeline schema this and every other Stand's move file follows. */

export const MOVES_STAR_PLATINUM = {
  sp_light: {
    id: 'sp_light', slot: 'light', type: 'light', reachMult: 1.0,
    frames: 16, // 5 startup / 3 active / 8 recovery (GDD §3.6 table)
    hitboxes: [{ from: 6, to: 8, x: null, z: 0, w: null, dmg: 4, poise: 6, tags: ['light', 'melee'] }],
    cancels: [{ from: 12, into: ['light', 'medium', 'special'], requires: 'hit', maxSelfChain: 3 }],
    armor: null,
    costs: { persistence: 0 }, gains: { persistence: 5, momentum: 8 },
    knockback: 9, hitstopMs: 55, label: 'JAB'
  },
  sp_medium: {
    id: 'sp_medium', slot: 'medium', type: 'medium', reachMult: 1.10,
    frames: 27, // 9 startup / 4 active / 14 recovery
    hitboxes: [{ from: 10, to: 13, x: null, z: 0, w: null, dmg: 8, poise: 10, tags: ['medium', 'melee'] }],
    cancels: [{ from: 17, into: ['heavy'], requires: 'hit' }],
    armor: null,
    costs: { persistence: 0 }, gains: { persistence: 8, momentum: 8 },
    knockback: 16, hitstopMs: 70, label: 'STRIKE'
  },
  sp_heavy: {
    id: 'sp_heavy', slot: 'heavy', type: 'heavy', reachMult: 1.23,
    frames: 43, // 16 startup / 5 active / 22 recovery
    hitboxes: [{ from: 17, to: 21, x: null, z: 0, w: null, dmg: 15, poise: 20, tags: ['heavy', 'melee'] }],
    cancels: [],
    armor: { from: 8, to: 21 }, // absorbs one non-Heavy hit from frame 8 through its own active window
    costs: { persistence: 0 }, gains: { persistence: 12, momentum: 8 },
    knockback: 28, hitstopMs: 110, label: 'HEAVY'
  },
  sp_barrage: {
    id: 'sp_barrage', slot: 'special_1', type: 'special', reachMult: 1.06,
    frames: 34, // 5 startup / 16 active (4 hits) / 13 recovery
    hitboxes: [
      { from: 6, to: 7, x: null, z: 0, w: null, dmg: 4, poise: 3, tags: ['special', 'melee'] },
      { from: 10, to: 11, x: null, z: 0, w: null, dmg: 4, poise: 3, tags: ['special', 'melee'] },
      { from: 14, to: 15, x: null, z: 0, w: null, dmg: 4, poise: 3, tags: ['special', 'melee'] },
      { from: 18, to: 19, x: null, z: 0, w: null, dmg: 4, poise: 3, tags: ['special', 'melee'] }
    ],
    cancels: [],
    armor: null,
    costs: { persistence: 35 }, gains: { persistence: 0, momentum: 12 },
    knockback: 5, hitstopMs: 45, label: 'ORA BARRAGE'
  },
  sp_ora_rush: {
    id: 'sp_ora_rush', slot: 'rush', type: 'rush', reachMult: 1.26,
    frames: 63, // 8 startup / 37 active (9 hits) / 18 recovery
    hitboxes: [9, 13, 17, 21, 25, 29, 33, 37, 41].map(from => (
      { from, to: from + 1, x: null, z: 0, w: null, dmg: 5, poise: 4, tags: ['rush', 'melee'] }
    )),
    cancels: [],
    armor: null,
    /* Momentum-gated ultimate (spec §2.3 / GDD §3.11): costs the whole bar,
       not just Persistence -- resolvers.js/combat_player.js check and
       consume `costs.momentum` alongside `costs.persistence`. */
    costs: { persistence: 80, momentum: 100 }, gains: { persistence: 0, momentum: 0 },
    knockback: 4, hitstopMs: 130, label: 'ORA ORA ORA!'
  }
};
