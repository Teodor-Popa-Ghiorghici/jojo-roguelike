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

## Apps
- `placeholder`: `apps/placeholder/index.js` - A trivial app to test the window manager.
- `standbattle`: `apps/standbattle/index.js` - Stand Battle Arena, a JoJo's Bizarre Adventure roguelike combat prototype (see `docs/stand-battle-arena-spec.md`). Playable Jotaro Kujo/Star Platinum vs. Morioh enemies and boss Yoshikage Kira/Killer Queen, across a 6-node Act 1 (Morioh) map. Implements the spec's Prototype milestone (§15 step 1): telegraphed enemy attacks, dodge (i-frames) vs. parry (tight counter window) as distinct mechanics, hit-stop/screen-shake/particle juice with a shake accessibility toggle, an effect-hook dispatcher (`hooks.js`), and a shared enemy attack-pattern module library (`ai.js`). Zero meta-progression by design; internal 480×270 canvas on a 720×260 belt plane (x, z) with a tracking camera, integer-only upscale.
  **Combat engine hardening (tech audit §1.2, Phase 0 "unblock"):** dodge (Step) is edge-triggered — one activation per physical key-down, never re-fired while a key is held — and gated by a 2-charge meter (`fighter.js`'s `DODGE_CHARGE_MAX`, 1.4s recharge each, GDD §3.7) with a HUD pip readout, closing the old "hold Space for ~77% invulnerability" exploit. All action inputs (light/medium/heavy/special/rush/dodge/parry) that arrive while the player isn't idle are queued in a 9-frame input buffer (`combat.js`'s `INPUT_BUFFER_FRAMES`) and fire the instant the player returns to idle, instead of being silently dropped. Arena world bounds (`ARENA_MIN`/`ARENA_MAX`/`WORLD_W`, plus the Phase 1 depth bounds below) are centralized in `arena_bounds.js`, imported by both the sim (`combat.js`) and the camera (`render.js`), so the two can no longer drift apart.
  **Simulation core (tech §5 Phase 1):** the sim now steps in whole frames at a fixed 60Hz rate instead of being driven by rAF's variable ms delta, on a real (x, z) belt plane instead of one lane.
  - `sim_loop.js` — `createFixedStepLoop(stepFn)`: a headless accumulator that turns variable real-elapsed ms into zero or more whole-frame `stepFn` calls, dropping backlog past 8 frames instead of spiraling. No canvas/DOM/rAF reference anywhere in it. `combat.js`'s `combat.update(dtMs)` (real usage, index.js's rAF loop) and `combat.step()` (headless, one frame, no wall clock) both drive the same per-frame `stepFrame`.
  - `fighter.js` — the entity/component store (tech §2.3). A "fighter" *is* an entity: `combat.entities = [player, enemy]` is the arena's real entity list (not two hardcoded variables), with `combat.player`/`combat.enemy` kept as named references into it for the render/pose/HUD/audio code this phase doesn't touch. Components are flattened onto the entity object rather than nested (`.x`/`.z` for Transform, `.hp`/`.maxHp` for Health, etc.) because pose_player.js/pose_enemy.js/render.js/hud.js already read those fields directly and this phase doesn't rewrite them. `.body`/`.poise`/`.statuses`/`.standLink`/`.frames`/`.aggro` are stubs Phase 2+ fills in; `.brain` aliases `.ai` (enemies) or is `null` (the player, human-controlled).
  - `render_adapter.js` — the only new render-layer logic (deliverable 4): `zToYOffset(z)` (projection constant `Z_TO_Y_SCALE = 0.4`, lives here rather than in constants.js because the sim must never know about pixels), `depthSort(entities)` (farthest z drawn first/behind, nearest last/in front, x-tiebreak matches the pre-Phase-1 ordering exactly when z is tied), and `cameraTargetX(entities)` (midpoint of the extremes, generalizes the old two-fighter midpoint to N entities). `render.js`/`arena.js` call these instead of computing depth inline anywhere.
  - Depth movement: `input.js` maps `forward`/`back` (W/S, held-triggered like left/right) to the player's z axis; z is clamped to `ARENA_Z_MIN`/`ARENA_Z_MAX` in `arena_bounds.js` and defaults to `Z_REST` (the belt-plane's resting depth, where `zToYOffset` is 0) for every entity, so a fight where nobody touches z renders exactly as it did before z existed. The enemy does not move in z yet (no AI depth logic this phase) and hit detection is still x-only — Phase 1 explicitly excludes hitboxes/frame-data/crowd combat (tech §5 Phase 2).
  - `combat.js`/`combat_enemy.js` — every timer (attack windup/active/recover, dodge, parry, i-frames, hit-stop-adjacent state, AI windup/active/recover, projectile life, phase-transition invulnerability, hurt-flash fade, banner) is now a whole frame count at the sim's 60Hz, not milliseconds; `data.js`'s `MOVES` and `ai.js`'s `PATTERNS` were converted the same way (`windupFrames`/`activeFrames`/`recoverFrames`). combat.js split enemy-side stepping into `combat_enemy.js` to stay under the 300-line file cap. `juice.js` (hit-stop/shake/particles) deliberately stays on the real render clock — see the Phase 1 report for why that's a flagged, not silently resolved, tension with "timing is frames, never ms".
  - `headless_harness.js` — `runHeadlessFight()` builds a combat instance exactly like index.js and steps it via `combat.step()` with no canvas anywhere in the process; run standalone with `node apps/standbattle/headless_harness.js`. Same seed -> byte-identical output, proving the sim is headless and reproducible. This is where the tech §4 fairness-assertion CI suite will run once the content registry it checks exists (Phase 2+).
  - Forced, minimal touches to the pose system (normally off-limits): `pose_player.js`/`pose_enemy.js` read the same move/pattern timing fields directly for animation-progress math, so their `windupMs`/`activeMs`/`recoverMs` reads were renamed to `windupFrames`/`activeFrames`/`recoverFrames` (pure rename, zero logic change — the progress ratio is unit-agnostic) and the enemy death-pose divisor now reads the shared `DEATH_ANIM_FRAMES` constant (`constants.js`) instead of a hardcoded `900`.
  **Cross-cutting foundations (tech-doc Phase 0):** four modules every later phase assumes.
  - `rng.js` — one xorshift128 PRNG seeded per run (`createRng(seed)`), with derived named sub-streams (`rng.stream('map'|'rewards'|'combat'|'ai')`) so drawing from one stream never perturbs another. `index.js` creates the run's `rng` from `runState.seed` and threads it into `createCombat(enemyDef, buffs, opts, rng)`; `combat.js` pulls `rng.stream('ai')` and passes it into `ai.js`'s `pickPattern`/`stepEnemyAI`, replacing their `Math.random()` calls — enemy pattern choice is now reproducible from the run seed. The `'map'`/`'combat'` streams are reserved, unused until map generation and frame-data land. Render/particle randomness (`juice.js`, `fx.js`, `arena.js`, and the still-untouched rendering-pipeline files) is deliberately left on plain `Math.random()`/existing seeds — already a separate, unseeded generator per the invariant, so a dropped frame can never desync the sim; `rng.js` also exports `createUnseededRng()` for any future code that wants that same guarantee explicitly.
  - `save.js` — the single choke point over `ctx.save`/`ctx.load`. Two independent blobs, `'run'` and `'meta'`, each `{ version, data }` through a per-blob migration table (both v1, no-op tables so far). `index.js` persists `runState` (`seed, hp, maxHp, nodeIndex, buffs`) at every node-boundary transition (new run, node clear, event/rest resolution) and clears it on run loss or completion; on `mount`, an existing run blob resumes straight to the map scene instead of the title, so killing the tab mid-run loses at most the in-progress node. `meta` (`shakeEnabled`, `cleared`, `keymap`) is loaded/saved independently, so a corrupted run blob can never take meta down with it.
  - `constants.js` — re-exports the arena bounds from `arena_bounds.js` (now including the Phase 1 depth bounds `WORLD_D`/`ARENA_Z_MIN`/`ARENA_Z_MAX`/`Z_REST`) plus every other number that must stay identical between sim and render: `SIM_HZ`/`FRAME_MS` (the sim's fixed 60Hz step, actually used since Phase 1 -- see below), `GROUND_Y` (one source, previously redeclared as the literal `208` independently in both `render.js` and `arena.js`), and `DEATH_ANIM_FRAMES` (shared between combat.js setting it and pose_enemy.js reading it back).
  - `input.js` — owns a rebindable keymap (persisted through `save.js`'s `meta` blob, no rebind UI yet) and explicitly classifies every action as edge-triggered (`EDGE_ACTIONS`: light/medium/heavy/special/rush/dodge/parry) or held-triggered (`HELD_ACTIONS`: left/right, plus Phase 1's forward/back for the z axis, W/S by default), plus a capped ring buffer of `(action, frame)` for future debugging/replay. `index.js`'s key handler now routes through `input.resolveKey(code, down)` before forwarding the same down/up transitions to `combat.setKey` exactly as before — this is bookkeeping layered on top, not a new gate, so combat feel is unchanged.
  **Graphics (rebuilt from scratch, 480×270 internal):** every pixel is generated by a software rasterizer (`draw.js`) that only ever emits axis-aligned 1px rows — canvas antialiases both path fills and rotated `fillRect`s, so nothing in this app calls `fill()`/`stroke()`/`ctx.rotate` for art. On top of that:
  - `palette.js` — five-step colour ramps (core shadow → shadow → base → light → rim) with hue-shifted shadows, one shared light direction, and `haze()` for atmospheric perspective.
  - `layer.js` — offscreen sprite compositor: pooled buffers, silhouette-traced ink outlines, character-shaped cast shadows, hit flashes, dodge afterimages, squash/stretch, plus `cached()` for painted-once background layers.
  - `body.js`/`face.js` — shared humanoid rig (FK from joint angles, cel-shaded limbs, hands, boots) and anime-style heads (lidded eyes with iris + specular, expression brows, mouths).
  - `anim.js` + `pose_player.js`/`pose_enemy.js` — pose engine: anticipation/overshoot easing per action, spring-lagged hair and coat driven by body velocity, breathing/blinking/weight-shift idles, per-pattern enemy telegraph shapes, and flinch layered on top of whatever the enemy was already doing.
  - `sprite_jotaro.js`, `sprite_star.js` (Star Platinum, incl. the fists-and-streaks barrage), `sprite_enemy.js`, `sprite_boss.js` — ~100–120px characters, roughly 5× the pixel detail of the previous pass.
  - `background.js` + `bg_scenes.js` + `bg_props.js` — six parallax layers per arena (sky, far ridge, mid town, near town, ground, foreground silhouettes) across four Morioh locations, cached to buffers.
  - `font.js`/`font_data.js` — 5×7 bitmap font; no antialiased system text anywhere.
  - `fx.js` — impact stars, manga speed lines, swing arcs, charge motes, shockwaves, onomatopoeia, dust and screen flashes, spawned from the effect-hook dispatcher rather than from the combat loop; screen-wide effects are `solo` so a fast combo can't stack four flashes into a whiteout.
  - `arena.js` — attack telegraphs, projectiles, particles and the render-only reactions (swing arcs, footfall dust, stagger scuffs) that watch combat state without the simulation knowing they exist.
  - `render.js` — camera, parallax, sprite stamping (outline + cast shadow + scene rim light + squash), HUD.
  This deliberately goes beyond the machine's base 16-colour/no-antialiasing rule below — an explicit exception for this app's content, requested by the user; canvas smoothing stays off and everything still snaps to whole pixels. Sound is a real 3-layer SFX design with combo-pitch escalation (`audio.js`) plus a from-scratch adaptive chiptune engine (`music.js`, its own Web Audio gain bus wired to the machine's MUS knob, independent of the SFX bus) with explore/combat/tension intensity layers.
  **Design documents — read before changing gameplay:**
  - `docs/stand-battle-arena-spec.md` — the technical contract (architecture, pixel pipeline, audio, fairness constraints). Binding for architecture and rendering.
  - `docs/stand-battle-arena-gdd.md` — the game design document: the User/Stand duality that is the core mechanic, the three Stand Classes, run structure, the six item layers (Fragments / Requiem / Relics / Discs / Aspects / economy), difficulty axes, meta-progression, and the 40-hour content math. Binding for gameplay.
  - `docs/stand-battle-arena-tech.md` — audit of the shipped prototype, the engine systems the GDD requires (effect pipeline, stat pipeline, frame data, 2.5D arena, seeded RNG, content validator), data schemas and build order.
  There is **no line budget** on this project — the engine may be as large as the design needs. The constraint is generality: content is data, never a new code path.

## Rules
- Apps never import from `kernel/`.
- Files stay under 300 lines (split into siblings in the app folder if needed).
