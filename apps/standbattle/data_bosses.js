/* Boss definitions — split out of data.js (Phase 9d, same precedent
   data_enemies.js set in Phase 9b) now that the roster is headed to 10.
   Every boss here is: a module composition (ai.js's shared PATTERNS
   library) + exactly one bespoke signature move + 3 phases, the last of
   which exposes the boss's User (boss_parts.js). Re-exported from data.js
   so every existing `import { BOSS_KILLER_QUEEN } from './data.js'` call
   site is untouched. `BOSSES` is the id-keyed registry map_gen.js/
   run_flow.js resolve a node's `boss` field through generically -- a new
   boss is one more entry here, never a new lookup branch. */

/* Phase 6 (GDD §4.6): 3 phases, each testing something different.
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

export const BOSSES = {
  killer_queen: BOSS_KILLER_QUEEN
};
