/* Requiems — GDD §6.2, tech §3's schema (extended: reuses the Duo
   `requires:[{donor}]` shape, 1 entry for a single-donor Requiem, 2 for a
   cross-donor one). 12 curated: one per donor (8) + 4 cross-donor.

   Rule rewrites, not numeric upgrades (mission deliverable 5) -- every
   entry changes what an existing mechanic DOES (time-stop no longer
   needs a Perfect Clash; a lethal hit is reverted instead of dealt;
   Step stops being a single-target tool) rather than scaling a number.
   Where GDD's own flagship line needed a mechanism this engine didn't
   have (periodic time-stop, lethal-damage prevention), Phase 10 added
   the primitive to item_effect_lib.js instead of reinterpreting it away
   -- see periodicTimeStop/preventLethalOnce there. Where a GDD line
   needed something structurally absent (per-instance status-duration
   overrides for "Virus never expires", enemy projectiles for "Gravity
   applies to enemy projectiles"), the entry below is an honest
   reinterpretation using the real verb vocabulary, flagged in its own
   `desc`.

   FLAGGED GAP (content-complete, not run-reachable): GDD's "Once per
   run, at the Act III Requiem Altar" has nowhere to fire from -- this
   game has no Act II/III yet, and the mission's DO NOT list forbids
   adding one. content_registry.js's installRequiem is real; nothing in
   run_flow.js calls it yet. Whichever phase adds Act III gets a real
   Altar to build on top of instead of inventing one blind. */

