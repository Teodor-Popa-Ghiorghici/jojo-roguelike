/* The purge beat -- GDD §18B: "once per fight, a boss clears all statuses
   from itself and gains 6 seconds of status immunity, announced with a
   cue... static, identical every run, and learnable." This is the fixed
   answer to a mono-strategy (e.g. pure-Virus) build that the item pool
   must already have an answer to before that pool exists (deliverable 4)
   -- generic and data-only, exactly like boss_parts.js/hazards.js: an
   enemy opts in with `def.purgeAtHpFrac`; an enemy without it never
   purges, zero behaviour change for everything shipped before Phase 6.

   Triggered on a fixed HP fraction, not a timer or a phase boundary, so
   it reads as its own beat distinct from a phase transition (and can't
   drift if a future boss's phase thresholds change) -- for Killer Queen
   this lands mid-Phase-2, between "Sheer Heart Attack debuts" and "the
   User is exposed". Sheer Heart Attack's own canon "Defend Mode" (curls
   into an invulnerable steel ball) is the in-fiction hook: the immunity
   window is drawn as a steel tint reusing fighter.js's existing `.tint`
   field (already read by render.js/drawFighter for crowd-modifier
   tinting) -- zero new render code needed for the visual cue. */

export const PURGE_IMMUNE_FRAMES = 360; // 6s, GDD §18B
const PURGE_BANNER_FRAMES = 96; // 1600ms
const PURGE_TINT = '#C8D4E8';

export function initPurge(enemy) {
  enemy.purged = false;
  enemy._baseTint = enemy.tint || null;
}

function triggerPurge(combat, enemy) {
  enemy.purged = true;
  enemy.statuses.length = 0; // GDD §18B: "clears all statuses from itself"
  enemy.statusImmuneFrames = PURGE_IMMUNE_FRAMES;
  combat.banner = enemy.def.purgeLine || 'STATUS PURGED';
  combat.bannerTimer = PURGE_BANNER_FRAMES;
  combat.juice.triggerHitstop(120);
  combat.juice.triggerShake(0, -1, 6, 220);
  combat.dispatcher.fire('onPurge', { enemy });
}

/* One sim frame: fires the one-shot trigger once the HP threshold is
   crossed, and keeps the Defend Mode tint synced to the immunity window
   every frame (statusImmuneFrames itself counts down generically in
   status.js's stepStatuses, which every entity already runs through). */
export function stepPurge(combat, enemy) {
  if (enemy.hp <= 0) return;
  if (!enemy.purged && enemy.def.purgeAtHpFrac != null && enemy.hp / enemy.maxHp <= enemy.def.purgeAtHpFrac) {
    triggerPurge(combat, enemy);
  }
  enemy.tint = enemy.statusImmuneFrames > 0 ? PURGE_TINT : enemy._baseTint;
}
