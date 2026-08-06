/* Daily/weekly challenge seeds -- GDD §21 deliverable 2, Phase 12. Fixed
   Stand + Aspect + Menace pact, identical for every player on the same
   UTC day/week, plus a local leaderboard. The seed IS the calendar date
   (or ISO week), so "today's run" is reproducible without any server:
   two players on the same machine, or the same player twice, draw the
   exact same map/offers/fight (invariant 1) because createRng(seed) is
   the only thing that varies here from an ordinary run.

   `donors: null` deliberately mirrors createFreshRunState's own default
   (fragment_offers.js: "an absent list means the whole pool") rather than
   gating the challenge by the player's own Archive unlocks -- a daily is
   the same challenge for a day-1 and a run-200 player alike. */

import { STANDS } from './data.js';
import { aspectsForStand, defaultAspectFor } from './aspects.js';
import { MENACE_CONDITIONS } from './meta_menace.js';
import { createRng } from './rng.js';

function isoWeekId(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function dailySeedId(date = new Date()) {
  return `daily-${date.toISOString().slice(0, 10)}`;
}
export function weeklySeedId(date = new Date()) {
  return `weekly-${isoWeekId(date)}`;
}

/* Deterministic loadout for a challenge seed: the seed string itself picks
   the Stand, its Aspect and a small fixed Menace pact (3 ranks across 3
   distinct conditions, rank 1 each -- a real but modest difficulty bump,
   never Menace 0 so a daily always means something over free play). */
export function challengeLoadout(seedId) {
  const rng = createRng(seedId).stream('challenge');
  const standIds = Object.keys(STANDS);
  const standId = rng.pick(standIds);
  const validAspects = aspectsForStand(standId);
  const aspect = validAspects.length ? rng.pick(validAspects) : null;
  const aspectId = (aspect && aspect.id) || defaultAspectFor(standId) || null;
  const conditions = [...MENACE_CONDITIONS];
  const pact = {};
  for (let i = 0; i < 3 && conditions.length; i++) {
    const idx = Math.floor(rng.random() * conditions.length);
    pact[conditions[idx].id] = 1;
    conditions.splice(idx, 1);
  }
  return { standId, aspectId, keepsakeId: null, menacePact: pact, donors: null, assist: null };
}

const LEADERBOARD_KEY = 'challengeLeaderboard'; // ctx.save-scoped (app-local, not synced -- "local leaderboard")
const MAX_ENTRIES_PER_SEED = 20;

export async function recordChallengeResult(ctx, seedId, entry) {
  const board = (await ctx.load(LEADERBOARD_KEY)) || {};
  const list = board[seedId] || [];
  list.push(entry);
  list.sort((a, b) => (b.actReached - a.actReached) || (a.hp === undefined ? 0 : b.hp - a.hp) || (a.ts - b.ts));
  board[seedId] = list.slice(0, MAX_ENTRIES_PER_SEED);
  await ctx.save(LEADERBOARD_KEY, board);
}

export async function loadChallengeLeaderboard(ctx, seedId) {
  const board = (await ctx.load(LEADERBOARD_KEY)) || {};
  return board[seedId] || [];
}
