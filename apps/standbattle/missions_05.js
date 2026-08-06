/*
 * Bizarre Missions — batch 05: "Menacing Presence, the difficulty ladder."
 * Pure data per GDD §10.2 (mission entries) and §8.3 (the Menace pact:
 * 14 opt-in conditions summing to menaceRank 0..30).
 * Every entry here demands a non-zero menaceRank — these are the
 * bragging-rights clears: acts and full runs under a raised pact, often
 * pinned to a single Stand or stacked with a second restraint.
 * Fate skews high; fate 150 is reserved for the top of the ladder.
 */

export const MISSIONS_05 = Object.freeze([
  {
    id: 'm05_menace_first_blood',
    name: 'PACT OF THREE',
    desc: 'Raise the pact to rank 3 and clear an act under it.',
    fate: 90,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 3 },
      { counter: 'actsCleared', op: '>=', value: 1 }
    ]
  },
  {
    id: 'm05_menace_three_run',
    name: 'THREE ALL THE WAY',
    desc: 'Finish an entire run with the pact standing at rank 3 or higher.',
    fate: 100,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 3 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm05_menace_six_reach',
    name: 'SIX AND STILL WALKING',
    desc: 'Reach Act 3 with a pact of rank 6 or higher. Survival optional.',
    fate: 92,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 6 },
      { counter: 'actReached', op: '>=', value: 3 }
    ]
  },
  {
    id: 'm05_menace_six_full',
    name: 'SIXFOLD BURDEN',
    desc: 'Clear all four acts while carrying a pact of rank 6 or higher.',
    fate: 105,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 6 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm05_menace_ten_star',
    name: 'ORA AT TEN',
    desc: 'Clear a full run as Star Platinum under Menace 10 or higher.',
    fate: 115,
    outcome: 'win',
    standId: 'star_platinum',
    requires: [
      { counter: 'menaceRank', op: '>=', value: 10 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm05_menace_ten_hermit',
    name: 'THREADS AT TEN',
    desc: 'Win as Hermit Purple at Menace 10 with six flawless nodes behind you.',
    fate: 118,
    outcome: 'win',
    standId: 'hermit_purple',
    requires: [
      { counter: 'menaceRank', op: '>=', value: 10 },
      { counter: 'flawlessNodes', op: '>=', value: 6 }
    ]
  },
  {
    id: 'm05_menace_ten_starved',
    name: 'TEN, EMPTY HANDED',
    desc: 'Win at Menace 10 or higher having filled no more than four slots.',
    fate: 120,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 10 },
      { counter: 'slotsFilled', op: '<=', value: 4 }
    ]
  },
  {
    id: 'm05_kakyoin_menace_twelve',
    name: 'CLEAR 12 W/ KAKYOIN',
    desc: 'Clear Menace 12 with Kakyoin. Hierophant Green, all four acts.',
    fate: 130,
    outcome: 'win',
    standId: 'hierophant_green',
    requires: [
      { counter: 'menaceRank', op: '>=', value: 12 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm05_menace_twelve_no_shops',
    name: 'TWELVE, NO MARKET',
    desc: 'Clear Menace 12 without ever setting foot inside a shop node.',
    fate: 125,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 12 },
      { counter: 'shopsVisited', op: '==', value: 0 }
    ]
  },
  {
    id: 'm05_menace_twelve_bosses',
    name: 'TWELVE HEADS TAKEN',
    desc: 'Put down every act boss in one run at Menace 12 or higher.',
    fate: 122,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 12 },
      { counter: 'bossKills', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm05_menace_fifteen_chariot',
    name: 'FIFTEEN BLADES',
    desc: 'Clear a full run as Silver Chariot under Menace 15 or higher.',
    fate: 132,
    outcome: 'win',
    standId: 'silver_chariot',
    requires: [
      { counter: 'menaceRank', op: '>=', value: 15 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm05_menace_fifteen_no_rest',
    name: 'FIFTEEN, NO SLEEP',
    desc: 'Clear Menace 15 or higher without taking a single rest.',
    fate: 135,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 15 },
      { counter: 'restsUsed', op: '==', value: 0 }
    ]
  },
  {
    id: 'm05_menace_fifteen_untouched',
    name: 'FIFTEEN UNBLOODIED',
    desc: 'End a Menace 15 run victorious with 90% of your health intact.',
    fate: 134,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 15 },
      { counter: 'hpPctAtEnd', op: '>=', value: 0.9 }
    ]
  },
  {
    id: 'm05_menace_twenty_diamond',
    name: 'TWENTY, DORARARA',
    desc: 'Clear a full run as Crazy Diamond under Menace 20 or higher.',
    fate: 140,
    outcome: 'win',
    standId: 'crazy_diamond',
    requires: [
      { counter: 'menaceRank', op: '>=', value: 20 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm05_menace_twenty_lean',
    name: 'TWENTY, SIX SHARDS',
    desc: 'Win at Menace 20 having taken six Fragments or fewer all run.',
    fate: 142,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 20 },
      { counter: 'fragmentsTaken', op: '<=', value: 6 }
    ]
  },
  {
    id: 'm05_menace_twenty_gold',
    name: 'TWENTY UNSCARRED',
    desc: 'Win as Gold Experience at Menace 20 taking under 1200 damage.',
    fate: 141,
    outcome: 'win',
    standId: 'gold_experience',
    requires: [
      { counter: 'menaceRank', op: '>=', value: 20 },
      { counter: 'damageTaken', op: '<=', value: 1200 }
    ]
  },
  {
    id: 'm05_menace_twentyfive_queen',
    name: 'TWENTY-FIVE, BITE',
    desc: 'Clear a full run as Killer Queen under Menace 25 or higher.',
    fate: 145,
    outcome: 'win',
    standId: 'killer_queen',
    requires: [
      { counter: 'menaceRank', op: '>=', value: 25 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm05_menace_twentyfive_long',
    name: 'THE LONG ARREST',
    desc: 'Take 24 nodes as Sticky Fingers at Menace 25 or higher.',
    fate: 146,
    outcome: 'win',
    standId: 'sticky_fingers',
    requires: [
      { counter: 'menaceRank', op: '>=', value: 25 },
      { counter: 'nodesCleared', op: '>=', value: 24 }
    ]
  },
  {
    id: 'm05_menace_twentyfive_purist',
    name: 'TWENTY-FIVE PURIST',
    desc: 'Clear Menace 25 or higher carrying at most one Relic.',
    fate: 147,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 25 },
      { counter: 'relicCount', op: '<=', value: 1 }
    ]
  },
  {
    id: 'm05_menace_thirty_witness',
    name: 'STARE INTO THIRTY',
    desc: 'Reach Act 2 at Menace 30. Whether you leave it is your business.',
    fate: 148,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 30 },
      { counter: 'actReached', op: '>=', value: 2 }
    ]
  },
  {
    id: 'm05_menace_thirty_apex',
    name: 'THE THIRTIETH RANK',
    desc: 'Clear every act at Menace 30. The top of the ladder. No excuses.',
    fate: 150,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'menaceRank', op: '>=', value: 30 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  }
]);
