/* The World (DIO) — Time. Phase 7's original 4, moved unchanged into
   Phase 10's content/fragments/<donor>.js layout. No behavioural change. */

export const THE_WORLD_FRAGMENTS = [
  {
    id: 'frag_the_world_step', donor: 'the_world', slot: 'step',
    name: 'Stopped Instant', rarity: 'common', tags: ['time'],
    levelDesc: [
      'Stepping stops time for an instant (0.13s).',
      'Stepping stops time for an instant (0.2s).',
      'Stepping stops time for an instant (0.27s).'
    ],
    effects: [
      { hook: 'onStepStart', fn: 'triggerTimeStop', data: { frames: [8, 12, 16] } }
    ]
  },
  {
    id: 'frag_the_world_clash', donor: 'the_world', slot: 'clash',
    name: 'Time, Stop!', rarity: 'epic', tags: ['time', 'economy'],
    levelDesc: [
      'A Perfect Clash stops time completely for 0.67s.',
      'A Perfect Clash stops time completely for 0.93s.',
      'A Perfect Clash stops time completely for 1.2s, and also grants 10 Persistence -- your Stand keeps working while nothing else does.'
    ],
    effects: [
      { hook: 'onPerfectClash', fn: 'triggerTimeStop', data: { frames: [40, 56, 72] } },
      { hook: 'onPerfectClash', fn: 'grantResource', minLevel: 3, data: { resource: 'persistence', amount: 10 } }
    ]
  },
  {
    id: 'frag_the_world_heavy', donor: 'the_world', slot: 'heavy',
    name: 'Chilling Grip', rarity: 'rare', tags: ['time', 'economy'],
    levelDesc: [
      'Heavy applies Frozen. Frozen targets take +25% damage from everything.',
      'Heavy applies Frozen (as above) and grants 8 Persistence per hit.',
      'Heavy applies Frozen (as above), grants 8 Persistence and 8 Momentum per hit.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'heavy', status: 'frozen' } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 2, data: { slot: 'heavy', resource: 'persistence', amount: 8 } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 3, data: { slot: 'heavy', resource: 'momentum', amount: 8 } }
    ]
  },
  {
    id: 'frag_the_world_rush', donor: 'the_world', slot: 'rush',
    name: 'Stopped World', rarity: 'legendary', tags: ['time', 'economy'],
    levelDesc: [
      'Using Stand Rush stops time for its opening beat (0.5s).',
      'Using Stand Rush stops time for its opening beat (0.75s).',
      'Using Stand Rush stops time for its opening beat (1.0s), and every Rush hit that lands during the stopped world refunds 10 Persistence -- the world isn\'t just still, it\'s yours to spend.'
    ],
    effects: [
      { hook: 'onMoveStart', fn: 'triggerTimeStop', data: { moveId: 'sp_ora_rush', frames: [30, 45, 60] } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 3, data: { slot: 'rush', resource: 'persistence', amount: 10 } }
    ]
  }
];
