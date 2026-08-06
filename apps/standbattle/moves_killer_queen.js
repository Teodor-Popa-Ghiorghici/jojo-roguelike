/* Killer Queen (Yoshikage Kira, playable) — Mid-Range trickster, spec
   §2.2/§2.3. Canon note: this is the same Stand as data_bosses.js's boss
   encounter, in the separate STANDS registry -- playable archetype and
   in-fiction story boss are not mutually exclusive for Kira (spec §2.2's
   explicit call-out). Its Special is Sheer Heart Attack -- the bomb-
   conversion pursuit is data_bosses.js's homing hazard on the enemy side,
   which the player-move system has no equivalent for yet, so this reads
   as the single heaviest-hitting Special in the roster instead (flagged
   scope gap, phase-9d.md). Its Rush is Bites the Dust: spec explicitly
   forbids this being "a raw damage tool" -- it's a small hit plus the one
   real utility payoff (a single lethal-hit negation, `kq_innate.js`),
   never a numbers finisher like the other three Stands' rush moves. */

export const MOVES_KILLER_QUEEN = {
  kq_light: {
    id: 'kq_light', slot: 'light', type: 'light', reachMult: 1.05,
    frames: 16,
    hitboxes: [{ from: 6, to: 8, x: null, z: 0, w: null, dmg: 4, poise: 5, tags: ['light', 'melee'] }],
    cancels: [{ from: 12, into: ['light', 'medium', 'special'], requires: 'hit', maxSelfChain: 3 }],
    armor: null,
    costs: { persistence: 0 }, gains: { persistence: 5, momentum: 8 },
    knockback: 9, hitstopMs: 55, label: 'TOUCH'
  },
  kq_medium: {
    id: 'kq_medium', slot: 'medium', type: 'medium', reachMult: 1.12,
    frames: 25,
    hitboxes: [{ from: 9, to: 12, x: null, z: 0, w: null, dmg: 7, poise: 9, tags: ['medium', 'melee'] }],
    cancels: [{ from: 16, into: ['heavy'], requires: 'hit' }],
    armor: null,
    costs: { persistence: 0 }, gains: { persistence: 8, momentum: 8 },
    knockback: 15, hitstopMs: 68, label: 'PRIME'
  },
  kq_heavy: {
    id: 'kq_heavy', slot: 'heavy', type: 'heavy', reachMult: 1.22,
    frames: 40,
    hitboxes: [{ from: 16, to: 20, x: null, z: 0, w: null, dmg: 14, poise: 18, tags: ['heavy', 'melee'] }],
    cancels: [],
    armor: { from: 7, to: 20 },
    costs: { persistence: 0 }, gains: { persistence: 12, momentum: 8 },
    knockback: 26, hitstopMs: 105, label: 'DETONATE'
  },
  kq_special: {
    id: 'kq_special', slot: 'special_1', type: 'special', reachMult: 1.18,
    frames: 34, // one heavy payoff hit -- the single biggest special-slot number in the roster
    hitboxes: [{ from: 26, to: 28, x: null, z: 0, w: null, dmg: 16, poise: 14, tags: ['special', 'melee'] }],
    cancels: [],
    armor: null,
    costs: { persistence: 35 }, gains: { persistence: 0, momentum: 12 },
    knockback: 20, hitstopMs: 95, label: 'SHEER HEART ATTACK'
  },
  kq_bites_the_dust: {
    id: 'kq_bites_the_dust', slot: 'rush', type: 'rush', reachMult: 1.0,
    frames: 30,
    hitboxes: [{ from: 20, to: 22, x: null, z: 0, w: null, dmg: 5, poise: 4, tags: ['rush', 'melee'] }],
    cancels: [],
    armor: null,
    costs: { persistence: 40, momentum: 100 }, gains: { persistence: 0, momentum: 0 },
    knockback: 6, hitstopMs: 90, label: 'BITES THE DUST'
  }
};
