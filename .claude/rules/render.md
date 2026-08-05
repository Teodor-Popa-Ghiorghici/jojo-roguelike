---
description: Stand Battle Arena render/sprite/pose/fx rules
globs: apps/standbattle/render*.js, apps/standbattle/pose_*.js, apps/standbattle/sprite_*.js, apps/standbattle/fx*.js, apps/standbattle/arena.js, apps/standbattle/hud.js, apps/standbattle/draw.js, apps/standbattle/layer.js, apps/standbattle/palette.js, apps/standbattle/body.js, apps/standbattle/face.js, apps/standbattle/anim.js, apps/standbattle/background.js, apps/standbattle/bg_*.js, apps/standbattle/font*.js, apps/standbattle/audio.js, apps/standbattle/music.js, apps/standbattle/juice.js, apps/standbattle/debug_overlay.js
---

# Render-layer rules

- **Sim state is read-only from here.** These files watch `combat`/`ctx`
  state and react to it; they never write it back. See `docs/render-map.md`
  for the full per-file inventory.
- **Additive changes only** to `render.js`/`arena.js`/`hud.js` unless a
  phase brief explicitly calls out a rewrite — new draw calls, not
  restructured ones, is the default.
- **No `fill()`/`stroke()`/`ctx.rotate`** anywhere in art code. `draw.js` is
  a software rasterizer that only emits axis-aligned 1px rows — canvas
  antialiases both path fills and rotated `fillRect`s.
- **Whole pixels only**, smoothing stays off. This app's content is an
  explicit exception to the machine's base 16-colour rule, but not to the
  no-antialiasing rule.
- `juice.js` deliberately stays on the real render clock, not sim frames —
  a known, flagged exception; don't "fix" it into frame-locked without
  checking `docs/phase-reports/phase-1.md`.
- Full graphics/audio module inventory: `docs/render-map.md`.
