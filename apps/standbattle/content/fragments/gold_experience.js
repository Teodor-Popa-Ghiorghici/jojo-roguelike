/* Gold Experience (Giorno) — Life. Phase 10. Life motes, reflection,
   resource conversion (GDD §6.1) -- ally-summon AI is out of scope for this
   engine, so the kit leans entirely on the life-mote/reflection/heal-
   conversion side of the donor: nothing here is a bare heal or bare damage
   number, every clause routes through a real status/resource/slot change
   (GDD §6.7). */

export const GOLD_EXPERIENCE_FRAGMENTS = [
  {
    id: 'frag_gold_experience_heavy', donor: 'gold_experience', slot: 'heavy',
    name: 'Life Signs', rarity: 'common', tags: ['heal', 'economy'],
    levelDesc: [
      'Heavy plants a life mote where it lands; walking over it heals 4 and grants 10 Momentum.',
      'Heavy plants a life mote; walking over it heals 6 and grants 14 Momentum.',
      'Heavy plants a life mote; walking over it heals 9 and grants 20 Momentum.'
    ],
    effects: [
      {
        hook: 'onHitLanded', fn: 'spawnFriendlyMote',
        data: { at: 'defender', radius: 20, lifeFrames: 600, healAmount: [4, 6, 9], momentumAmount: [10, 14, 20] }
      }
    ]
  },
  {
    id: 'frag_gold_experience_aura', donor: 'gold_experience', slot: 'aura',
    name: 'Return to Zero', rarity: 'common', tags: ['heal', 'risk'],
    tradeoff: 'Reflection only fires while you are actually taking damage -- it does nothing to prevent the hit itself.',
    levelDesc: [
      'Reflect 15% of incoming damage back at whatever hit you.',
      'Reflect 25% of incoming damage back at whatever hit you.',
      'Reflect 40% of incoming damage back at whatever hit you.'
    ],
    effects: [
      { hook: 'onDamageTaken', fn: 'reflectPctDamageToAttacker', data: { pct: [0.15, 0.25, 0.4] } }
    ]
  },
  {
    id: 'frag_gold_experience_rush', donor: 'gold_experience', slot: 'rush',
    name: 'Vital Transfer', rarity: 'rare', tags: ['heal', 'economy'],
    levelDesc: [
      'Each Stand Rush hit heals you for 10% of the damage dealt.',
      'Each Stand Rush hit heals you for 18% of the damage dealt.',
      'Each Stand Rush hit heals you for 28% of the damage dealt.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: [0.1, 0.18, 0.28] } }
    ]
  },
  {
    id: 'frag_gold_experience_step', donor: 'gold_experience', slot: 'step',
    name: 'Clean Slate', rarity: 'rare', tags: ['heal'],
    levelDesc: [
      'Stepping cures Virus.',
      'Stepping cures Virus and Frozen.',
      'Stepping cures Virus, Frozen and Gravity.'
    ],
    effects: [
      { hook: 'onStepStart', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onStepStart', fn: 'cureStatus', minLevel: 2, data: { status: 'frozen' } },
      { hook: 'onStepStart', fn: 'cureStatus', minLevel: 3, data: { status: 'gravity' } }
    ]
  },
  {
    id: 'frag_gold_experience_medium', donor: 'gold_experience', slot: 'medium',
    name: 'Vital Excision', rarity: 'rare', tags: ['heal', 'economy'],
    levelDesc: [
      'Medium consumes the target\'s Mark stacks for +4 damage each, and heals you 15% of the total damage dealt.',
      'Medium consumes the target\'s Mark stacks for +6 damage each, and heals you 22% of the total damage dealt.',
      'As above at +9 damage per stack and 30% healing, and Medium also cures Virus on you.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'mark', dmgPerStack: [4, 6, 9] } },
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: [0.15, 0.22, 0.3] } },
      { hook: 'onHitResolve', fn: 'cureStatus', minLevel: 3, data: { status: 'virus' } }
    ]
  },
  {
    id: 'frag_gold_experience_special_1', donor: 'gold_experience', slot: 'special_1',
    name: 'Golden Wind', rarity: 'epic', tags: ['heal', 'economy', 'crowd'],
    levelDesc: [
      'Gold Experience\'s special plants 2 life motes around the target on hit.',
      'Plants 3 life motes; each heals 6 and grants 12 Momentum.',
      'Plants 3 life motes; each heals 9 and grants 16 Momentum, and the special also cures Virus on the User.'
    ],
    effects: [
      {
        hook: 'onHitLanded', fn: 'spawnFriendlyMote',
        data: { at: 'defender', radius: 24, lifeFrames: 480, healAmount: [4, 6, 9], momentumAmount: [8, 12, 16] }
      },
      {
        hook: 'onHitLanded', fn: 'spawnFriendlyMote',
        data: { at: 'attacker', radius: 24, lifeFrames: 480, healAmount: [4, 6, 9], momentumAmount: [8, 12, 16] }
      },
      { hook: 'onHitLanded', fn: 'cureStatus', minLevel: 3, data: { status: 'virus' } }
    ]
  },
  {
    id: 'frag_gold_experience_clash', donor: 'gold_experience', slot: 'clash',
    name: 'Muda Rebound', rarity: 'epic', tags: ['heal', 'economy'],
    levelDesc: [
      'A successful Clash reflects 20% of the damage you would have taken back at the attacker.',
      'A successful Clash reflects 35% of the damage you would have taken back at the attacker, and heals you 5.',
      'A successful Clash reflects 55% of the damage you would have taken back at the attacker, and heals you 10.'
    ],
    effects: [
      { hook: 'onClashSuccess', fn: 'reflectPctDamageToAttacker', data: { pct: [0.2, 0.35, 0.55] } },
      { hook: 'onClashSuccess', fn: 'healEntity', minLevel: 2, data: { amount: [0, 5, 10] } }
    ]
  },
  {
    id: 'frag_gold_experience_special_2', donor: 'gold_experience', slot: 'special_2',
    name: 'Reset Button', rarity: 'legendary', tags: ['heal', 'mobility', 'economy'],
    levelDesc: [
      'Gold Experience\'s second special recalls the User to the fight\'s starting anchor and cures Virus.',
      'As above, and also cures Frozen, and heals 12 on use.',
      'As above, and also plants a life mote at your recall point that heals 15 and grants 24 Momentum.'
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'returnToAnchor', data: {} },
      { hook: 'onHitResolve', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onHitResolve', fn: 'cureStatus', minLevel: 2, data: { status: 'frozen' } },
      { hook: 'onHitResolve', fn: 'healEntity', minLevel: 2, data: { amount: 12 } },
      {
        hook: 'onHitResolve', fn: 'spawnFriendlyMote', minLevel: 3,
        data: { at: 'attacker', radius: 24, lifeFrames: 600, healAmount: 15, momentumAmount: 24 }
      }
    ]
  }
];
