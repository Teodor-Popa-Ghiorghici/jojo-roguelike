# PHASE 14 — VISUAL IDENTITY. Read this entire prompt before acting.

This is not a hardening phase. Phase 13 was find-and-record; this one is
build. The build is currently stable and every check is green — your job
is to keep it that way while replacing the art, which is the single most
destabilizing thing anyone can do to this codebase.

## CONTEXT DISCIPLINE

- `CLAUDE.md`, `.claude/rules/render.md` and `.claude/rules/content.md`
  load automatically. Do not re-read them.
- Read ONLY what each stage's READ block names. `docs/qa/bugs.md`
  QA-073..078, QA-084..087 and QA-089 are your specification — they
  contain the measurements, so do not re-measure what is already
  measured there.
- Delegate every verbose operation to a subagent: sprite-by-sprite
  render passes, contact sheets, palette sweeps, before/after diffs. Ask
  for a verdict and a list, never a transcript. Raw tool output must
  never land in the main conversation.
- Never paste file contents back to me. Cite `path:line`.

## THE RULE THAT MATTERS MOST

**Ship each stage green.** Every stage below ends with
`npm run validate && npm run assert && node apps/standbattle/headless_harness.js`
passing and a commit. Do not start stage N+1 with stage N half-done. A
half-rewritten character rig is the worst state this repo can be in —
worse than the current art — because it is neither shippable nor
revertable.

**Sim state is read-only from everything you touch here.** Art reacts to
`combat`/`ctx` state, never writes it back. If a visual change seems to
need a sim change, stop and write it up instead — that is a Phase 15
question, not a Phase 14 licence.

**The pixel rules are non-negotiable and were verified intact in 13i
(QA-067). Do not regress them:** no `fill()`/`stroke()`/`ctx.rotate`
anywhere in art code — `draw.js` is a software rasterizer emitting only
axis-aligned 1px rows; whole pixels only; `imageSmoothingEnabled` stays
false. Re-run the 13i grep assertion after every stage.

**300-line file cap.** New art belongs in new sibling files, never in a
bloated `render.js`.

---

## STAGE 0 — DECISIONS I OWE YOU BEFORE YOU START

Ask me these as one batched question. Do not begin Stage 1 without the
ground-plane answer; the rest can be answered as you reach them.

1. **Ground plane (QA-084), pick one:** (A) raise the backdrop horizon
   36px at the two call sites — clean, but reframes all 13 arenas, most
   visibly the store, which loses most of its upper framing; or
   (fallback) a per-`kind` horizon offset authored as data in
   `scene_defs.js`, so each arena absorbs the 36px differently. Show me
   a before/after of all four scene kinds for whichever you recommend
   before committing to it.
2. **Reference art.** For each Stand/boss I will point you at canon
   designs. Do not invent character designs from memory — the whole
   complaint in QA-085 is that they don't read as their canon selves.
3. **How far the rig rewrite goes** (Stage 3) — I will answer after I
   see your Stage 3 spike.

---

## STAGE 1 — THE GROUND UNDER THE PLANE (QA-084)

READ: `docs/qa/bugs.md` QA-084 · `bg_scenes.js:165-198` ·
`background.js:102` · `render.js:194,227` · `scene_defs.js:1-8,29-67` ·
`render_adapter.js:27,34-37` · `constants.js:29` · `arena_bounds.js:20-22`

The measurement is already exact: feet project to y 172…244, the ground
starts at y=208 in every scene, so there is **36px of overshoot,
uniform, and 49.2% of the legal depth range has no ground under it.**
Option C (extend only the ground layer) is already ruled out — ground
draws *after* `near`, so an apron buries the shopfronts. Option B
(remap `zToYOffset`) is ruled out — it breaks the documented
`zToYOffset(Z_REST) === 0` contract.

**Assume the z range stays 40…220.** Phase 15 is under instruction not
to clamp it. If it does anyway, these numbers scale — recompute, never
guess.

