---
description: Stand Battle Arena combat sim invariants
globs: apps/standbattle/combat*.js, apps/standbattle/ai.js, apps/standbattle/encounter*.js, apps/standbattle/token.js, apps/standbattle/resolvers.js, apps/standbattle/hitbox.js, apps/standbattle/poise.js, apps/standbattle/defense.js, apps/standbattle/status.js, apps/standbattle/fighter.js, apps/standbattle/sim_loop.js, apps/standbattle/boss_parts.js, apps/standbattle/purge.js, apps/standbattle/hazards.js, apps/standbattle/hooks.js, apps/standbattle/stats.js
---

# Sim invariants

Only 4, 5, 8 are numbered explicitly in source comments; the rest are
reconstructed from the same recurring rules stated throughout the codebase.

1. Headless: no canvas/DOM/rAF reference anywhere in the sim; same seed →
   byte-identical output (`sim_loop.js`, `headless_harness.js`).
2. Timing is frame counts at a fixed 60Hz, never wall-clock ms, in every
   sim timer.
3. A "fighter" is an entity in `fighter.js`'s flat component store;
   `combat.entities` is the real entity list, never hardcoded variables.
4. The sim knows nothing about pixels — z→y projection/depth sort/camera
   live in `render_adapter.js`/`render.js`, never in the sim.
5. Every derived number passes through exactly one resolver choke point in
   `resolvers.js`; nothing else does inline arithmetic on a stat.
6. Content is data, validated by `content_registry.js` and installed only
   through `effect_lib.js`'s verb vocabulary — never a bespoke code path.
7. RNG is seeded and stream-separated (`rng.js`); render/particle
   randomness stays unseeded so a dropped frame can never desync the sim.
8. Render/audio/fx (EVENT hooks) watch combat state and react post-hoc;
   they never write sim state back.

## Resolver choke points (Phase 2)

`resolveMoveFrames`, `resolvePatternFrames`, `resolveDamage`, `applyHit`,
`rollCrit`, `resolvePoiseDamage`, plus private `resolveReach`/
`resolveMomentumMult`. A new derived number gets a choke point here, not
inline math at the call site.

## Frames, not ms

`MOVES`/`PATTERNS` timing is `windupFrames`/`activeFrames`/`recoverFrames`
at `SIM_HZ`, not milliseconds. Flagged exception: `juice.js` stays on the
real render clock.
