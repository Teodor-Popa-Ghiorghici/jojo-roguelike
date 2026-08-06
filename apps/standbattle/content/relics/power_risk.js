/* Relics — Power/Risk batch. GDD §6.3. Canon inspiration: Stone Mask
   (+45% Power, -1 HP/sec in combat -- the model every risk-tagged entry
   below follows: a real numeric edge for a real, stated cost, never a
   hidden clause). */

export const RELICS_POWER_RISK = [
  {
    id: 'relic_stone_mask', name: 'Stone Mask', rarity: 'rare',
    desc: 'Your Power is permanently boosted 45%, but the mask never lets you rest -- you lose 1 HP every second you spend in combat.',
    tags: ['risk'],
    tradeoff: 'You lose 1 HP every real second while in combat, for the whole fight, win or lose.',
    queries: [
      { hook: 'getDamage', fn: 'multiplyIfPlayerAttacker', data: { mult: 1.45 } }
    ],
    effects: [
      { hook: 'onCombatTick', fn: 'selfDamage', data: { perSec: 1 } }
    ]
  },
  {
    id: 'relic_borrowed_time', name: 'Borrowed Time', rarity: 'rare',
    desc: 'Every landed hit deals 20% more damage, paid for out of your own Persistence reserve.',
    tags: ['risk', 'economy'],
    tradeoff: 'Each landed hit also drains 3 Persistence from you -- run dry and the bonus keeps costing you nothing back.',
    queries: [
      { hook: 'getDamage', fn: 'multiplyIfPlayerAttacker', data: { mult: 1.2 } }
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'grantResource', data: { resource: 'persistence', amount: -3 } }
    ]
  },
  {
    id: 'relic_reckless_momentum', name: 'Reckless Momentum', rarity: 'common',
    desc: 'Landing a hit grants a burst of Momentum, but every hit you take costs a little Momentum right back.',
    tags: ['risk', 'economy'],
    tradeoff: 'Taking a hit drains 4 Momentum from you.',
    effects: [
      { hook: 'onHitLanded', fn: 'grantResource', data: { resource: 'momentum', amount: 6 } },
      { hook: 'onDamageTaken', fn: 'grantResource', data: { resource: 'momentum', amount: -4 } }
    ]
  },
  {
    id: 'relic_glass_cannon_wiring', name: "Glass Cannon's Wiring", rarity: 'epic',
    desc: 'Your damage output is boosted a full 30%, in exchange for a permanent cut to your Stand\'s max Persistence reserve.',
    tags: ['risk'],
    tradeoff: 'A flat -20 max Persistence for the whole run, applied the moment you take this.',
    queries: [
      { hook: 'getDamage', fn: 'multiplyIfPlayerAttacker', data: { mult: 1.3 } },
      { hook: 'getMaxPersistence', fn: 'addFlat', data: { amount: -20 } }
    ]
  },
  {
    id: 'relic_bloodpact_gauntlet', name: 'Bloodpact Gauntlet', rarity: 'epic',
    desc: 'Every kill converts a burst of your own vitality into raw striking power -- Persistence and Momentum surge, but the toll is paid in blood the instant it lands.',
    tags: ['risk', 'economy'],
    tradeoff: 'Every kill costs you 5 HP the instant it lands (onKill self-damage).',
    effects: [
      { hook: 'onKill', fn: 'grantResource', data: { resource: 'persistence', amount: 10 } },
      { hook: 'onKill', fn: 'grantResource', data: { resource: 'momentum', amount: 10 } },
      { hook: 'onKill', fn: 'selfDamage', data: { perSec: 5 } }
    ]
  },
  {
    id: 'relic_overclocked_stand', name: 'Overclocked Stand', rarity: 'legendary',
    desc: 'Your Stand pushes past its rated limits: +55% damage, a genuinely game-changing edge, for a cost that never lets up while you fight.',
    tags: ['risk'],
    tradeoff: 'You lose 2 HP every real second while in combat, for the whole fight, win or lose.',
    queries: [
      { hook: 'getDamage', fn: 'multiplyIfPlayerAttacker', data: { mult: 1.55 } }
    ],
    effects: [
      { hook: 'onCombatTick', fn: 'selfDamage', data: { perSec: 2 } }
    ]
  },
  {
    id: 'relic_desperate_gambit', name: 'Desperate Gambit', rarity: 'rare',
    desc: 'Resolving a hit against a Marked target detonates it for heavy bonus damage, drawn straight out of your own Persistence reserve.',
    tags: ['single-target', 'economy', 'risk'],
    tradeoff: 'A flat -10 max Persistence for the whole run, applied the moment you take this.',
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'mark', dmgPerStack: 7 } }
    ],
    queries: [
      { hook: 'getMaxPersistence', fn: 'addFlat', data: { amount: -10 } }
    ]
  },
  {
    id: 'relic_last_stand_charm', name: "Last Stand Charm", rarity: 'common',
    desc: 'Every hit you land grants a small Persistence surge.',
    tags: ['economy'],
    effects: [
      { hook: 'onHitLanded', fn: 'grantResource', data: { resource: 'persistence', amount: 4 } }
    ]
  }
];
