/* Relics — Crowd/Elite batch. GDD §6.3. Canon objects: The Bow and Arrow
   (elite Fragment/affix trade), Wall Eyes (Rule Fight frequency/reward),
   Achtung Baby (aggro/feedback trade). No Elite-affix hook, no boss-phase
   hook, and no Rule-Fight system exist to build the literal canon
   mechanics on -- every entry below builds an original crowd- or
   elite-punishing mechanic purely from the hook/verb list (onHitLanded/
   onHitResolve/onKill/onStepStart/onCombatTick + damageNearby/
   applyStatusToNearby/bonusIfDefenderStatus/markNearestBroken/
   consumeStatusForBonus), same discipline the Fragment donor files use. */

export const RELICS_CROWD_ELITE = [
  {
    id: 'relic_pack_hunter', name: 'Pack Hunter\'s Ledger', rarity: 'common',
    desc: 'Landing a hit also strikes the 2 nearest other enemies for a fraction of the blow.',
    tags: ['crowd'],
    effects: [
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: 4, count: 2, radius: 60, from: 'target' } }
    ]
  },
  {
    id: 'relic_isolation_ward', name: 'Isolation Ward', rarity: 'rare',
    desc: 'Landing a hit brands the target Marked; a Marked target then takes 40% more damage from every hit after -- single out one enemy and it stays singled out.',
    tags: ['single-target'],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'mark', minStacks: 1, mult: 1.4 } }
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusUnconditional', data: { status: 'mark', stacks: 1 } }
    ]
  },
  {
    id: 'relic_break_the_line', name: 'Break the Line', rarity: 'rare',
    desc: 'Every Step forces the 2 nearest enemies to their knees, marking them Broken.',
    tags: ['crowd'],
    effects: [
      { hook: 'onStepStart', fn: 'markNearestBroken', data: { count: 2 } }
    ]
  },
  {
    id: 'relic_bounty_collector', name: 'Bounty Collector', rarity: 'rare',
    desc: 'A kill sends a shockwave of Virus into the 3 nearest survivors -- one body down, three more infected.',
    tags: ['virus', 'crowd'],
    effects: [
      { hook: 'onKill', fn: 'applyStatusToNearby', data: { status: 'virus', stacks: 2, count: 3, radius: 90 } }
    ]
  },
  {
    id: 'relic_giant_slayer', name: 'Giant Slayer\'s Oath', rarity: 'epic',
    desc: 'Against a target carrying 3+ Gravity, your hits deal 60% more damage -- the heavier they are, the harder they fall.',
    tags: ['single-target'],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'gravity', minStacks: 3, mult: 1.6 } }
    ]
  },
  {
    id: 'relic_detonation_ring', name: 'Detonation Ring', rarity: 'epic',
    desc: 'Resolving a hit detonates the target\'s Charge for bonus damage, then blasts that damage outward to the 2 nearest others.',
    tags: ['crowd'],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'charge', dmgPerStack: 5 } },
      { hook: 'onHitLanded', fn: 'damageNearby', data: { amount: 6, count: 2, radius: 70, from: 'target' } }
    ]
  },
  {
    id: 'relic_headhunter_pact', name: 'Headhunter\'s Pact', rarity: 'epic', tags: ['single-target', 'risk'],
    desc: 'Resolving a hit consumes the target\'s Mark stacks for heavy bonus damage, but the Pact bleeds you 1 HP every second for the rest of the fight.',
    tradeoff: 'You take 1 self damage every real second (onCombatTick), for the whole encounter, from the moment you pick this up.',
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'mark', dmgPerStack: 9 } },
      { hook: 'onCombatTick', fn: 'selfDamage', data: { perSec: 1 } }
    ]
  },
  {
    id: 'relic_swarm_breaker', name: 'Swarm Breaker', rarity: 'legendary',
    desc: 'Every kill marks the 3 nearest survivors Broken and infects them with Virus -- thin a crowd once and the rest starts to crumble.',
    tags: ['crowd', 'virus'],
    effects: [
      { hook: 'onKill', fn: 'markNearestBroken', data: { count: 3 } },
      { hook: 'onKill', fn: 'applyStatusToNearby', data: { status: 'virus', stacks: 3, count: 3, radius: 100 } }
    ]
  }
];
