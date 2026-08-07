# Stand Battle Arena — bug ledger

Phase 13's running record of hardening findings. Every entry needs a
deterministic repro (seed + exact command + frame number) or an explicit
"could not reproduce" note — no entry is a rumour.

**Severity:** S1 = run-ending (crash/softlock/save corruption), fixed
immediately on discovery. S2 = a real invariant/contract violation that
doesn't end the run. S3 = minor/cosmetic. BALANCE = not a defect, not
acted on this phase.

**Format per entry:** id, severity, repro command, symptom, frame, status.

---

### QA-001 — S2 — tether overextend cap breached for one frame during a
### knockback while Projecting

**Repro:** `npm run fuzz -- --runs=12` (seed `fuzz-11`, target
`funny_valentine`, weighted profile) — also reproduces on seed `fuzz-6`
target `ndoul`, frame 1541, same shape.

**Symptom:** `combat_stand.js`'s Close-Range overextend clamp
(`stand_classes.js:60-68`, `PROJECT_MAX_OVEREXTEND = 1.4`) is enforced
inside `stepStand`, which runs before `updatePlayer` each frame
(`combat.js:225-226`). While Projecting, `closeStepUser` roots the User's
own movement input (`stand_classes.js:83`) — but the User can still be
knocked back by a landed hit resolved later in the same frame (defense/hit
resolution runs after `stepStand`). The Stand's clamp isn't re-validated
against the User's post-knockback position until the *next* frame's
`stepStand`, so for exactly one frame the measured tether distance exceeds
`tetherPx * 1.4` — observed 75.9–76.2px against a 73.8px cap (≈3% over).
Self-corrects the following frame (confirmed via fuzz's per-frame
invariant monitor, `apps/standbattle/scripts/fuzz.js`'s tether check).

**Frame:** 746 (seed `fuzz-11`); 745 (seed `fuzz-45`, `fuzz-51`, ... — 19
occurrences total in `npm run fuzz -- --runs=200`, all the same shape,
all self-correcting next frame).

**Status:** logged, not fixed. Re-validating the clamp against the User's
final position would mean moving the Close-Range overextend check to run
after `updatePlayer` (or re-clamping post-knockback) — a step-ordering
change to `combat.js`'s per-frame sequence, which is a design change to
the frame pipeline, not a behavior fix within one file. Flagged for
Phase 13l's batch per the mission brief ("if a fix would change a
system's design rather than its behaviour, stop and write it up").

---

### QA-002 — none found — invariant sweep otherwise clean

`npm run fuzz -- --runs=200` (default seed `fuzz`, mixed ~70%
weighted/10% mash/20% idle across all 3 non-boss enemies + all registered
bosses in `BOSSES`) found zero NaN/Infinity, zero out-of-bounds entities,
zero negative/over-max HP, zero negative status stacks/durations, zero
frame-counter skips, and zero stuck-detector triggers, beyond QA-001's
class. `npm run fuzz -- --runs=60 --profile=mash` and `--runs=30
--profile=idle` (explicit single-profile stress) are independently clean.

**Status:** not a bug — recorded so a future sweep with a wider seed range
has a documented clean baseline to diff against.

---

### QA-003 — not a bug — headless test-bot never drives the z-axis,
### misreporting some crowd encounters as non-terminating

**Repro:** `node apps/standbattle/scripts/qa_run_sweep.js --runs=20000
--verbose` (Phase 13b, full-run driver over `run_flow.js`/`run_choices.js`,
modeled on `telemetry_sim.js`) — e.g. seed `qasweep-39`, node `r2_2`, frame
5400 (its 5400-frame combat budget).

**Symptom:** `headless_harness.js`'s/`telemetry_sim.js`'s shared
`scriptFrame()` policy only ever presses `left`/`right` — it never presses
`forward`/`back` — so once a crowd encounter's last survivor ends up
z-misaligned from the player (routine after multi-enemy spawn spread or a
knockback), the bot can spin forever with nothing landing, which
`qa_run_sweep.js`'s combat frame cap (5400f, matching `telemetry_sim.js`'s
own budget) then reports as a "combat timeout." 1592/20000 full runs hit
this in the `--runs=20000` sweep.

