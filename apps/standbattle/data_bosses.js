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

/* Phase 9d: 9 more bosses to reach GDD §3/§9's 10-total floor, 2-3 per
   Act (Act I's 2nd here; Acts II-IV's arenas/pools land in their own
   authoring batches, ACT_CONFIGS in map_data.js). Every entry below is
   the same shape as BOSS_KILLER_QUEEN above: module composition (ai.js's
   PATTERNS) + one bespoke signature + 3 phases, the last exposing the
   User. Canon note: Angelo (Act I's existing Elite) has no Stand in
   canon and stays an Elite rather than being promoted to a boss with a
   fabricated Stand ability -- see phase-9d.md. */

export const BOSS_YUYA_FUNGAMI = {
  id: 'yuya_fungami', character: 'Yuya Fungami', standName: 'Highway Star',
  source: 'Diamond is Unbreakable (Part 4)',
  hp: 160, power: 7, speedPx: 150, precision: 7, poise: 55,
  phases: [
    { hpAbove: 0.6, attackPatterns: ['sweep', 'quick_stab'] },
    { hpAbove: 0.25, attackPatterns: ['sweep', 'quick_stab', 'highway_star_dash'], transitionLine: 'FUNGAMI: "GET ON MY LEVEL!"' },
    { hpAbove: 0, attackPatterns: ['sweep', 'quick_stab', 'highway_star_dash'], transitionLine: 'FUNGAMI: "I\'M NOT LOSING TO A HIGH SCHOOLER!"' }
  ],
  purgeAtHpFrac: 0.45, purgeLine: 'HIGHWAY STAR REVS -- BRACING FOR IMPACT',
  parts: [{ id: 'yuya', label: 'FUNGAMI', revealAtPhase: 2, dx: 0, dz: 50, w: 14, h: 28, dmgMult: 3 }]
};

export const BOSS_HOL_HORSE = {
  id: 'hol_horse', character: 'Hol Horse', standName: 'The Emperor',
  source: 'Stardust Crusaders (Part 3)',
  hp: 150, power: 6, speedPx: 120, precision: 9, poise: 45,
  phases: [
    { hpAbove: 0.66, attackPatterns: ['projectile', 'quick_stab'] },
    { hpAbove: 0.33, attackPatterns: ['projectile', 'quick_stab', 'emperor_curveshot'], transitionLine: 'HOL HORSE: "MY BULLETS GO WHEREVER I WANT!"' },
    { hpAbove: 0, attackPatterns: ['projectile', 'quick_stab', 'emperor_curveshot'], transitionLine: 'HOL HORSE: "THIS IS GETTING ANNOYING..."' }
  ],
  purgeAtHpFrac: 0.5, purgeLine: 'THE EMPEROR RELOADS',
  parts: [{ id: 'hol_horse', label: 'HOL HORSE', revealAtPhase: 2, dx: 0, dz: 52, w: 14, h: 28, dmgMult: 3 }]
};

export const BOSS_NDOUL = {
  id: 'ndoul', character: "N'Doul", standName: 'Geb',
  source: 'Stardust Crusaders (Part 3)',
  hp: 170, power: 6, speedPx: 100, precision: 8, poise: 50,
  intangibleExceptActive: true, // Geb's sound-based, unseen form
  phases: [
    { hpAbove: 0.66, attackPatterns: ['projectile', 'sweep'] },
    { hpAbove: 0.33, attackPatterns: ['projectile', 'sweep', 'geb_drowning_wave'], transitionLine: "N'DOUL: \"ALLAH HAS GIVEN ME THIS POWER.\"" },
    { hpAbove: 0, attackPatterns: ['projectile', 'sweep', 'geb_drowning_wave'], transitionLine: "N'DOUL: \"YOU WILL DROWN ON DRY LAND.\"" }
  ],
  purgeAtHpFrac: 0.5, purgeLine: 'GEB COILS BACK, UNSEEN',
  parts: [{ id: 'ndoul', label: "N'DOUL", revealAtPhase: 2, dx: 0, dz: 54, w: 14, h: 28, dmgMult: 3 }]
};

