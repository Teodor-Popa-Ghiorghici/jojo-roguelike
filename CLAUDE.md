# TempleOS Module System

## The App Contract
Every app is a module with a default export shaped exactly like this:

```js
export default {
id: 'terminal', // matches the folder name
title: 'TERMINAL.EXE', // window title bar text
icon: 'assets/images/terminal.png',
width: 640,
height: 480,
resizable: true,

// Called when a window is opened. `root` is an empty <div> inside the window body.
mount(root, ctx) {},

// Called when the window closes. Must remove every timer, interval,
// requestAnimationFrame loop, and listener attached to window/document.
unmount() {}
};
```

## The ctx API
`ctx` is the only channel between an app and the rest of the system. An app must never import from kernel/, never touch document.body or window globals belonging to other apps, and never reach into another app's DOM.

```js
ctx.fs.read(path) // -> Promise<Blob|string|null>
ctx.fs.write(path, data) // -> Promise<void>
ctx.fs.list(dir) // -> Promise<string[]>
ctx.fs.remove(path) // -> Promise<void>
ctx.save(key, value) // -> Promise<void> app-scoped settings/progress
ctx.load(key) // -> Promise<any>
ctx.openWindow(appId) // launch another app
ctx.close() // close this app's own window
```

## CSS Variables from theme.css
Not all extracted yet, but typically `#FFFFFF`, `#AAAAAA`, `#555555`, `#FFFF55` etc. (Standard 16-color CGA/VGA palette).

## How to add a new app
1. Create `apps/<id>/index.js` obeying the contract.
2. (Optional) Create `apps/<id>/style.css` if it needs specific styles.
3. Add `<id>` to `kernel/registry.js`.
4. Update this `CLAUDE.md` with the new app description.

## Build/test commands
- `npm start` / `npm run dev` — run the TempleOS shell (`server.js`).
- `node apps/standbattle/headless_harness.js` — run one deterministic
  headless fight, no canvas/DOM.
- `npm run validate` — content validator over the real Fragment/donor pool.
- `npm run assert` — the fairness assertions (telegraph floor, encounter
  composition, pity/starvation/convergence) over the headless harness.
- `npm run sweep -- --runs=N` — simulated run sweep over N seeds.
  All three print at most 20 lines on success and only the failing items on
  failure; pass `--verbose` for full detail.

## Apps
- `placeholder`: `apps/placeholder/index.js` - A trivial app to test the window manager.
- `standbattle`: `apps/standbattle/index.js` - Stand Battle Arena, a JoJo's Bizarre Adventure roguelike combat prototype. Playable Jotaro Kujo/Star Platinum vs. Morioh enemies and boss Yoshikage Kira/Killer Queen, across a 6-node Act 1 (Morioh) map. Internal 480×270 canvas on a 720×260 belt plane (x, z) with a tracking camera, integer-only upscale. Zero meta-progression by design.

  Built in 8 phases (0-7), from the Phase 0 unblock through the fixed-step
  sim, the frame-data combat resolver, the effect/stat pipeline, the
  User/Stand duality, crowd combat, the first boss, and the Fragment boon
  system + ship gate. Per-phase deliverables, verification, and known gaps:
  `docs/phase-reports/phase-0.md` through `phase-7.md`.

  **Sim invariants (full list + resolver choke points: `.claude/rules/sim.md`):**
  1. The sim is headless and reproducible: same seed → byte-identical output.
  2. Timing is frame counts at a fixed 60Hz, never wall-clock ms.
  3. A "fighter" is an entity in `fighter.js`'s component store.
  4. The sim knows nothing about pixels — render concerns live in `render_adapter.js`/`render.js`.
  5. Every derived number passes through exactly one resolver choke point in `resolvers.js`.
  6. Content is data, validated and installed through `effect_lib.js`'s verb vocabulary, never a bespoke code path.
  7. RNG is seeded and stream-separated; render/particle randomness stays unseeded.
  8. Render/audio/fx hooks watch combat state and never write it back.

  **Design documents — read before changing gameplay:**
  - `docs/stand-battle-arena-spec.md` — technical contract (architecture, pixel pipeline, audio, fairness). Binding for architecture and rendering.
  - `docs/stand-battle-arena-gdd.md` — game design document: User/Stand duality, Stand Classes, run structure, item layers, difficulty axes, meta-progression. Binding for gameplay.
  - `docs/stand-battle-arena-tech.md` — engine audit, required systems, data schemas, build order.

  **Graphics/audio module inventory:** `docs/render-map.md` (moved out of
  this file to stay under budget — read it when touching rendering/sound).

  There is **no line budget** on this project beyond the repo-wide 300-line
  file cap — the engine may be as large as the design needs. The
  constraint is generality: content is data, never a new code path.

## Rules
- Apps never import from `kernel/`.
- Files stay under 300 lines (split into siblings in the app folder if needed).
- Path-scoped rules for Stand Battle Arena's sim/content/render layers live
  in `.claude/rules/` and load only when the matching files are open.
