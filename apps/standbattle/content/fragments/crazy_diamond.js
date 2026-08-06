/* Crazy Diamond (Josuke) — Restoration. Phase 10. Heal/repair/reposition
   identity (GDD §6.1): every clause routes through a real resource
   conversion or slot rewrite, never a flat heal alone (GDD §6.7 -- a bare
   "+4 HP on hit" would be exactly as additive as a bare damage bonus). */

export const CRAZY_DIAMOND_FRAGMENTS = [
  {
    id: 'frag_crazy_diamond_light', donor: 'crazy_diamond', slot: 'light',
    name: 'Quick Repair', rarity: 'common', tags: ['heal'],
    levelDesc: [
      'Hits heal you for 6% of the damage dealt.',
      'Hits heal you for 10% of the damage dealt.',
      'Hits heal you for 15% of the damage dealt.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: [0.06, 0.10, 0.15] } }
    ]
  },
  {
    id: 'frag_crazy_diamond_step', donor: 'crazy_diamond', slot: 'step',
    name: 'Undo the Cost', rarity: 'common', tags: ['heal', 'mobility', 'economy'],
    levelDesc: [
      'Stepping refunds 1 Step charge and heals you for 3 HP.',
      'Stepping refunds 1 Step charge and heals you for 6 HP.',
      'Stepping refunds 2 Step charges and heals you for 10 HP.'
    ],
    effects: [
      { hook: 'onStepStart', fn: 'refundStepCharge', data: { amount: [1, 1, 2] } },
      { hook: 'onStepStart', fn: 'healEntity', data: { amount: [3, 6, 10] } }
    ]
  },
  {
    id: 'frag_crazy_diamond_medium', donor: 'crazy_diamond', slot: 'medium',
    name: 'Corrective Strike', rarity: 'rare', tags: ['heal', 'economy'],
    levelDesc: [
      'Medium cures Virus from you.',
      'Medium cures Virus from you and grants 6 Persistence.',
      'Medium cures Virus from you and grants 12 Persistence. Also heals you for 8 HP.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 2, data: { slot: 'medium', resource: 'persistence', amount: [0, 6, 12] } },
      { hook: 'onHitLanded', fn: 'healEntity', minLevel: 3, data: { amount: 8 } }
    ]
  },
  {
    id: 'frag_crazy_diamond_heavy', donor: 'crazy_diamond', slot: 'heavy',
    name: 'Marked for Repair', rarity: 'rare', tags: ['heal', 'economy'],
    levelDesc: [
      'Heavy marks the target for repair (applies Mark).',
      'Heavy marks the target for repair (applies Mark) and heals you for 8% of damage dealt.',
      'Heavy marks the target for repair (applies Mark) and heals you for 14% of damage dealt. Also grants 8 Persistence.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'heavy', status: 'mark', stacks: 1 } },
      { hook: 'onHitResolve', fn: 'healPctOfDamage', minLevel: 2, data: { pct: [0, 0.08, 0.14] } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 3, data: { slot: 'heavy', resource: 'persistence', amount: 8 } }
    ]
  },
  {
    id: 'frag_crazy_diamond_special_1', donor: 'crazy_diamond', slot: 'special_1',
    name: 'Restoration Field', rarity: 'epic', tags: ['heal', 'economy'],
    levelDesc: [
      'Special 1 leaves behind a restoring mote (heals 10 HP, grants 4 Momentum on pickup).',
      'Special 1 leaves behind a restoring mote (heals 18 HP, grants 8 Momentum on pickup).',
      'Special 1 leaves behind a restoring mote (heals 28 HP, grants 12 Momentum on pickup) and heals you for 10 HP immediately on landing.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'spawnFriendlyMote', data: { at: 'attacker', radius: 20, lifeFrames: 600, healAmount: [10, 18, 28], momentumAmount: [4, 8, 12] } },
      { hook: 'onHitLanded', fn: 'healEntity', minLevel: 3, data: { amount: 10 } }
    ]
  },
  {
    id: 'frag_crazy_diamond_special_2', donor: 'crazy_diamond', slot: 'special_2',
    name: 'Emergency Recall', rarity: 'epic', tags: ['heal', 'mobility'],
    levelDesc: [
      'Special 2 returns you to your fight-start position.',
      'Special 2 returns you to your fight-start position and heals you for 10 HP.',
      'Special 2 returns you to your fight-start position, heals you for 18 HP, and cures Frozen.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'returnToAnchor', data: {} },
      { hook: 'onHitResolve', fn: 'healEntity', minLevel: 2, data: { amount: [0, 10, 18] } },
      { hook: 'onHitResolve', fn: 'cureStatus', minLevel: 3, data: { status: 'frozen' } }
    ]
  },
  {
    id: 'frag_crazy_diamond_aura', donor: 'crazy_diamond', slot: 'aura',
    name: 'Rebound Repair', rarity: 'epic', tags: ['heal', 'economy'],
    levelDesc: [
      'Taking damage reflects 15% of it back at the attacker.',
      'Taking damage reflects 25% of it back at the attacker. Stepping heals you for 4 HP.',
      'Taking damage reflects 35% of it back at the attacker. Stepping heals you for 8 HP and cures Virus.'
    ],
    effects: [
      { hook: 'onDamageTaken', fn: 'reflectPctDamageToAttacker', data: { pct: [0.15, 0.25, 0.35] } },
      { hook: 'onStepStart', fn: 'healEntity', minLevel: 2, data: { amount: [0, 4, 8] } },
      { hook: 'onStepStart', fn: 'cureStatus', minLevel: 3, data: { status: 'virus' } }
    ]
  },
  {
    id: 'frag_crazy_diamond_rush', donor: 'crazy_diamond', slot: 'rush',
    name: 'Restorative Rush', rarity: 'legendary', tags: ['heal'],
    levelDesc: [
      'Your Rush restores instead of destroys: heals you for 20% of the damage it deals.',
      'Your Rush restores instead of destroys: heals you for 25% of the damage it deals.',
      'Your Rush restores instead of destroys: heals you for 30% of the damage it deals, and cures Frozen on landing.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: [0.20, 0.25, 0.30] } },
      { hook: 'onHitResolve', fn: 'cureStatus', minLevel: 3, data: { status: 'frozen' } }
    ]
  }
];
