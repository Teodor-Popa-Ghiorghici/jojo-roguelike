/* Hermit Purple (Joseph) — Divination. Phase 10. Rerolls, foresight, Mark,
   economy (GDD §6.1) -- the donor GDD explicitly calls out as necessary so
   builds don't all converge on damage. Mark (status.js) is this donor's
   signature debuff: a boolean "the reading is on you" flag with no self-
   tick of its own -- every clause below either plants it, amplifies
   against it, or cashes it in, which is also what keeps each entry clear
   of GDD §6.7's bare-damage floor. `frag_hermit_purple_aura` additionally
   carries the donor's real economy identity via the `economyMods` side-
   channel (fragment_offers.js/economy.js, read outside combat) -- GDD
   §6.1's own example: "All reward offers show one extra choice." */

export const HERMIT_PURPLE_FRAGMENTS = [
  {
    id: 'frag_hermit_purple_light', donor: 'hermit_purple', slot: 'light',
    name: 'Probing Jab', rarity: 'common', tags: ['single-target'],
    levelDesc: [
      'Light hits apply Mark to their target.',
      'Light hits apply Mark and grant 4 Momentum on landing.',
      'Light hits apply Mark, grant 6 Momentum on landing, and your Light chain has no cap.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'light', status: 'mark', stacks: 1 } },
      { hook: 'onHitLanded', fn: 'grantResource', minLevel: 2, data: { slot: 'light', resource: 'momentum', amount: [0, 4, 6] } }
    ],
    queries: [
      { hook: 'getChainCap', fn: 'removeCapForSlot', minLevel: 3, data: { slot: 'light' } }
    ]
  },
  {
    id: 'frag_hermit_purple_medium', donor: 'hermit_purple', slot: 'medium',
    name: "Divination's Toll", rarity: 'rare', tags: ['economy', 'single-target'],
    levelDesc: [
      "Medium consumes the target's Mark for +6 damage and +2 Persistence.",
      "Medium consumes the target's Mark for +10 damage and +3 Persistence.",
      "Medium consumes the target's Mark for +15 damage and +4 Persistence, then immediately re-Marks the target so the next reading can begin again."
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'mark', dmgPerStack: [6, 10, 15], persistencePerStack: [2, 3, 4] } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', minLevel: 3, data: { slot: 'medium', status: 'mark', stacks: 1 } }
    ]
  },
  {
    id: 'frag_hermit_purple_heavy', donor: 'hermit_purple', slot: 'heavy',
    name: 'Radiant Vision', rarity: 'epic', tags: ['crowd'],
    levelDesc: [
      'Heavy hits also apply Mark to 1 enemy near you.',
      'Heavy hits also apply Mark to 2 enemies near you.',
      'Heavy hits also apply Mark to 3 enemies near you, and Heavy itself now consumes the target\'s own Mark for bonus damage first -- read it, then strike it.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'mark', stacks: 1, count: [1, 2, 3], radius: 60 } },
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', minLevel: 3, data: { status: 'mark', dmgPerStack: 8 } }
    ]
  },
  {
    id: 'frag_hermit_purple_special_1', donor: 'hermit_purple', slot: 'special_1',
    name: 'Overdrive Sight', rarity: 'rare', tags: ['single-target', 'economy'],
    levelDesc: [
      'Ora Barrage deals +20% damage against Marked targets and grants 4 Persistence whenever it lands on one.',
      'Ora Barrage deals +35% damage against Marked targets and grants 7 Persistence whenever it lands on one.',
      'Ora Barrage deals +55% damage against Marked targets, grants 10 Persistence whenever it lands on one, and also applies Mark to the target so the next barrage always qualifies.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', data: { status: 'mark', resource: 'persistence', amount: [4, 7, 10] } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', minLevel: 3, data: { slot: 'special_1', status: 'mark', stacks: 1 } }
    ],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'mark', minStacks: 1, mult: [1.2, 1.35, 1.55] } }
    ]
  },
  {
    id: 'frag_hermit_purple_special_2', donor: 'hermit_purple', slot: 'special_2',
    name: "Reading's End", rarity: 'legendary', tags: ['crowd', 'economy'],
    levelDesc: [
      'Killing a target Marks 1 nearby enemy and grants 6 Persistence.',
      'Killing a target Marks 2 nearby enemies and grants 10 Persistence.',
      'Killing a target Marks 4 nearby enemies, grants 16 Persistence, and 8 Momentum.'
    ],
    effects: [
      { hook: 'onKill', fn: 'applyStatusToNearby', data: { status: 'mark', stacks: 1, count: [1, 2, 4], radius: 90, from: 'target' } },
      { hook: 'onKill', fn: 'grantResource', data: { resource: 'persistence', amount: [6, 10, 16] } },
      { hook: 'onKill', fn: 'grantResource', minLevel: 3, data: { resource: 'momentum', amount: [0, 0, 8] } }
    ]
  },
  {
    id: 'frag_hermit_purple_rush', donor: 'hermit_purple', slot: 'rush',
    name: 'Coiling Vine', rarity: 'epic', tags: ['mobility'],
    levelDesc: [
      'Stand Rush hits apply Mark to whatever they land on.',
      'As above, and Rush hits also pull you in tight to your target immediately after landing.',
      'As above, pulling you in even tighter, and Rush hits also Mark 2 nearby enemies.'
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { slot: 'rush', status: 'mark', stacks: 1 } },
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', minLevel: 2, data: { standoff: [0, 26, 16] } },
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', minLevel: 3, data: { status: 'mark', stacks: 1, count: 2, radius: 50 } }
    ]
  },
  {
    id: 'frag_hermit_purple_step', donor: 'hermit_purple', slot: 'step',
    name: 'Retreating Vines', rarity: 'common', tags: ['mobility', 'economy'],
    levelDesc: [
      'Stepping grants 5 Persistence.',
      'Stepping grants 8 Persistence.',
      'Stepping grants 12 Persistence and Marks the nearest enemy.'
    ],
    effects: [
      { hook: 'onStepStart', fn: 'grantResource', data: { resource: 'persistence', amount: [5, 8, 12] } },
      { hook: 'onStepStart', fn: 'applyStatusToNearby', minLevel: 3, data: { status: 'mark', stacks: 1, count: 1, radius: 70 } }
    ]
  },
  {
    id: 'frag_hermit_purple_aura', donor: 'hermit_purple', slot: 'aura',
    name: "Hermit's Eye", rarity: 'legendary', tags: ['economy'],
    levelDesc: [
      'Every hit that lands applies Mark to its target.',
      'As above, and landing a hit on an already-Marked target also grants 4 Persistence.',
      "As above, grants 8 Persistence on an already-Marked hit, and reward offers you're shown now include one extra choice -- Divination reveals more of what's coming."
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { status: 'mark', stacks: 1 } },
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', minLevel: 2, data: { status: 'mark', resource: 'persistence', amount: [0, 4, 8] } }
    ],
    economyMods: { extraOfferChoice: [false, false, true] }
  }
];
