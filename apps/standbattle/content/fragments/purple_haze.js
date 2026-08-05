/* Purple Haze (Fugo) — Virus. Phase 7's original 4, moved unchanged out of
   the old flat fragments.js into this donor file (Phase 10's content/
   fragments/<donor>.js layout — CLAUDE.md's "content is data" split by
   donor instead of one growing file). No behavioural change. */

export const PURPLE_HAZE_FRAGMENTS = [
  {
    id: 'frag_purple_haze_light', donor: 'purple_haze', slot: 'light',
    name: 'Infectious Jab', rarity: 'common', tags: ['virus'],
    levelDesc: [
      'Light hits apply 1 Virus.',
      'Light hits apply 2 Virus.',
      'Light hits apply 3 Virus. Your Light chain has no cap.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'light', status: 'virus', stacks: [1, 2, 3] } }
    ],
    queries: [
      { hook: 'getChainCap', fn: 'removeCapForSlot', minLevel: 3, data: { slot: 'light' } }
    ]
  },
  {
    id: 'frag_purple_haze_medium', donor: 'purple_haze', slot: 'medium',
    name: 'Rotting Strike', rarity: 'rare', tags: ['virus', 'economy'],
    levelDesc: [
      'Medium consumes the target\'s Virus for +3 damage and +1 Persistence per stack.',
      'Medium consumes the target\'s Virus for +5 damage and +2 Persistence per stack.',
      'Medium consumes the target\'s Virus for +8 damage and +3 Persistence per stack.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeVirusForBonus', data: { dmgPerStack: [3, 5, 8], persistencePerStack: [1, 2, 3] } }
    ]
  },
  {
    id: 'frag_purple_haze_special', donor: 'purple_haze', slot: 'special_1',
    name: 'Toxic Barrage', rarity: 'rare', tags: ['virus', 'crowd'],
    levelDesc: [
      'Each Ora Barrage hit applies 1 Virus.',
      'Each Ora Barrage hit applies 2 Virus.',
      'Each Ora Barrage hit applies 3 Virus. Hitting an already-Virused target also grants 3 Momentum.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'special_1', status: 'virus', stacks: [1, 2, 3] } },
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', minLevel: 3, data: { status: 'virus', resource: 'momentum', amount: 3 } }
    ]
  },
  {
    id: 'frag_purple_haze_aura', donor: 'purple_haze', slot: 'aura',
    name: 'Virulent Bloom', rarity: 'epic', tags: ['virus', 'risk'],
    tradeoff: 'You take 4 damage from each cloud you trigger.',
    levelDesc: [
      'Enemies dying with 5+ Virus explode into a spreading cloud (radius 36).',
      'Enemies dying with 5+ Virus explode into a spreading cloud (radius 44, more damage per tick).',
      'Enemies dying with 5+ Virus explode into a spreading cloud (radius 52, more damage per tick).'
    ],
    effects: [
      {
        hook: 'onKill', fn: 'spawnDeathCloudIfVirused',
        data: { minStacks: 5, radius: [36, 44, 52], tickFrames: 20, dmg: [3, 4, 5], lifeFrames: 120, selfDamage: 4 }
      }
    ]
  }
];
