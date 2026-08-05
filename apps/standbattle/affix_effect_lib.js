/* Affix-side EFFECT_LIB verbs -- split out of effect_lib.js (Phase 9b)
   purely to keep both files under the repo's 300-line cap; merged back
   into EFFECT_LIB there so content_registry.js's validator/installer still
   sees one table (invariant 6: content installs only through effect_lib.js's
   verb vocabulary, never a second one).

   Every Fragment verb in effect_lib.js assumes the player is the acting
   entity; these instead read straight off whichever ctx field
   content_registry.js's installAffix already scoped to the owning enemy
   instance (its AFFIX_SCOPE table), so they stay just as reusable across
   affixes as the Fragment verbs are across Fragments. */

import { applyDamage } from './fighter.js';
import { spawnMinions } from './summons.js';

export const AFFIX_EFFECT_LIB = {
  /* onDamageTaken only. ctx.entity is the player, ctx.attacker the enemy
     that just hit them -- drains a flat amount of Persistence off the
     player, optionally healing the attacker some of it back (Leech, GDD
     §4.2 #11: "steals Persistence on hit"). Enemy-native (data_enemies.js's
     `onHitDrain` field), not an affix, but installed the exact same way. */
  drainPersistenceOnHit(ctx, data) {
    if (!ctx.entity) return;
    ctx.entity.persistence = Math.max(0, ctx.entity.persistence - (data.amount || 0));
    if (data.healAttackerAmount && ctx.attacker && ctx.attacker.hp > 0) {
      ctx.attacker.hp = Math.min(ctx.attacker.maxHp, ctx.attacker.hp + data.healAttackerAmount);
    }
  },

  /* onDamageTaken only. ctx.attacker is the affixed enemy that just hit
     the player -- heals it a fraction of the damage it dealt (Vampiric). */
  healAttackerPctOfDamage(ctx, data) {
    if (!ctx.attacker || ctx.attacker.hp <= 0) return;
    ctx.attacker.hp = Math.min(ctx.attacker.maxHp, ctx.attacker.hp + Math.round((ctx.dmg || 0) * (data.pct || 0)));
  },

  /* onHitLanded only. ctx.attacker is the player, ctx.defender the affixed
     enemy that just got hit -- reflects a flat amount back (Thorned). */
  reflectFlatDamageToAttacker(ctx, data) {
    if (ctx.attacker) applyDamage(ctx.attacker, data.amount || 0);
  },

  /* onKill only. ctx.target is the affixed enemy that just died, ctx.combat
     the fight -- flat/percent AoE against the player if still in range
     (Bomb-Primed, and reused directly by any enemy def with its own
     `explodeOnDeath` field, e.g. the Bomber's corpse explosion). */
  explodeOnDeath(ctx, data) {
    if (!ctx.combat || !ctx.target) return;
    const player = ctx.combat.player;
    const dist = Math.hypot(player.x - ctx.target.x, player.z - ctx.target.z);
    if (dist > (data.radius || 70) || player.hp <= 0) return;
    const dmg = (data.dmg || 0) + Math.round(player.maxHp * (data.pctMaxHp || 0));
    applyDamage(player, dmg);
    if (player.hp <= 0) ctx.combat.outcome = 'lose';
  },

  /* onKill only. ctx.target is the affixed enemy that just died -- spawns
     `count` weaker copies of itself at its last position via the generic
     mid-fight spawn primitive (summons.js), reused by Puppeteer/Caller's
     own timed summons (Split). */
  spawnMinionsOnDeath(ctx, data) {
    if (!ctx.combat || !ctx.target) return;
    spawnMinions(ctx.combat, ctx.target.def.id, ctx.target.x, ctx.target.z, data.count || 2, data.hpMult || 0.3);
  },

  /* onKill only, `scopeInvert` (installAffix) so ctx.target is an ALLY
     dying, not self. `data.self` is auto-injected by installAffix -- the
     one generic exception every affix hook verb gets, since "react to
     something happening to someone ELSE" needs a handle on its own owner
     that ctx alone never provides (Enraged-on-Kill). */
  enrageIfAllyDied(ctx, data) {
    const self = data.self;
    if (!self || self.hp <= 0 || self.affixData.enragedApplied) return;
    self.affixData.enragedApplied = true;
    self.affixData.enraged = data.mult || 1.25;
    self.speedPxPerFrame *= data.speedMult || 1.15;
  }
};
