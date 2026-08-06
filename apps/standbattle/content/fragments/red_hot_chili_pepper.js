/* Red Hot Chili Pepper (Akira) — Electricity. Phase 10. Charge stacks,
   chain damage across the crowd, the tether-as-live-wire identity (GDD
   §6.1's own example donor: "the tether becomes a live wire dealing
   Charge to anything crossing it -- a Fragment that only exists because
   of the core mechanic, the leash is a weapon"). */

export const RED_HOT_CHILI_PEPPER_FRAGMENTS = [
  {
    id: 'frag_red_hot_chili_pepper_light', donor: 'red_hot_chili_pepper', slot: 'light',
    name: 'Live Current', rarity: 'common', tags: ['single-target'],
    levelDesc: [
      'Light hits apply 1 Charge.',
      'Light hits apply 2 Charge.',
      'Light hits apply 3 Charge. Your Light chain has no cap.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'light', status: 'charge', stacks: [1, 2, 3] } }
    ],
    queries: [
      { hook: 'getChainCap', fn: 'removeCapForSlot', minLevel: 3, data: { slot: 'light' } }
    ]
  },
  {
    id: 'frag_red_hot_chili_pepper_step', donor: 'red_hot_chili_pepper', slot: 'step',
    name: 'Static Step', rarity: 'common', tags: ['mobility', 'economy'],
    levelDesc: [
      'Step grants 6 Momentum.',
      'Step grants 10 Momentum.',
      'Step grants 14 Momentum and applies 1 Charge to the nearest enemy.'
    ],
    effects: [
      { hook: 'onStepStart', fn: 'grantResource', data: { resource: 'momentum', amount: [6, 10, 14] } },
      { hook: 'onStepStart', fn: 'applyStatusToNearby', minLevel: 3, data: { status: 'charge', stacks: 1, count: 1 } }
    ]
  },
  {
    id: 'frag_red_hot_chili_pepper_medium', donor: 'red_hot_chili_pepper', slot: 'medium',
    name: 'Short Circuit', rarity: 'rare', tags: ['economy'],
    levelDesc: [
      'Medium consumes the target\'s Charge for +3 damage and +1 Persistence per stack.',
      'Medium consumes the target\'s Charge for +5 damage and +2 Persistence per stack.',
      'Medium consumes the target\'s Charge for +8 damage and +3 Persistence per stack, then immediately re-Charges it with 1 fresh stack -- the circuit never fully discharges.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'charge', dmgPerStack: [3, 5, 8], persistencePerStack: [1, 2, 3] } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', minLevel: 3, data: { slot: 'medium', status: 'charge', stacks: 1 } }
    ]
  },
  {
    id: 'frag_red_hot_chili_pepper_special_1', donor: 'red_hot_chili_pepper', slot: 'special_1',
    name: 'Discharge Barrage', rarity: 'rare', tags: ['single-target'],
    levelDesc: [
      'Each hit of Special 1 applies 1 Charge. Hits against a Charged target deal +15% damage.',
      'Each hit of Special 1 applies 1 Charge. Hits against a Charged target deal +25% damage.',
      'Each hit of Special 1 applies 2 Charge. Hits against a Charged target deal +40% damage and grant 3 Persistence -- the barrage starts paying you back.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'special_1', status: 'charge', stacks: [1, 1, 2] } },
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', minLevel: 3, data: { status: 'charge', resource: 'persistence', amount: 3 } }
    ],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'charge', minStacks: 1, mult: [1.15, 1.25, 1.4] } }
    ]
  },
  {
    id: 'frag_red_hot_chili_pepper_rush', donor: 'red_hot_chili_pepper', slot: 'rush',
    name: 'Surge Rush', rarity: 'rare', tags: ['crowd', 'economy'],
    levelDesc: [
      'Each Stand Rush hit applies 1 Charge and arcs 2 damage to the nearest enemy.',
      'Each Stand Rush hit applies 2 Charge and arcs 4 damage to the nearest 2 enemies.',
      'Each Stand Rush hit applies 3 Charge and arcs 6 damage to the nearest 3 enemies, and refunds 2 Persistence.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'rush', status: 'charge', stacks: [1, 2, 3] } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: [2, 4, 6], count: [1, 2, 3], radius: 50, from: 'target' } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 3, data: { slot: 'rush', resource: 'persistence', amount: 2 } }
    ]
  },
  {
    id: 'frag_red_hot_chili_pepper_heavy', donor: 'red_hot_chili_pepper', slot: 'heavy',
    name: 'Chain Lightning', rarity: 'epic', tags: ['crowd'],
    levelDesc: [
      'Heavy hits apply 1 Charge to the target and arc 1 stack to the nearest other enemy (radius 60).',
      'Heavy hits apply 2 Charge to the target and arc 2 stacks to the nearest 2 other enemies (radius 60).',
      'Heavy hits apply 3 Charge to the target and arc 3 stacks to the nearest 2 other enemies (radius 60); each arced enemy also takes 4 chain damage.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'heavy', status: 'charge', stacks: [1, 2, 3] } },
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'charge', stacks: [1, 2, 3], count: [1, 2, 2], radius: 60, from: 'target' } },
      { hook: 'onHitLanded', fn: 'damageNearby', minLevel: 3, data: { amount: 4, count: 2, radius: 60, from: 'target' } }
    ]
  },
  {
    id: 'frag_red_hot_chili_pepper_special_2', donor: 'red_hot_chili_pepper', slot: 'special_2',
    name: 'Overload', rarity: 'epic', tags: ['crowd', 'economy'],
    levelDesc: [
      'Special 2 detonates the target\'s Charge for +4 damage and +1 Persistence per stack, and arcs 3 damage to the nearest enemy.',
      'Detonates for +6 damage and +2 Persistence per stack, and arcs 5 damage to the nearest 2 enemies.',
      'Detonates for +9 damage and +3 Persistence per stack, and arcs 8 damage to the nearest 3 enemies -- each arced enemy is left with 1 Charge of its own.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'charge', dmgPerStack: [4, 6, 9], persistencePerStack: [1, 2, 3] } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: [3, 5, 8], count: [1, 2, 3], radius: 60, from: 'target' } },
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', minLevel: 3, data: { status: 'charge', stacks: 1, count: 3, radius: 60, from: 'target' } }
    ]
  },
  /* The Fragment that could only exist because of the leash -- GDD §6.1's
     own Red Hot Chili Pepper example, reproduced close to literally: "the
     tether becomes a live wire dealing Charge to anything crossing it".
     onTetherStrain fires exclusively while genuinely over-extending
     Project's tether (Sticky Fingers' Live Wire, content/fragments/
     sticky_fingers.js's frag_sticky_fingers_aura, is the model this
     copies the shape of -- Broken swapped for Charge). */
  {
    id: 'frag_red_hot_chili_pepper_aura', donor: 'red_hot_chili_pepper', slot: 'aura',
    name: 'Downed Line', rarity: 'legendary', tags: ['projection', 'risk'],
    tradeoff: 'Only active while Straining the tether -- which already costs Persistence per second and drags you toward your Stand.',
    levelDesc: [
      'While Straining the tether, it becomes a live wire: the nearest enemy crossing it takes 1 Charge.',
      'While Straining the tether, the nearest enemy crossing it takes 2 Charge.',
      'While Straining the tether, the nearest 2 enemies crossing it take 3 Charge each, and the nearest is left Broken.'
    ],
    effects: [
      { hook: 'onTetherStrain', fn: 'applyStatusToNearby', data: { status: 'charge', stacks: [1, 2, 3], count: [1, 1, 2] } },
      { hook: 'onTetherStrain', fn: 'markNearestBroken', minLevel: 3, data: { count: 1 } }
    ]
  }
];