export const BOSS_DIO = {
  id: 'dio', character: 'DIO', standName: 'The World',
  source: 'Stardust Crusaders (Part 3)',
  hp: 220, power: 10, speedPx: 160, precision: 9, poise: 80,
  phases: [
    { hpAbove: 0.66, attackPatterns: ['sweep', 'telegraphed_slam'] },
    { hpAbove: 0.33, attackPatterns: ['sweep', 'telegraphed_slam', 'the_world_time_stop'], transitionLine: 'DIO: "TIME HAS STOPPED!"' },
    { hpAbove: 0, attackPatterns: ['sweep', 'telegraphed_slam', 'the_world_time_stop'], transitionLine: 'DIO: "WRYYYYY!!"' }
  ],
  purgeAtHpFrac: 0.5, purgeLine: 'DIO STEADIES HIMSELF -- THE WORLD RESUMES',
  parts: [{ id: 'dio', label: 'DIO', revealAtPhase: 2, dx: 0, dz: 58, w: 14, h: 30, dmgMult: 3 }]
};

export const BOSS_FORMAGGIO = {
  id: 'formaggio', character: 'Formaggio', standName: 'Little Feet',
  source: 'Golden Wind (Part 5)',
  hp: 140, power: 5, speedPx: 110, precision: 6, poise: 40,
  phases: [
    { hpAbove: 0.66, attackPatterns: ['sweep', 'quick_stab'] },
    { hpAbove: 0.33, attackPatterns: ['sweep', 'quick_stab', 'little_feet_shrink_zone'], transitionLine: 'FORMAGGIO: "YOU\'LL FIT RIGHT IN THE TRASH."' },
    { hpAbove: 0, attackPatterns: ['sweep', 'quick_stab', 'little_feet_shrink_zone'], transitionLine: 'FORMAGGIO: "SHRINKING AWAY, ARE YOU?"' }
  ],
  purgeAtHpFrac: 0.5, purgeLine: 'LITTLE FEET RECOILS',
  parts: [{ id: 'formaggio', label: 'FORMAGGIO', revealAtPhase: 2, dx: 0, dz: 48, w: 14, h: 28, dmgMult: 3 }]
};

export const BOSS_ILLUSO = {
  id: 'illuso', character: 'Illuso', standName: 'Man in the Mirror',
  source: 'Golden Wind (Part 5)',
  hp: 145, power: 5, speedPx: 105, precision: 6, poise: 42,
  /* Bespoke signature: mirror-image duplicates, via the exact `summon`
     field Puppeteer/Caller already generalized (Phase 9b) -- a boss using
     the same mechanism its own roster's support enemies use is precisely
     "module composition", not a new one-off. */
  summon: { type: 'illuso_mirror', delayFrames: 240, intervalFrames: 280, max: 2, hpMult: 0.4 },
  phases: [
    { hpAbove: 0.66, attackPatterns: ['sweep', 'quick_stab'] },
    { hpAbove: 0.33, attackPatterns: ['sweep', 'quick_stab'], transitionLine: 'ILLUSO: "WHICH ONE OF US IS REAL?"' },
    { hpAbove: 0, attackPatterns: ['sweep', 'quick_stab'], transitionLine: 'ILLUSO: "STEP THROUGH THE GLASS."' }
  ],
  purgeAtHpFrac: 0.5, purgeLine: 'THE MIRROR STILLS',
  parts: [{ id: 'illuso', label: 'ILLUSO', revealAtPhase: 2, dx: 0, dz: 50, w: 14, h: 28, dmgMult: 3 }]
};

