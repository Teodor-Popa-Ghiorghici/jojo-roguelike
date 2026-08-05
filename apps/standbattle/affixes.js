/* Affixes -- GDD §4.3/spec §13, Phase 9b. Rolled at spawn (rollAffixes),
   never hand-authored per encounter. A "hook" affix's `effects`/`queries`
   install through content_registry.js's installAffix (the same
   EFFECT_LIB/QUERY_LIB verb vocabulary Fragments use, invariant 6, just
   scoped to one enemy instance instead of the whole run). A "flag" affix
   has no hook at all: applyAffixesToEnemy copies its `magnitude` onto
   `entity.affixData[id]` generically, and the *few* resolver choke points
   that read it by name (resolvers.js/poise.js/status.js/combat_enemy.js)
   are exactly the same "read one more optional def field" idiom Warden's
   `detachedStandPunishMult` already established -- not a new code path per
   affix, one optional field per consumer, shared by however many affixes
   want it.

   `announce: true` on every entry is the fairness contract itself (GDD
   §4.3: "visible before the fight starts") -- encounter.js's spawnWave
   reads `name` into combat.banner (the exact mechanism wave-arrival/phase-
   transition banners already use) and `tint` overrides the enemy's own
   sprite tint, both wired before the fight's first frame ever steps. */

import { PAL } from './data.js';
import { spawnHazard } from './hazards.js';
import { spawnMinions } from './summons.js';
import { installAffix } from './content_registry.js';

export const AFFIXES = {
  bomb_primed: {
    id: 'bomb_primed', name: 'Bomb-Primed', tint: PAL.lmagenta, announce: true,
    effects: [{ hook: 'onKill', fn: 'explodeOnDeath', data: { dmg: 24, pctMaxHp: 0.12, radius: 70 } }]
  },
  mirrored: {
    id: 'mirrored', name: 'Mirrored', tint: PAL.lcyan, announce: true, magnitude: 0.3
  },
  requiem_touched: {
    id: 'requiem_touched', name: 'Requiem-Touched', tint: PAL.magenta, announce: true, magnitude: 0.4
  },
  vampiric: {
    id: 'vampiric', name: 'Vampiric', tint: PAL.red, announce: true,
    effects: [{ hook: 'onDamageTaken', fn: 'healAttackerPctOfDamage', data: { pct: 0.3 } }]
  },
  warded: {
    id: 'warded', name: 'Warded', tint: PAL.white, announce: true, magnitude: true
  },
  hasted: {
    id: 'hasted', name: 'Hasted', tint: PAL.yellow, announce: true, magnitude: 1.35
  },
  ironclad: {
    id: 'ironclad', name: 'Ironclad', tint: PAL.gray, announce: true, magnitude: true
  },
  cornered: {
    id: 'cornered', name: 'Cornered', tint: PAL.lred, announce: true, magnitude: 1.6
  },
  leashed: {
    id: 'leashed', name: 'Leashed', tint: PAL.brown, announce: true, magnitude: true
  },
  static_charge: {
    id: 'static_charge', name: 'Static', tint: PAL.lblue, announce: true,
    hazard: { radius: 60, tickFrames: 30, dmg: 3, lifeFrames: 5400 } // 90s -- effectively "for the fight"
  },
  enraged_on_kill: {
    id: 'enraged_on_kill', name: 'Enraged-on-Kill', tint: PAL.lred, announce: true,
    effects: [{ hook: 'onKill', fn: 'enrageIfAllyDied', scopeInvert: true, data: { mult: 1.25, speedMult: 1.15 } }]
  },
  split: {
    id: 'split', name: 'Split', tint: PAL.lgreen, announce: true,
    effects: [{ hook: 'onKill', fn: 'spawnMinionsOnDeath', data: { count: 2, hpMult: 0.35 } }]
  },
  thorned: {
    id: 'thorned', name: 'Thorned', tint: PAL.brown, announce: true,
    effects: [{ hook: 'onHitLanded', fn: 'reflectFlatDamageToAttacker', data: { amount: 6 } }]
  },
  fortified: {
    id: 'fortified', name: 'Fortified', tint: PAL.dgray, announce: true,
    queries: [{ hook: 'getDamage', fn: 'multiplyFlat', data: { mult: 0.7 } }]
  },
  poised: {
    id: 'poised', name: 'Poised', tint: PAL.lblue, announce: true, magnitude: 1.5
  },
  reckless: {
    id: 'reckless', name: 'Reckless', tint: PAL.lred, announce: true, tags: ['risk'],
    tradeoff: '-30% poise pool.', magnitude: { dmgMult: 1.25, poiseMult: 0.7 }
  },
  toxic: {
    id: 'toxic', name: 'Toxic', tint: PAL.green, announce: true,
    effects: [{ hook: 'onHitResolve', fn: 'applyStatusUnconditional', data: { status: 'virus', stacks: 2 } }]
  },
  undying: {
    id: 'undying', name: 'Undying', tint: PAL.white, announce: true, magnitude: true
  }
};

