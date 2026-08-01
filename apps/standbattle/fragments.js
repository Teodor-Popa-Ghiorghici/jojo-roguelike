/* Fragments — GDD §6.1/§6.7, tech §3's schema, Phase 7. Exactly 12 across
   3 donors (Purple Haze / Virus, The World / Time, Sticky Fingers /
   Mobility+Break) — the mission's own limit: no fourth donor, no Relics/
   Discs/Aspects/Requiem/Duos. Every entry clears GDD §6.7 (enforced by
   content_registry.js's validator, not by this file's own honesty) and
   carries real 3-level clause changes, not just bigger numbers on the
   same clause — see each entry's `levelDesc`. `donor` values are plain
   strings registered via `registerDonor` (combat.js); `slot` is the one
   of the 9 GDD §6.1 slots this Fragment attaches to. Magnitude-per-level
   is authored as an array value (tech §3's own `stacks:[1,2,3]` shape),
   resolved generically by content_registry.js's installFragment — no
   verb here ever special-cases "level". A clause gated behind `minLevel`
   simply isn't registered below that level, which is how a level adds a
   whole new behaviour rather than just a bigger number. */

export const DONORS = ['purple_haze', 'the_world', 'sticky_fingers'];

export const FRAGMENTS = {
  /* ---- Purple Haze (Fugo) — Virus --------------------------------------- */
  frag_purple_haze_light: {
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
  frag_purple_haze_medium: {
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
  frag_purple_haze_special: {
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
  frag_purple_haze_aura: {
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
  },

  /* ---- The World (DIO) — Time -------------------------------------------- */
  frag_the_world_step: {
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
  frag_the_world_clash: {
    id: 'frag_the_world_clash', donor: 'the_world', slot: 'clash',
    name: 'Time, Stop!', rarity: 'epic', tags: ['time'],
    levelDesc: [
      'A Perfect Clash stops time completely for 0.67s.',
      'A Perfect Clash stops time completely for 0.93s.',
      'A Perfect Clash stops time completely for 1.2s.'
    ],
    effects: [
      { hook: 'onPerfectClash', fn: 'triggerTimeStop', data: { frames: [40, 56, 72] } }
    ]
  },
  frag_the_world_heavy: {
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
  frag_the_world_rush: {
    id: 'frag_the_world_rush', donor: 'the_world', slot: 'rush',
    name: 'Stopped World', rarity: 'legendary', tags: ['time'],
    levelDesc: [
      'Using Stand Rush stops time for its opening beat (0.5s).',
      'Using Stand Rush stops time for its opening beat (0.75s).',
      'Using Stand Rush stops time for its opening beat (1.0s).'
    ],
    effects: [
      { hook: 'onMoveStart', fn: 'triggerTimeStop', data: { moveId: 'sp_ora_rush', frames: [30, 45, 60] } }
    ]
  },

  /* ---- Sticky Fingers (Bruno) — Mobility + Break ------------------------- */
  frag_sticky_fingers_medium: {
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
  frag_sticky_fingers_step: {
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
     extending Project's tether — a mechanic that cannot exist without
     the User/Stand duality this engine has been building toward since
     Phase 4. Off Project entirely, or anchored/under tether length, this
     Fragment does nothing at all. */
  frag_sticky_fingers_aura: {
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
  frag_sticky_fingers_rush: {
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
};

export const FRAGMENT_LIST = Object.values(FRAGMENTS);
