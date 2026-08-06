/* Boss Reprises -- GDD §5's "so the fortieth encounter is not the first
   one again": 3 variants per boss (different signature timing, an extra
   module, a swapped hazard), generated from a small transform instead of
   30 hand-authored full boss defs -- exactly the "content is data, never
   a new code path" rule CLAUDE.md sets for the rest of the project,
   applied to Reprises too even though the phase brief calls Rule Fights
   (not these) "bespoke by nature".

   - "different signature timing": `recoveryMult` on the derived boss def,
     read by resolvers.js's resolvePatternFrames (encounter.js's spawnWave
     stamps it onto the enemy's own ai object) -- the same choke point
     Menace's own recovery scaling already goes through, one more source.
   - "an extra module": one more attack pattern appended to the final
     phase's own list -- ai.js's PATTERNS are already a shared library, so
     "extra" here just means "one more id from that same library".
   - "a swapped hazard": wraps the reprise in encounter_objectives.js's
     existing Hazard objective (Phase 11-A) instead of a new arena-rule
     mechanism -- zero new code, one more `objective: 'hazard'` def. */

import { BOSSES } from './data_bosses.js';

const HAZARD_SWAP = { radius: 48, tickFrames: 20, dmg: 5, lifeFrames: 200 };

const VARIANTS = [
  { tag: 'quickened', suffix: 'QUICKENED', recoveryMult: 0.7 },
  { tag: 'reinforced', suffix: 'REINFORCED', extraModule: 'telegraphed_slam' },
  { tag: 'scorched', suffix: 'SCORCHED', arenaHazard: true }
];

function deriveReprise(bossId, variant) {
  const base = BOSSES[bossId];
  const phases = base.phases.map((p, i) => (
    i === base.phases.length - 1 && variant.extraModule
      ? { ...p, attackPatterns: [...p.attackPatterns, variant.extraModule] }
      : p
  ));
  return { ...base, id: `${bossId}_${variant.tag}`, phases, recoveryMult: variant.recoveryMult || 1 };
}

/* Builds all 3 variant ENCOUNTER defs (not just boss defs) for one boss --
   each a trivial one-wave encounter exactly like a vanilla Elite wrap
   (data_encounters.js), so map_gen.js's `{ encounter: id }` pool entries
   need no special case for a reprise vs. an original. */
export function repriseEncountersFor(bossId, label) {
  return VARIANTS.map(v => {
    const boss = deriveReprise(bossId, v);
    const def = { id: boss.id, label: `${label} -- ${v.suffix}`, winCondition: 'killAll', waves: [{ types: [boss] }] };
    if (v.arenaHazard) { def.objective = 'hazard'; def.arenaHazards = [{ delay: 150, repeat: 260, hazard: HAZARD_SWAP }]; }
    return def;
  });
}

const BOSS_LABELS = [
  ['killer_queen', 'KILLER QUEEN'], ['yuya_fungami', 'HIGHWAY STAR'], ['hol_horse', 'HOL HORSE'],
  ['ndoul', "N'DOUL"], ['dio', 'THE WORLD'], ['formaggio', 'LITTLE FEET'], ['illuso', 'MAN IN THE MIRROR'],
  ['diavolo', 'KING CRIMSON'], ['funny_valentine', 'DIRTY DEEDS DONE DIRT CHEAP'], ['pucci', 'MADE IN HEAVEN']
];

// All 30 reprise encounters, id-keyed exactly like data_encounters.js's ENCOUNTERS -- map_gen.js resolves either the same way.
export const BOSS_REPRISES = {};
BOSS_LABELS.forEach(([id, label]) => repriseEncountersFor(id, label).forEach(def => { BOSS_REPRISES[def.id] = def; }));
