/* Menacing Presence — Track B (spec §7, GDD §8.3). The opt-in difficulty
   dial, and the ONLY source of permanent difficulty drift in the game.
   Off by default: an empty pact resolves to BASE_PROFILE, every field of
   which is the identity value, so a player who never touches this file's
   output plays exactly the pre-Phase-10 game.

   THE FIREWALL (spec §7, deliverable 1). This module's single output is a
   MenaceProfile: a frozen struct whose keys are exactly
   MENACE_PROFILE_KEYS and whose values are numbers and booleans. It has no
   field that can name a piece of content, and this file may not reference
   the Track A vocabulary at all -- meta_check.js's checkMenaceFirewall()
   asserts both mechanically, on every `npm run assert`. Track B changes
   how hard the run is; it can never change what is in the run.

   THE TELEGRAPH FLOOR (spec §5.1, GDD §6.8: ">= 260ms after all Menace
   modifiers are applied"). Note what is NOT in MENACE_PROFILE_KEYS: there
   is no windup/telegraph key. `enemyRecoveryMult` exists and is applied by
   resolvers.js's resolvePatternFrames to `recoverFrames` alone. Sharpened
   Instinct therefore cannot shorten a telegraph, not because the numbers
   happen not to reach it but because no channel from this file to a
   windup frame exists. The Menace-30 assertion in fairness_check.js is a
   second belt on top of that. */

/* The closed numeric vocabulary. A condition may write one of these keys
   and nothing else; anything not listed here is unreachable from a pact. */
export const MENACE_PROFILE_KEYS = Object.freeze([
  'enemyHpMult', 'enemyDamageMult', 'enemyRecoveryMult', 'extraEnemies',
  'healMult', 'shopPriceMult', 'offerCountDelta', 'enemyArmorAll',
  'countdownFrames', 'feedbackMult', 'invadesPerAct', 'requiemDenied',
  'actStartHpPct', 'bossPhase3Early'
]);

export const BASE_PROFILE = Object.freeze({
  enemyHpMult: 1, enemyDamageMult: 1, enemyRecoveryMult: 1, extraEnemies: 0,
  healMult: 1, shopPriceMult: 1, offerCountDelta: 0, enemyArmorAll: 0,
  countdownFrames: 0, feedbackMult: 1, invadesPerAct: 0, requiemDenied: false,
  actStartHpPct: 1, bossPhase3Early: false
});

export const MENACE_MAX_RANK = 30; // the ladder, GDD §8.3

/* The 14 conditions, purely declarative -- `mode` picks one of three
   generic combinators, so adding a condition is a data row and never an
   `if` in resolveMenace(). GDD §8.3's table verbatim, in its order. */
export const MENACE_CONDITIONS = Object.freeze([
  { id: 'bloodthirst', name: 'BLOODTHIRST', desc: 'Enemy HP +15% per rank', ranks: 5, key: 'enemyHpMult', mode: 'add', per: 0.15 },
  { id: 'killing_intent', name: 'KILLING INTENT', desc: 'Enemy damage +12% per rank', ranks: 5, key: 'enemyDamageMult', mode: 'add', per: 0.12 },
  { id: 'sharpened_instinct', name: 'SHARPENED INSTINCT', desc: 'Enemy recovery -8% per rank. Telegraphs untouched.', ranks: 3, key: 'enemyRecoveryMult', mode: 'add', per: -0.08 },
  { id: 'crowded', name: 'CROWDED', desc: '+1 enemy per encounter, per rank', ranks: 3, key: 'extraEnemies', mode: 'add', per: 1 },
  { id: 'rationing', name: 'RATIONING', desc: 'Healing -25% per rank', ranks: 3, key: 'healMult', mode: 'add', per: -0.25 },
  { id: 'inflation', name: 'INFLATION', desc: 'Shop prices +30% per rank', ranks: 3, key: 'shopPriceMult', mode: 'add', per: 0.30 },
  { id: 'scarcity', name: 'SCARCITY', desc: 'One fewer choice per reward offer, per rank', ranks: 2, key: 'offerCountDelta', mode: 'add', per: -1 },
  { id: 'unyielding', name: 'UNYIELDING', desc: 'Enemies gain armor on all attacks', ranks: 3, key: 'enemyArmorAll', mode: 'add', per: 1 },
  { id: 'countdown', name: 'COUNTDOWN', desc: 'Node timer; overrunning it summons an invader', ranks: 3, key: 'countdownFrames', mode: 'ladder', ladder: [3600, 2700, 1800] },
  { id: 'fragility', name: 'FRAGILITY', desc: 'Feedback rate +25% per rank', ranks: 3, key: 'feedbackMult', mode: 'add', per: 0.25 },
  { id: 'hunted', name: 'HUNTED', desc: 'Invaders arrive +1x per act, per rank', ranks: 3, key: 'invadesPerAct', mode: 'add', per: 1 },
  { id: 'requiem_denied', name: 'REQUIEM DENIED', desc: 'No Requiem Altar this run', ranks: 1, key: 'requiemDenied', mode: 'flag' },
  { id: 'pristine_condition', name: 'PRISTINE CONDITION', desc: 'Start each act at reduced HP', ranks: 2, key: 'actStartHpPct', mode: 'add', per: -0.15 },
  { id: 'convergence', name: 'CONVERGENCE', desc: 'Bosses reach their hidden third phase early', ranks: 1, key: 'bossPhase3Early', mode: 'flag' }
]);

