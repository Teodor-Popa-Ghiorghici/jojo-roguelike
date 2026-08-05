# Phase 1 — the simulation core

**Commit:** `3770fba` (2026-07-31, "fixed-step sim, entity store, belt-plane
depth axis").

**Goal (build plan):** step the sim in whole frames at a fixed 60Hz instead
of rAF's variable ms delta; move from one lane to a real (x, z) belt plane.

**Delivered:**
- `sim_loop.js` — headless fixed-step accumulator, no canvas/DOM/rAF
  reference; drops backlog past 8 frames.
- `fighter.js` — entity/component store; `combat.entities` is the real
  entity list, `.player`/`.enemy` are named references into it.
- `render_adapter.js` — `zToYOffset`, `depthSort`, `cameraTargetX`; the only
  new render-layer logic, kept out of the sim.
- Depth movement: `input.js` maps forward/back (W/S) to z, clamped in
  `arena_bounds.js`; enemy stays at `Z_REST`, hit detection stays x-only.
- All sim timers converted from ms to whole frame counts at 60Hz.
- `headless_harness.js` — `runHeadlessFight()`, `node
  apps/standbattle/headless_harness.js`; same seed → byte-identical output.
- Forced minimal rename in `pose_player.js`/`pose_enemy.js`
  (`windupMs`→`windupFrames` etc., zero logic change).

**Verification:** `headless_harness.js` same-seed determinism (introduced
this phase).

**Known gaps:** `juice.js` (hit-stop/shake/particles) deliberately stays on
the real render clock — flagged tension with "timing is frames, never ms",
not resolved this phase.
