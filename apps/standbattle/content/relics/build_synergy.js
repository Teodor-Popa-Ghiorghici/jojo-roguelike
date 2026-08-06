/* Relics — Build/Synergy batch. GDD §6.3. Canon objects: The Arrow
   (boss-only extra Fragment), plus Fragment-pool-interaction objects that
   don't fit the other five batches. No Fragment-offer-count hook is
   reachable from a Relic's combat-time effects, so this batch is instead
   built the way the mission scopes it: pick one or two of the five status
   ids (virus/frozen/gravity/charge/mark) per entry and wire a real apply/
   consume/amplify/cure loop around it with applyStatusToNearby/
   bonusIfDefenderStatus/consumeStatusForBonus/cureStatus -- generic enough
   to reward whichever Fragments the run's build happens to be stacking,
   without being donor-specific itself. */

export const RELICS_BUILD_SYNERGY = [
  {
    id: 'relic_infection_vector', name: 'Infection Vector', rarity: 'common',
    desc: 'Landing a hit on a Virused target spreads 1 stack of it to the 2 nearest other enemies -- one Virus Fragment now infects the whole room.',
    tags: ['virus', 'crowd'],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'virus', minStacks: 1, mult: 1.1 } }
    ],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'virus', stacks: 1, count: 2, radius: 70, from: 'target' } }
    ]
  },
  {
    id: 'relic_static_discharge', name: 'Static Discharge', rarity: 'rare',
    desc: 'Resolving a hit detonates the target\'s Charge stacks for bonus damage and refunds you Persistence per stack -- whatever built the Charge, this cashes it in.',
    tags: ['economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'charge', dmgPerStack: 4, persistencePerStack: 1 } }
    ]
  },
  {
    id: 'relic_deep_freeze', name: 'Deep Freeze Contract', rarity: 'rare',
    desc: 'Your hits deal 30% more damage to a Frozen target -- any Fragment that chills something, this makes it hurt more.',
    tags: ['single-target'],
    queries: [
      { hook: 'getDamage', fn: 'bonusIfDefenderStatus', data: { status: 'frozen', minStacks: 1, mult: 1.3 } }
    ]
  },
  {
    id: 'relic_gravity_well', name: 'Gravity Well Charm', rarity: 'rare',
    desc: 'Landing a hit pulls Gravity onto the 2 nearest other enemies too -- one Gravity stack becomes a shared burden.',
    tags: ['crowd'],
    effects: [
      { hook: 'onHitLanded', fn: 'applyStatusToNearby', data: { status: 'gravity', stacks: 1, count: 2, radius: 60, from: 'target' } }
    ]
  },
  {
    id: 'relic_purge_ritual', name: 'Purge Ritual', rarity: 'rare',
    desc: 'Landing a hit cures 1 stack of your own Virus, then grants 4 Momentum -- whatever infects you, this burns off and turns into fuel.',
    tags: ['virus', 'economy'],
    effects: [
      { hook: 'onHitLanded', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onHitLanded', fn: 'grantResource', data: { resource: 'momentum', amount: 4 } }
    ]
  },
  {
    id: 'relic_markhunter_focus', name: 'Markhunter\'s Focus', rarity: 'epic',
    desc: 'Resolving a hit consumes the target\'s Mark stacks for heavy bonus damage and Persistence -- whichever Fragment brands them Marked, this is the payoff.',
    tags: ['single-target', 'economy'],
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'mark', dmgPerStack: 6, persistencePerStack: 2 } }
    ]
  },
  {
    id: 'relic_overload_capacitor', name: 'Overload Capacitor', rarity: 'epic', tags: ['risk', 'economy'],
    desc: 'Resolving a hit detonates the target\'s Charge for massive bonus damage, but you take 1 self damage every real second while owned -- a live wire that never fully discharges.',
    tradeoff: 'You take 1 self damage every real second (onCombatTick), for the whole encounter, from the moment you pick this up.',
    effects: [
      { hook: 'onHitResolve', fn: 'consumeStatusForBonus', data: { status: 'charge', dmgPerStack: 8 } },
      { hook: 'onCombatTick', fn: 'selfDamage', data: { perSec: 1 } }
    ]
  },
  {
    id: 'relic_cold_compress', name: 'Cold Compress', rarity: 'epic',
    desc: 'Every real second, cures 1 stack of your own Virus and heals you 3 HP -- whatever infects you over the course of a fight, this quietly scrubs off and knits shut.',
    tags: ['heal', 'virus'],
    effects: [
      { hook: 'onCombatTick', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onCombatTick', fn: 'healEntity', data: { amount: 3 } }
    ]
  }
];
