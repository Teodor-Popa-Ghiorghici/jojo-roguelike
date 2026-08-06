/*
 * Bizarre Missions — batch 01 (GDD §10.2).
 *
 * Theme: fundamentals & first steps. These are the directives a player
 * meets in runs 1-15: clear an act, land the basic combat verbs, kill a
 * first boss, take a first Fragment, spend a first yen. Each one is
 * achievable early, but none of them completes itself — every entry asks
 * the player to lean on a specific verb harder than they otherwise would.
 *
 * Pure data. No engine code lives here.
 */

export const MISSIONS_01 = Object.freeze([
  {
    id: 'm01_first_steps',
    name: 'FIRST STEPS',
    desc: 'Clear Act 1. Morioh is only the doorway.',
    fate: 40,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'actsCleared', op: '>=', value: 1 }]
  },
  {
    id: 'm01_hundred_fists',
    name: 'A HUNDRED FISTS',
    desc: 'Land 200 hits in a single run. Volume before finesse.',
    fate: 45,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'hits', op: '>=', value: 200 }]
  },
  {
    id: 'm01_ora_barrage',
    name: 'ORA ORA ORA',
    desc: 'As Star Platinum: 300 hits and 20 crits in one run.',
    fate: 60,
    outcome: 'any',
    standId: 'star_platinum',
    requires: [
      { counter: 'hits', op: '>=', value: 300 },
      { counter: 'crits', op: '>=', value: 20 }
    ]
  },
  {
    id: 'm01_read_the_tell',
    name: 'READ THE TELL',
    desc: 'Watch 60 telegraphs while taking no more than 250 damage.',
    fate: 70,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'telegraphsSeen', op: '>=', value: 60 },
      { counter: 'damageTaken', op: '<=', value: 250 }
    ]
  },
  {
    id: 'm01_clash_of_wills',
    name: 'CLASH OF WILLS',
    desc: 'Enter 10 clashes and win 3 of them perfectly.',
    fate: 55,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'clashes', op: '>=', value: 10 },
      { counter: 'perfectClashes', op: '>=', value: 3 }
    ]
  },
  {
    id: 'm01_untouched',
    name: 'UNTOUCHED',
    desc: 'Clear 3 nodes without taking a single point of damage.',
    fate: 70,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'flawlessNodes', op: '>=', value: 3 }]
  },
  {
    id: 'm01_the_bomber_falls',
    name: 'THE BOMBER FALLS',
    desc: 'Win a run and put down at least one boss on the way.',
    fate: 65,
    outcome: 'win',
    standId: null,
    requires: [{ counter: 'bossKills', op: '>=', value: 1 }]
  },
  {
    id: 'm01_first_fragments',
    name: 'FIRST FRAGMENTS',
    desc: 'Take 3 Fragments. Stop walking past the pedestal.',
    fate: 40,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'fragmentsTaken', op: '>=', value: 3 }]
  },
  {
    id: 'm01_fill_the_grid',
    name: 'FILL THE GRID',
    desc: 'Finish the run with 5 or more Fragment slots filled.',
    fate: 55,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'slotsFilled', op: '>=', value: 5 }]
  },
  {
    id: 'm01_footwork',
    name: 'FOOTWORK',
    desc: 'Dodge 40 times and end the run under 400 damage taken.',
    fate: 50,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'dodges', op: '>=', value: 40 },
      { counter: 'damageTaken', op: '<=', value: 400 }
    ]
  },
  {
    id: 'm01_parry_drill',
    name: 'PARRY DRILL',
    desc: 'As Silver Chariot: turn aside 25 attacks with clean parries.',
    fate: 65,
    outcome: 'any',
    standId: 'silver_chariot',
    requires: [{ counter: 'parries', op: '>=', value: 25 }]
  },
  {
    id: 'm01_out_of_body',
    name: 'OUT OF BODY',
    desc: 'As Hierophant Green: 25 projections, no more than 4 strains.',
    fate: 70,
    outcome: 'any',
    standId: 'hierophant_green',
    requires: [
      { counter: 'projections', op: '>=', value: 25 },
      { counter: 'tetherStrains', op: '<=', value: 4 }
    ]
  },
  {
    id: 'm01_open_the_guard',
    name: 'OPEN THE GUARD',
    desc: 'Break 10 guards and force 12 staggers in one run.',
    fate: 60,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'guardBreaks', op: '>=', value: 10 },
      { counter: 'staggers', op: '>=', value: 12 }
    ]
  },
  {
    id: 'm01_pocket_money',
    name: 'POCKET MONEY',
    desc: 'Earn 400 yen and spend 350 of it. Hoarding is a loss.',
    fate: 50,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'yenEarned', op: '>=', value: 400 },
      { counter: 'yenSpent', op: '>=', value: 350 }
    ]
  },
  {
    id: 'm01_window_shopping',
    name: 'WINDOW SHOPPING',
    desc: 'Visit 3 shops and put 2 upgrades into your Fragments.',
    fate: 50,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'shopsVisited', op: '>=', value: 3 },
      { counter: 'upgradesUsed', op: '>=', value: 2 }
    ]
  },
  {
    id: 'm01_doctors_orders',
    name: "DOCTOR'S ORDERS",
    desc: 'As Crazy Diamond: win above half HP, purging 3 statuses.',
    fate: 75,
    outcome: 'win',
    standId: 'crazy_diamond',
    requires: [
      { counter: 'hpPctAtEnd', op: '>=', value: 0.5 },
      { counter: 'purges', op: '>=', value: 3 }
    ]
  },
  {
    id: 'm01_march_on',
    name: 'MARCH ON',
    desc: 'Clear 12 nodes before the run ends, however it ends.',
    fate: 60,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'nodesCleared', op: '>=', value: 12 }]
  },
  {
    id: 'm01_elite_appetite',
    name: 'ELITE APPETITE',
    desc: 'Hunt down 3 elites instead of taking the safe path.',
    fate: 70,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'eliteKills', op: '>=', value: 3 }]
  },
  {
    id: 'm01_no_rest',
    name: 'NO REST',
    desc: 'Clear an act without ever stopping to rest.',
    fate: 85,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'restsUsed', op: '==', value: 0 },
      { counter: 'actsCleared', op: '>=', value: 1 }
    ]
  },
  {
    id: 'm01_go_down_swinging',
    name: 'GO DOWN SWINGING',
    desc: 'Lose the run, but deal 1500 damage and take 20 kills with you.',
    fate: 40,
    outcome: 'loss',
    standId: null,
    requires: [
      { counter: 'damageDealt', op: '>=', value: 1500 },
      { counter: 'kills', op: '>=', value: 20 }
    ]
  }
]);
