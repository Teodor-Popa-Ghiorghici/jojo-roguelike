/* Silver Chariot (Jean Pierre Polnareff) — Mid-Range technician, spec
   §2.2/§2.3. Canon hooks: rapier thrusts (every normal) and the
   retractable-armor defensive tech (the `armor` field, already generic
   from Star Platinum's sp_heavy, carried through the whole kit instead of
   just the Heavy). Same frame-data timeline schema as moves.js's header
   documents -- a new Stand's moveset is pure data over that schema. */

export const MOVES_SILVER_CHARIOT = {
  sc_light: {
    id: 'sc_light', slot: 'light', type: 'light', reachMult: 1.15,
    frames: 14, // 5 startup / 2 active / 7 recovery -- Precision/Speed lean reads as the fastest jab in the roster
    hitboxes: [{ from: 5, to: 6, x: null, z: 0, w: null, dmg: 4, poise: 5, tags: ['light', 'melee'] }],
    cancels: [{ from: 10, into: ['light', 'medium', 'special'], requires: 'hit', maxSelfChain: 3 }],
    armor: null,
    costs: { persistence: 0 }, gains: { persistence: 5, momentum: 8 },
    knockback: 8, hitstopMs: 50, label: 'RAPIER JAB'
  },
  sc_medium: {
    id: 'sc_medium', slot: 'medium', type: 'medium', reachMult: 1.32,
    frames: 24, // 8 startup / 3 active / 13 recovery
    hitboxes: [{ from: 9, to: 11, x: null, z: 0, w: null, dmg: 7, poise: 9, tags: ['medium', 'melee'] }],
    cancels: [{ from: 15, into: ['heavy'], requires: 'hit' }],
    armor: null,
    costs: { persistence: 0 }, gains: { persistence: 8, momentum: 8 },
    knockback: 15, hitstopMs: 65, label: 'THRUST'
  },
  sc_heavy: {
    id: 'sc_heavy', slot: 'heavy', type: 'heavy', reachMult: 1.40,
    frames: 38, // 14 startup / 5 active / 19 recovery
    hitboxes: [{ from: 14, to: 18, x: null, z: 0, w: null, dmg: 14, poise: 18, tags: ['heavy', 'melee'] }],
    cancels: [],
    armor: { from: 6, to: 18 }, // the plate armor absorbs one non-Heavy hit through the lunge
    costs: { persistence: 0 }, gains: { persistence: 12, momentum: 8 },
    knockback: 24, hitstopMs: 100, label: 'LUNGING THRUST'
  },
  sc_special: {
    id: 'sc_special', slot: 'special_1', type: 'special', reachMult: 1.20,
    frames: 30, // long armored advance, one payoff hit at the end
    hitboxes: [{ from: 24, to: 25, x: null, z: 0, w: null, dmg: 10, poise: 8, tags: ['special', 'melee'] }],
    cancels: [],
    armor: { from: 0, to: 22 }, // retractable armor tech: armored for nearly the whole approach
    costs: { persistence: 30 }, gains: { persistence: 0, momentum: 12 },
    knockback: 12, hitstopMs: 70, label: 'ARMOR ADVANCE'
  },
  sc_hora_rush: {
    id: 'sc_hora_rush', slot: 'rush', type: 'rush', reachMult: 1.35,
    frames: 58, // 7 startup / 33 active (9 hits) / 18 recovery
    hitboxes: [8, 12, 16, 20, 24, 28, 32, 36, 40].map(from => (
      { from, to: from + 1, x: null, z: 0, w: null, dmg: 5, poise: 4, tags: ['rush', 'melee'] }
    )),
    cancels: [],
    armor: null,
    costs: { persistence: 75, momentum: 100 }, gains: { persistence: 0, momentum: 0 },
    knockback: 4, hitstopMs: 125, label: 'HORA HORA HORA!'
  }
};
