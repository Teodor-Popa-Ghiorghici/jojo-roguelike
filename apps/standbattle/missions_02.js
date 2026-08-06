/*
 * Bizarre Missions — batch 02 (GDD §10.2).
 * Theme: defensive mastery, the execution ceiling.
 * Clash, Perfect Clash, parry, dodge, guard-break, stagger and
 * telegraph reading — the defensive triangle taught by demand.
 * Several entries invert the usual pressure and ask for restraint:
 * clear without being touched, or win having barely dodged at all.
 * Pure data. No engine code, no imports, no bespoke branches.
 */

export const MISSIONS_02 = Object.freeze([
  {
    id: 'm02_first_clash',
    name: 'STEEL ON STEEL',
    desc: 'Meet a Stand fist with your own. Clash five times in one run.',
    fate: 40,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'clashes', op: '>=', value: 5 }]
  },
  {
    id: 'm02_read_the_wind',
    name: 'READ THE WIND',
    desc: 'Watch thirty telegraphs resolve before you commit to anything.',
    fate: 45,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'telegraphsSeen', op: '>=', value: 30 }]
  },
  {
    id: 'm02_parry_school',
    name: 'PARRY SCHOOL',
    desc: 'Turn aside twelve blows in a single winning run.',
    fate: 55,
    outcome: 'win',
    standId: null,
    requires: [{ counter: 'parries', op: '>=', value: 12 }]
  },
  {
    id: 'm02_perfect_timing',
    name: 'PERFECT TIMING',
    desc: 'Land three Perfect Clashes. The window is one frame wide.',
    fate: 80,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'perfectClashes', op: '>=', value: 3 }]
  },
  {
    id: 'm02_ora_ora_wall',
    name: 'THE ORA WALL',
    desc: 'As Star Platinum, win five Perfect Clashes in one run.',
    fate: 110,
    outcome: 'win',
    standId: 'star_platinum',
    requires: [{ counter: 'perfectClashes', op: '>=', value: 5 }]
  },
  {
    id: 'm02_untouched_act',
    name: 'UNTOUCHED',
    desc: 'Clear an entire act taking six damage or less, total.',
    fate: 95,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'actsCleared', op: '>=', value: 1 },
      { counter: 'damageTaken', op: '<=', value: 6 }
    ]
  },
  {
    id: 'm02_flawless_five',
    name: 'FLAWLESS FIVE',
    desc: 'Clear five nodes without taking a single point of damage.',
    fate: 90,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'flawlessNodes', op: '>=', value: 5 }]
  },
  {
    id: 'm02_no_dodge_doctrine',
    name: 'NO DODGE DOCTRINE',
    desc: 'Win with three dodges or fewer. Block, do not run.',
    fate: 100,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'dodges', op: '<=', value: 3 },
      { counter: 'parries', op: '>=', value: 8 }
    ]
  },
  {
    id: 'm02_guard_breaker',
    name: 'GUARD BREAKER',
    desc: 'Shatter ten guards. Defence cuts both ways.',
    fate: 60,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'guardBreaks', op: '>=', value: 10 }]
  },
  {
    id: 'm02_stagger_chain',
    name: 'STAGGER CHAIN',
    desc: 'Rock enemies off their stance fifteen times in one run.',
    fate: 65,
    outcome: 'any',
    standId: null,
    requires: [{ counter: 'staggers', op: '>=', value: 15 }]
  },
  {
    id: 'm02_chariot_riposte',
    name: 'CHARIOT RIPOSTE',
    desc: 'Silver Chariot: fifteen parries, and win the fight after each.',
    fate: 105,
    outcome: 'win',
    standId: 'silver_chariot',
    requires: [
      { counter: 'parries', op: '>=', value: 15 },
      { counter: 'damageTaken', op: '<=', value: 60 }
    ]
  },
  {
    id: 'm02_emerald_screen',
    name: 'EMERALD SCREEN',
    desc: 'Hierophant Green: deny twelve moves before they ever land.',
    fate: 85,
    outcome: 'any',
    standId: 'hierophant_green',
    requires: [{ counter: 'movesDenied', op: '>=', value: 12 }]
  },
  {
    id: 'm02_boss_no_hits',
    name: 'IMMACULATE KILL',
    desc: 'Kill a boss having taken under twenty damage all run.',
    fate: 130,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'bossKills', op: '>=', value: 1 },
      { counter: 'damageTaken', op: '<', value: 20 }
    ]
  },
  {
    id: 'm02_full_health_finish',
    name: 'NOT A SCRATCH',
    desc: 'Finish a winning run at ninety-five percent health or better.',
    fate: 120,
    outcome: 'win',
    standId: null,
    requires: [{ counter: 'hpPctAtEnd', op: '>=', value: 0.95 }]
  },
  {
    id: 'm02_patient_hands',
    name: 'PATIENT HANDS',
    desc: 'Reach act three having thrown fewer than eighty moves.',
    fate: 75,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'actReached', op: '>=', value: 3 },
      { counter: 'moves', op: '<', value: 80 }
    ]
  },
  {
    id: 'm02_elite_defence',
    name: 'ELITE DEFENCE',
    desc: 'Put down three elites while clashing at least eight times.',
    fate: 95,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'eliteKills', op: '>=', value: 3 },
      { counter: 'clashes', op: '>=', value: 8 }
    ]
  },
  {
    id: 'm02_queen_composure',
    name: 'QUEEN’S COMPOSURE',
    desc: 'Killer Queen: win with two Perfect Clashes and no lost act.',
    fate: 115,
    outcome: 'win',
    standId: 'killer_queen',
    requires: [
      { counter: 'perfectClashes', op: '>=', value: 2 },
      { counter: 'actsCleared', op: '>=', value: 3 }
    ]
  },
  {
    id: 'm02_no_healing_wall',
    name: 'STONE DISCIPLINE',
    desc: 'Clear two acts without a single rest, above half health.',
    fate: 100,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'restsUsed', op: '==', value: 0 },
      { counter: 'actsCleared', op: '>=', value: 2 },
      { counter: 'hpPctAtEnd', op: '>', value: 0.5 }
    ]
  },
  {
    id: 'm02_diamond_repair',
    name: 'DOROLA GUARD',
    desc: 'Crazy Diamond: twenty staggers, six guard breaks, one win.',
    fate: 90,
    outcome: 'win',
    standId: 'crazy_diamond',
    requires: [
      { counter: 'staggers', op: '>=', value: 20 },
      { counter: 'guardBreaks', op: '>=', value: 6 }
    ]
  },
  {
    id: 'm02_execution_ceiling',
    name: 'EXECUTION CEILING',
    desc: 'The full run: eight Perfect Clashes, ten flawless nodes, no loss.',
    fate: 150,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'perfectClashes', op: '>=', value: 8 },
      { counter: 'flawlessNodes', op: '>=', value: 10 },
      { counter: 'nodesCleared', op: '>=', value: 24 }
    ]
  }
]);
