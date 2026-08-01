/* Encounter budget generator — GDD §4.4's composition rules, deliverable 6.
   Generic over whatever fields an ENEMIES entry (data.js) carries, never
   over an enemy id by name: adding a fourth crowd type (a Shielder, a
   Sniper, a Caller) is a `cost`/`ranged`/`role`/`clashable` data entry, and
   these rules apply to it automatically.

   Rules (GDD §4.4):
     - never more than 2 ranged types at once
     - never a Shielder without something already pressuring the player
     - at most one Caller
     - always at least one enemy that can be safely Clashed (the fairness
       floor, spec §5) */

import { ENEMIES } from './data.js';

const MAX_RANGED = 2;
const MAX_CALLERS = 1;

export function generateEncounterBudget(rng, budget, pool) {
  const chosen = [];
  let remaining = budget, rangedCount = 0, callerCount = 0;

  while (remaining > 0) {
    const options = pool.filter(id => {
      const def = ENEMIES[id];
      if (!def || def.cost > remaining) return false;
      if (def.ranged && rangedCount >= MAX_RANGED) return false;
      if (def.role === 'caller' && callerCount >= MAX_CALLERS) return false;
      if (def.role === 'shielder' && chosen.length === 0) return false;
      return true;
    });
    if (!options.length) break;
    const pick = rng.pick(options);
    chosen.push(pick);
    remaining -= ENEMIES[pick].cost;
    if (ENEMIES[pick].ranged) rangedCount++;
    if (ENEMIES[pick].role === 'caller') callerCount++;
  }

  /* Fairness floor repair (spec §5 / GDD §4.4): if nothing drawn happens to
     be Clash-able, swap the first pick for the cheapest Clash-able option
     the pool offers rather than shipping a composition that fails it. */
  if (chosen.length && !chosen.some(id => ENEMIES[id].clashable !== false)) {
    const fallback = pool.find(id => ENEMIES[id].clashable !== false);
    if (fallback) chosen[0] = fallback;
  }
  return chosen;
}