export const BOSS_DIAVOLO = {
  id: 'diavolo', character: 'Diavolo', standName: 'King Crimson',
  source: 'Golden Wind (Part 5)',
  hp: 230, power: 10, speedPx: 130, precision: 9, poise: 85,
  phases: [
    { hpAbove: 0.66, attackPatterns: ['sweep', 'telegraphed_slam'] },
    { hpAbove: 0.33, attackPatterns: ['sweep', 'telegraphed_slam', 'king_crimson_erase'], transitionLine: 'DIAVOLO: "TIME... HAS BEEN ERASED."' },
    { hpAbove: 0, attackPatterns: ['sweep', 'telegraphed_slam', 'king_crimson_erase'], transitionLine: 'DIAVOLO: "I WILL NOT ACCEPT DEATH!"' }
  ],
  purgeAtHpFrac: 0.5, purgeLine: 'KING CRIMSON RESETS ITS STANCE',
  parts: [{ id: 'diavolo', label: 'DIAVOLO', revealAtPhase: 2, dx: 0, dz: 60, w: 14, h: 30, dmgMult: 3 }]
};

export const BOSS_FUNNY_VALENTINE = {
  id: 'funny_valentine', character: 'Funny Valentine', standName: 'Dirty Deeds Done Dirt Cheap',
  source: 'Steel Ball Run',
  hp: 200, power: 8, speedPx: 125, precision: 8, poise: 60,
  // Bespoke signature: parallel-universe equivalents, the same `summon` mechanism Illuso's mirror images use above.
  summon: { type: 'valentine_parallel', delayFrames: 260, intervalFrames: 320, max: 2, hpMult: 0.45 },
  phases: [
    { hpAbove: 0.66, attackPatterns: ['sweep', 'telegraphed_slam', 'quick_stab'] },
    { hpAbove: 0.33, attackPatterns: ['sweep', 'telegraphed_slam', 'quick_stab'], transitionLine: 'VALENTINE: "FOR THE SAKE OF MY COUNTRY!"' },
    { hpAbove: 0, attackPatterns: ['sweep', 'telegraphed_slam', 'quick_stab'], transitionLine: 'VALENTINE: "I WILL BECOME THE ONE TRUE PRESIDENT!"' }
  ],
  purgeAtHpFrac: 0.5, purgeLine: 'ANOTHER VALENTINE STEPS BACK INTO LINE',
  parts: [{ id: 'valentine', label: 'VALENTINE', revealAtPhase: 2, dx: 0, dz: 56, w: 14, h: 28, dmgMult: 3 }]
};

export const BOSS_PUCCI = {
  id: 'pucci', character: 'Enrico Pucci', standName: 'Made in Heaven',
  source: 'Stone Ocean (Part 6) -- finale cameo only, spec §3',
  hp: 240, power: 10, speedPx: 170, precision: 9, poise: 80,
  phases: [
    { hpAbove: 0.66, attackPatterns: ['sweep', 'telegraphed_slam'] },
    { hpAbove: 0.33, attackPatterns: ['sweep', 'telegraphed_slam', 'made_in_heaven_acceleration'], transitionLine: 'PUCCI: "TIME MOVES FASTER NOW."' },
    { hpAbove: 0, attackPatterns: ['sweep', 'telegraphed_slam', 'made_in_heaven_acceleration'], transitionLine: 'PUCCI: "THE WORLD WILL BE REBORN."' }
  ],
  purgeAtHpFrac: 0.5, purgeLine: 'MADE IN HEAVEN STEADIES -- GRAVITY REASSERTS',
  parts: [{ id: 'pucci', label: 'PUCCI', revealAtPhase: 2, dx: 0, dz: 60, w: 14, h: 30, dmgMult: 3 }]
};

export const BOSSES = {
  killer_queen: BOSS_KILLER_QUEEN,
  yuya_fungami: BOSS_YUYA_FUNGAMI,
  hol_horse: BOSS_HOL_HORSE,
  ndoul: BOSS_NDOUL,
  dio: BOSS_DIO,
  formaggio: BOSS_FORMAGGIO,
  illuso: BOSS_ILLUSO,
  diavolo: BOSS_DIAVOLO,
  funny_valentine: BOSS_FUNNY_VALENTINE,
  pucci: BOSS_PUCCI
};
