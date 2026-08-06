/* Echoes ACT3 (Koichi) — Gravity. Phase 10. Slow/ground/pull the crowd
   together (GDD §6.1). Every clause routes through the boolean Gravity
   status (status.js: refresh rule, maxStacks 1, no self-tick) via the
   generic apply/consume/bonus-vs-status verbs item_effect_lib.js built for
   it -- applyStatusToNearby is the "gravity well pulls the crowd together"
   primitive (Special/Step/Aura), consumeStatusForBonus/bonusIfDefenderStatus
   are the "grounded = extra damage" payoff (Medium/Light/Special 1). */

export const ECHOES_ACT3_FRAGMENTS = [
  {
    id: 'frag_echoes_act3_light', donor: 'echoes_act3', slot: 'light',
    name: 'Weighted Jab', rarity: 'common', tags: ['crowd'],
    levelDesc: [
      'Light hits apply Gravity. Grounded enemies take 15% more damage from you.',
      'Light hits apply Gravity. Grounded enemies take 25% more damage from you.',
      'Light hits apply Gravity. Grounded enemies take 40% more damage from you. Your Light chain has no cap.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'light', status: 'gravity' } }
    ],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'gravity', minStacks: 1, mult: [1.15, 1.25, 1.4] } },
      { hook: 'getChainCap', fn: 'removeCapForSlot', minLevel: 3, data: { slot: 'light' } }
    ]
  },
  {
    id: 'frag_echoes_act3_medium', donor: 'echoes_act3', slot: 'medium',
    name: 'Collapsing Blow', rarity: 'rare', tags: ['crowd', 'economy'],
    levelDesc: [
      'Medium consumes the target\'s Gravity for +4 damage and +1 Persistence.',
      'Medium consumes the target\'s Gravity for +7 damage and +2 Persistence.',
      'Medium consumes the target\'s Gravity for +11 damage and +3 Persistence, and grants 6 Momentum.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'gravity', dmgPerStack: [4, 7, 11], persistencePerStack: [1, 2, 3] } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 3, data: { slot: 'medium', resource: 'momentum', amount: 6 } }
    ]
  },
  {
    id: 'frag_echoes_act3_heavy', donor: 'echoes_act3', slot: 'heavy',
    name: 'Grounding Slam', rarity: 'rare', tags: ['crowd', 'economy'],
    levelDesc: [
      'Heavy applies Gravity to the target.',
      'Heavy applies Gravity to the target and grants 8 Persistence per hit.',
      'Heavy applies Gravity to the target, and grants 8 Persistence and 8 Momentum per hit.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'heavy', status: 'gravity' } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 2, data: { slot: 'heavy', resource: 'persistence', amount: 8 } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 3, data: { slot: 'heavy', resource: 'momentum', amount: 8 } }
    ]
  },
  {
    id: 'frag_echoes_act3_special_1', donor: 'echoes_act3', slot: 'special_1',
    name: 'Gravity Well', rarity: 'epic', tags: ['crowd'],
    levelDesc: [
      'Special hits pull in and ground the 2 nearest enemies with Gravity.',
      'Special hits pull in and ground the 3 nearest enemies with Gravity.',
      'Special hits pull in and ground the 4 nearest enemies with Gravity. Grounded enemies are easier to stagger, you deal 30% more poise damage to them.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'gravity', count: [2, 3, 4], radius: 90 } }
    ],
    queries: [
      { hook: 'getPoiseDamage', fn: 'bonusIfDefenderStatus', minLevel: 3, data: { status: 'gravity', minStacks: 1, mult: 1.3 } }
    ]
  },
  {
    id: 'frag_echoes_act3_special_2', donor: 'echoes_act3', slot: 'special_2',
    name: 'Collapsing Singularity', rarity: 'legendary', tags: ['crowd'],
    levelDesc: [
      'Special 2 detonates a gravity well: grounds the 3 nearest enemies with Gravity and deals 6 damage to each.',
      'Grounds the 4 nearest enemies with Gravity and deals 10 damage to each.',
      'Grounds the 5 nearest enemies with Gravity and deals 16 damage to each, and the well collapses inward, pulling you instantly to the target.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'gravity', count: [3, 4, 5], radius: 100 } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: [6, 10, 16], count: [3, 4, 5], radius: 100 } },
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', minLevel: 3, data: { standoff: 20 } }
    ]
  },
  {
    id: 'frag_echoes_act3_step', donor: 'echoes_act3', slot: 'step',
    name: 'Undertow', rarity: 'common', tags: ['crowd', 'mobility'],
    levelDesc: [
      'Stepping grounds the nearest enemy with Gravity.',
      'Stepping grounds the 2 nearest enemies with Gravity, pulled from a wider radius.',
      'Stepping grounds the 3 nearest enemies with Gravity, pulled from an even wider radius.'
    ],
    effects: [
      { hook: 'onStepStart', fn: 'applyStatusToNearby', data: { status: 'gravity', count: [1, 2, 3], radius: [50, 65, 80] } }
    ]
  },
  {
    id: 'frag_echoes_act3_clash', donor: 'echoes_act3', slot: 'clash',
    name: 'Static Collapse', rarity: 'rare', tags: ['crowd', 'economy'],
    levelDesc: [
      'A successful Clash grounds your opponent with Gravity.',
      'A successful Clash grounds your opponent with Gravity and grants you 6 Persistence.',
      'A successful Clash grounds your opponent with Gravity and grants you 10 Persistence. A Perfect Clash instead grounds the 3 nearest enemies.'
    ],
    effects: [
      { hook: 'onClashSuccess', fn: 'applyStatusToNearby', data: { status: 'gravity', count: 1, radius: 60 } },
      { hook: 'onClashSuccess', fn: 'grantResource', minLevel: 2, data: { resource: 'persistence', amount: [0, 6, 10] } },
      { hook: 'onPerfectClash', fn: 'applyStatusToNearby', minLevel: 3, data: { status: 'gravity', count: 3, radius: 90 } }
    ]
  },
  {
    id: 'frag_echoes_act3_aura', donor: 'echoes_act3', slot: 'aura',
    name: 'Collapsing Field', rarity: 'epic', tags: ['crowd'],
    levelDesc: [
      'When an enemy dies, the crowd around it collapses inward: the 2 nearest survivors are grounded with Gravity and take 5 damage.',
      'The 3 nearest survivors are grounded with Gravity and take 9 damage.',
      'The 4 nearest survivors are grounded with Gravity and take 14 damage, and the kill itself grants 8 Momentum -- the collapse feeds back into you.'
    ],
    effects: [
      { hook: 'onKill', fn: 'applyStatusToNearby', data: { status: 'gravity', count: [2, 3, 4], radius: 90, from: 'target' } },
      { hook: 'onKill', fn: 'damageNearby', data: { amount: [5, 9, 14], count: [2, 3, 4], radius: 90, from: 'target' } },
      { hook: 'onKill', fn: 'grantResource', minLevel: 3, data: { resource: 'momentum', amount: 8 } }
    ]
  }
];
