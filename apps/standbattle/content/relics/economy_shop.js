/* Relics — Economy/Shop batch. GDD §6.3/§6.5. Canon objects: Dio's Bone,
   Speedwagon Foundation Kit, Sugar Mountain's Contract, Rokakaka Fruit.
   No Shop-pricing hook exists in this engine (scope note, Phase 10+), so
   every entry below is a real in-fight Persistence/Momentum/HP conversion
   loop instead — the canon names are flavor only, built entirely from
   grantResource/consumeStatusForBonus/healPctOfDamage/selfDamage etc. */

export const RELICS_ECONOMY_SHOP = [
  {
    id: 'relic_dios_bone', name: "Dio's Bone", rarity: 'epic',
    desc: 'Every landed hit siphons Persistence from the fight itself, but the borrowed vitality bleeds back out of your own body.',
    tags: ['economy', 'risk'],
    tradeoff: 'Costs 2 HP every second for the whole fight, win or lose — a clock that never stops ticking.',
    effects: [
      { hook: 'onHitLanded', fn: 'grantResource', data: { resource: 'persistence', amount: 3 } },
      { hook: 'onCombatTick', fn: 'selfDamage', data: { perSec: 2 } }
    ]
  },
  {
    id: 'relic_rokakaka_fruit', name: 'Rokakaka Fruit', rarity: 'rare',
    desc: 'A wish granted in small installments: every solid hit returns a sliver of its damage as HP, and every kill leaves a burst of Momentum behind.',
    tags: ['heal', 'economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'healPctOfDamage', data: { pct: 0.12 } },
      { hook: 'onKill', fn: 'grantResource', data: { resource: 'momentum', amount: 6 } }
    ]
  },
  {
    id: 'relic_sugar_mountains_contract', name: "Sugar Mountain's Contract", rarity: 'epic',
    desc: "Sign here: every hit you eat converts straight into Persistence, but the contract quietly skims your own power for the privilege.",
    tags: ['economy', 'risk'],
    tradeoff: 'Your own damage output is permanently reduced 10% for as long as you carry it.',
    effects: [
      { hook: 'onDamageTaken', fn: 'grantResource', data: { resource: 'persistence', amount: 5 } }
    ],
    queries: [
      { hook: 'getDamage', fn: 'multiplyIfPlayerAttacker', data: { mult: 0.9 } }
    ]
  },
  {
    id: 'relic_speedwagon_reserve', name: 'Speedwagon Foundation Reserve', rarity: 'rare',
    desc: 'The Foundation never lets a job go unfinished: landing a hit has a chance to leave a supply cache behind that heals and refuels whoever reaches it.',
    tags: ['economy', 'heal'],
    effects: [
      { hook: 'onHitLanded', fn: 'spawnFriendlyMote', data: { at: 'attacker', radius: 24, lifeFrames: 240, healAmount: 12, momentumAmount: 8 } }
    ]
  },
  {
    id: 'relic_stray_cat_charm', name: 'Stray Cat Charm', rarity: 'common',
    desc: "A small trinket, kept for luck: landing a hit trickles a sliver of Persistence into reserve.",
    tags: ['economy'],
    effects: [
      { hook: 'onHitLanded', fn: 'grantResource', data: { resource: 'persistence', amount: 1 } }
    ]
  },
  {
    id: 'relic_extended_credit_line', name: 'Extended Credit Line', rarity: 'rare',
    desc: "Your Stand's reserve tank was built bigger than it needed to be — more room to bank Persistence before it caps out, and every resolved hit tops it off.",
    tags: ['economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'grantResource', data: { resource: 'persistence', amount: 1 } }
    ],
    queries: [
      { hook: 'getMaxPersistence', fn: 'addFlat', data: { amount: 20 } }
    ]
  },
  {
    id: 'relic_killer_queens_wager', name: "Killer Queen's Wager", rarity: 'epic',
    desc: "Bites the Dust, but for your wallet: detonating a Marked target for damage also converts the stacks straight into Persistence.",
    tags: ['economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'mark', dmgPerStack: 6, persistencePerStack: 2 } }
    ]
  },
  {
    id: 'relic_morioh_pawn_shop', name: 'Morioh Pawn Shop Stub', rarity: 'rare',
    desc: 'Everything has a trade-in value: a clean Clash cashes out into Persistence, and a Perfect Clash pays out Momentum on top.',
    tags: ['economy'],
    effects: [
      { hook: 'onClashSuccess', fn: 'grantResource', data: { resource: 'persistence', amount: 4 } },
      { hook: 'onPerfectClash', fn: 'grantResource', data: { resource: 'momentum', amount: 6 } }
    ]
  },
  {
    id: 'relic_heaven_ascension_toll', name: 'Heaven Ascension Toll', rarity: 'legendary',
    desc: 'The final rung of the ladder charges by the second: your power grows and every hit and kill pays out big, but the toll never waives.',
    tags: ['economy', 'risk'],
    tradeoff: "Costs 3 HP every second for the whole fight — the debt is due whether you win or not.",
    effects: [
      { hook: 'onCombatTick', fn: 'selfDamage', data: { perSec: 3 } },
      { hook: 'onHitResolve', fn: 'grantResource', data: { resource: 'momentum', amount: 4 } },
      { hook: 'onKill', fn: 'grantResource', data: { resource: 'persistence', amount: 15 } }
    ],
    queries: [
      { hook: 'getDamage', fn: 'multiplyIfPlayerAttacker', data: { mult: 1.12 } }
    ]
  }
];
