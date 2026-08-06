/*
 * Bizarre Missions — batch 04 (GDD §10.2).
 *
 * Theme: per-Stand identity. Every entry pins `standId` and asks for
 * something that Stand is uniquely suited to — or uniquely bad at.
 * Close-range brawlers are pushed toward contact and precision,
 * long-range zoners toward Projection, tether strain and denial.
 * Pure data: no engine code, no imports, no bespoke branches.
 */

export const MISSIONS_04 = Object.freeze([
  // ---- Star Platinum: close-range precision brawler ----
  {
    id: 'm04_ora_ora_ora',
    name: 'ORA ORA ORA',
    desc: 'As Star Platinum, land 40 hits in a run without a single Projection.',
    fate: 85,
    outcome: 'win',
    standId: 'star_platinum',
    requires: [
      { counter: 'hits', op: '>=', value: 40 },
      { counter: 'projections', op: '==', value: 0 }
    ]
  },
  {
    id: 'm04_star_finger_precision',
    name: 'STAR FINGER',
    desc: 'Star Platinum: 12 crits and 4 perfect clashes in one run.',
    fate: 110,
    outcome: 'win',
    standId: 'star_platinum',
    requires: [
      { counter: 'crits', op: '>=', value: 12 },
      { counter: 'perfectClashes', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm04_time_stops_for_no_one',
    name: 'TIME STOPS',
    desc: 'Reach Act III with Star Platinum having never been guard-broken.',
    fate: 125,
    outcome: 'any',
    standId: 'star_platinum',
    requires: [
      { counter: 'actReached', op: '>=', value: 3 },
      { counter: 'guardBreaks', op: '==', value: 0 },
      { counter: 'hits', op: '>=', value: 90 }
    ]
  },

  // ---- Silver Chariot: mid-range fencer, fast light hits ----
  {
    id: 'm04_rapier_tempo',
    name: 'RAPIER TEMPO',
    desc: 'Silver Chariot: 200 moves in a run with fewer than 5 stagger states.',
    fate: 95,
    outcome: 'win',
    standId: 'silver_chariot',
    requires: [
      { counter: 'moves', op: '>=', value: 200 },
      { counter: 'staggers', op: '<=', value: 4 }
    ]
  },
  {
    id: 'm04_armor_off',
    name: 'ARMOR OFF',
    desc: 'Silver Chariot: 25 parries and 25 dodges before the run ends.',
    fate: 115,
    outcome: 'any',
    standId: 'silver_chariot',
    requires: [
      { counter: 'parries', op: '>=', value: 25 },
      { counter: 'dodges', op: '>=', value: 25 }
    ]
  },
  {
    id: 'm04_thousand_thrusts',
    name: 'THOUSAND THRUSTS',
    desc: 'Clear 10 nodes with Silver Chariot while taking under 300 damage.',
    fate: 130,
    outcome: 'any',
    standId: 'silver_chariot',
    requires: [
      { counter: 'nodesCleared', op: '>=', value: 10 },
      { counter: 'damageTaken', op: '<', value: 300 }
    ]
  },

  // ---- Hierophant Green: long-range zoner ----
  {
    id: 'm04_emerald_web',
    name: 'EMERALD WEB',
    desc: 'Hierophant Green: 120 Projections and 30 tether strains in one run.',
    fate: 100,
    outcome: 'any',
    standId: 'hierophant_green',
    requires: [
      { counter: 'projections', op: '>=', value: 120 },
      { counter: 'tetherStrains', op: '>=', value: 30 }
    ]
  },
  {
    id: 'm04_no_leash',
    name: 'NO LEASH',
    desc: 'Win with Hierophant Green having ended fewer than 20 Projections early.',
    fate: 105,
    outcome: 'win',
    standId: 'hierophant_green',
    requires: [
      { counter: 'projectEnds', op: '<=', value: 20 },
      { counter: 'projections', op: '>=', value: 60 }
    ]
  },
  {
    id: 'm04_zoner_denial',
    name: 'ZONER DENIAL',
    desc: 'Deny 40 enemy moves as Hierophant Green and survive above 60% HP.',
    fate: 135,
    outcome: 'win',
    standId: 'hierophant_green',
    requires: [
      { counter: 'movesDenied', op: '>=', value: 40 },
      { counter: 'hpPctAtEnd', op: '>=', value: 0.6 }
    ]
  },

  // ---- Killer Queen: mid-range detonator, one-shot lethal save ----
  {
    id: 'm04_first_bomb',
    name: 'FIRST BOMB',
    desc: 'Killer Queen: 15 kills in a run where you never spend a single yen.',
    fate: 90,
    outcome: 'win',
    standId: 'killer_queen',
    requires: [
      { counter: 'kills', op: '>=', value: 15 },
      { counter: 'yenSpent', op: '==', value: 0 }
    ]
  },
  {
    id: 'm04_third_bomb_answer',
    name: 'THIRD BOMB',
    desc: 'Fall as Killer Queen only after clearing an act and killing 2 elites.',
    fate: 120,
    outcome: 'loss',
    standId: 'killer_queen',
    requires: [
      { counter: 'actsCleared', op: '>=', value: 1 },
      { counter: 'eliteKills', op: '>=', value: 2 },
      { counter: 'menaceRank', op: '>=', value: 12 }
    ]
  },

  // ---- Crazy Diamond: close-range, restoration / return-to-position ----
  {
    id: 'm04_dora_restore',
    name: 'DORARARA',
    desc: 'Crazy Diamond: finish a run at full-ish HP after 4 rests or fewer.',
    fate: 100,
    outcome: 'win',
    standId: 'crazy_diamond',
    requires: [
      { counter: 'hpPctAtEnd', op: '>=', value: 0.9 },
      { counter: 'restsUsed', op: '<=', value: 4 }
    ]
  },
  {
    id: 'm04_fix_it_back',
    name: 'FIX IT BACK',
    desc: 'Crazy Diamond: 60 Projection returns and 6 flawless nodes in one run.',
    fate: 140,
    outcome: 'any',
    standId: 'crazy_diamond',
    requires: [
      { counter: 'projectEnds', op: '>=', value: 60 },
      { counter: 'flawlessNodes', op: '>=', value: 6 }
    ]
  },

  // ---- Gold Experience: close-range, life-giving / counter ----
  {
    id: 'm04_life_giver',
    name: 'LIFE GIVER',
    desc: 'Gold Experience: take 800 damage and still win the run.',
    fate: 115,
    outcome: 'win',
    standId: 'gold_experience',
    requires: [
      { counter: 'damageTaken', op: '>=', value: 800 },
      { counter: 'bossKills', op: '>=', value: 1 }
    ]
  },
  {
    id: 'm04_return_to_zero',
    name: 'RETURN TO ZERO',
    desc: 'Gold Experience: 30 parries with no rerolls and no removals used.',
    fate: 125,
    outcome: 'any',
    standId: 'gold_experience',
    requires: [
      { counter: 'parries', op: '>=', value: 30 },
      { counter: 'rerollsUsed', op: '==', value: 0 },
      { counter: 'removalsUsed', op: '==', value: 0 }
    ]
  },

  // ---- Sticky Fingers: mid-range zipper / reposition ----
  {
    id: 'm04_zipper_walk',
    name: 'ZIPPER WALK',
    desc: 'Sticky Fingers: 1200 steps taken across a single run.',
    fate: 70,
    outcome: 'any',
    standId: 'sticky_fingers',
    requires: [
      { counter: 'steps', op: '>=', value: 1200 }
    ]
  },
  {
    id: 'm04_arrivederci',
    name: 'ARRIVEDERCI',
    desc: 'Sticky Fingers: expose 20 parts and clear Act II in the same run.',
    fate: 120,
    outcome: 'any',
    standId: 'sticky_fingers',
    requires: [
      { counter: 'partsExposed', op: '>=', value: 20 },
      { counter: 'actsCleared', op: '>=', value: 2 }
    ]
  },

  // ---- Hermit Purple: long-range, thorn / divination ----
  {
    id: 'm04_thorn_vine_reach',
    name: 'THORN VINE',
    desc: 'Hermit Purple: 90 Projections while suffering under 10 feedback ticks.',
    fate: 130,
    outcome: 'any',
    standId: 'hermit_purple',
    requires: [
      { counter: 'projections', op: '>=', value: 90 },
      { counter: 'feedbackTicks', op: '<', value: 10 }
    ]
  },
  {
    id: 'm04_spirit_photography',
    name: 'SPIRIT PHOTO',
    desc: 'Hermit Purple: read 150 telegraphs and take zero guard breaks.',
    fate: 110,
    outcome: 'any',
    standId: 'hermit_purple',
    requires: [
      { counter: 'telegraphsSeen', op: '>=', value: 150 },
      { counter: 'guardBreaks', op: '<=', value: 0 }
    ]
  },
  {
    id: 'm04_divined_the_path',
    name: 'DIVINED THE PATH',
    desc: 'Hermit Purple: 8 distinct donors and 7 slots filled by Act III.',
    fate: 145,
    outcome: 'any',
    standId: 'hermit_purple',
    requires: [
      { counter: 'distinctDonors', op: '>=', value: 8 },
      { counter: 'slotsFilled', op: '>=', value: 7 },
      { counter: 'actReached', op: '>=', value: 3 }
    ]
  }
]);