export const AFFIX_LIST = Object.values(AFFIXES);

/* Spawn-time side effects that can't be expressed as a reaction to a combat
   hook because they happen once, at creation -- a short, closed list (not
   "one bespoke function per affix": every other affix above needs none of
   this). */
const SPAWN_EFFECTS = {
  hasted(combat, entity, def) {
    const mult = def.magnitude || 1.3;
    entity.speedPx *= mult;
    entity.speedPxPerFrame *= mult;
  },
  poised(combat, entity, def) {
    const mult = def.magnitude || 1.5;
    entity.poise.max = Math.round(entity.poise.max * mult);
    entity.poise.current = entity.poise.max;
  },
  reckless(combat, entity, def) {
    entity.poise.max = Math.round(entity.poise.max * def.magnitude.poiseMult);
    entity.poise.current = entity.poise.max;
  },
  static_charge(combat, entity, def) {
    spawnHazard(combat, entity.x, entity.z, def.hazard);
  },
  mirrored(combat, entity, def) {
    spawnMinions(combat, entity.def.id, entity.x, entity.z, 1, def.magnitude || 0.3);
  }
};

/* Elites roll 1-2, each Menace rank adds one more (GDD §4.3). Fodder (not
   `isElite`) never rolls -- the roster's own stat lean is its variety, per
   §13's own framing of affixes as *perceived* variety on top of that. */
export function rollAffixes(rng, isElite, menaceRank) {
  if (!isElite) return [];
  const rolls = Math.min(AFFIX_LIST.length, 1 + (rng.random() < 0.5 ? 1 : 0) + (menaceRank || 0));
  const pool = AFFIX_LIST.slice();
  const picked = [];
  for (let i = 0; i < rolls && pool.length; i++) {
    picked.push(pool.splice(Math.floor(rng.random() * pool.length), 1)[0].id);
  }
  return picked;
}

/* Installs every rolled affix onto one enemy instance and returns the
   display names for the pre-fight banner (GDD §4.3's visibility contract).
   `entity.affixData[id]` is the generic flag/magnitude read the resolver
   choke points consult by name; hook-based affixes additionally register
   through installAffix, scoped to this instance only. */
export function applyAffixesToEnemy(combat, entity, affixIds) {
  entity.affixIds = affixIds;
  entity.affixData = {};
  if (!affixIds.length) return [];
  const names = [];
  affixIds.forEach(id => {
    const def = AFFIXES[id];
    if (def.magnitude !== undefined) entity.affixData[id] = def.magnitude;
    installAffix(combat.dispatcher, def, entity);
    if (SPAWN_EFFECTS[id]) SPAWN_EFFECTS[id](combat, entity, def);
    names.push(def.name);
  });
  entity.tint = AFFIXES[affixIds[0]].tint; // fairness visibility wins over the type's own cosmetic tint
  return names;
}
