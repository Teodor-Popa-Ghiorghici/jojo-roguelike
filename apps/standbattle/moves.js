/* Player move definitions as frame-data timelines — tech §2.4, GDD §3.6.
   A move is a single timeline of `frames` total length with one or more
   `hitboxes` windows (absolute frame numbers within that timeline,
   inclusive), so multi-hit moves (barrage, rush) list several windows
   instead of the old code dividing activeFrames by hitCount.

   `hitboxes[].w`/`.x` are left null here and resolved to real world units
   by resolvers.js's resolveMoveFrames() from the Stand's Range stat
   (spec §2.1) — reachMult is the only per-move number, a small dimension-
   less lean, never an absolute reach. That is the one place move reach is
   computed; nothing else in the engine may do that arithmetic (invariant 5).

   `cancels[].from` is the absolute frame a buffered action may fire early
   (tech §2.4 / GDD §3.6: "cancel windows are data"). `requires: 'hit'`
   means the cancel only opens if this activation has landed at least one
   hit; a bare cancel (no `requires`) is always available once its frame
   is reached. `maxSelfChain` caps repeated self-cancels (Light chains x3,
   GDD §3.6) — a generic counter (combat_player.js's chainCounts), not a
   bespoke branch per move id.

   Phase 9d: each Stand's moveset moved to its own moves_<id>.js file (this
   file was headed well past the 300-line cap at 4 Stands) — MOVES here is
   just their merge, so every existing `import { MOVES } from './moves.js'`
   call site is untouched. */

import { MOVES_STAR_PLATINUM } from './moves_star_platinum.js';
import { MOVES_SILVER_CHARIOT } from './moves_silver_chariot.js';
import { MOVES_HIEROPHANT_GREEN } from './moves_hierophant_green.js';
import { MOVES_KILLER_QUEEN } from './moves_killer_queen.js';

export const MOVES = {
  ...MOVES_STAR_PLATINUM,
  ...MOVES_SILVER_CHARIOT,
  ...MOVES_HIEROPHANT_GREEN,
  ...MOVES_KILLER_QUEEN
};
