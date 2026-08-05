/* Enemy definitions -- split out of data.js (Phase 9b) purely to keep both
   files under the repo's 300-line cap; re-exported from data.js so every
   existing `import { ENEMIES } from './data.js'` call site is untouched,
   the same precedent moves.js's MOVES re-export already set.

   attackPatterns reference the shared module library in ai.js -- per §9,
   boss variety comes from recombining these, not bespoke code per enemy.
   `poise` (GDD §3.9) is the hit count of poise damage the enemy can absorb
   before staggering -- resolved once by poise.js, never read as a raw
   number anywhere else.

   Phase 5 crowd fields (GDD §4.1/§4.4/§16), all optional/data-only so a
   fifth enemy type is a data entry, never an engine change:
   `profile`     -- token.js's weighting verb (profiles.js), default 'aggressor'
   `cost`        -- encounter_budget.js's generator budget unit
   `ranged`/`role`/`clashable` -- encounter_budget.js's composition rules
   `tokenPool`   -- 'melee' (default) or 'ranged' (token.js's separate pool)
   `shortName`   -- hud.js's crowd mini health-bar label
   `tint`        -- fighter.js's existing tint mechanism (already used by
                    MODIFIERS.aggressive in data.js), reused here so each
                    crowd type reads as visually distinct at a glance
                    without any new sprite art (render.js's drawFighter
                    already applies whatever tint an entity carries)

   Phase 9b fields (GDD §4.2, all optional/data-only, resolved generically
   at the handful of choke points named below -- a 15th enemy type is still
   just a data entry):
   `frontalBlock`          -- resolvers.js's resolveDamage: zero damage from
                              a non-flanking, non-Shielder-staggered hit
   `intangibleExceptActive`-- resolvers.js's resolveDamage: zero damage
                              except during this enemy's own active frames
   `explodeOnDeath`        -- encounter.js's installNativeAbilities (onKill,
                              effect_lib.js's explodeOnDeath -- the same
                              verb Bomb-Primed the affix uses)
   `onHitDrain`            -- encounter.js's installNativeAbilities
                              (onDamageTaken, effect_lib.js's
                              drainPersistenceOnHit)
   `summon`                -- summons.js's stepSummon: periodic/one-shot
                              mid-fight minion spawn */

import { PAL } from './cga_palette.js';

