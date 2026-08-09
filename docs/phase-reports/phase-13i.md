# Phase 13i — how it looks and sounds

**Tested:** grep-assertion of the pixel rules over every render file; two headless stress
runs (12-enemy simultaneous chain detonation, 120s continuous combo) on the real
`createCombat`/`createFx`/`createJuice`; a Playwright harness importing `combat.js`/
`render.js` to capture all 16 telegraphs and 33 characters × 4 backgrounds; static
extraction of every palette ramp/tint; a brute-force probe of the three hit predicates
against the pixels the rasterizer is handed; and an owner review round.

**Clean (QA-067..070):** pixel pipeline intact after twelve phases — no `fill()`/`stroke()`/
`ctx.rotate`, `px()` rounds everything, smoothing off on all three contexts, integer scale,
whole-pixel shake. Screen-wide fx stay `solo` under 12 simultaneous deaths (max 1 flash,
frame 9, seed `qa-fx-stack-001`); `PARTICLE_CAP` clips at 140 against 216 requested; music
transitions never click or double-trigger.

**Fixed (5):** QA-079 window was 24px short of tripling so the scaler floored to 2× → now
1480×920. QA-080 no maximize existed; `wm.js` gained `toggleMaximize` exposed via `ctx` (every
app gets it) + a FULL button. QA-081 combat had no stop; new `pause.js` freezes the sim and
offers ABANDON RUN through the same `finishRunLoss` a death takes, so pausing is never cheaper
than fighting. QA-082 **zero of 16 patterns had a telegraph matching its hitbox** — new
`telegraph_geom.js` derives each footprint from the numbers the hit test resolves with, and the
windup animates the fill not the boundary, so the edge is exact on every frame (0-of-N → N-of-N).
Canvas/scaler/appbar moved to `shell.js` for the 300-line cap.

**The two that matter most, logged not fixed:**
- **QA-083 — no enemy moves in z.** Not one of 28 types, not one boss. Hitboxes are
  depth-gated, so holding one key is permanent invulnerability: **0 damage over 90s from
  11/11 targets including Killer Queen, DIO, Pucci.** Invalidates all combat. Top of queue.
- **QA-084 — far half of the walkable plane has no ground under it.** Exactly 36px overshoot,
  uniform across 13 scenes, 49.2% of legal depth unsupported. Needs an owner call: no remedy
  is visually neutral (the recommended one reframes every arena).

**Also logged:** QA-071 SFX knob dead after audio wake (kernel-wide). QA-072 barks never rate-cap
(`comboCount` never resets; ~1.5/sec past combo 9). QA-073/074/085 7 of 8 Stands and 9 of 10
bosses reuse one of three sprites; 5 tint groups pixel-identical. QA-086 rig/faces. QA-087 impact.
QA-075..078/089 telegraph glyph/colour/texture, palette proximity. QA-088 whether slam should be
*genuinely* radial — a real design change, deliberately not taken.

**Could not reproduce:** nothing; every entry has a deterministic repro.

**Process gap closed:** the fairness floor measures telegraph **time only** and reads no
geometry — exactly how a telegraph matching none of the three hit geometries shipped. New
`scripts/qa_telegraph_geometry.js` probes the real predicates, wired into `npm run assert`,
verified to fail on reintroducing the original defect.

**Next should know:** the art overhaul (QA-085/086/087) is its own phase — ~33 designs plus a
rewrite of `body.js`/`face.js`/`anim.js`/`pose_*.js`; deliberately not started, since a
half-rewritten rig is the worst state to leave this in. Decide QA-083/084/088 together: if the
depth axis changes, required ground coverage changes, and a radial slam counters depth-camping.
