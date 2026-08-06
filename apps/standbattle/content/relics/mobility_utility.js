/* Relics — Mobility/Utility batch. GDD §6.3. Canon inspiration: Hermit
   Purple's Camera (map reveal), Cinderella's Kit (slot reshuffle) -- no
   map-layer hook reaches a Relic's combat-time effects, so both are used
   as flavor only. Built purely from onStepStart/onHitResolve/onTetherStrain
   and the mobility verb list (teleportAttackerToTarget/returnToAnchor/
   refundStepCharge/markNearestBroken). */

export const RELICS_MOBILITY_UTILITY = [
  {
    id: 'relic_hermit_purples_lens', name: "Hermit Purple's Lens", rarity: 'rare',
    desc: 'Stepping marks the nearest enemy Broken -- the vine sees the opening before you do.',
    tags: ['mobility'],
    effects: [
      { hook: 'onStepStart', fn: 'markNearestBroken', data: { count: 1 } }
    ]
  },
  {
    id: 'relic_cindys_reshuffle', name: "Cinderella's Reshuffle", rarity: 'epic',
    desc: 'Every Step refunds a Step charge -- the kit keeps rearranging itself back into your favor.',
    tags: ['mobility', 'economy'],
    effects: [
      { hook: 'onStepStart', fn: 'refundStepCharge', data: { amount: 1 } }
    ]
  },
  {
    id: 'relic_zippers_second_wind', name: "Zipper's Second Wind", rarity: 'rare',
    desc: 'Resolving a hit has a real chance to snap you back to your fight-start anchor -- always a safe line home.',
    tags: ['mobility'],
    effects: [
      { hook: 'onHitResolve', fn: 'returnToAnchor', data: {} }
    ]
  },
  {
    id: 'relic_live_wire_coil', name: 'Live Wire Coil', rarity: 'epic',
    desc: 'Straining the tether applies Charge to the nearest enemy crossing it -- the leash sparks even without a Fragment behind it.',
    tags: ['projection'],
    effects: [
      { hook: 'onTetherStrain', fn: 'applyStatusToNearby', data: { status: 'charge', stacks: 1, count: 1 } }
    ]
  },
  {
    id: 'relic_restless_feet', name: 'Restless Feet', rarity: 'common',
    desc: 'Stepping grants a small burst of Momentum -- staying mobile keeps your Stand warmed up.',
    tags: ['mobility', 'economy'],
    effects: [
      { hook: 'onStepStart', fn: 'grantResource', data: { resource: 'momentum', amount: 5 } }
    ]
  },
  {
    id: 'relic_pursuers_instinct', name: "Pursuer's Instinct", rarity: 'rare',
    desc: 'Landing a hit zips you to the target -- your Stand never has to reposition twice.',
    tags: ['mobility', 'single-target'],
    effects: [
      { hook: 'onHitResolve', fn: 'teleportAttackerToTarget', data: { standoff: 22 } }
    ]
  },
  {
    id: 'relic_gravity_defiant_boots', name: 'Gravity-Defiant Boots', rarity: 'epic',
    desc: 'Stepping cures Gravity off you the instant you move -- the crowd can weigh you down, but never for long.',
    tags: ['mobility'],
    effects: [
      { hook: 'onStepStart', fn: 'cureStatus', data: { status: 'gravity' } }
    ]
  }
];
