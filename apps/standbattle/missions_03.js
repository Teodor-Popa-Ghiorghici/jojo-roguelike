/**
 * Bizarre Missions — batch 03 (GDD §10.2).
 *
 * Theme: BUILD IDENTITY. Fragments, donors, Relics, Discs and Duos —
 * missions about *how* you assemble a run rather than how you fight it.
 * Mono-donor hoarding, relic-less finales, filling all nine slots,
 * refusing upgrades, never rerolling, shopping like a miser.
 *
 * Pure data. No engine code, no imports, no bespoke branches.
 */

export const MISSIONS_03 = Object.freeze([
  {
    id: 'm03_one_hand_only',
    name: 'ONE HAND ONLY',
    desc: 'Finish a run with all 9 slots filled by a single donor.',
    fate: 150,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'maxDonorSlots', op: '>=', value: 9 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm03_no_heirlooms',
    name: 'NO HEIRLOOMS',
    desc: 'Reach the finale carrying zero Relics.',
    fate: 120,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'relicCount', op: '==', value: 0 },
      { counter: 'actReached', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm03_nine_of_nine',
    name: 'NINE OF NINE',
    desc: 'Win with every Fragment slot filled.',
    fate: 70,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'slotsFilled', op: '==', value: 9 }
    ]
  },
  {
    id: 'm03_first_offer_stands',
    name: 'FIRST OFFER STANDS',
    desc: 'Take nine or more Fragments without ever rerolling a choice.',
    fate: 85,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'rerollsUsed', op: '==', value: 0 },
      { counter: 'fragmentsTaken', op: '>=', value: 9 }
    ]
  },
  {
    id: 'm03_refuse_the_polish',
    name: 'REFUSE THE POLISH',
    desc: 'Clear three Acts without spending a single upgrade.',
    fate: 95,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'upgradesUsed', op: '==', value: 0 },
      { counter: 'actsCleared', op: '>=', value: 3 }
    ]
  },
  {
    id: 'm03_many_voices',
    name: 'MANY VOICES',
    desc: 'Win a run whose kit borrows from seven different donors.',
    fate: 110,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'distinctDonors', op: '>=', value: 7 },
      { counter: 'slotsFilled', op: '>=', value: 8 }
    ]
  },
  {
    id: 'm03_disc_library',
    name: 'DISC LIBRARY',
    desc: 'Carry four Discs into a victory.',
    fate: 105,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'discCount', op: '>=', value: 4 },
      { counter: 'bossKills', op: '>=', value: 1 }
    ]
  },
  {
    id: 'm03_three_duos',
    name: 'THREE DUOS',
    desc: 'Assemble three Duo pairings and fell a boss with them.',
    fate: 115,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'duoCount', op: '>=', value: 3 },
      { counter: 'bossKills', op: '>=', value: 1 },
      { counter: 'actReached', op: '>=', value: 3 }
    ]
  },
  {
    id: 'm03_relic_hoarder',
    name: 'RELIC HOARDER',
    desc: 'Hold five Relics and spend nine hundred yen getting them.',
    fate: 100,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'relicCount', op: '>=', value: 5 },
      { counter: 'yenSpent', op: '>=', value: 900 }
    ]
  },
  {
    id: 'm03_empty_hands',
    name: 'EMPTY HANDS',
    desc: 'Reach Act 4 with no more than three Fragments equipped.',
    fate: 140,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'slotsFilled', op: '<=', value: 3 },
      { counter: 'actReached', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm03_nothing_discarded',
    name: 'NOTHING DISCARDED',
    desc: 'Take twelve Fragments and never remove one.',
    fate: 90,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'removalsUsed', op: '==', value: 0 },
      { counter: 'fragmentsTaken', op: '>=', value: 12 }
    ]
  },
  {
    id: 'm03_closed_for_business',
    name: 'CLOSED FOR BUSINESS',
    desc: 'Clear two Acts without setting foot in a shop.',
    fate: 80,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'shopsVisited', op: '==', value: 0 },
      { counter: 'actsCleared', op: '>=', value: 2 }
    ]
  },
  {
    id: 'm03_greed_undone',
    name: 'GREED UNDONE',
    desc: 'Die holding four Relics and a nearly empty Fragment board.',
    fate: 55,
    outcome: 'loss',
    standId: null,
    requires: [
      { counter: 'relicCount', op: '>=', value: 4 },
      { counter: 'slotsFilled', op: '<=', value: 4 }
    ]
  },
  {
    id: 'm03_shattered_kit',
    name: 'SHATTERED KIT',
    desc: 'Fall in Act 3 or later having rerolled a dozen times.',
    fate: 45,
    outcome: 'loss',
    standId: null,
    requires: [
      { counter: 'rerollsUsed', op: '>=', value: 12 },
      { counter: 'actReached', op: '>=', value: 3 }
    ]
  },
  {
    id: 'm03_dora_repairs',
    name: 'DORA! REPAIRS',
    desc: 'Crazy Diamond: cut five Fragments, still end with all nine slots.',
    fate: 125,
    outcome: 'win',
    standId: 'crazy_diamond',
    requires: [
      { counter: 'removalsUsed', op: '>=', value: 5 },
      { counter: 'slotsFilled', op: '==', value: 9 }
    ]
  },
  {
    id: 'm03_life_from_one_source',
    name: 'LIFE FROM ONE SOURCE',
    desc: 'Gold Experience: two Duos drawn from three donors or fewer.',
    fate: 130,
    outcome: 'win',
    standId: 'gold_experience',
    requires: [
      { counter: 'duoCount', op: '>=', value: 2 },
      { counter: 'distinctDonors', op: '<=', value: 3 }
    ]
  },
  {
    id: 'm03_touch_and_detonate',
    name: 'TOUCH AND DETONATE',
    desc: 'Killer Queen: erase seven Fragments and take no upgrades.',
    fate: 135,
    outcome: 'any',
    standId: 'killer_queen',
    requires: [
      { counter: 'removalsUsed', op: '>=', value: 7 },
      { counter: 'upgradesUsed', op: '<=', value: 0 }
    ]
  },
  {
    id: 'm03_arrivederci_pockets',
    name: 'ARRIVEDERCI POCKETS',
    desc: 'Sticky Fingers: pocket eighteen Fragments across one run.',
    fate: 75,
    outcome: 'any',
    standId: 'sticky_fingers',
    requires: [
      { counter: 'fragmentsTaken', op: '>=', value: 18 }
    ]
  },
  {
    id: 'm03_emerald_network',
    name: 'EMERALD NETWORK',
    desc: 'Hierophant Green: win holding two Duos and two Discs at once.',
    fate: 120,
    outcome: 'win',
    standId: 'hierophant_green',
    requires: [
      { counter: 'duoCount', op: '>=', value: 2 },
      { counter: 'discCount', op: '>=', value: 2 }
    ]
  },
  {
    id: 'm03_naked_blade',
    name: 'NAKED BLADE',
    desc: 'Silver Chariot: three Acts, no Relics, five slots at most.',
    fate: 145,
    outcome: 'any',
    standId: 'silver_chariot',
    requires: [
      { counter: 'relicCount', op: '==', value: 0 },
      { counter: 'slotsFilled', op: '<=', value: 5 },
      { counter: 'actsCleared', op: '>=', value: 3 }
    ]
  }
]);
