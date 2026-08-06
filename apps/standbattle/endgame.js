/* Endgame -- GDD §10.3: 3 secret superbosses (Diavolo/King Crimson, Kars,
   one Requiem-tier fight) and the Heaven Ascension, "gated by optional
   [Act/routing] conditions rather than sequence."

   Superbosses reuse boss_reprise.js's own transform shape (a stat bump +
   `recoveryMult`) rather than three more hand-authored boss defs -- the
   same "content is data" reasoning Boss Reprises already established,
   just with a bigger multiplier and a new character (Kars) where canon
   has no existing boss to derive from.

   Known gap, same accepted shape as Phase 10's Requiems and this phase's
   Act variants: no Archive/hub entry point offers these nodes yet
   (map_gen.js never emits a 'superboss' node type) -- content-complete,
   not run-reachable. `heavenAscensionUnlocked` is real and callable
   (menace floor + a specific cleared Rule Fight both check live runState
   fields), but its third leg -- GDD's "a specific Requiem" -- can't be
   evaluated for real yet: Requiems have no live selection/ownership flow
   at all (phase-10.md's own flagged gap), so it's a permanent `false`
   here until that flow exists, not a silently dropped condition. */

import { BOSSES } from './data_bosses.js';
import { menaceRankOf } from './meta_menace.js';

function superbossFrom(bossId, overrides) {
  const base = BOSSES[bossId];
  return {
    ...base, hp: Math.round(base.hp * 1.6), power: base.power + 2, poise: base.poise + 20,
    recoveryMult: 0.75, ...overrides
  };
}

export const SUPERBOSS_KING_CRIMSON = superbossFrom('diavolo', {
  id: 'king_crimson_secret', standName: 'King Crimson (Requiem-adjacent)'
});

// No existing BOSSES entry to derive from -- Kars (Battle Tendency, Part 2) is an outsider to this roster's Part 3-6/SBR cast.
export const SUPERBOSS_KARS = {
  id: 'kars', character: 'Kars', standName: 'ULTIMATE LIFEFORM', source: 'Battle Tendency (Part 2)',
  hp: 260, power: 11, speedPx: 175, precision: 9, poise: 90,
  phases: [
    { hpAbove: 0.66, attackPatterns: ['sweep', 'telegraphed_slam', 'projectile'] },
    { hpAbove: 0.33, attackPatterns: ['sweep', 'telegraphed_slam', 'projectile', 'the_world_time_stop'], transitionLine: 'KARS: "I HAVE SURPASSED ALL LIFE."' },
    { hpAbove: 0, attackPatterns: ['sweep', 'telegraphed_slam', 'projectile', 'the_world_time_stop'], transitionLine: 'KARS: "THERE IS NOTHING LEFT TO FEAR."' }
  ],
  purgeAtHpFrac: 0.5, purgeLine: 'KARS REGENERATES -- ULTIMATE LIFEFORM',
  parts: [{ id: 'kars_core', label: 'CORE', revealAtPhase: 2, dx: 0, dz: 58, w: 14, h: 30, dmgMult: 3 }]
};

export const SUPERBOSS_REQUIEM_AVATAR = superbossFrom('pucci', {
  id: 'requiem_avatar', standName: 'Made in Heaven Requiem'
});

export const SUPERBOSSES = { king_crimson_secret: SUPERBOSS_KING_CRIMSON, kars: SUPERBOSS_KARS, requiem_avatar: SUPERBOSS_REQUIEM_AVATAR };

export const SUPERBOSS_ENCOUNTERS = {
  king_crimson_secret: { id: 'king_crimson_secret', label: 'SECRET: KING CRIMSON', winCondition: 'killAll', waves: [{ types: [SUPERBOSS_KING_CRIMSON] }] },
  kars: { id: 'kars', label: 'SECRET: KARS, THE ULTIMATE LIFEFORM', winCondition: 'killAll', waves: [{ types: [SUPERBOSS_KARS] }] },
  requiem_avatar: { id: 'requiem_avatar', label: 'SECRET: THE REQUIEM AVATAR', winCondition: 'killAll', waves: [{ types: [SUPERBOSS_REQUIEM_AVATAR] }] }
};

const HEAVEN_MENACE_FLOOR = 10;
const HEAVEN_RULE_FIGHT = 'rf_bites_the_dust'; // the "loop" Rule Fight -- thematically the closest to Made in Heaven's own loop

/* Real and callable; the Requiem leg is a documented permanent `false`
   until Requiems have somewhere to be owned from (see header). */
export function heavenAscensionConditions(runState) {
  return {
    act4Cleared: (runState.act || 1) >= 4,
    menaceFloor: menaceRankOf(runState.menacePact) >= HEAVEN_MENACE_FLOOR,
    ruleFightCleared: (runState.ruleFightsCleared || []).includes(HEAVEN_RULE_FIGHT),
    requiemOwned: false // Phase 10 gap: no live Requiem selection/ownership flow exists yet
  };
}

export function heavenAscensionUnlocked(runState) {
  const c = heavenAscensionConditions(runState);
  return c.act4Cleared && c.menaceFloor && c.ruleFightCleared && c.requiemOwned;
}
