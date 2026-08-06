/* Arena hazards -- GDD §4.6 Phase 2's "adds a rule": a lingering damage
   zone, generic and data-driven so any future boss's own phase-2 rule can
   spawn one via a plain data field instead of a bespoke zone-damage code
   path. Killer Queen's Sheer Heart Attack (the fight's one bespoke
   signature, ai.js) opts in with a `hazard` field on its pattern; a
   pattern without one never leaves anything behind.

   A hazard tick is data-authored flat damage against a fixed defender
   (the player), not an attacker-vs-defender "hit" in the combat-
   resolution sense -- it goes straight through fighter.js's applyDamage,
   the same precedent status.js's Virus DoT already set, rather than
   forcing a synthetic attacker/hitbox through resolvers.js's
   attacker-facing pipeline. It still re-fires the existing onDamageTaken
   EFFECT hook so the standard hit-reaction fx/audio (fx.js/audio.js) read
   it for free -- no new render/audio wiring needed for "standing in the
   fire hurts and looks/sounds like it". */

import { applyDamage } from './fighter.js';
import { gainMomentum } from './resources.js';

/* `def.friendly` (Phase 10, Gold Experience donor's "life mote" -- GDD
   §6.1: "plants a life mote; walking over it heals 4 and grants 10
   Momentum") makes this a single-use PLAYER pickup instead of a repeating
   damage zone: the player heals + gains Momentum once on proximity, then
   the mote is gone, rather than ticking the same payoff every
   `tickFrames`. Everything else (radius/lifeFrames) is shared with the
   damage-zone path below, so both are still one generic system. */
export function spawnHazard(combat, x, z, def) {
  combat.hazards.push({
    x, z, radius: def.radius, tickFrames: def.tickFrames, tickTimer: def.tickFrames,
    dmg: def.dmg, life: def.lifeFrames,
    friendly: !!def.friendly, healAmount: def.healAmount, momentumAmount: def.momentumAmount
  });
}

export function stepHazards(combat) {
  const player = combat.player;
  for (let i = combat.hazards.length - 1; i >= 0; i--) {
    const h = combat.hazards[i];
    h.life -= 1;
    if (h.friendly) {
      const dist = Math.hypot(player.x - h.x, player.z - h.z);
      if (dist <= h.radius && player.hp > 0) {
        player.hp = Math.min(player.maxHp, player.hp + (h.healAmount || 0));
        if (h.momentumAmount) gainMomentum(player, h.momentumAmount);
        combat.hazards.splice(i, 1);
        continue;
      }
      if (h.life <= 0) combat.hazards.splice(i, 1);
      continue;
    }
    h.tickTimer -= 1;
    if (h.tickTimer <= 0 && player.hp > 0) {
      h.tickTimer = h.tickFrames;
      const dist = Math.hypot(player.x - h.x, player.z - h.z);
      if (dist <= h.radius) {
        applyDamage(player, h.dmg);
        combat.juice.triggerShake(0, 1, 2, 90);
        combat.dispatcher.runEffect('onDamageTaken', { entity: player, attacker: null, dmg: h.dmg, heavy: false, cancelled: false });
        if (player.hp <= 0) combat.outcome = 'lose';
      }
    }
    if (h.life <= 0) combat.hazards.splice(i, 1);
  }
}
