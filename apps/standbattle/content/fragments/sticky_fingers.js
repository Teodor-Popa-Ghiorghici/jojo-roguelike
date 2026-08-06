/* Sticky Fingers (Bruno) — Mobility + Break. Phase 7's original 4, moved
   unchanged into Phase 10's content/fragments/<donor>.js layout. No
   behavioural change. */

export const STICKY_FINGERS_FRAGMENTS = [
  {
    id: 'frag_sticky_fingers_medium', donor: 'sticky_fingers', slot: 'medium',
    name: 'Zipper Punch', rarity: 'rare', tags: ['mobility', 'single-target'],
    levelDesc: [
      'Medium zips you to the target.',
      'Medium zips you to the target. Hitting a Broken enemy strips its armor for the rest of the encounter.',
      'As above, and stripping armor this way also refunds a Step charge.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 24 } },
      { hook: 'onHitResolve', fn: 'stripArmorIfBroken', minLevel: 2, data: {} },
      { hook: 'onHitResolve', fn: 'refundStepCharge', minLevel: 3, data: { requiresBreak: true, amount: 1 } }
    ]
  },
  {
    id: 'frag_sticky_fingers_step', donor: 'sticky_fingers', slot: 'step',
    name: 'Zip Charge', rarity: 'common', tags: ['mobility', 'economy'],
    levelDesc: [
      'Step grants 8 Momentum.',
      'Step grants 12 Momentum.',
      'Step grants 16 Momentum and marks the nearest enemy Broken.'
    ],
    effects: [
      { hook: 'onStepStart', fn: 'grantResource', data: { resource: 'momentum', amount: [8, 12, 16] } },
      { hook: 'onStepStart', fn: 'markNearestBroken', minLevel: 3, data: { count: 1 } }
    ]
  },
  /* The Fragment that could only exist because of the leash (GDD §6.1's
     Red Hot Chili Pepper "the tether becomes a live wire" example is the
     model): onTetherStrain fires exclusively while genuinely over-
     extending Project's tether. */
  {
    id: 'frag_sticky_fingers_aura', donor: 'sticky_fingers', slot: 'aura',
    name: 'Live Wire', rarity: 'epic', tags: ['mobility', 'projection', 'risk'],
    tradeoff: 'Only active while Straining the tether -- which already costs Persistence per second and drags you toward your Stand.',
    levelDesc: [
      'While Straining the tether, the nearest enemy is marked Broken every frame.',
      'While Straining the tether, the nearest enemy is marked Broken every frame.',
      'While Straining the tether, the nearest 2 enemies are marked Broken every frame.'
    ],
    effects: [
      { hook: 'onTetherStrain', fn: 'markNearestBroken', data: { count: [1, 1, 2] } }
    ]
  },
  {
    id: 'frag_sticky_fingers_rush', donor: 'sticky_fingers', slot: 'rush',
    name: 'Vanishing Point', rarity: 'epic', tags: ['mobility', 'economy'],
    levelDesc: [
      'Each Stand Rush hit refunds 3 Persistence.',
      'Each Stand Rush hit refunds 5 Persistence.',
      'Each Stand Rush hit refunds 8 Persistence. Activating Rush also refunds a Step charge.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'grantResource', data: { slot: 'rush', resource: 'persistence', amount: [3, 5, 8] } },
      { hook: 'onMoveStart', fn: 'refundStepCharge', minLevel: 3, data: { moveId: 'sp_ora_rush', amount: 1 } }
    ]
  }
];
