/* Duo Fragments — core batch. GDD §6.1: "offered only when you hold
   Fragments from two specific donors" (tech §3 schema: `requires` checks
   donor ownership only, not slot). No slot, no levels -- taken once,
   permanently active for the run like a Relic (content_registry.js's
   installDuo). */

export const DUO_FRAGMENTS_CORE = [
  {
    id: 'duo_frozen_contagion', name: 'Frozen Contagion', rarity: 'legendary',
    requires: [{ donor: 'the_world' }, { donor: 'purple_haze' }],
    desc: 'Frozen targets take 30% more damage from everything, and resolving a hit against them detonates their Virus for a heavy bonus.',
    tags: ['time', 'virus'],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'frozen', minStacks: 1, mult: 1.3 } }
    ],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'virus', dmgPerStack: 5 } }
    ]
  },
  {
    id: 'duo_deadweight', name: 'Deadweight', rarity: 'epic',
    requires: [{ donor: 'sticky_fingers' }, { donor: 'echoes_act3' }],
    desc: 'Resolving a hit zips you to the target and grounds it with Gravity in the same motion -- the distance problem and the crowd-control problem solve each other.',
    tags: ['mobility', 'crowd'],
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 20 } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { status: 'gravity', stacks: 1 } }
    ]
  },
  {
    id: 'duo_stopped_current', name: 'Stopped Current', rarity: 'legendary',
    requires: [{ donor: 'red_hot_chili_pepper' }, { donor: 'the_world' }],
    desc: 'A Perfect Clash stops time and charges the 2 nearest enemies at once -- the world freezes mid-arc, current and all.',
    tags: ['time'],
    effects: [
      { hook: 'onPerfectClash', fn: 'triggerTimeStop', data: { frames: 40 } },
      { hook: 'onPerfectClash', fn: 'applyStatusToNearby', data: { status: 'charge', stacks: 2, count: 2, radius: 80 } }
    ]
  },
  {
    id: 'duo_requiem_of_life', name: 'Requiem of Life', rarity: 'legendary',
    requires: [{ donor: 'gold_experience' }, { donor: 'crazy_diamond' }],
    desc: 'Every hit heals you for a real share of the damage dealt, and any healing beyond the moment converts into a burst of Persistence -- restoration made into fuel.',
    tags: ['heal', 'economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: 0.15 } },
      { hook: 'onHitResolve', fn: 'grantResource', data: { resource: 'persistence', amount: 4 } }
    ]
  },
  {
    id: 'duo_marked_contagion', name: 'Marked Contagion', rarity: 'epic',
    requires: [{ donor: 'hermit_purple' }, { donor: 'purple_haze' }],
    desc: 'Resolving a hit against a Marked target detonates its Virus too, cashing in both readings at once.',
    tags: ['virus', 'economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'mark', dmgPerStack: 5, persistencePerStack: 1 } },
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'virus', dmgPerStack: 4 } }
    ]
  },
  {
    id: 'duo_frozen_zip', name: 'Frozen Zip', rarity: 'rare',
    requires: [{ donor: 'the_world' }, { donor: 'sticky_fingers' }],
    desc: 'Landing a hit zips you to the target and leaves it Frozen -- close the gap and lock it down in the same beat.',
    tags: ['time', 'mobility'],
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 22 } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { status: 'frozen', stacks: 1 } }
    ]
  },
  {
    id: 'duo_grounded_circuit', name: 'Grounded Circuit', rarity: 'epic',
    requires: [{ donor: 'echoes_act3' }, { donor: 'red_hot_chili_pepper' }],
    desc: 'A grounded target conducts: Charged-and-Grounded enemies take real bonus damage from everything you throw at them.',
    tags: ['crowd'],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'gravity', minStacks: 1, mult: 1.15 } }
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'charge', stacks: 1, count: 2, radius: 70, from: 'target' } }
    ]
  },
  {
    id: 'duo_diagnostic_repair', name: 'Diagnostic Repair', rarity: 'rare',
    requires: [{ donor: 'crazy_diamond' }, { donor: 'hermit_purple' }],
    desc: 'Landing a hit against a Marked target cures a status off you and refunds Persistence -- restoration reading the pattern before it strikes.',
    tags: ['heal', 'economy'],
    effects: [
      { hook: 'onHitLanded', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', data: { status: 'mark', resource: 'persistence', amount: 6 } }
    ]
  },
  {
    id: 'duo_toxic_bloom', name: 'Toxic Bloom', rarity: 'epic',
    requires: [{ donor: 'gold_experience' }, { donor: 'purple_haze' }],
    desc: 'Taking damage reflects a share of it back at the attacker, and landing a hit spreads Virus to the 2 nearest enemies around the target -- life feeds on decay.',
    tags: ['virus'],
    effects: [
      { hook: 'onDamageTaken', fn: 'reflectPctDamageToAttacker', data: { pct: 0.2 } },
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'virus', stacks: 1, count: 2, radius: 60, from: 'target' } }
    ]
  },
  {
    id: 'duo_marked_zip', name: 'Marked Zip', rarity: 'rare',
    requires: [{ donor: 'sticky_fingers' }, { donor: 'hermit_purple' }],
    desc: 'Landing a hit zips you to the target and Marks it -- the divination always knows exactly where you\'ll end up.',
    tags: ['mobility', 'single-target'],
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 20 } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { status: 'mark', stacks: 1 } }
    ]
  }
];
