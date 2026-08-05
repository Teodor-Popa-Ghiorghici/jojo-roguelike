/* Discs — GDD §6.4, tech §3's schema. Phase 10.

   Deviation flagged: GDD's literal description ("swap a Special or your
   Rush for a DIFFERENT STAND'S move") needs that other Stand's real move
   -- frame data, hitbox, animation. Only Star Platinum has any of that
   (moves.js); the other 7 donors exist purely as Fragment-flavoured hook
   clauses, never full move definitions. Building 7 more real movesets is
   a content order of magnitude beyond this phase's budget (and this
   engine's own "content is data" contract still needs a real code path
   underneath the data, which doesn't exist for a second moveset).

   Scoped down to what the existing engine actually supports: a Disc is a
   single-level, single-slot content entry restricted to DISC_SLOTS
   (special_1/special_2/rush, content_registry.js) that FULLY overwrites
   what that slot does, installed via installDisc the same way a Fragment
   installs via installFragment minus the level -- same schema shape
   (`effects`/`queries`, same EFFECT_LIB/QUERY_LIB vocabulary), just no
   `donor`/`levelDesc` fields since a Disc doesn't level and isn't offered
   through the Fragment pity/starvation/convergence system. This keeps
   the "weapon variety inside a run" identity (GDD §6.4) real, just
   without a second sprite/animation set behind it.

   Also flagged: "dropped by Duel nodes and secret bosses" -- neither
   exists yet. Sold through Owson (shop.js) instead, same stand-in Phase 8
   used for Relics before Phase 10 gave them a real system. */

export const DISCS = [];
