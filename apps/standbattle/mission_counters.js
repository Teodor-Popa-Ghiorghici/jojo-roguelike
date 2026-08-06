/* The Bizarre Missions counter vocabulary (GDD §10.2). Missions are data;
   this is the closed set of facts a mission may ask about, so a new
   mission is a row in missions_*.js and never an `if` in the engine.

   COMBAT_COUNTERS are accumulated live by mission_tracker.js from
   hooks.js's existing EVENT/EFFECT hooks -- no new instrumentation, and
   the tracker only ever *reads* combat state (invariant 8). RUN_COUNTERS
   are read off runState once at run end. Nothing here writes sim state. */

/* counter -> the hook that feeds it, and how. `field` names the payload
   number to add; absent means "count the occurrence". `when` names an
   optional boolean payload field that must be truthy. */
export const COMBAT_COUNTERS = Object.freeze({
  moves: { hook: 'onMoveStart' },
  hits: { hook: 'onHitLanded', when: 'isPlayerAttacker' },
  crits: { hook: 'onHitLanded', when: 'crit' },
  damageDealt: { hook: 'onHitLanded', when: 'isPlayerAttacker', field: 'damage' },
  damageTaken: { hook: 'onDamageTaken', field: 'damage' },
  kills: { hook: 'onKill' },
  dodges: { hook: 'onDodgeSuccess' },
  parries: { hook: 'onParrySuccess' },
  clashes: { hook: 'onClashSuccess' },
  perfectClashes: { hook: 'onPerfectClash' },
  guardBreaks: { hook: 'onGuardBreak' },
  staggers: { hook: 'onStaggerStart' },
  steps: { hook: 'onStepStart' },
  projections: { hook: 'onProjectStart' },
  projectEnds: { hook: 'onProjectEnd' },
  tetherStrains: { hook: 'onTetherStrain' },
  feedbackTicks: { hook: 'onFeedbackDamage' },
  movesDenied: { hook: 'onMoveDenied' },
  telegraphsSeen: { hook: 'onTelegraphStart' },
  phaseTransitions: { hook: 'onPhaseTransition' },
  purges: { hook: 'onPurge' },
  partsExposed: { hook: 'onPartExposed' }
});

/* Read off runState / the run result at run end. */
export const RUN_COUNTERS = Object.freeze([
  'actReached', 'actsCleared', 'nodesCleared', 'hpAtEnd', 'hpPctAtEnd',
  'yenEarned', 'yenSpent', 'tensionMax', 'menaceRank',
  'fragmentsTaken', 'slotsFilled', 'relicCount', 'duoCount', 'discCount',
  'distinctDonors', 'maxDonorSlots', 'upgradesUsed', 'rerollsUsed', 'removalsUsed',
  'restsUsed', 'shopsVisited', 'flawlessNodes', 'bossKills', 'eliteKills'
]);

export const ALL_COUNTERS = Object.freeze([...Object.keys(COMBAT_COUNTERS), ...RUN_COUNTERS]);

export const MISSION_OPS = Object.freeze({
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '==': (a, b) => a === b
});
