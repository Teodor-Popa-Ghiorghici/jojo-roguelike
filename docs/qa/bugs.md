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

### QA-008 — S1 — the attack-token gate has never gated anything: every
### enemy commits to attacks whether or not it holds a token

**Repro:** `node apps/standbattle/scripts/qa_ai_probe.js --runs=24
--immortal` (seed `aiprobe-0`..`-23`), or the minimal one, seed
`gatecheck-1` on `ENCOUNTERS.morioh_shopping_street`: count
`approach`→`windup` transitions and bucket them by `enemy.hasToken`.
Pre-fix: **376 of 381 commits (98.7%) happened with `hasToken === false`**;
first ungated commit at **frame 50** (`knife_thug`). Post-fix: 77 commits,
0 ungated.

**Symptom:** `combat_enemy.js:101` computed the gate as
`enemy.hasToken || enemy.def.ignoresToken`. `ignoresToken` is absent on 13
of the 14 enemy types, so for a token-less enemy the expression evaluated to
`undefined`, not `false`. `ai.js`'s gate was `if (canCommit === false)
return null;` — a strict comparison that `undefined` fails — so the
approach→windup transition was never blocked. GDD §16's attack-token rule,
the single mechanism that makes crowd combat readable instead of a pile-on
and Phase 5's headline deliverable, was inert from the day it shipped:
`token.js` correctly assigned, held, cooled down and released slots every
frame, and nothing downstream ever read the result.

It survived Phases 13a–13c because `scripts/fuzz.js`'s `TARGETS` are all
**solo** fights (3 fodder types + 10 bosses, `fuzz.js:41-46`) — a solo enemy
has 1 candidate for 2 melee slots and is granted a token immediately, so the
gate's value never mattered in anything the fuzzer drove. Phase 5's own
verification measured the token *cap* (how many slots were held), never
whether a non-holder could still attack.

**Frame:** 50 (seed `gatecheck-1`); reproduces on every crowd encounter and
every seed tried.

**Status:** **FIXED.** `combat_enemy.js:101` now passes `!!(...)`, and
`ai.js`'s gate is `if (canCommit != null && !canCommit)` so the documented
"omitted/undefined behaves as true" contract still holds for a caller that
genuinely omits the argument while any falsy-but-not-`false` value now
gates. Two lines, no design change — this restores the behaviour GDD §16 and
`token.js`'s own header always specified.

**Consequence 13l must know:** crowd attack volume drops ~80% (381→77
commits over 3600 frames on `morioh_shopping_street`). Every crowd
encounter's difficulty was implicitly tuned against an ungated crowd, so all
Phase 5/9b encounter budgets are now unverified. `validate`/`assert`/
`sweep --runs=4000`/`determinism` all still pass, and `fuzz --runs=2000
--profile=idle` is clean — but those exercise solo fights, which this change
does not touch.

---

### QA-009 — S1 — a token holder in a non-advancing AI state holds its slot
### for the rest of the encounter, permanently stalling the melee pool

**Repro:** `node apps/standbattle/scripts/qa_ai_probe.js --runs=21
--pool=synthetic --immortal` — seeds `aiprobe-6`, `aiprobe-13`, `aiprobe-20`
on the `qa_flee_deadlock` composition (2 `flees: true` enemies + a
`morioh_thug` + a `brute`). Pre-fix: both melee slots held by
`runner_a:flee` / `runner_b:flee`, **deadlock run 3379 frames** (56s),
beginning **frame 221** and never ending — the run hit the 3600-frame cap
still deadlocked, with the thug and brute unable to commit.

**Symptom:** `token.js`'s only release condition for a committed slot is the
holder returning to `ai.state === 'approach'`. `ai.js`'s `stepEnemyAI`
advances approach/windup/active/recover/staggered and nothing else, and
`combat_enemy.js:85-90` returns *before* `stepEnemyAI` for a `flee` enemy —
so a fleeing enemy's state is terminal. `token.js`'s candidate filter
excluded only `'staggered'`, so a fleeing enemy was freely granted a slot,
was immediately marked `committed` (its state is not `'approach'`), and
could never satisfy the release test. Two fleeing enemies take both melee
slots and the rest of the crowd stands still permanently.

Reachable through shipped content **only latently**: `flees: true` appears
on exactly one def (`data_encounters.js:30` `PANICKED_LOOTER`, in the solo
`morioh_sudden_death`), where every enemy in the wave flees, so no
non-fleeing enemy is starved — and Crowded only duplicates that same fleeing
type. Mixing a fleeing enemy with an attacker is a plain data edit (exactly
what GDD §17's Stalker escape behaviour implies), which is why this is
logged as an engine defect rather than a content bug. It was also *masked*
by QA-008: while the gate was inert, a stalled pool starved nobody.

**Frame:** 221 (seed `aiprobe-6`), continuous to the 3600 cap.

**Status:** **FIXED.** `ai.js` gained `canHoldAttackToken(enemy)` over an
explicit `ADVANCING_STATES` set — stated next to the state machine that owns
the states, so a future non-advancing state is covered without touching
`token.js`. `token.js` releases any slot whose holder fails it (subsuming
the old `hp <= 0` check) and excludes such enemies from candidacy.
`'staggered'` is deliberately still inside the set: a stagger is bounded and
self-resolving, and moving it out would change crowd pacing rather than fix
a deadlock. Post-fix deadlock run: 0 frames on all three seeds.

---

### QA-010 — S2 — 13 of 18 enemy types appear in no shipped encounter,
### including every ranged type and both Long-Range counterplay types

**Repro:** enumerate every `types`/`generate.pool` entry across
`data_encounters.js`'s `ENCOUNTERS` plus every `def.summon.type`, and diff
against `Object.keys(ENEMIES)`.

**Symptom:** never referenced: `bomber caller duelist hound illuso_mirror
leech phaser puppeteer shielder sniper valentine_parallel warden zoner`.
Only `morioh_thug`, `knife_thug`, `brute`, `angelo`, `panicked_looter`,
`the_stalker` and `puppet_minion` (summon-only) ever spawn. Consequences
that matter more than the count: **no ranged enemy ever spawns**, so the
reserved ranged token pool (QA-011) has never run; **no summoner ever
spawns**, so `summons.js` is unreachable outside affixes; and **Hound (#7)
and Warden (#12) never spawn**, which Phase 9a shipped explicitly as "the
counterplay Long-Range can't be tuned without" (`docs/phase-reports/
phase-9a.md`). `encounter_check.js`'s POOL exercises all 14 in the
*generator*, which is why validation never caught this — the generator can
compose them, no encounter asks it to.

**Frame:** n/a — a static content-wiring gap, not a runtime event.

**Status:** logged, not fixed. Wiring 13 types into Act pools is content
authoring across four Acts' difficulty curves, which is a design act, not a
hardening fix. Phase 13d drove all 13 through synthetic encounters
(`scripts/qa_ai_probe.js`'s `SYNTHETIC` table) to test the engine paths
behind them; findings QA-011/012/013 all come from those runs.

---

### QA-011 — S2 — the reserved ranged token pool is dead capacity; a sniper
### can and does fire during a melee commitment

**Repro:** `node apps/standbattle/scripts/qa_ai_probe.js --runs=8
--pool=synthetic --immortal --crowded=3 --seed=crowd3` (11 bodies —
mission's "maximum enemy count and Crowded rank 3"), and the same with
`--crowded=0`.

**Symptom:** `combat.js:170` builds 2 melee + 1 ranged slot, and `token.js`
routes by `enemy.def.tokenPool === 'ranged'`. **No enemy def in the game
sets `tokenPool`** — `sniper`/`zoner`/`bomber` carry `ranged: true` (a
pattern-selection hint) but not `tokenPool`, so `poolOf()` returns `'melee'`
for all three. Measured over 28,800 sim frames per condition: the reserved
ranged slot was held **0 frames**; ranged-only enemies occupied a *melee*
slot for 5,753 frames (Crowded 0) / 6,806 frames (Crowded 3); and ranged
windup/active frames overlapping a live melee commitment were **857/4,023
(21.3%)** at Crowded 0 and **595/4,988 (11.9%)** at Crowded 3. So the answer
to the mission's question is no: a sniper genuinely *can* fire during a
melee commitment, roughly one firing frame in five.

**Frame:** continuous; first overlap within the first ~90 frames of every
`qa_ranged_max` run.

**Status:** logged, not fixed. The one-word fix (`tokenPool: 'ranged'` on
the three ranged defs) also silently changes crowd pressure — it would move
those types out of the 2-slot melee pool into a slot nothing competes for,
making them strictly more active, not less. That is an encounter-pacing
design call for 13l, not a hardening fix, and it should land together with
`TOKEN_MELEE_COUNT`'s own unimplemented Crowded scaling (`combat.js:46`
still reads "3 under Menace's Crowded condition, not implemented yet" —
confirmed still 2 at Crowded rank 3).

---

### QA-012 — S2 — the Hound does not prioritise the User, and the Warden
### cannot land a hit at all, against the Long-Range class they exist to counter

**Repro:** `node apps/standbattle/scripts/qa_ai_profiles.js --runs=20
--verbose` (seeds `aiprof-ag-0`..`-9`), aggro section: each Stand class ×
{control, hound, warden} wave, 10 trials × 3600 frames.

**Symptom:** measured share of landed enemy hits that struck the **User**
rather than the Stand —

| class | control | +Hound | +Warden |
|---|---|---|---|
| close | 84.9% (n=292) | **98.6%** (n=847) | 67.8% (n=258) |
| mid | 77.6% (n=303) | **96.2%** (n=845) | 81.2% (n=250) |
| long | 0.0% (n=**1**) | **1.0%** (n=729) | — (n=**0**) |

The Hound's `userTargetWeightMult: 20` works exactly as designed for Close
and Mid. Under Long-Range it inverts: 729 landed hits, 1.0% of them on the
User. The multiplier only ever applies in `combat_stand.js:104-108`'s
*both-hurtboxes-overlap* branch, and under Long-Range the two bodies are
never co-located — the User is retreat-AI-driven (`stand_classes.js:153`)
while the Stand is player-driven — so the branch is essentially never taken
and the Hound just hits whichever body its x-chase happens to reach, which
is the Stand. The Warden is worse: **0 hits in 10 × 3600 frames** against a
Long-Range player, because its `telegraphed_slam` (speedPx 110) can never
catch the retreating User at all. Its multiplier itself is correct — measured
**1.700×** exactly (25 detached hits mean 45.22 dmg vs 13 attached hits mean
26.60, seed `warden-1`, Close-Range) — it simply never gets to apply it to
the permanently-detached class.

Root cause is shared with QA-005/QA-007 and one line: every enemy closes on
`player.x` only (`combat_enemy.js:92`) and never moves in z or toward the
Stand — measured `chasedStand = 0` across all 9 class×wave cells.

**Frame:** Hound's Long-Range inversion is steady-state from ~frame 150;
Warden's zero-hit result holds for the full 3600-frame cap on every seed.

**Status:** logged, not fixed. Both fixes are AI-system design work
(z-aware or Stand-aware interception), which `docs/phase-reports/
phase-9a.md`'s own "honest kiting question" already names as the required
fix. Same 13l batch as QA-005/QA-007. Compounded by QA-010: neither type
spawns in any shipped encounter, so no playtest could have surfaced it.

---

### QA-013 — S2 — the Shielder's frontal block is disabled from frame 0 in
### 2 of 5 spawn slots

**Repro:** seeds `shield-0`..`shield-4`, a solo `shielder` preceded by N
`morioh_thug` filler so it lands in spawn index N; Close-Range player
holding `right` and tapping `light` every 20 frames, 2400 frames. Blocked /
landed player hits by spawn index: 0 → 48/8, 1 → **0/0**, 2 → **0/0**,
3 → 61/6, 4 → 52/2.

**Symptom:** `resolvers.js:162-164` denies frontal damage only while
`Math.abs(attacker.z - defender.z) <= 20` — GDD §4.2's "must be flanked or
poise-broken". But `encounter.js:30`'s `SPAWN_Z_OFFSETS = [0,-26,26,-13,13]`
places spawn slots 1 and 2 at **±26** from `Z_REST`, past that 20-unit
threshold, so a Shielder in either slot counts as flanked before the fight
starts and its defining mechanic never engages. The same 20-unit constant
governs `profiles.js:30`'s `FLANK_Z_THRESHOLD`, so the `flanker` profile's
`flankBonus` is decided by the same spawn lottery in reverse — always on at
slots 1/2, never at slots 0/3/4. (The 0/0 rows also re-demonstrate QA-007:
at ±26 neither side can reach the other in z at all.)

**Frame:** 0 — the condition is decided at spawn and never changes, because
no enemy ever moves in z.

**Status:** logged, not fixed. Reconciling a spawn-spread constant with a
combat-threshold constant changes either the crowd's spawn geometry or the
flank rule for every consumer of it — a tuning decision for 13l, not a
behaviour fix. Note it is currently unreachable in play (QA-010: `shielder`
spawns in no shipped encounter).

---

### QA-014 — S3 — four of six behaviour profiles differ only by a scalar;
### `turtle` never blocks and `spacer` never yields a token at bad range

**Repro:** `node apps/standbattle/scripts/qa_ai_profiles.js --runs=20` —
one instance of every profile in a single wave against a shared scripted
player (heavy every 90f), so the vulnerability baseline and token pool are
identical across profiles.

**Symptom:** measured token grants per 1,000 candidate-frames against the
declared `PROFILES` eagerness — opportunist 7.2 (1.0), aggressor 5.6 (1.4),
turtle 4.1–4.8 (0.75), flanker 3.1 (1.1), spacer 2.4 (0.6), support 2.2
(0.5). The weights *are* observable, so no profile is inert, but only
`opportunist` has a clause that does what its name promises: it commits
during a player-vulnerable frame **32.8% of the time against a 23.7%
baseline (1.38×)**, while aggressor/turtle/shielder/warden all sit at
21.3–22.9%, i.e. exactly chance. Against the mission's three explicit
expectations: an `opportunist` does punish more than chance (**pass**); a
`turtle` never blocks — `PROFILES.turtle` is `{ eagerness: 0.75 }` and
nothing more, and the engine has no enemy-side guard at all (the only enemy
damage denial is the `frontalBlock` def field, which the two turtle-profile
enemies `brute`/`warden` do not carry) (**fail**); a `spacer` never gives up
its token at bad range — releases-while-out-of-range were 26.6–90% across
*every* profile with no spacer-specific path in `token.js`, because release
is driven purely by pattern completion (**fail**). `flanker` also ranks
*below* `turtle` observed despite a higher declared eagerness, because
`profiles.js`'s positional `CLEAN_LINE_BONUS` (1.6×) swamps the profile
weights and its own `flankBonus` is spawn-slot-determined (QA-013).

**Frame:** n/a — steady-state rates over 20 × 3600 frames.

**Status:** logged, not fixed. Giving `turtle` a real block or `spacer` a
range-based token yield means adding enemy-side defensive behaviour and a
second token-release condition — new AI systems, not behaviour fixes.
Flagged for 13l as a scope question: either build them or narrow the
profiles' documented promises to the weighting they actually are.

---

### QA-015 — S3 — no aggro hysteresis exists, and no enemy ever moves
### toward the Stand

**Repro:** `node apps/standbattle/scripts/qa_ai_profiles.js --runs=20
--verbose`, aggro section.

**Symptom:** the mission asks whether an enemy can thrash between the User
and the Stand every frame. It cannot, because there is no persistent target
to thrash: `combat_stand.js:103`'s `resolveTarget` is evaluated once per
*landed hit*, only when a hitbox overlaps both hurtboxes, and nothing is
stored. Measured switch rate between consecutive landed hits tracks an
independent Bernoulli draw with the same marginal almost exactly (close/
control 22.3% observed vs 24.1% memoryless; close/hound 2.6% vs 2.7%;
long/hound 1.0% vs 1.9%) — i.e. **no hysteresis, and none needed**. The
related real gap: enemy movement reads `player.x` unconditionally
(`combat_enemy.js:92`), so `chasedStand` was **0** across all nine
class×wave cells — the Stand is never pursued by anything, under any class.

**Frame:** n/a — steady-state over 10 × 3600 frames per cell.

**Status:** logged, not fixed, and recorded mainly so 13l does not go
looking for a thrash bug that cannot exist in this design. The
never-chase-the-Stand half is the same root cause as QA-012 and belongs to
that batch.

---

## Not reproduced

Nothing from Phase 13d's own matrix failed to reproduce — every finding
above replays from its logged seed. Two items are recorded as **untested
rather than clean**, and 13l should not read them as verified: the Crowded
`TOKEN_MELEE_COUNT` scaling (`combat.js:46`) is documented-unimplemented and
so was measured, not exercised; and `hazardSet`-style per-arena position
mechanics remain unwired (already noted in `phase-13c.md`), so "can it path
around hazards" reduces to the single static damage-zone, which Phase 13c
already covered.
