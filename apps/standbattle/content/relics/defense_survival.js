/* Relics — Defense/Survival batch. GDD §6.3. Canon inspiration: Aja Stone
   (lethal-hit save), Zeppeli's Hat (automatic Clash), Lisa Lisa's Scarf
   (free early Guard). This engine has no "once per Act" tracker and no
   lethal-hit-save hook, so those two are used as flavor only -- the real
   mechanics below are built purely from onDamageTaken/onClashSuccess/
   onPerfectClash/getPersistenceCost/getFeedbackRate and the verb list. */

export const RELICS_DEFENSE_SURVIVAL = [
  {
    id: 'relic_zeppelis_resolve', name: "Zeppeli's Resolve", rarity: 'rare',
    desc: 'A successful Clash refunds Persistence and grants Momentum -- the confidence to hold your guard instead of flinching.',
    tags: ['economy'],
    effects: [
      { hook: 'onClashSuccess', fn: 'grantResource', data: { resource: 'persistence', amount: 6 } },
      { hook: 'onClashSuccess', fn: 'grantResource', data: { resource: 'momentum', amount: 6 } }
    ]
  },
  {
    id: 'relic_lisa_lisas_ward', name: "Lisa Lisa's Ward", rarity: 'rare',
    desc: 'Taking a hit reflects a modest 15% of the damage straight back at whatever landed it.',
    tags: [],
    effects: [
      { hook: 'onDamageTaken', fn: 'reflectPctDamageToAttacker', data: { pct: 0.15 } }
    ]
  },
  {
    id: 'relic_scarlet_overdrive_plating', name: 'Scarlet Overdrive Plating', rarity: 'epic',
    desc: 'A Perfect Clash cures Virus and Frozen off you and heals you 10 HP -- a full reset the instant you time it right.',
    tags: ['heal'],
    effects: [
      { hook: 'onPerfectClash', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onPerfectClash', fn: 'cureStatus', data: { status: 'frozen' } },
      { hook: 'onPerfectClash', fn: 'healEntity', data: { amount: 10 } }
    ]
  },
  {
    id: 'relic_aja_stones_echo', name: "Aja Stone's Echo", rarity: 'epic',
    desc: "Every hit you take heals a small fraction back, and grants Persistence besides -- the stone doesn't stop the blow, but it softens what's left.",
    tags: ['heal', 'economy'],
    effects: [
      { hook: 'onDamageTaken', fn: 'healEntity', data: { amount: 3 } },
      { hook: 'onDamageTaken', fn: 'grantResource', data: { resource: 'persistence', amount: 3 } }
    ]
  },
  {
    id: 'relic_tempered_will', name: 'Tempered Will', rarity: 'common',
    desc: 'Guard/Clash costs less Persistence to hold -- your Stand\'s defensive stance is cheaper to maintain.',
    tags: ['economy'],
    queries: [
      { hook: 'getPersistenceCost', fn: 'multiplyFlat', data: { mult: 0.85 } }
    ]
  },
  {
    id: 'relic_undying_resolve', name: 'Undying Resolve', rarity: 'legendary',
    desc: 'Taking damage cures 1 stack of Virus or Mark off you and heals a real amount back -- the worse it gets, the harder you refuse to go down.',
    tags: ['heal'],
    effects: [
      { hook: 'onDamageTaken', fn: 'cureStatus', data: { status: 'virus' } },
      { hook: 'onDamageTaken', fn: 'cureStatus', data: { status: 'mark' } },
      { hook: 'onDamageTaken', fn: 'healEntity', data: { amount: 6 } }
    ]
  },
  {
    id: 'relic_bracing_stance', name: 'Bracing Stance', rarity: 'rare',
    desc: 'A successful Clash grounds your opponent with Gravity, buying you a real opening.',
    tags: ['crowd'],
    effects: [
      { hook: 'onClashSuccess', fn: 'applyStatusToNearby', data: { status: 'gravity', count: 1, radius: 60 } }
    ]
  },
  {
    id: 'relic_feedback_dampener', name: 'Feedback Dampener', rarity: 'epic',
    desc: 'Your Stand\'s feedback rate is reduced -- straining the tether costs less of your own body than it should.',
    tags: [],
    queries: [
      { hook: 'getFeedbackRate', fn: 'multiplyFlat', data: { mult: 0.75 } }
    ]
  }
];