export const REQUIEMS = [
  {
    id: 'requiem_the_world', name: 'The World, Over Heaven', rarity: 'legendary',
    requires: [{ donor: 'the_world' }],
    desc: 'Time-stop no longer needs a Perfect Clash to happen at all -- every 25 real seconds, the world simply stops on its own, whether you\'ve earned it or not.',
    tags: ['time'],
    effects: [
      { hook: 'onCombatTick', fn: 'periodicTimeStop', data: { cycleSec: 25, frames: 90 } }
    ]
  },
  {
    id: 'requiem_purple_haze', name: 'Purple Haze Distortion', rarity: 'legendary',
    requires: [{ donor: 'purple_haze' }],
    desc: 'The virus stops being a dose you apply and becomes the air itself -- every hit floods the target with a full, maximal infection, no matter how it was already infected.',
    tags: ['virus'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusUnconditional', data: { status: 'virus', stacks: 15 } }
    ]
  },
  {
    id: 'requiem_sticky_fingers', name: "Sticky Fingers' Bizarre Freedom", rarity: 'legendary',
    requires: [{ donor: 'sticky_fingers' }],
    desc: 'The arena stops being a distance problem: every resolved hit, not just Medium, zips you to the target, and every Step fully refunds itself.',
    tags: ['mobility'],
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 20 } },
      { hook: 'onStepStart', fn: 'refundStepCharge', data: { amount: 2 } }
    ]
  },
  {
    id: 'requiem_echoes_act3', name: 'Echoes ACT4 (Reimagined)', rarity: 'legendary',
    requires: [{ donor: 'echoes_act3' }],
    desc: 'Gravity stops being something you aim: every Step now grounds the entire crowd at once, not just the nearest few -- there is no longer anywhere to stand that isn\'t under it.',
    tags: ['crowd'],
    effects: [
      { hook: 'onStepStart', fn: 'applyStatusToNearby', data: { status: 'gravity', stacks: 1, count: 12 } }
    ]
  },
  {
    id: 'requiem_crazy_diamond', name: 'Crazy Diamond, Unbreakable', rarity: 'legendary',
    requires: [{ donor: 'crazy_diamond' }],
    desc: 'Restoration stops being a fraction: every hit you land now heals you for the FULL amount of damage it deals, and your Stand no longer spends Persistence at all -- there is nothing left in this fight that can wear you down.',
    tags: ['heal', 'economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: 1.0 } }
    ],
    queries: [
      { hook: 'getPersistenceCost', fn: 'multiplyFlat', data: { mult: 0 } }
    ]
  },
  {
    id: 'requiem_gold_experience', name: 'Gold Experience Requiem', rarity: 'legendary',
    requires: [{ donor: 'gold_experience' }],
    desc: 'Enemy attacks that would kill you are reverted to zero -- once per encounter, whatever hit lands, it simply never happened.',
    tags: ['risk'],
    tradeoff: 'Only fires once per encounter -- the second lethal hit in the same fight goes through at full force.',
    effects: [
      { hook: 'onDamageIncoming', fn: 'preventLethalOnce', data: {} }
    ]
  },
  {
    id: 'requiem_red_hot_chili_pepper', name: 'Red Hot Chili Pepper, Grounded', rarity: 'legendary',
    requires: [{ donor: 'red_hot_chili_pepper' }],
    desc: 'The tether stops being conditional: it is a live wire at all times now, Charging the nearest enemy every single second you\'re in the fight, Straining or not.',
    tags: ['projection'],
    effects: [
      { hook: 'onCombatTick', fn: 'applyStatusToNearby', data: { status: 'charge', stacks: 1, count: 1 } }
    ]
  },
  {
    id: 'requiem_hermit_purple', name: "Hermit Purple's Full Reading", rarity: 'legendary',
    requires: [{ donor: 'hermit_purple' }],
    desc: 'Every reading lands: every hit you land now Marks its target unconditionally, and Marked targets take a real, permanent bonus from everything you throw at them.',
    tags: ['single-target'],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'mark', minStacks: 1, mult: 1.5 } }
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusUnconditional', data: { status: 'mark', stacks: 1 } }
    ]
  },
  {
    id: 'requiem_stopped_pandemic', name: 'Stopped Pandemic', rarity: 'legendary',
    requires: [{ donor: 'the_world' }, { donor: 'purple_haze' }],
    desc: 'A Perfect Clash no longer just stops time -- it detonates every stack of Virus on every nearby enemy for real damage, all at once, the instant the world goes still.',
    tags: ['time', 'virus'],
    effects: [
      { hook: 'onPerfectClash', fn: 'triggerTimeStop', data: { frames: 60 } },
      { hook: 'onPerfectClash', fn: 'applyStatusToNearby', data: { status: 'virus', stacks: 6, count: 5 } }
    ]
  },
  {
    id: 'requiem_absolute_diagnosis', name: 'Absolute Diagnosis', rarity: 'legendary',
    requires: [{ donor: 'purple_haze' }, { donor: 'hermit_purple' }],
    desc: 'Every landed hit now Marks AND fully infects the target in the same motion -- there is no longer a difference between reading someone and poisoning them.',
    tags: ['virus', 'single-target'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusUnconditional', data: { status: 'mark', stacks: 1 } },
      { hook: 'onHitLanded', fn: 'applyStatusUnconditional', data: { status: 'virus', stacks: 10 } }
    ]
  },
  {
    id: 'requiem_weighted_mercy', name: 'Weighted Mercy', rarity: 'legendary',
    requires: [{ donor: 'echoes_act3' }, { donor: 'crazy_diamond' }],
    desc: 'Every Step now grounds the whole crowd with Gravity AND heals you outright -- pin the room down and repair yourself in the exact same motion.',
    tags: ['crowd', 'heal'],
    effects: [
      { hook: 'onStepStart', fn: 'applyStatusToNearby', data: { status: 'gravity', stacks: 1, count: 8 } },
      { hook: 'onStepStart', fn: 'healEntity', data: { amount: 12 } }
    ]
  },
  {
    id: 'requiem_eternal_moment', name: 'Eternal Moment', rarity: 'legendary',
    requires: [{ donor: 'gold_experience' }, { donor: 'the_world' }],
    desc: 'A Perfect Clash now stops time completely AND heals you to the brim -- Life and Time stop competing for the same instant and both just happen at once.',
    tags: ['time', 'heal'],
    effects: [
      { hook: 'onPerfectClash', fn: 'triggerTimeStop', data: { frames: 60 } },
      { hook: 'onPerfectClash', fn: 'healEntity', data: { amount: 30 } }
    ]
  }
];
