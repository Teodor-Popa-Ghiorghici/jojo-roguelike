/* Duo Fragments — extended batch. Same schema as core.js: no slot, no
   levels, offered only once both `requires[].donor` entries are owned
   somewhere in fragmentsBySlot. */

export const DUO_FRAGMENTS_EXTENDED = [
  {
    id: 'duo_stopped_repair', name: 'Stopped Repair', rarity: 'epic',
    requires: [{ donor: 'the_world' }, { donor: 'crazy_diamond' }],
    desc: 'A Perfect Clash stops time and heals you a real amount in the same instant -- the world holds still just long enough to mend.',
    tags: ['time', 'heal'],
    effects: [
      { hook: 'onPerfectClash', fn: 'triggerTimeStop', data: { frames: 36 } },
      { hook: 'onPerfectClash', fn: 'healEntity', data: { amount: 14 } }
    ]
  },
  {
    id: 'duo_frozen_weight', name: 'Frozen Weight', rarity: 'epic',
    requires: [{ donor: 'the_world' }, { donor: 'echoes_act3' }],
    desc: 'A target already Grounded takes real bonus damage from every hit -- weight and stillness compound.',
    tags: ['crowd', 'time'],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'gravity', minStacks: 1, mult: 1.25 } }
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { status: 'frozen', stacks: 1 } }
    ]
  },
  {
    id: 'duo_toxic_zipper', name: 'Toxic Zipper', rarity: 'rare',
    requires: [{ donor: 'purple_haze' }, { donor: 'sticky_fingers' }],
    desc: 'Landing a hit zips you to the target and spreads Virus to the 2 nearest other enemies -- the infection travels with you.',
    tags: ['virus', 'mobility'],
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 20 } },
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'virus', stacks: 1, count: 2, radius: 60, from: 'target' } }
    ]
  },
  {
    id: 'duo_volatile_toxin', name: 'Volatile Toxin', rarity: 'epic',
    requires: [{ donor: 'purple_haze' }, { donor: 'red_hot_chili_pepper' }],
    desc: 'Resolving a hit detonates the target\'s Virus for bonus damage and leaves it Charged -- the infection sparks on the way out.',
    tags: ['virus'],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'virus', dmgPerStack: 4 } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { status: 'charge', stacks: 1 } }
    ]
  },
  {
    id: 'duo_live_zip', name: 'Live Zip', rarity: 'rare',
    requires: [{ donor: 'sticky_fingers' }, { donor: 'red_hot_chili_pepper' }],
    desc: 'Landing a hit zips you to the target and Charges it -- close the gap with a spark still on your fingers.',
    tags: ['mobility'],
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 20 } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { status: 'charge', stacks: 1 } }
    ]
  },
  {
    id: 'duo_grounded_bloom', name: 'Grounded Bloom', rarity: 'epic',
    requires: [{ donor: 'echoes_act3' }, { donor: 'gold_experience' }],
    desc: 'Landing a hit grounds the 2 nearest enemies with Gravity and plants a life mote on the target -- pin them down, then bloom something living in the wreckage.',
    tags: ['crowd', 'heal'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'gravity', stacks: 1, count: 2, radius: 70, from: 'target' } },
      { hook: 'onHitLanded', fn: 'spawnFriendlyMote', data: { at: 'defender', radius: 20, lifeFrames: 480, healAmount: 8, momentumAmount: 10 } }
    ]
  },
  {
    id: 'duo_divined_vitality', name: 'Divined Vitality', rarity: 'rare',
    requires: [{ donor: 'gold_experience' }, { donor: 'hermit_purple' }],
    desc: 'Landing a hit on a Marked target heals you and grants Persistence -- Divination tells Life exactly where to strike.',
    tags: ['heal', 'economy'],
    effects: [
      { hook: 'onHitLanded', fn: 'grantResourceIfDefenderStatus', data: { status: 'mark', resource: 'persistence', amount: 6 } },
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: 0.1 } }
    ]
  },
  {
    id: 'duo_purifying_strike', name: 'Purifying Strike', rarity: 'rare',
    requires: [{ donor: 'crazy_diamond' }, { donor: 'purple_haze' }],
    desc: 'Landing a hit cures a stack of your own Virus and heals you a share of the damage dealt -- restoration burning off decay as it goes.',
    tags: ['heal', 'virus'],
    effects: [
      { hook: 'onHitLanded', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: 0.12 } }
    ]
  },
  {
    id: 'duo_charged_repair', name: 'Charged Repair', rarity: 'epic',
    requires: [{ donor: 'crazy_diamond' }, { donor: 'red_hot_chili_pepper' }],
    desc: 'Every hit heals you a share of the damage dealt and leaves the target Charged -- restoration with a live current running through it.',
    tags: ['heal'],
    effects: [
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: 0.12 } },
      { hook: 'onHitLanded', fn: 'chainedApplyStatus', data: { status: 'charge', stacks: 1 } }
    ]
  },
  {
    id: 'duo_restorative_zip', name: 'Restorative Zip', rarity: 'rare',
    requires: [{ donor: 'crazy_diamond' }, { donor: 'sticky_fingers' }],
    desc: 'Landing a hit zips you to the target and heals you a share of the damage dealt -- restoration that never leaves you standing still.',
    tags: ['heal', 'mobility'],
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 20 } },
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: 0.12 } }
    ]
  }
];
