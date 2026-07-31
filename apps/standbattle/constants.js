/* Shared cross-cutting constants — Phase 0 foundation (tech audit §1.2
   item 13). Arena bounds already had a single source of truth in
   arena_bounds.js; this file re-exports them alongside every other
   number that must stay identical between the sim and the renderer, so
   new code has exactly one place to import from. */

export { ARENA_MIN, ARENA_MAX, ARENA_MARGIN, WORLD_W } from './arena_bounds.js';

/* Target simulation rate. combat.js is still wall-clock (ms) driven --
   converting its loop to fixed-step frames is tech-doc Phase 2 work, not
   done here -- but every new system (input.js's ring buffer, and the
   future frame-data resolver) counts frames against this rate so that
   conversion has one number to change. */
export const SIM_HZ = 60;
export const FRAME_MS = 1000 / SIM_HZ;

/* Ground line shared by render.js (sprite stamping) and arena.js (world
   furniture/particles). Previously the literal `208` was redeclared
   independently in both files with nothing tying them together. */
export const GROUND_Y = 208;
