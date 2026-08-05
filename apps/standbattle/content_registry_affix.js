/* Affix installer — split out of content_registry.js (Phase 10, repo's
   300-line cap; content_registry.js grew past it once Disc/Requiem/Duo
   validation was added). Pure move, no behavioural change: affixes.js/
   encounter.js now import installAffix from here instead.

   Phase 9b finding: Fragments/Relics/Discs/Requiems install GLOBALLY --
   one registration lasts the whole fight, correct because there is
   exactly one player. Affixes are rolled per spawned ENEMY INSTANCE
   (affixes.js), so the same effect/query registration needs a filter
   identifying "is this firing actually about MY enemy" before it may run
   at all -- the one piece the other installers never needed. AFFIX_SCOPE
   says which ctx field names that enemy for each hook this content type
   actually uses; `scopeInvert` (Enraged-on-Kill) flips the match to
   "about anyone ELSE". Every verb an affix names still comes from the
   same EFFECT_LIB/QUERY_LIB Fragments use (invariant 6) -- this only
   changes WHO it's scoped to. */

import { EFFECT_LIB, QUERY_LIB } from './effect_lib.js';
import { PRIORITY } from './hooks.js';

const AFFIX_SCOPE = {
  onKill: 'target', onDamageTaken: 'attacker', onHitLanded: 'defender',
  // onHitResolve fires for either attack direction (resolvers.js) -- every
  // affix that uses it today (Toxic) reacts to the affixed enemy attacking
  // the player, so it scopes on 'attacker', not 'defender'.
  onHitResolve: 'attacker', getDamage: 'defender'
};

export function installAffix(dispatcher, def, entity) {
  (def.effects || []).forEach(eff => {
    const fn = EFFECT_LIB[eff.fn];
    const priority = eff.priority == null ? PRIORITY.ADD : eff.priority;
    const field = AFFIX_SCOPE[eff.hook];
    const data = { ...(eff.data || {}), self: entity };
    dispatcher.effect(eff.hook, priority, ctx => {
      if (field) {
        const matches = ctx[field] === entity;
        if (eff.scopeInvert ? matches : !matches) return;
      }
      fn(ctx, data);
    }, def.id + ':' + entity.id);
  });
  (def.queries || []).forEach(q => {
    const fn = QUERY_LIB[q.fn];
    const priority = q.priority == null ? PRIORITY.MULTIPLY : q.priority;
    const field = AFFIX_SCOPE[q.hook];
    const data = { ...(q.data || {}), self: entity };
    dispatcher.query(q.hook, priority, (value, ctx) => {
      if (field) {
        const matches = ctx[field] === entity;
        if (q.scopeInvert ? matches : !matches) return value;
      }
      return fn(value, ctx, data);
    }, def.id + ':' + entity.id);
  });
}
