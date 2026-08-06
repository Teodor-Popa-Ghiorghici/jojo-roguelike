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

## Not reproduced

None this sub-phase — every fuzz/replay finding above reproduced on first
retry from its logged seed.
