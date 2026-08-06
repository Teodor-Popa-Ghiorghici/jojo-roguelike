/*
 * Bizarre Missions — batch 06 (GDD §10.2).
 * Theme: bosses, endurance, and the long tail.
 * Phase transitions, purges, exposed-User parts, deep runs,
 * economy extremes (rich and broke), attrition, and the
 * "died gloriously" payouts that GDD §9.5 requires — death is
 * never zero, so several entries settle on outcome: 'loss'.
 * Pure data: no imports, no engine code, no bespoke branches.
 */

export const MISSIONS_06 = Object.freeze([
  {
    id: 'm06_the_third_phase',
    name: 'THE THIRD PHASE',
    desc: 'Push a single boss all the way through both of its phase changes.',
    fate: 55,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'phaseTransitions', op: '>=', value: 2 }
    ]
  },
  {
    id: 'm06_ten_masks_dropped',
    name: 'TEN MASKS DROPPED',
    desc: 'Witness every boss in the run shed both of its masks.',
    fate: 130,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'phaseTransitions', op: '>=', value: 18 },
      { counter: 'bossKills', op: '>=', value: 9 }
    ]
  },
  {
    id: 'm06_strike_the_user',
    name: 'STRIKE THE USER',
    desc: 'Kill a boss by carving into the User behind the Stand.',
    fate: 105,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'partsExposed', op: '>=', value: 6 },
      { counter: 'bossKills', op: '>=', value: 1 }
    ]
  },
  {
    id: 'm06_flesh_under_armor',
    name: 'FLESH UNDER ARMOR',
    desc: 'Expose the User again and again across a full run.',
    fate: 140,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'partsExposed', op: '>=', value: 20 },
      { counter: 'actsCleared', op: '>=', value: 3 }
    ]
  },
  {
    id: 'm06_purge_the_board',
    name: 'PURGE THE BOARD',
    desc: 'Survive a dozen boss purges without the run ending.',
    fate: 120,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'purges', op: '>=', value: 12 }
    ]
  },
  {
    id: 'm06_purge_untouched',
    name: 'PURGE UNTOUCHED',
    desc: 'Eat six purges and still finish above three quarters health.',
    fate: 135,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'purges', op: '>=', value: 6 },
      { counter: 'hpPctAtEnd', op: '>=', value: 0.75 }
    ]
  },
  {
    id: 'm06_bitter_end',
    name: 'BITTER END',
    desc: 'Fall in Act 4 — the long walk counts even when it ends badly.',
    fate: 90,
    outcome: 'loss',
    standId: null,
    requires: [
      { counter: 'actReached', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm06_died_gloriously',
    name: 'DIED GLORIOUSLY',
    desc: 'Die with at least six bosses already buried behind you.',
    fate: 115,
    outcome: 'loss',
    standId: null,
    requires: [
      { counter: 'bossKills', op: '>=', value: 6 },
      { counter: 'nodesCleared', op: '>=', value: 20 }
    ]
  },
  {
    id: 'm06_last_stand_taken',
    name: 'LAST STAND TAKEN',
    desc: 'Lose the run only after triggering a final phase transition.',
    fate: 100,
    outcome: 'loss',
    standId: null,
    requires: [
      { counter: 'phaseTransitions', op: '>=', value: 14 },
      { counter: 'damageDealt', op: '>=', value: 9000 }
    ]
  },
  {
    id: 'm06_no_regrets',
    name: 'NO REGRETS',
    desc: 'Die having spent every last yen you ever picked up.',
    fate: 70,
    outcome: 'loss',
    standId: null,
    requires: [
      { counter: 'yenSpent', op: '>=', value: 500 },
      { counter: 'actReached', op: '>=', value: 3 }
    ]
  },
  {
    id: 'm06_bleeding_out',
    name: 'BLEEDING OUT',
    desc: 'Reach the final act on fumes: under a tenth of your health left.',
    fate: 125,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'actReached', op: '>=', value: 4 },
      { counter: 'hpPctAtEnd', op: '<=', value: 0.1 }
    ]
  },
  {
    id: 'm06_war_of_attrition',
    name: 'WAR OF ATTRITION',
    desc: 'Take punishing damage all run and still clear the last act.',
    fate: 130,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'damageTaken', op: '>=', value: 6000 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm06_no_rest_for_jotaro',
    name: 'NO REST FOR JOTARO',
    desc: 'Clear the whole map without ever sitting down to rest.',
    fate: 145,
    outcome: 'win',
    standId: 'star_platinum',
    requires: [
      { counter: 'restsUsed', op: '==', value: 0 },
      { counter: 'actsCleared', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm06_broke_and_bizarre',
    name: 'BROKE AND BIZARRE',
    desc: 'Reach the third act having never once walked into a shop.',
    fate: 110,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'shopsVisited', op: '==', value: 0 },
      { counter: 'actReached', op: '>=', value: 3 }
    ]
  },
  {
    id: 'm06_filthy_rich',
    name: 'FILTHY RICH',
    desc: 'Hoard a thousand yen out of a single winning run.',
    fate: 85,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'yenEarned', op: '>=', value: 1000 }
    ]
  },
  {
    id: 'm06_bought_the_win',
    name: 'BOUGHT THE WIN',
    desc: 'Burn nine hundred yen and every reroll you can afford.',
    fate: 95,
    outcome: 'win',
    standId: 'sticky_fingers',
    requires: [
      { counter: 'yenSpent', op: '>=', value: 900 },
      { counter: 'rerollsUsed', op: '>=', value: 10 }
    ]
  },
  {
    id: 'm06_the_long_tail',
    name: 'THE LONG TAIL',
    desc: 'Clear twenty-six nodes in one uninterrupted descent.',
    fate: 120,
    outcome: 'win',
    standId: null,
    requires: [
      { counter: 'nodesCleared', op: '>=', value: 26 }
    ]
  },
  {
    id: 'm06_kings_menace',
    name: "KING'S MENACE",
    desc: 'Drive Menace to its ceiling and still cut down the last boss.',
    fate: 150,
    outcome: 'win',
    standId: 'killer_queen',
    requires: [
      { counter: 'menaceRank', op: '>=', value: 27 },
      { counter: 'bossKills', op: '>=', value: 10 }
    ]
  },
  {
    id: 'm06_endless_tension',
    name: 'ENDLESS TENSION',
    desc: 'Hold maximum Tension while grinding down four elite foes.',
    fate: 80,
    outcome: 'any',
    standId: null,
    requires: [
      { counter: 'tensionMax', op: '>=', value: 6 },
      { counter: 'eliteKills', op: '>=', value: 4 }
    ]
  },
  {
    id: 'm06_healers_marathon',
    name: "HEALER'S MARATHON",
    desc: 'Finish a deep run at full health with the Doctor of Morioh.',
    fate: 140,
    outcome: 'win',
    standId: 'crazy_diamond',
    requires: [
      { counter: 'hpPctAtEnd', op: '>=', value: 0.99 },
      { counter: 'nodesCleared', op: '>=', value: 22 },
      { counter: 'flawlessNodes', op: '>=', value: 8 }
    ]
  }
]);
