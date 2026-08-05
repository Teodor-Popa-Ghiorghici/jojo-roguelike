# Phase 2 — the combat resolver

**Commit:** `da4748a` (2026-07-31, "frame-data combat resolver + defensive
triangle").

**Goal (build plan):** frame data, real AABB hitboxes, the three-tool
defensive triangle, replacing `{windupMs,activeMs,recoverMs}` +
`Math.abs(dx) <= range`.

**Delivered — the resolver choke-point list (`resolvers.js`):**
`resolveMoveFrames`, `resolvePatternFrames`, `resolveDamage`, `applyHit`,
`rollCrit`, `resolvePoiseDamage`, plus private helpers `resolveReach`,
`resolveMomentumMult`. `resolveMoveFrames` is the only place reach is
computed (`REACH_PER_RANGE * stand.stats.range * move.reachMult`). No other
file in the sim does inline arithmetic on a stat (invariant 5).

- `moves.js` — player moves as frame timelines: `frames`, `hitboxes[]`
  (absolute from/to frame numbers), `cancels[]`, `armor` (Heavy only).
- `hitbox.js` — AABB overlap in (x, z), melee ±22 / ranged exact-10 depth
  tolerance; per-activation `spent` set so a window connects once.
- `poise.js` — real per-enemy poise, 1.2s regen, 0 poise → 36f Stagger.
- `resources.js` — Persistence and Momentum as real mechanical resources.
- `defense.js` — Step (3f pre/10f invuln/6f recovery), Guard (−70% dmg, 14
  Persistence/sec drain), Clash (active frames 2-8 of 8, Perfect Clash on
  2-3 refunds a Step charge + sets `breakActive`).
- `combat_player.js` split out of `combat.js`; `ai.js`'s `PATTERNS` gained
  `hitbox`/`glyph`/`armor`/`tags`.
- `debug_overlay.js`, `fairness_check.js` (telegraph ≥260ms floor).

**Verification:** `fairness_check.js` (`node
apps/standbattle/fairness_check.js`) — all four patterns clear 260ms.

**Known gaps:** `pose_player.js` has no dedicated pose for `guard`/
`staggered` states — both render as idle.
