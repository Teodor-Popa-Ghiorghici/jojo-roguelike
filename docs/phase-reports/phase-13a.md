# Phase 13a — the foundation (replay, fuzz, determinism)

**Goal:** make every bug in this game reproducible by a command.

**Built:**
- `replay.js` — the one place that builds a combat from a header
  (seed/stand/aspect/menace/encounter) and folds state into a checksum.
  `recordHeadlessRun`/`attachRecorder` capture (seed, header, ordered
  input log, per-second checkpoint checksums, final state); `replayRun`
  reruns a log headlessly; `firstDivergence` localizes a mismatch to a
  60-frame checkpoint window (chosen over per-frame storage to hold a long
  fight's replay file to tens of KB, not megabytes).
- `combat.js` gained one read-only accessor, `combat.getFrame()`, so
  replay/fuzz never touch the sim's internals directly.
- `npm run replay -- <file>` — reruns a saved replay, asserts final state
  + checkpoints match, reports the first divergent checkpoint frame on
  failure. 3 fixture replays in `apps/standbattle/scripts/fixtures/`
  (scripted-attack win, mash-profile boss loss, idle-profile loss) all
  match on rerun.
- `npm run fuzz -- --runs=N [--seed=S] [--profile=weighted|mash|idle]` —
  weighted-random default (~70/10/20 weighted/mash/idle mix across runs),
  drives every non-boss enemy + every registered boss. Invariant monitor
  checks NaN/Infinity, HP bounds, arena bounds, tether cap, status
  stacks/duration, frame-counter monotonicity, and a 15-sim-second stuck
  detector, every frame.
- `npm run determinism` — same seed twice same-process, twice in fresh
  child processes, and with the juice (hit-stop/shake) layer attached vs.
  detached. Self-verified: injected a `Math.random()` into
  `resolvers.js`'s `resolveDamage` (sim-path damage roll), confirmed all
  three checks fail with a divergent frame/checksum, reverted — `git diff`
  on `resolvers.js` is clean.
- `docs/qa/bugs.md` — the ledger, header format above.

**Found:** QA-001 (S2) — Close-Range's Project overextend clamp
(`stand_classes.js:60-68`) isn't re-validated after a same-frame
knockback, so the tether briefly (1 frame, self-correcting) exceeds its
1.4x cap by ~3%. Repro: `npm run fuzz -- --runs=12`. Root cause is a
step-ordering question (`stepStand` runs before the hit resolution that
can move the User) — logged for Phase 13l rather than reordering the sim
frame pipeline mid-hardening. No S1s found.

**Self-verify:** `npm run replay` on 3 fixtures — all match.
`npm run fuzz -- --runs=200` — completes in ~2s, 19/200 hit QA-001 (all
logged as one entry), zero other violations. `npm run determinism` — OK,
and the deliberate-bug injection test above confirms it actually catches
a leak. `npm run validate`/`npm run assert` still pass (unaffected).

**Known gaps:** live in-game recording (deliverable 1's "app storage +
export") isn't wired into `index.js`/`hub_flow.js` yet — `attachRecorder`
is written to support it (wraps both `combat.step` and `combat.update`)
but nothing calls it outside the headless scripts. The "render layer
attached/detached" leg of the determinism check uses the juice
(hit-stop/shake) toggle as its proxy, not an actual canvas — there is no
headless canvas harness in this repo to test against real `render.js`.

**Handoff for 13b+:** `npm run replay -- <file>`, `npm run fuzz --
--runs=N [--seed=S] [--profile=...]`, `npm run determinism` are the three
commands every later sub-phase should reach for first. A new invariant
goes in `apps/standbattle/scripts/fuzz.js`'s `checkInvariants`; a new
fixture replay is `recordHeadlessRun` + `JSON.stringify` into
`scripts/fixtures/`.