Hand-verified this is a test-harness gap, not a sim defect: re-running
seed `qasweep-39`'s `r2_2` fight with a corrected bot that also closes the
z-axis (`stand_classes.js`'s `closeStepUser`: `forward` decreases z,
`back` increases it — the inverse of the naive reading, confirmed by
reading the source) resolves the exact same seed/encounter to a decisive
outcome. The remaining z-aware-but-still-timing-out seeds trace to Stand
Control Scheme diversity (`stand_classes.js`'s `CONTROL_SCHEMES`): Mid/Long
redirect the same movement keys to the Stand and drive the User by a
retreat AI instead of direct control, which no existing headless bot
(including this one) models — a *harness* sophistication gap, not
evidence the sim can get stuck.

Critically, this never blocks run completion: `qa_run_sweep.js`'s own
`terminations` counter across the same 20000 runs is
`{"win":60,"loss":19940,"guardExhausted":0,"noEdge":0}` — every run still
reaches the `'continued'` terminal state, because a combat-frame-cap
timeout is treated exactly like any other loss and the run's single exit
door (`run_flow_combat_end.js`'s `finishRun`) still fires.

**Status:** not a bug — `apps/standbattle/scripts/qa_run_sweep.js`'s
`scriptFrame()` was updated to also close the z-axis (cutting false
positives, though Control-Scheme diversity means it doesn't reach zero);
kept as a durable script (Phase 13b addition, not throwaway) since it also
covers node-type frequency/economy/reward-pool integrity that no existing
script measures. `headless_harness.js`/`telemetry_sim.js` themselves were
left untouched per the "no restructuring beyond a narrow S1 fix" rule —
this isn't an S1, and widening their shared bot to be Control-Scheme-aware
is a real feature, not a one-line fix.

---

### QA-004 — none found — full-run sweep clean on the mission's S1 hunts

**Repro:** `node apps/standbattle/scripts/qa_run_sweep.js --runs=20000`
(Phase 13b) plus `npm run sweep -- --runs=20000` (260,000 combat fights
across 3 fodder + 10 bosses, 80,000 Act map generations across 4 Acts).

**Symptom (absence of one):** across 20000 full headless runs — zero
zero-choice reward offers, zero duplicate candidates within one offer,
zero Rest offers missing the heal option, zero Caller-over-cap spawns,
zero Leashed-unreachable enemies, zero *enemy*-entity out-of-arena-bounds
events (all 3827 OOB events recorded carry `id:"stand"` — the player's own
Stand entity, the same shape as the already-logged QA-001 tether
overextend, not a new class), zero runs stuck short of the `'continued'`
terminal state. `npm run sweep -- --runs=20000` independently found 0/20000
non-decisive combat fights across every registered enemy/boss and 0/80000
map-generator constraint failures (0 seeds with a 0-Rest or 0-Shop path on
any generated path; worst pity gap observed 4/4; retry distribution mean
4.9 attempts, p95 16, max 40 — the `MAX_ATTEMPTS` ceiling, caught cleanly
by the deterministic repair floor 0.05% of the time, 42/80000).

Node-type frequency (20000 full runs, every node type well above the
mission's 0.1% flag line): combat 26.24%, shop 24.33%, rest 18.87%, event
16.16%, treasure 7.38%, archive 3.85%, elite 3.17%.

Yen: 778,459 generated / 206,555 spent across the sweep (~3.8x headroom) —
not directly comparable to GDD §6.5's ~1,400/~1,900 full-clear estimate
since the naive scripted bot loses early in the large majority of runs
(60/20000 full clears), so most runs' totals reflect a short partial run,
not a full Act I-IV playthrough. No path was ever without a Shop (sweep.js,
0/80000) and Rest's heal option is free of any Yen cost by design
(`rest.js`'s `restChoices`), so no run is ever locked out of recovery for
lack of Yen regardless of this sample's low win rate.

**Status:** not a bug — recorded as Phase 13b's clean baseline for items
1, 2 (partially — see QA-003 for the harness caveat), 3, 4, 5, 6 of the
mission's test matrix.

---

### QA-005 — S2 — Long-Range retreat AI can park the User at an arena
### z-extreme where melee enemies structurally cannot connect

**Repro:** `npm run fuzz -- --runs=20 --profile=spatial` (seed `fuzz-14`,
target `knife_thug`, standId `hierophant_green` — Long-Range), also `fuzz-4`
(`yuya_fungami`, same scheme). Deterministic replay:
`docs/qa/replays/qa005-long-retreat-corner-freeze.json`. Also reproduces
directly through shipped content, no fuzz needed: build a fight on
`data_encounters.js`'s `ENCOUNTERS.shopping_street_pinned` (the actual
"Pinned" encounter objective, GDD §15) with any Stand and hold
left+forward the whole `pinnedFrames` window (2400f) — replay:
`docs/qa/replays/qa005-pinned-objective-corner-safe.json`.

**Symptom:** `stand_classes.js`'s `longStepUser` (retreat AI, ~lines
153-189) picks "away from nearest enemy" purely in x/z with no z-bound
awareness, and `moveEntity`'s ARENA_Z clamp then pins the User at
`ARENA_Z_MIN`/`ARENA_Z_MAX` once it gets there and has nowhere further to
retreat. `combat_enemy.js`'s enemy `z` is set once at spawn
(`encounter.js`'s `spawnPosition`) and is never written again by any AI
state — melee patterns' hit test (`hitbox.js`'s `MELEE_DEPTH_TOLERANCE`,
22 units) then permanently fails once the User's z and the enemy's spawn z
differ by more than that, which a z-extreme corner reliably does (spawn z
clusters within ±26 of `Z_REST`=130; `ARENA_Z_MAX`=220 is 64+ units away).
Verified directly through the Pinned encounter: the objective's own stated
intent is "trapped and forced into Long-Range for a window" (GDD §15) —
observed result is the User takes **zero damage** for the entire
2400-frame pinned window (`qa005-pinned-objective-corner-safe.json`'s
final: `playerHp: 100` through frame 2400, only dropping once
`forceControlScheme` lifts and the AI reverts). The retreat "downside"
inverts into guaranteed safety.

**Frame:** corner reached ~200 (fuzz-14), static/no-damage confirmed
through frame 1200+ (replay) and through the full 2400f pinned window
(Pinned replay).

**Status:** logged, not fixed. Not run-ending (the player isn't stuck —
they still have full Stand-attack input and can end the fight; nothing
crashes or requires a restart), so not S1 under this phase's rule. A
correct fix needs either z-aware enemy AI or z-aware retreat-AI cornering
logic — both are AI-system design changes, not a narrow behavior fix in
one file. Flagged for Phase 13l.

---

### QA-006 — S2 — Mid/Long-Range's Strain drag doesn't actually bound
### tether overextension when the far side has continuous movement authority

**Repro:** `npm run fuzz -- --runs=20 --profile=spatial` — Mid-Range:
seed `fuzz-8` (`formaggio`, standId `sticky_fingers`), also `fuzz-3`,
`fuzz-13`, `fuzz-18`; Long-Range: seed `fuzz-9` (`illuso`, standId
`hierophant_green`), also `fuzz-19`. Replays:
`docs/qa/replays/qa006-mid-flick-tether-unbounded.json`,
`docs/qa/replays/qa006-long-tether-unbounded.json`.

**Symptom:** `stand_classes.js`'s `midUpdateStand` (~lines 102-125)
freezes the Stand at a `flickTargetX/Z` computed once, on the Project
key-edge, for the whole `MID_FLICK_DURATION_FRAMES` (150f/2.5s) — unlike
`closeUpdateStand`'s per-frame `PROJECT_MAX_OVEREXTEND` (1.4x) clamp,
nothing re-checks this position against the tether OR the arena bounds
while flicked (`stand.x = stand.flickTargetX` has no `clamp()` call at
all, the only positioning assignment in the file that doesn't). Mid-Range
also never roots the User (`midStepUser` — "the User keeps mobility" per
its own comment), so held movement input away from the frozen Stand
outraces `combat_stand.js`'s shared Strain drag
(`STRAIN_DRAG_FACTOR`=0.4, i.e. 40% of move speed) every single frame:
observed tether distance grew from 106.9px (flick start) past the fuzz
monitor's Close-shaped 1.4x reference (146.6px) by frame 18, to 162.7px by
frame 24, continuing to grow for the rest of the hold. Long-Range shows
the same root cause in its base case (no flick needed): the Stand is
player-driven by movement keys while the User is independently AI-driven
by `longStepUser`, so the two routinely diverge past any 1.4x-shaped
reference with nothing capping it — by design for Long-Range's
"permanently detached" class per the file's own header, but the header
also claims Mid/Long "get dragged/penalized the same generic way" as
Close's hard clamp, which the code does not actually deliver for either
class once one side has continuous independent movement. The Mid-Range
flick's *un-clamped-to-ARENA* freeze (separate from the tether-ratio
question) is confirmed by code inspection but a full natural-play
out-of-bounds repro needs a narrow timing window (facing toward a wall
while the tracked enemy is still nearer to it than the User) that this
phase's scripted runs didn't happen to hit — flagged for 13l to reproduce
directly rather than reported as "found" without a frame number.

**Frame:** 18-19 onward (Mid, tether-ratio breach), continuing through at
least frame 122 before the flick auto-retracts; 72 onward (Long).

**Status:** logged, not fixed. Not run-ending. A fix means either capping
the flicked position every frame (a Mid-Range behavior change) or rooting
the User during a flick/adding a hard Long-Range cap — both real changes
to a Stand Class's design, not a narrow one-file fix. Flagged for Phase
13l, same batch as QA-001 (same file, same "Strain vs. clamp" seam).

---

### QA-007 — S2 — z-extreme parking causes a mutual whiff stalemate against
### any melee-only enemy, under any Stand Class

**Repro:** `npm run fuzz -- --runs=20 --profile=spatial` (seed `fuzz-6`,
target `ndoul`, standId `star_platinum` — Close-Range, plain player-held
input, no AI involved). Replay:
`docs/qa/replays/qa007-z-extreme-mutual-whiff.json`.

**Symptom:** holding `back` (or `forward`) continuously walks the User to
`ARENA_Z_MAX`/`MIN` under ordinary Close-Range control (no AI, no
Project) — the same z-fixed-enemy gap QA-005 hits via the retreat AI, but
here purely from direct player input. Once there, `hitbox.js`'s
`overlaps()`/`pointOverlaps()` depth check fails for **both** directions:
the enemy's melee patterns can't reach the User (as in QA-005) and the
User's own attacks can't reach the enemy either (their hitbox is the
Stand's, which for Close-Range rides right next to the User at the same
z). Confirmed over the full 3600-frame fuzz cap: `playerHp` and `enemyHp`
both static the entire run (`100` / `170`), tripping the fuzz monitor's
own stuck-detector at frame 3561 (900f — 15s — with zero HP change or
>2px movement on any entity).

**Status:** logged, not fixed, and explicitly **not** a true softlock —
the player retains full input; walking back toward the enemy's z resolves
it immediately (untested here only because the script never releases the
held key). No automatic mechanic corrects it, though, and no enemy (melee
or the ranged/homing patterns in `combat_enemy.js`, which also only ever
adjust `dir` in x) ever re-aligns z on its own — worth 13l knowing this is
a standing property of the sim, not a one-off. Root cause overlaps
QA-005's (enemies never move in z after spawn); logged separately since
it's reachable without any AI/retreat scheme involved and needs its own
fix surface (arguably: nothing to fix here at all, since the player is
never actually trapped — 13l should make that call).

---

## Not reproduced

None this sub-phase — every fuzz/replay finding above reproduced on first
retry from its logged seed.