const BY_ID = new Map(MENACE_CONDITIONS.map(c => [c.id, c]));

/* Total ranks on offer (40) deliberately exceeds MENACE_MAX_RANK (30): at
   the top of the ladder the player still chooses which ten ranks to leave
   on the table, so Menace 30 is a build decision, not one fixed loadout. */
export function totalAvailableRanks() {
  return MENACE_CONDITIONS.reduce((n, c) => n + c.ranks, 0);
}

export function menaceRankOf(pact) {
  if (!pact) return 0;
  return MENACE_CONDITIONS.reduce((n, c) => n + clampRank(c, pact[c.id]), 0);
}

function clampRank(cond, raw) {
  const r = Math.floor(Number(raw) || 0);
  return Math.max(0, Math.min(cond.ranks, r));
}

/* A pact ({conditionId: rank}) resolves to exactly one frozen profile.
   Unknown ids are dropped rather than throwing -- a save written before a
   condition was renamed must not brick the meta blob (invariant 7). */
export function createMenaceProfile(pact) {
  const p = { ...BASE_PROFILE };
  if (pact) {
    for (const id of Object.keys(pact)) {
      const cond = BY_ID.get(id);
      if (!cond) continue;
      const rank = clampRank(cond, pact[id]);
      if (rank <= 0) continue;
      if (cond.mode === 'add') p[cond.key] = p[cond.key] + cond.per * rank;
      else if (cond.mode === 'ladder') p[cond.key] = cond.ladder[Math.min(rank, cond.ladder.length) - 1];
      else if (cond.mode === 'flag') p[cond.key] = true;
    }
  }
  /* Floors on the multipliers, so a future condition table can never make
     one non-positive and invert a resolver's sign. */
  p.enemyRecoveryMult = Math.max(0.35, p.enemyRecoveryMult);
  p.healMult = Math.max(0, p.healMult);
  p.actStartHpPct = Math.max(0.4, p.actStartHpPct);
  return Object.freeze(p);
}

/* Pact editing, used by the Menace board. Returns a new pact object;
   never mutates, so the board can preview a rank before committing. */
export function setCondition(pact, id, rank) {
  const cond = BY_ID.get(id);
  if (!cond) return pact;
  const next = { ...(pact || {}) };
  const r = clampRank(cond, rank);
  if (r <= 0) delete next[id]; else next[id] = r;
  return next;
}

export function conditionById(id) { return BY_ID.get(id) || null; }

/* Per-Stand tracking (GDD §8.3: "Rank is tracked per Stand, so mastering
   the ladder four times is four separate journeys"). */
export function bestRankFor(menaceState, standId) {
  if (!menaceState || !menaceState.best) return 0;
  return menaceState.best[standId] || 0;
}

export function pactFor(menaceState, standId) {
  if (!menaceState || !menaceState.pacts) return {};
  return menaceState.pacts[standId] || {};
}

/* Called at run end. Records a new personal best for this Stand and
   returns the titles newly earned. Titles are bragging rights only, per
   GDD §9.2 -- see meta_fate.js for the Fate side, and the phase report
   for why the payout is Fate + title and never anything else. */
export const MENACE_TITLES = Object.freeze([
  { at: 1, title: 'MENACING' }, { at: 5, title: 'THREATENING' },
  { at: 10, title: 'DREADFUL' }, { at: 15, title: 'OVERWHELMING' },
  { at: 20, title: 'TERRIFYING' }, { at: 25, title: 'BIZARRE' },
  { at: 30, title: 'THE WORLD ITSELF' }
]);

export function recordMenaceClear(menaceState, standId, rank) {
  const prev = bestRankFor(menaceState, standId);
  if (rank <= prev) return { improved: false, titles: [] };
  menaceState.best = menaceState.best || {};
  menaceState.best[standId] = rank;
  const titles = MENACE_TITLES.filter(t => t.at > prev && t.at <= rank).map(t => t.title);
  return { improved: true, titles };
}