DONE WHEN: a character at max depth stands on ground in all 13 scenes,
0px of art is pushed off-canvas (verify, don't assume), rest-depth
composition is unchanged, and you have shown me before/after.

---

## STAGE 2 — HUD AND MENUS AT NATIVE SCALE

READ: `hud.js` · `hub_ui.js` · `docs/qa/bugs.md` QA-064 ·
`font.js`/`font_data.js` · spec §11's UI paragraph

My complaint was "the hud is way too long and very hard to read or use
properly," and QA-064 already found 21 strings overflowing their panel
budget. The window now renders at 3× (QA-079), so legibility is a layout
problem, not a scale problem.

Rebuild the combat HUD and the hub/menu panels to read at native 480×270
*before* upscale. Keep `bar()`/`text()` and the 5×7 bitmap font — this
is layout and hierarchy, not new art machinery. Fix QA-064's overflows
properly (truncation or wrapping in `rowList`, or wider panels), don't
paper over them.

DONE WHEN: `node apps/standbattle/scripts/qa_string_overflow.js` exits 0,
and you have handed me a native-resolution screenshot of the combat HUD,
the hub, and each of the six stations.

---

## STAGE 3 — THE RIG (QA-086) — THE DANGEROUS ONE

READ: `body.js` · `face.js` · `anim.js` · `pose_player.js` ·
`pose_enemy.js` · `layer.js` · `docs/phase-reports/phase-1.md` (the
flagged `juice.js` render-clock exception — do not "fix" it)

My complaint: "the pose itself is unnatural and limb movement looks very
unnatural and forced. The faces look like doodles instead of the iconic
JoJo design style with clear shapes and outlines."

**Spike first, commit second.** Build ONE character end-to-end on the
new rig — Jotaro — behind the existing draw entry point so the old rig
still runs everything else. Show it to me idle, walking, throwing a
light, a heavy, taking a hit, and dying. I approve or redirect before
you touch a second character.

The two named defects are specific: limb motion (FK interpolation and
easing that reads mechanical) and faces (the JoJo look is hard shapes,
heavy ink outlines, strong brow/jaw structure — not soft doodle curves).
Solve those, don't restyle everything you touch.

DONE WHEN: I approve the Jotaro spike. Not before.

---

## STAGE 4 — 33 CHARACTERS (QA-085, QA-073, QA-074)

READ: `docs/qa/bugs.md` QA-073/074/085 · `render.js:29,81-101,140` ·
`sprite_*.js` · `data_enemies.js` · `data_bosses.js` · `palette.js` ·
`cga_palette.js`

Current state, already measured: `ENEMY_ART` maps only `morioh_thug` and
`angelo`; every other boss falls through to `drawThug` untinted, so DIO
and Diavolo are the same brown delinquent. `drawStand` always calls
`drawStar` with a tint alpha of `0.18*(1-manifest)` that reaches **0**
once manifested, so 7 of 8 Stands are pixel-identical Star Platinum.
Five crowd tint groups are identical to each other (`warden`/`shielder`,
`knife_thug`/`sniper`, `hound`/`bomber`/`illuso_mirror`,
`puppeteer`/`puppet_minion`/`leech`, `duelist`/`valentine_parallel`).

Author per character, incrementally, on the Stage 3 rig, **committing
green after each small batch.** Order: playable Stands → bosses → crowd
types. Each character gets a hand-picked 8–16 colour palette per spec
§11, canon-accurate, distinct from everything it can share a screen
with. Re-run the QA-073 palette-distance check as you go — do not
discover a collision at the end.

DONE WHEN: no two characters that can co-appear are confusable, and the
contact sheet regenerates with 33 distinct silhouettes.

---

## STAGE 5 — IMPACT (QA-087)

READ: `juice.js` · `audio.js` · `fx.js` · `fx_wire.js` · `layer.js` ·
spec §10 in full

My complaint: "attacks both given and taken feel like they have no
impact." Every mechanism already exists and 13i verified each is
individually healthy — hit-stop, whole-pixel directional shake, the
capped particle burst, the 3-layer hit sound, squash/stretch. This is a
tuning and layering pass across all of them.

Spec §10's juice budget rule is the spine: **reserve the largest
responses for crits, parries, boss staggers and finishers.** Uniform
juice on every hit reads as noise, which is a plausible root cause of
"no impact" — everything is loud, so nothing lands.

Do not raise the particle cap (QA-069 verified it holds) or break the
`solo` scoping on screen-wide effects (QA-068). More is not the fix.

DONE WHEN: I can feel the difference between a light and a finisher, and
you have not regressed QA-067/068/069.

---

## STAGE 6 — TELEGRAPH TEXTURE AND THE SMALL BATCH

READ: `telegraph_geom.js` · `arena.js:135,200` · `ai.js` PATTERNS ·
`draw.js:175` (`dither`) · `docs/qa/bugs.md` QA-075/076/077/078/089

13i corrected telegraph *geometry*; this is the styling pass on top of
the corrected shapes. Batch these:

- **QA-089:** powerful attacks need a **texture**, not just a colour —
  `dither()` is the right primitive and is already used elsewhere.
- **QA-075:** `bomb_plant`'s glyph is `ring`, should be `crosshair`
  (`ai.js:96`) — one-line data fix.
- **QA-077:** Pucci's telegraph is plain UI white (`ai.js:162`).
- **QA-078:** Thug and Angelo jacket palettes too close for a crowd
  containing both.

`npm run assert`'s new geometry check must stay green — it will catch you
if a styling change moves a footprint.

---

## FINISH BY

`docs/phase-reports/phase-14.md`, 40 lines max: what you built per stage,
what I approved, what changed visually, what regressed and was caught,
and what Phase 15 needs to know about the depth plane's new appearance.

Anything you find that is a defect rather than a design gap goes in
`docs/qa/bugs.md` in the existing format with a repro, same as 13.
