/* Shared arena/world bounds -- single source of truth for the belt-plane
   extent so the sim (combat.js) and the camera (render.js) can never drift
   out of sync (tech audit §1.2 item #13). ARENA_MIN/MAX describe where the
   player and enemy are allowed to stand; WORLD_W is the full scrollable
   width the camera clamps against. */

export const WORLD_W = 600;
export const ARENA_MARGIN = 58;
export const ARENA_MIN = ARENA_MARGIN;
export const ARENA_MAX = WORLD_W - ARENA_MARGIN;
