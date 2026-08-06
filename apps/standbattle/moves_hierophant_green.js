/* Hierophant Green (Noriaki Kakyoin) — Long-Range zoner, spec §2.2/§2.3.
   Canon hooks: chain-limb extension on every normal (by far the longest
   `reachMult` in the roster -- there is no player-side traveling
   projectile in this engine yet, so "zoning" reads entirely through reach,
   same mechanism every Stand's reach already goes through, just leaned
   much harder) and Emerald Splash as the ranged Special/Rush signature,
   its multi-hit spread expressed as several hitbox windows the way
   sp_barrage's 4-hit windows already are. stand_classes.js's `long` scheme
   applies its own -35% damage baseline on top of these numbers. */

export const MOVES_HIEROPHANT_GREEN = {
  hg_light: {
    id: 'hg_light', slot: 'light', type: 'light', reachMult: 1.65,
    frames: 18, // longer limb extension costs a little startup versus SP's jab
    hitboxes: [{ from: 7, to: 9, x: null, z: 0, w: null, dmg: 4, poise: 4, tags: ['light', 'melee'] }],
    cancels: [{ from: 13, into: ['light', 'medium', 'special'], requires: 'hit', maxSelfChain: 3 }],
    armor: null,
    costs: { persistence: 0 }, gains: { persistence: 5, momentum: 8 },
    knockback: 8, hitstopMs: 55, label: 'CHAIN JAB'
  },
  hg_medium: {
    id: 'hg_medium', slot: 'medium', type: 'medium', reachMult: 1.85,
    frames: 28, // 10 startup / 4 active / 14 recovery
    hitboxes: [{ from: 11, to: 14, x: null, z: 0, w: null, dmg: 7, poise: 8, tags: ['medium', 'melee'] }],
    cancels: [{ from: 18, into: ['heavy'], requires: 'hit' }],
    armor: null,
    costs: { persistence: 0 }, gains: { persistence: 8, momentum: 8 },
    knockback: 14, hitstopMs: 70, label: 'CHAIN WHIP'
  },
  hg_heavy: {
    id: 'hg_heavy', slot: 'heavy', type: 'heavy', reachMult: 2.05,
    frames: 44, // 17 startup / 5 active / 22 recovery -- the longest windup in the roster, the fairness floor's telegraph
    hitboxes: [{ from: 17, to: 21, x: null, z: 0, w: null, dmg: 13, poise: 16, tags: ['heavy', 'melee'] }],
    cancels: [],
    armor: { from: 8, to: 21 },
    costs: { persistence: 0 }, gains: { persistence: 12, momentum: 8 },
    knockback: 22, hitstopMs: 105, label: 'CHAIN SLAM'
  },
  hg_special: {
    id: 'hg_special', slot: 'special_1', type: 'special', reachMult: 2.20,
    frames: 34, // 6 startup / 20 active (4-hit spread) / 8 recovery
    hitboxes: [
      { from: 7, to: 8, x: null, z: 0, w: null, dmg: 5, poise: 3, tags: ['special', 'melee'] },
      { from: 12, to: 13, x: null, z: 0, w: null, dmg: 5, poise: 3, tags: ['special', 'melee'] },
      { from: 17, to: 18, x: null, z: 0, w: null, dmg: 5, poise: 3, tags: ['special', 'melee'] },
      { from: 22, to: 23, x: null, z: 0, w: null, dmg: 5, poise: 3, tags: ['special', 'melee'] }
    ],
    cancels: [],
    armor: null,
    costs: { persistence: 30 }, gains: { persistence: 0, momentum: 12 },
    knockback: 6, hitstopMs: 50, label: 'EMERALD SPLASH'
  },
  hg_rush: {
    id: 'hg_rush', slot: 'rush', type: 'rush', reachMult: 2.40,
    frames: 64, // 9 startup / 37 active (9-hit spread) / 18 recovery
    hitboxes: [10, 14, 18, 22, 26, 30, 34, 38, 42].map(from => (
      { from, to: from + 1, x: null, z: 0, w: null, dmg: 5, poise: 4, tags: ['rush', 'melee'] }
    )),
    cancels: [],
    armor: null,
    costs: { persistence: 80, momentum: 100 }, gains: { persistence: 0, momentum: 0 },
    knockback: 4, hitstopMs: 130, label: 'EMERALD SPLASH: FULL BLOOM'
  }
};