export const ENEMIES = {
  morioh_thug: {
    id: 'morioh_thug', name: 'MORIOH DELINQUENT', shortName: 'DELINQUENT', baseType: 'melee',
    hp: 40, power: 5, speedPx: 122, precision: 3, poise: 24,
    attackPatterns: ['sweep', 'telegraphed_slam'],
    profile: 'aggressor', cost: 2, clashable: true
  },
  angelo: {
    id: 'angelo', name: 'ANGELO', baseType: 'elite',
    hp: 78, power: 7, speedPx: 165, precision: 6, poise: 50,
    attackPatterns: ['sweep', 'projectile', 'telegraphed_slam']
  },
  /* Knife Thug (GDD §4.2 #2): fast, low HP, punishes greed -- opportunist
     profile means it holds its token back until the player is caught in a
     recovery/hitstun/stagger window (profiles.js), then commits its one
     quick pattern. */
  knife_thug: {
    id: 'knife_thug', name: 'KNIFE THUG', shortName: 'KNIFE THUG', baseType: 'melee',
    hp: 22, power: 4, speedPx: 168, precision: 4, poise: 14,
    attackPatterns: ['quick_stab'],
    profile: 'opportunist', cost: 1, clashable: true, tint: PAL.lcyan
  },
  /* Brute (GDD §4.2 #3): high poise, armored slam, must be respected --
     turtle profile means it rarely volunteers for a token and, once it
     has one, throws out its single heavy, armored, telegraphed pattern. */
  brute: {
    id: 'brute', name: 'BRUTE', shortName: 'BRUTE', baseType: 'melee',
    hp: 95, power: 8, speedPx: 96, precision: 5, poise: 60,
    attackPatterns: ['telegraphed_slam'],
    profile: 'turtle', cost: 4, clashable: true, tint: PAL.brown
  },
  /* Hound (GDD §4.2 #7, Phase 9a): a Stand-beast flanker -- the designed
     counterplay to a rooted/exposed User (Close's held Project, Long-
     Range's permanently separated second body). `ignoresToken` (read by
     token.js/combat_enemy.js) means it's never gated by the crowd's
     attack-token pool; `userTargetWeightMult` (combat_stand.js's
     resolveTarget) heavily -- not absolutely -- biases the aggro-weighted
     target split toward the User whenever both hurtboxes are hit. */
  hound: {
    id: 'hound', name: 'HOUND', shortName: 'HOUND', baseType: 'melee',
    hp: 30, power: 6, speedPx: 210, precision: 5, poise: 16,
    attackPatterns: ['quick_stab'],
    profile: 'aggressor', cost: 2, clashable: true, tint: PAL.lmagenta,
    ignoresToken: true, userTargetWeightMult: 20
  },
  /* Warden (GDD §4.2 #12, Phase 9a): anti-Project -- `detachedStandPunishMult`
     is read directly by resolvers.js's resolveDamage while its target's
     Stand is detached (the generic `standDetached` flag every Stand Class
     sets each frame, stand_classes.js: Close's held Project, Mid's flick,
     or Long-Range's permanent detachment), the counter to holding Project
     or kiting behind a detached Stand. */
  warden: {
    id: 'warden', name: 'WARDEN', shortName: 'WARDEN', baseType: 'melee',
    hp: 70, power: 7, speedPx: 110, precision: 5, poise: 46,
    attackPatterns: ['telegraphed_slam'],
    profile: 'turtle', cost: 3, clashable: true, tint: PAL.blue,
    detachedStandPunishMult: 1.7
  },
  /* Phase 9b -- roster to 14 types (GDD §4.2). Types 1/2/3/7/12 already
     existed (Delinquent/Knife Thug/Brute/Hound/Warden above); this is the
     remaining 9 (#4/5/6/8/9/10/11/13/14). Each is a pattern set +
     behaviour profile + stat lean per the mission -- nothing here reaches
     past the fields the header comment above already documents. */
  shielder: { // #4 -- frontal immunity; must be flanked (z-offset) or poise-broken
    id: 'shielder', name: 'SHIELDER', shortName: 'SHIELDER', baseType: 'melee',
    hp: 60, power: 6, speedPx: 90, precision: 4, poise: 50,
    attackPatterns: ['shield_advance'],
    profile: 'turtle', cost: 3, clashable: true, tint: PAL.blue,
    role: 'shielder', frontalBlock: true
  },
  sniper: { // #5 -- long telegraph, forces you to close (sniper_shot's 46f windup)
    id: 'sniper', name: 'SNIPER', shortName: 'SNIPER', baseType: 'melee',
    hp: 26, power: 6, speedPx: 100, precision: 6, poise: 12,
    attackPatterns: ['sniper_shot'],
    profile: 'spacer', cost: 3, clashable: true, tint: PAL.lcyan, ranged: true
  },
  zoner: { // #6 -- places a persistent hazard zone (ai.js's zone_denial, hazards.js)
    id: 'zoner', name: 'ZONER', shortName: 'ZONER', baseType: 'melee',
    hp: 32, power: 5, speedPx: 95, precision: 4, poise: 16,
    attackPatterns: ['zone_denial'],
    profile: 'spacer', cost: 3, clashable: true, tint: PAL.magenta, ranged: true
  },
  bomber: { // #8 -- plants Bomb-Primed-style charges; corpse-explodes on its own death
    id: 'bomber', name: 'BOMBER', shortName: 'BOMBER', baseType: 'melee',
    hp: 34, power: 5, speedPx: 105, precision: 4, poise: 18,
    attackPatterns: ['bomb_plant'],
    profile: 'aggressor', cost: 3, clashable: true, tint: PAL.lmagenta, ranged: true,
    explodeOnDeath: { dmg: 18, pctMaxHp: 0.08, radius: 60 }
  },
  puppeteer: { // #9 -- support profile, summons weak minions on a timer (summons.js)
    id: 'puppeteer', name: 'PUPPETEER', shortName: 'PUPPETEER', baseType: 'melee',
    hp: 44, power: 3, speedPx: 88, precision: 3, poise: 20,
    attackPatterns: ['sweep'],
    profile: 'support', cost: 3, clashable: true, tint: PAL.green,
    summon: { type: 'puppet_minion', delayFrames: 180, intervalFrames: 300, max: 2, hpMult: 0.5 }
  },
  /* Puppeteer's own summon fodder -- not counted among the 14 roster types
     (never picked by the budget generator's own pool), the same way
     BOSS_KILLER_QUEEN's `parts` aren't a "type" either. */
  puppet_minion: {
    id: 'puppet_minion', name: 'PUPPET', shortName: 'PUPPET', baseType: 'melee',
    hp: 14, power: 2, speedPx: 130, precision: 2, poise: 8,
    attackPatterns: ['quick_stab'],
    profile: 'aggressor', cost: 1, clashable: true, tint: PAL.green
  },
  duelist: { // #10 -- 1v1 mirror-flavoured kit (deviation: no real parry-your-parries engine this phase, see report)
    id: 'duelist', name: 'DUELIST', shortName: 'DUELIST', baseType: 'melee',
    hp: 58, power: 6, speedPx: 150, precision: 7, poise: 34,
    attackPatterns: ['quick_stab', 'sweep'],
    profile: 'opportunist', cost: 3, clashable: true, tint: PAL.lred
  },
  leech: { // #11 -- steals Persistence on hit (effect_lib.js's drainPersistenceOnHit)
    id: 'leech', name: 'LEECH', shortName: 'LEECH', baseType: 'melee',
    hp: 28, power: 4, speedPx: 140, precision: 4, poise: 14,
    attackPatterns: ['quick_stab'],
    profile: 'flanker', cost: 2, clashable: true, tint: PAL.green,
    onHitDrain: { amount: 8, healAttackerAmount: 5 }
  },
  phaser: { // #13 -- intangible except during its own active frames
    id: 'phaser', name: 'PHASER', shortName: 'PHASER', baseType: 'melee',
    hp: 36, power: 5, speedPx: 118, precision: 5, poise: 22,
    attackPatterns: ['quick_stab'],
    profile: 'opportunist', cost: 3, clashable: true, tint: PAL.dgray,
    intangibleExceptActive: true
  },
  caller: { // #14 -- harmless alone; summons reinforcements if not killed within 12s (720f)
    id: 'caller', name: 'CALLER', shortName: 'CALLER', baseType: 'melee',
    hp: 24, power: 2, speedPx: 80, precision: 2, poise: 10,
    attackPatterns: ['quick_stab'],
    profile: 'support', cost: 2, clashable: true, tint: PAL.yellow,
    role: 'caller', summon: { type: 'morioh_thug', delayFrames: 720, max: 1, hpMult: 1 }
  }
};
