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

**Severity note (stated, not stretched):** this is not run-ending under the
ledger's literal parenthetical — nothing crashes, softlocks or corrupts a
save. It is graded S1 because it is the total functional failure of the
system this sub-phase exists to validate, and because every crowd
measurement 13e onward would take is meaningless while the gate is inert. It
was fixed on discovery rather than batched to 13l on that basis, and because
the fix is two lines restoring documented behaviour. If 13l prefers the
strict reading, re-grade it S2 — the fix stands either way.

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

### QA-016 — S2 — Bites the Dust silently fails to rewind for any death
### latched after `stepCrowd`, including a shipped Aspect's periodic cost

**Repro:** seed `btd-tickonly`, `ENCOUNTERS.budogaoka_bites_the_dust`,
`standId: 'star_platinum'`, `aspectId: 'kq_sheer_heart'`, with the lone
`knife_thug` held in `staggered` every frame so the Aspect's own 1 HP/sec
`onCombatTick` `selfDamage` (`aspects.js:153`) is provably the only damage
source. Result: `outcome: 'lose'` at **frame 6000**, `btdUsed: false`, with
**20 snapshots banked and unused**. Two narrower confirmations of the same
mechanism: seed `btd-B` (player HP set to 0 at the top of frame 200 →
no rewind, lose at **frame 201**) and seed `btd-dot-virus` (a `virus`
damage-over-time tick as the killer → no rewind, lose at **frame 243**).
Control: seed `btd-A` (ordinary enemy melee kill) **does** rewind, at
frame 607.

**Symptom:** `rule_fights_2.js:91` triggers the rewind only when its
`onTick` observes `combat.outcome === 'lose'`. `onTick` runs inside
`stepEncounter` → `stepCrowd`, and `combat.js`'s `stepFrame` opens with
`if (combat.outcome !== 'fighting') return;` — so a frame that *starts*
already lost never reaches `onTick` again. Only deaths latched **during**
`stepCrowd` (an enemy's landed hit, via `combat_defense.js`/
`combat_stand.js`) are seen. Every damage source that resolves *after*
`stepCrowd` in the same frame is invisible to it: `stepHazards`,
`stepStatuses` damage-over-time, the `onCombatTick` dispatch, and the
end-of-frame `if (player.hp <= 0 ...) combat.outcome = 'lose'` at
`combat.js:254`. The Rule Fight's entire signature — "death rewinds 20s" —
silently does not happen and the run ends.

Reachable with shipped content only, no fuzzing required: `kq_sheer_heart`
and `kq_bites_the_dust` are both Killer Queen Aspects (`aspects.js`), so the
player most likely to meet this Rule Fight is exactly the one who can carry
a periodic HP cost into it.

**Frame:** 6000 (seed `btd-tickonly`); 201 (`btd-B`); 243 (`btd-dot-virus`).

**Status:** logged, not fixed. Every candidate fix moves *when* the outcome
is observed relative to the frame pipeline — re-checking `outcome` after
`stepHazards`/`stepStatuses`, or giving the rewind its own hook at the
bottom of `stepFrame` — which is a change to `combat.js`'s per-frame
sequence, i.e. a design change to the frame pipeline rather than a behaviour
fix inside one file. Same class as QA-001, and it belongs in the same 13l
step-ordering batch.

---

### QA-017 — S2 — the Bomber cannot damage a stationary player from any
### position on the map

**Repro:** `node apps/standbattle/scripts/qa_ai_pathing.js --only=bomber
--verbose` (seed `qapath`). 0 damage across 11/11 player positions and 37/37
depth samples over 2400 frames each, despite 26-28 *committed* attacks per
run. Hazard first visible at **frame 239** (seed `qapath:bomber:centre`) at
`distPlayer→hazard = 88.7` against a hazard radius of 55.

**Symptom:** `ai.js:191-194`'s `defaultApproachRange` filters ranged
patterns out before taking a minimum, so a *pure*-ranged kit falls through
to `MELEE_MAX_RANGE = 110` (`ai.js:168`) and `combat_enemy.js:97` halts the
enemy there. `bomb_plant` then travels only ~20 units (40px/s ÷ 60 × 30
activeFrames) and leaves a 55-radius hazard, so the bomb always detonates
~89 units from the player — outside its own blast. The authored
`range: 90` would not close the gap either; it needs ≤75. The Bomber is
therefore an enemy type that structurally cannot deal damage.

**Frame:** 239 (seed `qapath:bomber:centre`), and every subsequent plant.

**Status:** logged, not fixed. Reconciling `defaultApproachRange` with
pure-ranged kits changes how every ranged enemy chooses its standoff
distance — an AI-tuning decision, not a one-file behaviour fix. Currently
unreachable in play (QA-010: `bomber` spawns in no shipped encounter). Same
root cause makes the `spacer` profile not actually space:
`sniper`/`zoner`/`bomber` all get approachRange 110 while their patterns
reach 420/360/90, so the sniper closes to melee distance to fire.

---

### QA-018 — S2 — 78% of the depth axis is a permanent safe lane, and all
### four corners are absolute safe zones

**Repro:** `node apps/standbattle/scripts/qa_ai_pathing.js` (seed `qapath`),
Section B depth sweep. Across 72 corner runs: **2,585 committed enemy
attacks, 0 total damage.**

**Symptom:** the quantified consequence of QA-005/QA-007's "enemies never
move in z after spawn". Measured maximum |player.z − enemy.z| at which a hit
can still land, against the 180-unit depth axis: 15 melee types **20.1
units (22% of the axis lethal, 78% a permanent safe lane)**, governed by
`hitbox.js:10`'s `MELEE_DEPTH_TOLERANCE`; `sniper` 8.6 units (10%);
`zoner` 8.6-40.1 units seed-dependent — the only type that partly escapes,
because `hazards.js:55` uses true 2D distance rather than the depth
tolerance; `bomber` 0% (QA-017). **0 of 18 enemy types can damage the player
from all 7 tested positions.**

Also measured, and shipped-reachable: `LEASH_RANGE = 90`
(`combat_enemy.js:22`) anchored at `encounter.js:28`'s `spawnX = 602` floors
a Leashed enemy at x = 512 in an arena spanning 58-662, so it can never
threaten a player left of x ≈ 438 — **63% of the arena width**. All 18
types orbit forever at both x-min corners. This is not QA-only: `angelo`
is `baseType: 'elite'` and rolls affixes on every spawn, and seed
`qapath:angelo:nw` rolled `fortified + leashed` → orbit at min |dx| = 456
for the full 2400 frames, 7 telegraphs, 0 damage. Seed-dependent by design
(`--seed=alt7` does not roll it).

**Frame:** leash floor reached ~290 and held to 2400 (seed
`qapath:morioh_thug:nw:leash`).

**Status:** logged, not fixed — same 13l batch as QA-005/QA-007/QA-012, all
one "enemies have no z-axis and no interception" family. Explicitly **not a
softlock**: `encounter.js:32-34`'s only win condition is `killAll`, so the
player must approach regardless; nothing traps them.

---

### QA-019 — S3 — melee patterns commit at any distance ("phantom
### telegraphs"), which also masks genuine commit starvation

**Repro:** seed `qapath:morioh_thug:nw:leash` — melee windups begin at
**frames 347 (sweep), 1142, 1723 and 1842**, each with |dx| = 454.5 against
an `approachRange` of 84.

**Symptom:** `ai.js:234`'s `rng.random() < 0.002` escape hatch fires
regardless of distance, and `ai.js:175`'s pattern filter keeps any pattern
with `range <= 110` eligible whatever `dist` is — so an enemy that cannot
close (leashed, or halted by its approach range) still telegraphs and swings
at empty air roughly every 500 frames. Cosmetically this reads as broken AI;
functionally it also means the NO-COMMIT stuck-state class can never
trigger, so a real commit starvation would be masked by the same escape.

**Frame:** 347 (first occurrence, seed above).

**Status:** logged, not fixed. Gating the escape on distance changes when
enemies attack at all, which is a pacing design call for 13l.

---

### QA-020 — S3 — a hit routed to the Stand never fires `onDamageTaken`,
### hiding ~71% of incoming damage from that hook

**Repro:** `node apps/standbattle/scripts/qa_ai_pathing.js --only=sniper
--verbose` (seed `qapath`) — solo sniper at arena centre: 20 Stand-routed
hits vs 8 direct User hits, i.e. 71% of that fight's incoming damage never
reaches an `onDamageTaken` listener.

**Symptom:** `combat_stand.js:129-130`'s `applyFeedbackDamage` fires
`onFeedbackDamage` and then `applyHit` directly, while the User path fires
`onDamageTaken` (`combat_defense.js:139`). Any Fragment/Relic/affix worded
as "when you take damage…" therefore silently does not fire for feedback
damage, even though the player's HP dropped.

**Frame:** n/a — steady-state over the 2400-frame run.

**Status:** logged, not fixed, and flagged as a **design question rather
than a confirmed defect**: a separate `onFeedbackDamage` hook exists, so the
split may be deliberate. 13l should decide whether `onDamageTaken` is meant
to mean "the User's HP fell" (in which case the feedback path must also fire
it) or "the User's own body was struck" (in which case this is correct and
the content wording needs auditing instead).

---

### QA-021 — S2 — an enemy killed by a status tick skips the entire death
### pipeline: `onKill` never fires and `deathTimer` stays 0

**Repro:** `node apps/standbattle/scripts/qa_ai_interrupts.js`, seed
`qa13d-6dot`, **frame 121** — enemy killed by a damage-over-time tick fires
`onKill` **0 times** with `deathTimer = 0`; the control (an identical kill
from a landed hit) fires it once and sets `deathTimer = 53`.

**Symptom:** `status.js:126`'s `applyDot` calls `fighter.js:120`'s
`applyDamage` directly, but `onKill` is dispatched only from
`combat_player.js:193` and `combat_defense.js:87` — the two landed-hit
paths. So every on-kill mechanic silently does not fire for a
status-damage kill: the Bomber's `explodeOnDeath`, the Enraged-on-Kill
affix, combo/momentum grants, and `mission_counters.js`'s kill counters. The
zero `deathTimer` also skips the death animation entirely.

**Frame:** 121 (seed `qa13d-6dot`).

**Status:** logged, not fixed. The fix is a shared kill choke point that
both damage paths route through — a real refactor of where death is
detected, not a one-file behaviour fix. Flagged for 13l; note it likely
also explains any future "my on-kill Fragment sometimes doesn't proc"
report.

---

### QA-022 — S2 — a dead enemy's in-flight projectiles freeze in place,
### stay rendered, and never detonate their authored hazard

**Repro:** solo encounter per type, seeds `orphan-sniper` / `orphan-zoner` /
`orphan-bomber`: set `enemy.hp = 0` on the first frame `enemy.projectiles`
is non-empty (**frames 235 / 233 / 210** respectively), then step 400 more
frames. Each still has **1 entry in `enemy.projectiles`**, frozen at its
kill-frame x (280.0 / 284.2 / 288.1), and **0 hazards** were ever spawned.
Also reproduces through the scripted harness: `node
apps/standbattle/scripts/qa_ai_interrupts.js`, seed `qa13d-6c-haz-bomber`,
**frame 55** — a Bomber killed mid-`active` with its hazard projectile
airborne produces 0 hazards where the control run produces 2.

**Symptom:** `combat_enemy.js:59-63` returns early for `hp <= 0`, before the
projectile loop at `:119` — so a dead enemy's projectiles stop being
stepped, spliced, or expired. They are never removed from the array, and
`arena.js:200` draws them with no `hp > 0` guard, so they hang in mid-air
for the rest of the fight. The same early return skips `:131-134`'s
`pr.life <= 0 → spawnHazard` branch, so Phase 6's authored "a pursuit that
times out without connecting still detonates" rule is silently cancelled by
killing the owner.

**Frame:** 134 / 212 / 235 / 55 (seeds above).

**Status:** logged, not fixed. Continuing to step a dead enemy's
projectiles changes who owns them and when a fight is really over — an
ownership/lifetime design call, not a behaviour fix. Unreachable in shipped
play today (QA-010: none of the three ranged types spawn).

---

### QA-023 — S2 — a summoner poise-broken on its summon frame still summons

**Repro:** `node apps/standbattle/scripts/qa_ai_interrupts.js`, seed
`qa13d-6e-caller`, **frame 820** — a `caller` poise-broken on the exact
frame `summonTimer` reaches 0 spawns anyway (alive summons 2 → 3).

**Symptom:** `combat_enemy.js:98` calls `stepSummon` after `stepPoise`, but
`summons.js:47`'s `stepSummon` has no stagger or poise-broken guard at all —
it only checks `def.summon` and `hp <= 0`. This is exactly the interrupt
the mission's item 6 names ("stagger of a summoner mid-summon"), and it does
not interrupt. Killing the Caller outright *does* stop it (the `hp <= 0`
check), so only the stagger case fails.

**Frame:** 820 (seed `qa13d-6e-caller`).

**Status:** logged, not fixed. Adding a stagger guard changes what a poise
break is *for* on a summoner class — a real design decision about whether
summons are interruptible, which the GDD does not settle. Flagged for 13l.
Unreachable in shipped play today (QA-010: no summoner spawns).

---

### QA-024 — S2 — a boss staggered into a phase transition stays staggered
### more than twice as long, at ×1.5 damage throughout

**Repro:** `node apps/standbattle/scripts/qa_ai_interrupts.js`, seed
`qa13d-7-staggered-killer_queen`, **frame 42** — `killer_queen` remains
staggered for **76 frames** against `STAGGER_FRAMES = 36`, taking
`STAGGER_DAMAGE_MULT` (×1.5) for the whole time.

**Symptom:** `combat_enemy.js:76`'s `if (enemy.invulnFrames > 0) { ...
return; }` returns before `stepEnemyAI`, so `ai.timer` — the stagger clock —
is frozen for the 30-frame phase invulnerability plus the transition's
160 ms hitstop. The stagger does not tick down while the boss is invulnerable
and then resumes, so a player who poise-breaks a boss right at a phase
threshold gets a free punish window more than twice the authored length.
Not a softlock; it self-resolves.

**Frame:** 42 (seed above); reproduces on every boss with `phases`.

**Status:** logged, not fixed. Ticking status/stagger clocks during
invulnerability is a frame-pipeline ordering change (same family as
QA-001/QA-016), not a one-file fix. Verified separately that the transition
itself is correct: **all 10 bosses walk `[0,1,2]` with no skip and no
repeat**, correct `patternIds` and `invulnFrames` set at each step, even
when a single catastrophic hit drops HP from full to below the last
threshold (seeds `phase-<bossId>`).

---

### QA-025 — S2 — Yellow Temperance is mathematically unwinnable for
### Long-Range, and Illuso's Mirror has no player agency for Mid or Long

**Repro:** `node apps/standbattle/scripts/qa_rule_fights.js` (seed `rf`).
Both numbers below are **policy-independent** — they are ceilings and
uptimes measured under forced conditions, not the outcome of a scripted
bot, deliberately so: a win/lose cell only measures the driver's skill.
Yellow Temperance trade ceiling, boss parked in `recover`, heavy only:
close **20.89 dmg per 6 self-damage (3.48×)**, self-cost 30 of 100 HP; mid
**15.38 per 6 (2.56×)**, self-cost 42; long **5.81 per 6 (0.97×)**,
self-cost **102 HP against a 100 HP pool** — i.e. the player provably runs
out of health before the boss does, whatever the player does. Illuso's
Mirror, 1440 sustained frames holding `project` on the boss's layer: close
window 100% with **600 projecting frames**; mid 56% with **0**; long 53%
with **0**.

**Symptom:** two independent Stand-Class blind spots in `rule_fights*.js`.
`rule_fights_2.js:20`'s flat `YT_CONTACT_DMG = 6` per landed hitbox is not
scaled by the attacker's damage output, so Long-Range's −35% baseline
(`stand_classes.js:194`, `damageMult: 0.65`) drops the exchange below 1:1
and the player provably dies first. `rule_fights.js:74` gates mirror
vulnerability on `combat.player.projecting`, which only Close-Range ever
sets (`stand_classes.js:53`) — Mid uses `stand.flicked` and Long is always
detached — so for those classes the layer toggle is unreachable and the
fight's stated puzzle ("time your Project across layers") is replaced by
waiting out a 240-frame timer. Winnable, but agency-free.

**Frame:** YT trade ceiling measured over frames 0-1800 with the boss held
in `recover`; mirror agency over frames 0-1440.

**Caveat, stated:** the win/lose grid this script also prints is **not**
evidence and is not cited here. The scripted policy was partly rebuilt after
the original run was lost, and the rebuilt driver is weaker — it now loses
several cells the first driver won. The two findings above survive that
change untouched because neither depends on the driver.

**Status:** logged, not fixed. Both fixes are content/design decisions —
scale YT's contact damage through a resolver, and re-gate the mirror on the
generic `player.standDetached` every scheme already sets — and re-gating the
mirror changes what the fight *is* for two of three classes. Flagged for
13l.

---

### QA-026 — S2 — Rolling Stones' greed reward latches before any fate
### damage can tick, so the doubling is free

**Repro:** `node apps/standbattle/scripts/qa_rule_fights.js` — a 3-frame tap
into the fate zone at **frame 200** sets `combat.rollingStonesGreedy = true`
with **0 damage taken**.

**Symptom:** `rule_fights_2.js:57-60` sets the greed flag on the first frame
the player is inside `FATE_RADIUS`, but the damage it is supposed to trade
against only lands when `encounter.fateTick` counts 20 consecutive frames
down (`:61-64`). Stepping in for three frames and out again buys the
promised reward doubling (`run_flow.js`'s reward step reads the flag) at
zero cost, so GDD's "lethal but doubles rewards" greed check has no downside
at all. All three Stand classes show `GREEDY` with a 100% win rate.

**Frame:** 200 (seed `rf`).

**Status:** logged, not fixed — moving the flag to the first damage tick is
a one-line change but it changes the objective's payout economics, which is
a balance decision for 13l, not a hardening fix.

---

### QA-027 — S3 — Bites the Dust leaves the player input-locked for 170
### frames after its own rewind

**Repro:** `node apps/standbattle/scripts/qa_rule_fights.js` — seed `rf`,
rewind fires at **frame 1121**, after which `player.state === 'dead'`
persists until **frame 1291** (170 frames, 2.8 s) and is cleared only by the
player being hit again.

**Symptom:** `rule_fights_2.js:94-101` restores HP, position and
`combat.outcome`, but nothing resets `player.state`, and
`combat_player.js`'s state machine has no branch that exits `'dead'` — it
was written on the assumption death is terminal. The signature payoff of
the Rule Fight therefore hands control back ~3 seconds late, in the middle
of the fight that just killed you.

**Frame:** 1121 → 1291 (seed `rf`).

**Status:** logged, not fixed. Belongs with QA-016 — same Rule Fight, same
"resurrection was never modelled as a state" root cause, same 13l batch.

---

### QA-028 — S3 — a token slot points at a corpse for the remainder of the
### frame in which its holder dies

**Repro:** `node apps/standbattle/scripts/qa_ai_interrupts.js`, seed
`qa13d-6c-brute-active`, **frame 258** — end-of-frame assertion finds melee
slot 1 still holding an enemy with `hp <= 0`.

**Symptom:** `combat_crowd.js:15` runs `stepTokens` at the *top* of
`stepCrowd`, so a holder that dies later in the same frame — during another
enemy's step, or during `updatePlayer`'s own hitboxes — is not noticed until
the next frame's `stepTokens` releases it (QA-009's fix, `token.js`'s
`canHoldAttackToken` check). The stale reference lasts exactly one frame and
self-corrects; nothing reads a dead holder in between, because the gate is
`enemy.hasToken` on the enemy, not the slot's back-pointer.

**Frame:** 258 (seed above); the same shape on any seed where a token holder
dies mid-frame.

**Status:** logged, not fixed — and recorded mainly so 13l does not mistake
this for a QA-009 regression. It is the same one-frame ordering class as
QA-001: fixing it means re-running the token step after damage resolution,
which is a frame-pipeline change. No observable effect on play.

---

### QA-029 — none found — all 16 Stand x Aspect configs, plus the 4
### Aspect-less Stands, complete a full run every time

**Repro:** `node apps/standbattle/scripts/qa_matrix.js --seeds=15` (new
Phase 13e script, modeled on `qa_run_sweep.js`'s real-flow driver —
`run_flow.js`/`run_choices.js`, never a parallel sim). Only 4 of the 8
Stands carry any `ASPECT_LIST` entries (`star_platinum`, `silver_chariot`,
`hierophant_green`, `killer_queen`, 4 Aspects each = the mission's "16");
`crazy_diamond`/`gold_experience`/`sticky_fingers`/`hermit_purple` have
none, so they run with `aspectId: null` instead of being padded to a fake
count.

**Symptom (absence of one):** 20/20 configs, 15 seeds each (300 runs) —
**100.0% completion**, zero thrown errors, zero non-finite HP, zero
`guardExhausted`/`noEdge` terminations. Mean run length 2.3-8.7 node
visits, mean damage taken 0.0-64.4 HP. The two 0.0-damage-taken rows
(`hierophant_green` all 4 Aspects, `hermit_purple`) are both Long-Range
(range 9) Stands — same shape as QA-005/007/012/018's "enemies never move
in z, retreat AI parks the User safely" family, not a new defect.

**Status:** not a bug — recorded as Phase 13e's item-1 clean baseline.
`qa_matrix.js` kept as a durable script for future Stand/Aspect additions.

---

### QA-030 — none found — stacking every `onCombatTick selfDamage` relic
### plus Sheer Heart Attack's own drain resolves death cleanly

**Repro:** ad hoc script (Phase 13e, not checked in — logic below is
short enough to restate): `buildCombatFromHeader` with `standId:
'killer_queen'`, `aspectId: 'kq_sheer_heart'` (1 HP/sec, the Aspect QA-016
already names) and `relics: ['relic_stone_mask', 'relic_overclocked_stand',
'relic_overload_capacitor', 'relic_headhunter_pact', 'relic_dios_bone',
'relic_heaven_ascension_toll']` — every `onCombatTick`-hooked `selfDamage`
relic in the content pool, `relic_stone_mask` being the mission's literal
"Stone Mask-equivalent" (1 HP/sec, `content/relics/power_risk.js:8-16`).
Enemy forced `staggered`+`invulnFrames` so it can never land a hit —
self-damage is provably the only source. Stepped 4000 frames.

**Symptom (absence of one):** clean death at **frame 599**, `finalHp: 0`
(not negative), `outcome: 'lose'` exactly once (`outcomeFlips: 0`), no
throw, no non-finite HP, no further frame stepping after death changes
outcome. Item 3's "confirm death resolves cleanly, no infinite loop" holds
under the worst stacked-drain build the content pool can produce.

**Status:** not a bug. Separately confirmed by grep that this codebase has
no "Arrow Shrine"-equivalent (max-HP-reducing) content at all — no `run
choices.js`/`item_effect_lib.js`/relic path ever assigns
`maxHp -= …` or otherwise lowers `runState.maxHp`, only `hp` moves — so
item 3's "every Arrow-Shrine-equivalent item taken" scenario has no
content to exercise; not invented per the mission's own instruction not to
add content that isn't there.

---

### QA-031 — S3 — `feedbackPct`'s documented 0.10 floor is unreachable by
### any Stand the game ships

**Repro:** `stats.js:72-74`: `feedbackPct = clamp(0.70 - 0.065*range, 0.10,
0.70)`. `data.js`'s 8 Stands span `range: 2` (`star_platinum`,
`crazy_diamond`) to `range: 9` (`hierophant_green`, `hermit_purple`) — no
Fragment/Relic/Aspect/Duo anywhere in the content pool (`fragments.js`,
`relics.js`, `aspects.js`, `content/duos/*.js` — grepped for any write to
a `range` stat) ever modifies it. `range: 9` resolves to `0.70 - 0.585 =
0.115`, the closest any Stand gets; the floor requires `range >= 9.23`.

**Symptom:** the mission's "feedbackPct at its clamp floor (0.10)" boundary
cannot be produced by any in-game build — the floor branch of `stats.js`'s
`clamp` is dead code under the current roster. Not a defect (nothing
degenerates, nothing divides by it), just a boundary the mission asked to
confirm that turns out to not exist. `tetherPx` (`26 * range`) is likewise
always positive (min 52px at range 2) and `hud.js:177`'s `standDist /
tetherPx` never risks a zero divisor for the same reason. No "20m
Radius"/"Rite"-equivalent Aspect exists either (grepped for a separate Stand
HP pool or untargetable-User flag — the only detachment mechanic is the
Long-Range Control Scheme's generic `standDetached` flag, already the
subject of QA-005/007/012/018/025).

**Status:** logged, not fixed — nothing to fix; recorded so 13l does not
re-derive this boundary and mistake "unreachable" for "untested."

---

### QA-032 — none found — every Duo Fragment's donor pair is producible,
### and a Disc slot swap cannot leak the overwritten Disc's hooks

**Repro:** enumerated every `requires[].donor` across `content/duos/core.js`
and `content/duos/extended.js` (20 entries) against the donor set actually
referenced by `fragments.js`'s donor pool — all 8 donor ids used by
`DUO_LIST` (`the_world`, `purple_haze`, `sticky_fingers`, `echoes_act3`,
`red_hot_chili_pepper`, `gold_experience`, `crazy_diamond`,
`hermit_purple`) are real, ownable donors, and `fragment_offers.js`'s
`buildDuoCandidates` gates only on `ownedDonorSet(runState)` — no
unreachable Duo. For Disc swap: `combat.js:88` builds a fresh
`dispatcher` from `opts.discs` (`Object.values(discsBySlot)`) on every
`createCombat` call — combat is rebuilt per fight, so overwriting
`discsBySlot[slot]` before the next fight naturally drops the old Disc's
hooks with it; there is no persistent dispatcher a stale hook could survive
in. No "Requiem-elevation" mechanism matching the mission's description
exists in this codebase — `Requiem` here names a Silver Chariot Aspect
(`sc_requiem_stance`) and an enemy/boss affix tier, not a slot-elevation
system — not invented per the mission's instruction.

**Status:** not a bug — items 5 and 6 clean.

---

### QA-033 — S2 — five shipped content clauses are silently inert: a
### `ctx.combat`-reading verb attached to a hook whose ctx has no `combat`

**Systems collided:** content-validation × effect-pipeline.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--case=c8d --verbose` (static scan over the shipped registry, seed
`c13f-unit`), plus the runtime confirmation `--case=c5e` (seed
`c13f-barrier-loop`, **frame 118**): Hierophant Green + `hg_barrier`,
Guard held and nothing else, player parked 50px from three enemies —
well inside the Aspect's 130px radius — breaks guard 44 times in 3600
frames and freezes **0 of 3** enemies. Replays:
`docs/qa/replays/c5e-guard-break-loop-vs-a-dead-aspect-clause.json`.

**Symptom:** `item_effect_lib.js:101` (`applyStatusToNearby`),
`:122` (`damageNearby`) and `effect_lib.js`'s `triggerTimeStop` all open
with `if (!ctx.combat) return;`. Eight effect hooks build their ctx
without a `combat` field — `onGuardBreak` (`combat_player.js:276`,
`combat_defense.js:98`), `onStaggerStart` (`combat_defense.js:74`,
`combat_enemy.js:74`), `onDamageTaken` (`combat_defense.js:139`,
`hazards.js:59`), `onDamageIncoming` (`combat_defense.js:128`),
`onProjectStart`/`onProjectEnd` (`stand_classes.js:56`, `:72`),
`onCritCheck` (`resolvers.js:129`) and `onFeedbackDamage`
(`combat_stand.js:123-127`) — while `onMoveStart`/`onHitLanded`/`onKill`/
`onStepStart`/`onClashSuccess`/`onHitResolve`/`onTetherStrain`/
`onCombatTick` all carry it. Five shipped clauses land on the wrong side
of that line and do nothing at all:

| entry | clause |
|---|---|
| fragment `frag_moody_blues_special_2` | `onStaggerStart -> triggerTimeStop` |
| fragment `frag_moody_blues_special_2` | `onGuardBreak -> triggerTimeStop` |
| aspect `hg_web` | `onProjectStart -> applyStatusToNearby` |
| aspect `hg_barrier` | `onGuardBreak -> applyStatusToNearby` |
| aspect `kq_bites_the_dust` | `onDamageIncoming -> triggerTimeStop` |

`frag_moody_blues_special_2` has only those two effects, so the whole
Fragment is inert: picking it costs the player a reward slot for nothing.
`hg_barrier`'s card text ("Breaking a guard Freezes everything around it
and returns a Step charge") is half false — the Step-charge clause
(`refundStepCharge`) reads no combat and does fire.

This is exactly the mission's item 8: **each entry is individually legal
and `npm run validate` reports 0 errors.** `validateEffectsAndQueries`
(`content_registry.js:69-78`) checks that the verb exists and that any
status it names exists; nothing anywhere checks that the hook can satisfy
the verb. The verb list is derived at runtime by the case, not hardcoded
— `qa_collision_cases_c.js` introspects each `EFFECT_LIB`/
`ITEM_EFFECT_LIB`/`ASPECT_EFFECT_LIB` entry's own source for a
`ctx.combat` read — so it stays correct as verbs are added.

**Frame:** 118 (seed `c13f-barrier-loop`); static for the scan.

**Status:** logged, not fixed — **deliberately, and this is the entry
13l should read first.** Adding `combat` to the five ctx literals is a
one-line-each behaviour restoration and looks like the QA-008 case. It is
not, because of what turning these on collides with: `hg_barrier`'s
trigger fires ~once a second for free (QA-035) and the status it applies
never expires or breaks (QA-034), so enabling the clause in isolation
hands a held Guard key a permanent arena-wide freeze. **QA-033 must be
fixed together with QA-034 and QA-035 or not at all** — fixing it alone
takes a stable build to an unstable one, which is the failure mode this
phase exists to prevent. The durable fix is a validator rule (hook→verb
requirement table) so the class cannot recur, which is new validation
surface, not a behaviour fix.

---

### QA-034 — S2 — Frozen never expires and never breaks, so its authored
### `breaksOnHits: 3` is dead and its +25% damage-taken is permanent

**Systems collided:** status × damage-resolution.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--case=c2a` (seed `c13f-unit`): apply `frozen`, step `stepStatuses`
**6000 frames** — still present. The control in the same case calls
`registerStatusHit` three times by hand and the status is removed
correctly, so the mechanism works and is simply never invoked.

**Symptom:** `status.js:53` gives Frozen `durationFrames: NO_EXPIRY`
(Infinity) on purpose — GDD §3.10 says it is "broken by hits, not a
timer" — and delegates removal entirely to `registerStatusHit`
(`status.js:184`). That function has **zero call sites outside
`status.js`**: no landed-hit path (`combat_player.js`,
`combat_defense.js`, `combat_stand.js`) calls it. Its own Phase 3 comment
still reads "not called by any combat path yet", which was true when
Frozen was data-only — but Frozen is now applied by a lot of shipped
content (`aspects.js:117`, `content/discs.js:39`, and eight donor
Fragments in `content/donors_meta_b.js`), and `resolvers.js:200` reads
`STATUS_DEFS.frozen.damageTakenMult` unconditionally. So every Frozen
application is a permanent, unremovable ×1.25 damage-taken mark rather
than a three-hit window. `consumeStatusForBonus` content can still strip
it deliberately; nothing strips it as a cost.

**Frame:** 6000 (seed `c13f-unit`), i.e. it survives 100 sim-seconds.

**Status:** logged, not fixed. Wiring `registerStatusHit` into the landed
-hit paths decides *where* a hit is counted against a status across three
files that currently share no such choke point — the same shared-kill
-choke-point shape QA-021 asks for, and a real refactor rather than a
one-file behaviour fix. See QA-033: this is one of the three that must
land together.

---

### QA-035 — S2 — a held Guard re-breaks about once a second, so every
### `onGuardBreak` clause is a free repeating trigger

**Systems collided:** defense × resources (and defense × aspect).

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--case=c5c` — seed `c13f-gb0`, hold `guard` and nothing else: **28
`onGuardBreak` fires in 1800 frames**, first at **frame 130**, all with
`cause: 'persistence'`. Nothing is poked; the case's second arm (which
pins Persistence at exactly 0) is reported separately so the natural
result stands on its own. `--case=c5e` reproduces it in a crowd fight
with a real Aspect equipped: **44 fires in 3600 frames**, first at
**frame 118**. Replays: `c5c-guard-break-at-exactly-zero-persistence.json`,
`c5e-guard-break-loop-vs-a-dead-aspect-clause.json`.

**Symptom:** the cycle is `combat_player.js:274-277` → `guardBreakStagger`
(`defense.js:99`, sets `state:'staggered'`) → stagger expires to `idle`
(`combat_player.js:294`) → Persistence regenerates at 2/s while idle
(`resources.js:52`) → Guard is still held, so the player re-enters guard
with a few points → `stepGuardDrain` (`defense.js:89`) empties it again →
break. No latch, no cooldown, no "you must release Guard first". The
break itself is a punish that costs the player a stagger, so the loop is
not free in a fight — but the *hook* is free, and any `onGuardBreak`
content is therefore a ~1 Hz engine rather than a once-per-punish payoff.

**Frame:** 130 (seed `c13f-gb0`); 118 (seed `c13f-barrier-loop`).

**Status:** logged, not fixed. Whether a held Guard should re-break is a
design question the GDD does not settle (the alternative — requiring a
release before Guard re-arms — changes what holding Guard means), and any
latch is a new state on the player. Flagged for 13l, and see QA-033: this
is the collision that makes the QA-033 one-liner unsafe on its own.

---

### QA-036 — S2 — Crowded adds bodies to every Rule Fight's authored
### roster, and the rule only ever binds `enemies[0]`

**Systems collided:** menace × rule-fight.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--group=7` — `--case=c7c` (seed `c13f-crowded-rf`) and `--case=c7d`
(seed `c13f-crowded-all`), both at **frame 0**, i.e. at spawn:

| encounter | authored | Crowded r3 |
|---|---|---|
| `budogaoka_sheer_heart_attack` | 1 | 4 |
| `kameyu_illusos_mirror` | 1 | 4 |
| `alley_formaggios_shrink` | 1 | 4 |
| `shopping_street_baby_face` | 1 | 4 |
| `loading_dock_yellow_temperance` | 1 | 4 |
| `park_rolling_stones` | 1 | 4 |
| `budogaoka_bites_the_dust` | 4 | 7 |
| `alley_cheap_trick` | 1 | 4 |

**8 of 8.** `encounter.js:77-78` appends `opts.extraEnemies` copies drawn
from the wave's own `types` list to **every** wave; a Rule Fight declares
its roster as `waves: [{ types: [...] }]` (`data_encounters.js:113-143`)
with no fixed-count field for the spawner to respect, so a one-boss Rule
Fight spawns four of that boss. Every `rf_*` handler then captures
`combat.enemies[0]` once in `onStart` and holds it for the fight
(`rule_fights.js:36`, `:69`, `:113`, `rule_fights_2.js:24`, `:126`), so
the rule's special behaviour — Sheer Heart Attack's
invulnerable-outside-the-hiding-spot clamp, Cheap Trick's Doom stacking,
Baby Face's per-slot resistance — applies to exactly one of the four
copies. The other three are ordinary bosses that the fight's stated rule
does not govern.

**Not run-ending:** `--case=c7e` runs all eight inflated Rule Fights to a
terminal outcome with a z-aware bot and **all eight resolve inside 5400
frames**, so this is graded S2, not S1.

**Frame:** 0 (spawn) for the inflation; c7e covers 0-5400.

**Status:** logged, not fixed. Two candidate fixes and both are design
calls: exempt Rule Fights from `extraEnemies` (decides that Menace does
not apply to them at all, which contradicts GDD §8.3's "every encounter"),
or make the rule handlers bind every enemy rather than `enemies[0]`
(changes what a Rule Fight's subject is). Flagged for 13l. Note this also
makes QA-025's "Yellow Temperance is mathematically unwinnable for
Long-Range" worse by a factor of four.

---

### QA-037 — S2 — five of the fourteen Menace conditions resolve into
### profile keys that nothing outside `meta_menace.js` reads

**Systems collided:** menace × run-flow.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--case=c7a --verbose` (seed `c13f-unit`). `createMenaceProfile`
(`meta_menace.js:84`) resolves them correctly — at max rank the profile
reads `countdownFrames=1800 feedbackMult=1.75 invadesPerAct=3
requiemDenied=true bossPhase3Early=true` — and no file reads any of them.

**Symptom:** grep for each `MENACE_PROFILE_KEYS` entry
(`meta_menace.js:26`) outside `meta_menace.js`/`scripts/`:

| key | condition | consumers |
|---|---|---|
| `countdownFrames` | COUNTDOWN | **0** |
| `feedbackMult` | FRAGILITY | **0** |
| `invadesPerAct` | HUNTED | **0** |
| `requiemDenied` | REQUIEM DENIED | **0** |
| `bossPhase3Early` | CONVERGENCE | **0** |
| `enemyHpMult` | BLOODTHIRST | 1 (`combat.js:176`) |
| `enemyDamageMult` | KILLING INTENT | 2 |
| `enemyRecoveryMult` | SHARPENED INSTINCT | 1 (`resolvers.js:108`) |
| `extraEnemies` | CROWDED | 2 (`combat.js:178`, `encounter.js:77`) |
| `healMult` | RATIONING | 2 |
| `shopPriceMult` | INFLATION | 1 |
| `offerCountDelta` | SCARCITY | 1 (`run_flow.js:180`) |
| `enemyArmorAll` | UNYIELDING | 1 |
| `actStartHpPct` | PRISTINE CONDITION | 1 (`run_flow.js:235`) |

A player can spend up to 8 of the 30 Menace ranks (Countdown 3, Fragility
3, Hunted 3, Requiem Denied 1, Convergence 1 = 11 ranks available) on
conditions that raise their recorded Menace rank and change nothing about
the run. The Menace board and `menaceRankOf` count them normally.

**Consequence for this phase's own matrix:** two of the mission's named
item-7 collisions cannot be constructed. "Requiem Denied plus a build that
requires Requiem" and "Countdown plus a Survive objective" have no
mechanism to collide with — recorded as untested rather than clean.

**Frame:** n/a (profile resolution, seed `c13f-unit`).

**Status:** logged, not fixed. Implementing five conditions is feature
work, not a hardening fix. 13l should decide whether they are wired up or
removed from the board; leaving them offered-but-inert is the worst of
the three options.

---

### QA-038 — S3 — a hit-stop frame freezes the entire frame pipeline,
### including the time-stop countdown and the player-death poll

**Systems collided:** hit-stop × time-stop.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--case=c3d` — seed `c13f-hs-ts`, **frame 101**: with
`timeStopFrames = 120` and `hitstopMs = 200` set on the same frame, the
time-stop counter is still 120 twelve frames later. Replay:
`docs/qa/replays/c3d-hitstop-freezes-timestop-and-lose-check.json`.

**Symptom:** `combat.js:224` (`if (juice.update(FRAME_MS)) return;`)
returns before everything: the time-stop decrement (`:233`), `stepCrowd`/
`stepHazards`, the per-entity `stepStatuses` sweep (`:238-242`), the
`onCombatTick` dispatch (`:246-252`) and the `player.hp <= 0` lose poll
(`:254`). The frame counter (`loop.frame`) still advances, so a hit-stop
frame is a frame in which nothing at all happened. Two consequences worth
naming: a time-stop overlapping a hit-stop is *extended* by the hit-stop's
full duration rather than overlapping it, and a player whose HP is already
≤ 0 stays `'fighting'` for the length of the freeze.

Also note the layering: `juice.js` is a render module and
`.claude/rules/render.md` flags it as deliberately on the real render
clock. In the headless path it is fed a constant `FRAME_MS`, so it is
deterministic here — but a render module holds the sim's stop button.

**Frame:** 101 (seed `c13f-hs-ts`).

**Status:** logged, not fixed. Every candidate fix moves what a hit-stop
frame is allowed to skip, i.e. a change to `combat.js`'s per-frame
sequence — the same class as QA-001 and QA-016, and it belongs in the same
13l step-ordering batch.

---

### QA-039 — S3 — an action starts during a hit-stop frame, on a frame the
### sim never ran

**Systems collided:** cancel-window × hit-stop.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--case=c3b` — seed `c13f-hitstop-input`, **frame 101**: with
`hitstopMs = 200` set at frame 100, a `light` press at frame 101 takes the
player from `idle` to `attack` while `stepFrame` is returning early.
Replay: `docs/qa/replays/c3b-input-executes-during-hitstop.json`.

**Symptom:** `combat.setKey` (`combat.js:206-216`) calls `performAction`
directly on the key-down edge when `player.state === 'idle'`, outside
`stepFrame` entirely — so it is unaffected by the hit-stop early return at
`:224`. The move's costs are spent and its state is set on a frame in
which no sim step occurs. It is self-limiting (the move leaves `idle`, so
further presses buffer instead), and the practical window is small: a
phase transition's `triggerHitstop(160)` (`combat_enemy.js:42`) is ~10
frames, a purge's 120ms is ~7. Recorded as S3 because nothing illegal
results — but "input is live during a sim freeze" is not stated anywhere
and is the kind of asymmetry a later feature would trip over.

**Frame:** 101 (seed `c13f-hitstop-input`).

**Status:** logged, not fixed. Same step-ordering batch as QA-038.

---

### QA-040 — S3 — time-stop suspends a boss's phase-transition i-frames
### and the purge immunity window instead of eating into them

**Systems collided:** time-stop × boss-phase, time-stop × purge.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--group=4`. `--case=c4a`, seed `c13f-ts-phase`, **frame 98**: a
`killer_queen` phase transition sets `invulnFrames = 30`; entering a
240-frame time-stop on that exact frame leaves it at **30** a hundred and
twenty frames later. `--case=c4b`, seed `c13f-ts-purge`, **frame 125**: a
purge window opens at `statusImmuneFrames = 359` and is still **359**
after 150 frames of time-stop. Replays:
`c4a-timestop-during-phase-transition.json`,
`c4b-timestop-during-purge.json`.

**Symptom:** `combat.js:240` skips `stepStatuses` for every enemy entity
during time-stop, and `stepCrowd` (which owns `updateEnemyPhase` and the
`invulnFrames` countdown, `combat_enemy.js:29-45`) does not run at all
(`combat.js:236`). Both are the documented intent — the comment at
`combat.js:240` says "the frozen world's own clocks stop too" — so this is
**correct composition of two documented rules**, recorded because the
player-facing result is the opposite of what The World is for: a time-stop
landed on a phase transition buys a window against a boss that is
invulnerable for all of it, and the invulnerability outlives the freeze by
its own full remaining duration.

**Frame:** 98 (seed `c13f-ts-phase`); 125 (seed `c13f-ts-purge`).

**Status:** logged, not fixed. Graded S3 and arguably **BALANCE** rather
than a defect — no invariant is broken and the behaviour follows from the
rule as written. Making i-frames tick during time-stop would carve an
exception into "the world doesn't move", which is a design change. 13l
should decide whether The World is meant to be counterable this way.

---

### QA-041 — S3 — an unaffordable cancel fails silently: no `onMoveDenied`,
### and the buffered action is left queued

**Systems collided:** cancel-window × economy.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--case=c3a` — seed `c13f-cancelcost`, **frame 16**: a Special buffered
into `sp_light`'s frame-12 cancel window (`moves_star_platinum.js:10`)
with Persistence at 34 against `sp_barrage`'s cost of 35 (`:44`) is still
queued as `'special'` on frame 17. Replay:
`docs/qa/replays/c3a-unaffordable-cancel-retains-buffer.json`.

**Symptom:** the two ways a move starts diverge on failure.
`tryAttack` fires the denial cue — `if (!attemptMove(...))
combat.dispatcher.fire('onMoveDenied', {})` (`combat_player.js:79`) —
while `tryCancel` just returns (`combat_player.js:129`), so a cancel
denied on cost produces no cue for `fx.js`/`audio.js` and leaves
`player.bufferedAction` set. Retaining the buffer is defensible on its own
(that is what `INPUT_BUFFER_FRAMES` is for, `combat.js:206`), which is why
this is S3 rather than S2 — the defect is the missing denial signal and
the asymmetry between the two call sites, not the buffer itself.

**Frame:** 16 (seed `c13f-cancelcost`).

**Status:** logged, not fixed. Firing `onMoveDenied` from `tryCancel` is a
one-line change, but it makes a hook fire in a situation it never fired in
before, and `fx.js`/`audio.js`/`pose_player.js` all listen to it — a
behaviour change with a render-layer blast radius, batched to 13l rather
than taken mid-phase.

---

### QA-042 — S3 — feedback damage ignores the User's i-frames, so a
### Projecting player cannot become invulnerable at all

**Systems collided:** feedback × defense.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--case=c6b --verbose` — seed `c13f-fb-invuln`, **frame 60**: two
identical fights on `ENCOUNTERS.morioh_shopping_street`, Project engaged,
then `applyFeedbackDamage` invoked with the `knife_thug`'s real
`quick_stab` pattern. The control loses **3.19 HP**; a User with
`player.invulnerable = true`, `hitIframeTimer = 999` and Guard up at full
Persistence loses **3.19 HP** — bit-identical. Replay:
`docs/qa/replays/c6b-feedback-ignores-user-invulnerability.json`.

(Driven by a direct call rather than by geometry: whether a crowd hit
lands on the Stand or the User depends on exact spacing
(`combat_stand.js:100-111`), which made the geometric version of this case
inconclusive across 5400 frames. The direct call uses the real combat, the
real enemy and the real authored pattern; only the aiming is skipped.)

**Symptom:** `applyFeedbackDamage` (`combat_stand.js:121-138`) computes the
transfer and hands it to `applyHit` at `:132` with no defensive check of
any kind. Skipping Guard and Clash is documented and deliberate —
`combat_defense.js:33` routes a Stand-aimed hit past "the whole defensive
triangle" because the triangle is the User's own body's toolkit. What is
not stated anywhere is the consequence for Step: `player.invulnerable`
(`defense.js:78`) is skipped on the same path, so `DODGE_CHARGE_MAX`'s
"hard cap on invulnerability uptime" (`defense.js:5-7`) caps nothing
against a Stand-routed hit. While Projecting, every incoming hit that
resolves against the Stand is unavoidable by any means the player has.

**Frame:** 60 (seed `c13f-fb-invuln`).

**Status:** logged, not fixed. Graded S3 because it follows from a
documented routing rule rather than violating one — but it is the rule's
unstated half, and it interacts with QA-005/QA-006's Long-Range findings
(a class that is Projected more or less permanently has no i-frames at
all). Whether Step should cover the Stand is a GDD question, not a
behaviour fix. Flagged for 13l.

---

### QA-043 — S3 — Warded is consumed by the first status of any kind,
### including a purely benign one

**Systems collided:** status × affix.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--case=c2d` (seed `c13f-unit`): apply 1 stack of `mark` to a warded
entity — the ward is spent and the Mark does not land — then apply 9
stacks of `virus`, which lands in full.

**Symptom:** `status.js:147` clears `affixData.warded` on the first
`applyStatus` call, whatever it carries. `mark` (`status.js:93`) has no
tick, no damage and no multiplier — it exists to be amplified or consumed
by Hermit Purple content — so spending a one-shot ward on it is strictly
worse than not having the ward. Any status-application build that carries
a cheap utility status strips the affix's protection for free before its
real payload arrives.

**Frame:** 0 (seed `c13f-unit`, no combat needed).

**Status:** logged, not fixed. Making the ward selective needs a notion of
which statuses are "threats" — a new content axis (a tag, a threat flag)
that no schema has today, i.e. a design addition rather than a behaviour
fix. Flagged for 13l as **BALANCE-adjacent**: the mechanism does exactly
what it says, and only the interaction is undesirable.

---

### QA-044 — S3 — `bus.effect` accepts a non-numeric priority; the failure
### is deferred to dispatch and points at the wrong file

**Systems collided:** effect-pipeline × content.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--case=c1c` (seed `c13f-unit`). Registering with the arguments in the
intuitive-but-wrong order — `bus.effect(name, fn, priority)` instead of
`bus.effect(name, priority, fn, source)` (`hooks.js:148`) — succeeds
silently; `sortByPriority` (`hooks.js:122`) then compares against `NaN`,
and the first `runEffect` throws `list[i].fn is not a function` from
`hooks.js:161`.

**Symptom:** `assertKind` validates the hook *name* at that exact spot and
throws a good error naming the caller's mistake; the priority is not
validated at all. No shipped content mis-registers today (the scan in
`--case=c8d` walks every entry), so this is purely a guard-rail gap for
future content — a one-line `typeof priority` check next to the existing
`assertKind` would move the error to the registration site.

**Frame:** 0 (seed `c13f-unit`).

**Status:** logged, not fixed. S3, batched to 13l with QA-033's proposed
validator work — both are "the pipeline should reject this at load rather
than at dispatch".

---

### QA-045 — none found — the pipeline's own guarantees, all status pairs,
### and the feedback/resource boundaries hold

`node apps/standbattle/scripts/qa_systems_collision.js` — **56 of 74
cases clean**, 0 throws. What was checked and passed, so 13l can diff
against it rather than re-derive it:

- **Priority bands (`c1a`).** Registering CLAMP → MULTIPLY → ADD, i.e.
  authoring order exactly inverted, still executes add → multiply → clamp
  and the clamp wins. Priority beats authoring order.
- **Tie determinism (`c1b`).** Ten effects at identical priority, with
  registrations at other bands interleaved to force `sortByPriority` to
  re-run (`hooks.js:152` re-sorts on every registration), produce a
  byte-identical execution order across 200 fresh dispatchers. It holds
  because `Array.prototype.sort` is spec-stable and re-sorting a sorted
  array preserves order — nothing in the codebase asserts that, so the
  seed guarantee rides on an engine property rather than on an invariant
  anyone wrote down. Recorded as a fact, not a finding.
- **Cancel vs the CLAMP band (`c1d`).** A cancel in the ADD band *does*
  break `runEffect` (`hooks.js:158`) before the CLAMP band, leaving
  `ctx.damage` unclamped — but all three damage consumers
  (`combat_defense.js:130`, `combat_stand.js:130`, `resolvers.js:217`)
  zero the value on cancel, so the unclamped number never reaches a stat.
  Latent only for a future call site that reads ctx after a cancel.
- **All 36 status pairs (`c2-pair-*`).** Every ordered pair of the six
  statuses in `STATUS_DEFS` (`virus`, `frozen`, `gravity`, `charge`,
  `mark`, `doom`), both apply orders, then 400 frames of `stepStatuses`:
  no dropped status, no stack over `maxStacks`, no negative stack or
  timer.
- **Status on a corpse (`c2b`).** Virus applied on the exact frame an
  enemy's HP hits 0 does not tick HP negative — `fighter.js`'s
  `applyDamage` floors it. (The *other* half of that interaction, a DoT
  kill skipping the death pipeline, is QA-021 and is unchanged.)
- **Purge immunity (`c2c`).** `statusImmuneFrames` swallows every status
  application in its window, silently, exactly as GDD §18B specifies.
  Recorded so a future "my status didn't apply" report is checked against
  purge before being filed as a bug.
- **Step during Project (`c3c`).** Confirmed impossible, not assumed: 74
  Step attempts across a 900-frame Project, all denied at
  `combat_player.js:66`, zero charges consumed.
- **Feedback damage routing (`c6a`, `c6c`).** A feedback kill
  mid-attack transitions the player to `'dead'` cleanly and sets
  `outcome: 'lose'` exactly once — no lose→win flip, no move left live on
  a dead player. A full crowd fight held under Project kept player HP
  finite and within `[0, maxHp]` for 5400 frames, and `combat.stand` never
  grew an HP field.
- **Resource boundaries (`c5a`, `c5b`, `c5d`).** Momentum gained at
  exactly 100 stays 100; halved at exactly 0 stays 0 (not `-0`); a Rush
  pressed on the exact frame `onMomentumHitTaken` halves the bar never
  spends past 0 across 1496 attempts. `combat_player.js:106`'s inline
  `player.momentum -= cost` is the one resource write that does not route
  through `resources.js`, but the affordability gate at `:92` holds the
  floor — noted, not a defect today.
- **Scarcity's offer floor (`c7b`).** 400 consecutive offers under
  Scarcity rank 2 with the candidate pool progressively starved (every
  offered Fragment marked owned) never produced an empty or zero-choice
  offer; minimum size 1. `run_flow.js:180`'s `Math.max(1, ...)` floors the
  slice length rather than the pool, so it would not save an
  already-empty pool — but the pool never empties.
- **Rule Fight termination under Crowded (`c7e`).** All 8 inflated Rule
  Fights reach a terminal outcome inside 5400 frames. This is what keeps
  QA-036 at S2.
- **Menace profile integrity (`c8c`).** All 14 `MENACE_PROFILE_KEYS`
  resolve finite and correctly typed with every condition at max rank.
- **Telegraph floor vs Menace (`c8b`).** The floor cannot be shrunk out
  from under the validator: Sharpened Instinct is the only condition that
  touches attack timing and it reaches `enemyRecoveryMult` only
  (`resolvers.js:108`), never `windupFrames`. `combat.js:112-125`'s own
  comment claims this by construction; confirmed by measurement.
- **Unlock-aware validation (`c8a`).** There is no unlock-gated content
  path in this build, so an entry that is legal only under a specific
  unlock state cannot exist — the mission's item-8 case is structurally
  unreachable in that direction. The direction it *is* reachable in is
  QA-033.

`npm run validate`, `npm run assert`, `npm run determinism` and
`npm run sweep -- --runs=4000` all pass unchanged (no engine file was
modified this sub-phase).

---

### QA-046 — structural absences — four mechanics the mission's matrix
### names do not exist in this codebase

Recorded explicitly rather than reported as clean, so 13l does not read
"no finding" as "verified".

1. **Bleed and Break are not statuses.** `STATUS_DEFS` (`status.js:35`)
   holds exactly six ids: `virus`, `frozen`, `gravity`, `charge`, `mark`,
   `doom`. There is no `bleed` (damage per distance moved) and no `break`
   anywhere. The mission's "Bleed on a Frozen or Leashed target" and
   "Break consumed by a hit that was cancelled" cases have no subject.
2. **Bomb-Primed and Leashed are affixes, not statuses** (`affixes.js:26`,
   `:52`; `entity.affixData.leashed` is read at `combat_enemy.js:94`).
   "Frozen plus Bomb-Primed death" is therefore a status × affix case, and
   is covered in that form by the `c2-pair-*` sweep plus QA-043.
3. **No Death 13 / sleep mechanic.** No sleep status, no `rf_death13` in
   `rule_fights.js`/`rule_fights_2.js`, no such encounter in
   `data_encounters.js`. "Death 13's sleep cycle overlapping a Rule Fight
   win condition" has no subject.
4. **The Stand has no HP of its own.** `combat_stand.js:114-115` states it
   outright, `combat.stand` carries no `hp` field, and no Aspect adds one
   (`ASPECT_LIST`, `aspects.js:21`) — there is no "Aspect of the Rite"
   equivalent. "Separate Stand HP interacting with feedback rules that
   assume there is none" has no subject. (Phase 13e reached the same
   conclusion about a Requiem-elevation slot mechanic.)

Additionally, two of the mission's item-7 collisions are unconstructable
for a different reason — the conditions exist but do nothing. See QA-037.

**Repro:** `node apps/standbattle/scripts/qa_systems_collision.js
--verbose` prints all four under "STRUCTURAL ABSENCES"
(`--case=c2e`, `--case=c4d`, `--case=c6d`).

---
## Not reproduced

Nothing from Phase 13d's own matrix failed to reproduce — every finding
above replays from its logged seed. Four items are recorded as **untested
rather than clean**, and 13l must not read them as verified:

1. **Three of the mission's four named stuck-state classes are structurally
   unreachable under an idle player, so `0/198` is not evidence of
   correctness.** Wall-press, oscillation and no-commit cannot occur when
   the enemy always spawns right of the player at x = 602, only ever moves
   toward `player.x`, and halts `approachRange` short
   (`combat_enemy.js:91-97`): it can never touch a wall, and its per-frame
   dx sign can never flip without knockback. Exercising those three needs a
   moving/attacking player, which this sub-phase's idle-first matrix
   excludes. (No-commit is additionally masked by QA-019.)
2. **Crowded's `TOKEN_MELEE_COUNT` scaling** (`combat.js:46`, still 2 and
   still commented "not implemented yet") was measured at Crowded rank 3,
   not exercised — there is nothing there to exercise.
3. **Per-arena position mechanics** remain unwired (`phase-13c.md`), and
   `arena_bounds.js`'s bounds are global constants with no per-arena
   override, so "each arena" collapses to one rectangle and "pathing around
   hazards" collapses to the single static damage-zone Phase 13c covered.
   Stated plainly rather than reported as 12 clean per-arena runs.
4. **QA-016's shipped-content reachability** is proven for one route (a
   Killer Queen Aspect's periodic cost) but the hazard and
   status-damage-over-time routes into that same fight were confirmed only
   by directly applying the status, not by reaching it through natural play —
   `rollAffixes` (`affixes.js:124`) returns `[]` for any non-elite enemy
   regardless of Menace rank, so the Toxic-affix route I first assumed does
   **not** exist for `budogaoka_bites_the_dust`'s lone `knife_thug`.

### Phase 13f additions

Nothing from 13f's matrix failed to reproduce — every finding above
replays from `qa_systems_collision.js --case=<id>` at the logged seed and
frame, and 43 of the 74 cases carry a recorded fixture in
`docs/qa/replays/`. Five items are **untested rather than clean**, and
13l must not read them as verified:

5. **Four mission-named mechanics do not exist** (QA-046): Bleed, Break,
   Death 13's sleep, and separate Stand HP. Their cases were not run.
6. **Two mission-named Menace collisions are unconstructable** (QA-037):
   Requiem Denied and Countdown resolve into profile keys no file reads,
   so "Requiem Denied plus a build that requires Requiem" and "Countdown
   plus a Survive objective" have no mechanism to collide with. Not clean
   — there is nothing there yet.
7. **Effect-priority ties are deterministic today by engine property, not
   by contract** (QA-045). `sortByPriority` (`hooks.js:122`) relies on
   `Array.prototype.sort` being stable; 200 trials agree, but nothing in
   the codebase asserts it, so the seed guarantee has no test that would
   fail if a future refactor sorted unstably.
8. **The `c2-pair-*` sweep covers status pairs, not status pairs under
   combat.** All 36 ordered pairs were exercised against `applyStatus`/
   `stepStatuses` directly. Frozen-plus-forced-movement and
   Gravity-plus-a-launcher were not exercised in a fight because
   `frozenSolid` (`status.js:56`) and `gravity` have **no movement
   consumer anywhere** — both are flags content reads, not engine
   lockouts — so there is no movement rule for a launcher to contradict.
9. **`runStatusDeathHooks` (`status.js:224`) has zero call sites**, so
   Virus's documented on-death spread never fires. Its `onDeath` is an
   explicit no-op today (`status.js:47`), so nothing is currently lost —
   but the first status authored with a real `onDeath` will silently do
   nothing. Recorded here rather than as a finding because no shipped
   content is affected.

---

## Phase 13g — the window closes

Scope: `mount`/`unmount` lifecycle, save/load/migration, storage growth,
and the `ctx` boundary, over the standbattle app and the `kernel/wm.js`
window manager that drives it. Method: static read of index.js/save.js/
run_flow.js/audio.js/music.js/telemetry.js/kernel/wm.js, direct repro
scripts against save.js/combat.js in Node, and a Playwright agent driving
the real app in a real browser for the DOM-instrumented cases (listener/
timer counts, localStorage dumps across two windows).

### QA-047 — S1 — fixed — mount/unmount race left the frame loop and
### music engine running forever after a fast window close

**Repro:** `kernel/wm.js`'s `openWindow()` calls `app.mount(made.body,
ctx, args)` without awaiting it; the close button / `ctx.close()` call
`app.unmount()` synchronously. `index.js`'s `mount()` is `async` and
`await`s `saveStore.loadMeta()`/`loadRun()` before touching the DOM/rAF/
audio. Closing the window during those awaits (or via 20+ open-then-
immediately-close cycles in a tight loop) left `this._cleanup` unset, so
`unmount()` no-op'd: the `requestAnimationFrame` loop and `music.js`'s
`setInterval` kept running against a canvas already removed from the DOM.

**Symptom:** orphaned rAF loop + orphaned music `setInterval`, indefinite
(confirmed both via manual trace and the Playwright agent's fast-close
loop before the fix).

**Status:** fixed (`index.js`) — a `this._closed` flag set by `unmount()`
and checked both right after the awaits and right after `_cleanup` is
assigned, so a close that lands before setup finishes tears down
whatever partial state exists instead of leaving it to run forever.
Verified clean over 25 fast cycles post-fix. **Superseded in scope by
QA-050 below** — the flag lives on `this`, and `this` turns out to be a
shared singleton across every window of the app (see QA-050); the fix is
correct for the single-window case it was built for, not for concurrent
windows of the same app.

### QA-048 — S1 — fixed — permanent `document` keydown listener leaked
### on every mount, never removed on unmount

**Repro:** `settings_panel.js`'s `buildRebindPanel()` (called every
`mount()` via `mountAccessibilityBar`) did
`document.addEventListener('keydown', ..., true)` and returned no way to
remove it. Every mount/unmount cycle left one more permanent capturing
listener on `document`, closing over that mount's now-detached panel/
input/meta.

**Symptom:** unbounded `document` listener growth, one per mount, holding
that mount's whole closure alive forever (rebind panel DOM node, `input`,
`meta`, `saveStore`).

**Status:** fixed — `buildRebindPanel` now returns `destroy()`, wired
through `mountAccessibilityBar`'s return value into `index.js`'s
`_cleanup`. Playwright agent confirms 0 net standbattle-owned `document`
listener growth over a 100x clean sequential mount/unmount loop.

### QA-049 — S1 — fixed — an owned Fragment id missing from content
### bricked every future combat entry for the rest of the run

**Repro:** `node -e` against `combat.js`'s `createCombat` directly with
`ownedFragments = [{id: 'frag_does_not_exist', level: 1}]` (any enemy,
any seed — content-shape bug, not seed-dependent). `combat.js:74`
called `installFragment(dispatcher, FRAGMENTS[owned.id], owned.level)`
unguarded; `FRAGMENTS[owned.id]` is `undefined` for an unknown id, and
`content_registry.js:248`'s `(def.effects || [])` throws
`TypeError: Cannot read properties of undefined (reading 'effects')`
before `createCombat` returns. Since `fragmentsBySlot` is read on *every*
combat entry for the whole run (not once), one stale id bricks the run
permanently the moment any node is clicked.

**Status:** fixed — `combat.js:74` now guards like its sibling relic/
duo/disc installs three lines below it already did (`if (def)
installFragment(...)`). Confirmed pre-fix crash and post-fix clean
construction via direct repro script.

### QA-050 — S1 — logged, not fixed — the app object is a module
### singleton shared by every window of the app; per-instance mount state
### (QA-047's fix included) cannot be made correct without a contract change

**Repro (Playwright, two windows):** open standbattle window A, let it
mount fully; open window B, let it mount fully; close A via its titlebar
X. Result: A's rAF loop/ResizeObserver/listeners are never released —
leaked forever — while B's rebind-panel `document` keydown listener is
silently removed instead (confirmed by identity-tagging each closure:
`survivorIsA: true, survivorIsB: false` after closing A).

**Repro (single window, rapid cycling):** 5 back-to-back fast
open+close-X cycles with no settling time between them leave 5
accumulated `raf` handles and 5 orphaned `keydown` listeners once things
settle, because each new `mount()` resets the shared `this._closed =
false`, un-bailing a *previous* already-closed mount's still-pending
awaits, which then builds a full UI into an already-detached DOM node
with no path left to ever tear it down.

**Root cause:** `kernel/registry.js`'s dynamic import is module-cached,
so `kernel/wm.js:223`'s `const app = mod.default` is the *same* object
for every `openWindow('standbattle')` call. CLAUDE.md's app contract —
`mount(root, ctx)` / `unmount()`, no instance handle passed to either —
has no way to express "which window" inside `unmount()`, so QA-047's
`this._closed`/`this._cleanup` (and any per-instance state an app could
put on `this`) is unavoidably shared across concurrent windows of the
same app. `music.js`'s module-level `running`/`bus`/`timerId` (QA-051)
is the same root cause in a different file.

**Why not fixed here:** every fix considered changes the contract, not
just this file's behavior. Tracking multiple `{closed, cleanup}` records
instead of one doesn't help — `unmount()` still receives no argument
identifying which window closed, so there is no correct rule for which
record to tear down (LIFO picks the wrong one in the exact two-window
repro above). A correct fix needs `wm.js` to hand `mount()` (and
`unmount()`) a per-window instance token, which is a change to the app
contract itself — precisely the kind of change the mission brief asks to
stop and write up rather than patch under a hardening pass. Scope for a
future phase: thread an instance identity through `openWindow`/`mount`/
`unmount`, and audit every app for `this.`-scoped mount state the same
grep this phase used on standbattle would catch.

### QA-051 — S2 — logged, not fixed — `music.js`'s module-level audio
### state is shared across concurrent windows of the same app

**Repro:** open two standbattle windows; `musicStart()` on the second
no-ops because `running` is already `true` from the first (module-level,
not per-instance) — the second window's `musicSetIntensity` calls become
no-ops against a bus it doesn't own. Close either window: `unmount()` ->
`musicStop()` unconditionally kills the shared `bus`/`timerId` for
*both* windows — the surviving window goes silent.

**Status:** not fixed — same root cause as QA-050 (no per-instance
identity available to `mount`/`unmount`); a real fix means giving the
music engine per-instance state, which needs the same contract change.
Folded into QA-050's writeup rather than treated as independent, since a
standalone fix here would just be a different flavor of the same
un-addressable sharing bug.

### QA-052 — S1 — logged, not fixed — concurrent windows can silently
### revert each other's meta/Archive writes

**Repro (Playwright, two windows + localStorage dump):** open window A,
toggle SHAKE (writes `meta` with `shakeEnabled:false`). Open window B
*before* A's toggle if testing the worse case, or independently — B
loaded its own `meta` snapshot at its own mount time. B toggles
PARTICLES and saves. Dumping `localStorage['app_standbattle_meta']`
before/after: A's `shakeEnabled:false` is reverted back to `true` by B's
save, because `save.js:128`'s `saveMeta(data)` always writes B's entire
stale in-memory snapshot, not just the field B actually changed. The
same mechanism reverts Archive purchases, Fate totals, Bond progress, or
Mission completions made in one window if any other open window saves
afterward with an older in-memory copy of those fields.

**Status:** not fixed. The mission brief's "last-write-wins is
acceptable, silent Archive loss is not" describes exactly this failure
mode as the one that must not happen. A shallow merge against the
on-disk copy at save time does **not** fix it — every top-level key
exists in both the disk copy and the saving window's snapshot, so a
merge still picks the (possibly stale) value from whichever window saves
last for every field, not just the one it meant to change. A correct fix
needs either per-field dirty-tracking (know which keys a given
`saveMeta` call actually intends to change vs. carries along stale) or a
transactional/patch-based save API replacing "load whole blob, mutate in
place, save whole blob" everywhere meta is touched — both are a design
change to `save.js`'s contract with its ~15+ call sites across the app,
not a one-file hardening patch. Flagged for a future phase; until then,
players who keep two windows of this app open risk silently losing
Archive/Fate/Mission/Bond progress with no error shown.

### QA-053 — S1 — fixed — `migrate()` trusted a future-version save's
### shape instead of falling back

**Repro:** `save.js`'s `migrate(entry, migrations, targetVersion,
fallback)` only walked forward `while (version < targetVersion)`; a save
whose `version` is *greater* than the target (a save from a newer build,
or a tampered/corrupted version field — e.g. `{version: 99, data:
{seed: 'future'}}`) skipped the loop entirely and returned `data`
verbatim instead of falling back, unlike every other unmigratable-version
case (`if (!step) return fallback`). Confirmed via a direct `node -e`
harness against `createSaveStore` with an in-memory fake `ctx`: pre-fix,
a v99 run save loaded as-is; post-fix, it falls back to `null` (fresh
run) exactly like a v2 run save already correctly does.

**Status:** fixed — `migrate()` now checks `version > targetVersion` and
falls back immediately, before the walk. `meta`'s independent migration
table gets the same guard for free (shared `migrate()`). Re-verified: a
current-version (`v3`) save still loads unchanged.

### QA-054 — S1 — fixed — unknown Fragment id crashed the map's
### per-frame render loop indefinitely (distinct from QA-049)

**Repro (Playwright agent, unit-level):** build a real run via
`run_flow.js`, set `fragmentsBySlot[SLOTS[0]] = {id: 'FAKE_ID', level:
1}`, call `drawBuildSummary` (`rewards.js:118`, invoked every frame from
`map.js:197` while on the map scene) -> `TypeError: Cannot read
properties of undefined (reading 'name')` at the old `rewards.js:123`.
Unlike QA-049 (which bricks the *next combat entry*), this crashes the
*current* frame's render call every single frame once a tampered/
corrupted save with a bad fragment id reaches the map screen — a frozen
screen, forever, with no combat needed to trigger it. A second unguarded
site at the old `rewards.js:88` (`FRAGMENTS[owned.id].name` in the
reward-card "OVERWRITES" label) has the same shape.

**Status:** fixed — both sites now guard on `FRAGMENTS[id]` existing
(`rewards.js`), matching the pattern already used at `run_end.js:50`,
`mission_tracker.js:67`, and (post-QA-049) `combat.js:74`.

### QA-055 — S2 — fixed — resume guard checked `graph.nodes` but not
### `graph.edges`/`graph.paths`, which `drawMap` also reads unconditionally

**Repro:** a run save with a structurally incomplete `graph` (real
`nodes`, missing `edges`/`paths` — e.g. truncated by a storage failure
mid-write) passed `index.js`'s old resume guard
(`savedRun.graph.nodes[savedRun.nodeId]`) and then crashed
`map.js:143`'s `graph.edges.filter(...)` on the first resumed frame,
every frame, same failure mode as QA-054.

**Status:** fixed — `index.js`'s resume guard now also requires
`Array.isArray(savedRun.graph.edges)` and `Array.isArray(savedRun.graph.paths)`
before resuming; anything short of that falls through to a fresh run,
same as an unparseable save already did.

### QA-056 — S2 — fixed — every window leaked two permanent `document`
### listeners on close (kernel-level, not standbattle-specific)

**Repro (Playwright, 100x clean mount/unmount loop):** `document`
listener count grew by exactly 201 (≈2×100+1) over 100 clean standbattle
open/close cycles even with QA-047/048 fixed, because the leak is in
`kernel/wm.js`'s `createWindow()` (used by every window: apps, sysDialog,
askName), not in the app. `createWindow()` adds
`document.addEventListener('mousemove'/'mouseup', ...)` for window drag/
resize and never removes either on `closeWin()`.

**Status:** fixed — both handlers named and removed in `closeWin()`.
This affects every window the shell creates, not just standbattle;
flagging here since it's exactly the class of bug this phase's
instrumentation was built to catch, and standbattle's own
mount/unmount-loop assertion (QA-048's verification) would otherwise
never reach a true zero baseline regardless of app-level correctness.

### QA-057 — S3 — fixed — `ctx.close()` unmounted the app twice

**Repro:** `kernel/wm.js`'s `openWindow()` built `ctx.close` to call
`app.unmount()` then `made.close()` — but `made.close` was reassigned
three lines later to a version that *also* calls `app.unmount()` before
`oldClose()`. Since `ctx.close`'s closure reads `made.close` at call
time (after the reassignment), calling `ctx.close()` unmounted the app
twice. Harmless today only because standbattle's `unmount()` is
idempotent by accident (`_cleanup` nulled after first call), not by any
contract guarantee — nothing stops a future app's `unmount()` from
double-freeing a resource.

**Status:** fixed — `ctx.close` now just calls `made.close()`, which
already does both unmount and the actual window teardown.

### QA-058 — S2 — logged, not fixed — telemetry has no cap or rotation

**Repro:** grepped all of `apps/standbattle/` for `MAX_`/`rotat`/`trim`/
`slice` near telemetry code — none. `telemetry.js`'s `appendRunSummary`
does a full read + string-concat + full rewrite of
`standbattle/telemetry.jsonl` on every run end; cost and storage grow
linearly, unbounded, with total lifetime run count. `kernel/vfs.js`'s
`fs.write` has no quota handling of its own either.

**Status:** not fixed — deciding a retention policy (cap by line count?
by age? rotate to a second file?) is a product decision, not a hardening
patch. The one part of this that *was* a plain defensive gap — a
quota-exceeded `ctx.fs.write` rejecting into `run_flow_combat_end.js`'s
unawaited call site as an unhandled promise rejection — is fixed
(`telemetry.js` now catches the write). The unbounded-growth question
itself is unresolved and belongs in front of whoever owns storage
budget for this shell.

### QA-059 — none found — corruption handling for the `run` key is
### solid as designed

Truncated/malformed JSON, `{"version":3,"data":{}}` (valid JSON, current
version, missing fields), and `{"version":99,...}` (pre-QA-053) all fail
closed correctly through `save.js`'s per-blob try/catch: zero console
errors beyond the caught one, the `meta` blob untouched in every case,
the game falling back to hub/fresh-run. `loadRun`/`loadMeta`'s
independent-try/catch design (Phase 0) works exactly as documented.

**Repro:** Playwright agent, direct `localStorage` manipulation of
`app_standbattle_run` before reload, all four payloads above.



### QA-060 — S1 — fixed — Rest node could reach zero enabled choices
### with no exit at all

**Repro (Node, unit-level, deterministic):**
```
node -e "import('./apps/standbattle/rest.js').then(({restChoices}) => {
  const runState = { hp: 100, maxHp: 100, tension: 5, upgradePoints: 0, fragmentsBySlot: {} };
  console.log(restChoices(runState));
});"
```
prints all three choices with `enabled: false` (REST needs `hp < maxHp`;
UPGRADE needs `upgradePoints > 0` and an eligible non-maxed slot; RAISE
TENSION needs `tension < 5`) — a full-HP run that has spent its upgrade
points/maxed its Fragments and already sits at Tension 5 (both entirely
reachable states) hits all three at once. `rest.js` (pre-fix) drew only
those three buttons and nothing else; `pickRestChoice` only ever returns
an index for `choices[i].enabled`, so `applyRestChoice` could never fire.
`rest`/`'rest'` is not in `hub_flow.js`'s `HUB_SCENES`, so `hubKey`'s
one-key Escape (index.js:236) never runs for this scene either — no
click landed anywhere on screen, no key did anything. Unlike Shop
(`shop.js`'s `leaveRect`/LEAVE) and Archive (`archive_stub.js`'s
CONTINUE), Rest had no always-on exit button at all.

**Status:** fixed — `rest.js` now draws an always-enabled LEAVE button
(`leaveRect`, mirroring `shop.js`'s pattern) and exports
`pickRestLeave`; `index.js`'s `'rest'` click branch checks it after
`pickRestChoice` comes back -1 and calls `commitNode(state, env)`
directly, the same "nothing happened, move on" path RAISE TENSION/REST/
UPGRADE already end at. Re-verified the same degenerate `runState`
against the new `pickRestLeave` — always hit-testable regardless of
`choices`.

### QA-061 — S1 — fixed — an empty Fragment/Treasure reward offer
### routed to the 'reward' scene with zero cards and no exit

**Repro (Node, unit-level):** `fragment_offers.js`'s own header
documents the failure mode directly: "Returns an array of up to 3
candidates; fewer only in the late-run edge case where the whole pool is
already owned-and-maxed" — that "fewer" can be zero once every Fragment
slot a run's allowed donors can offer is owned at max level and every
Duo candidate is also owned. `item_offers.js`'s `generateTreasureOffer`
has the identical shape: its own fallback comment only guarantees
"whichever pool has unowned entries left", not that either pool is
nonempty, so a run that has collected every Relic *and* every Disc gets
`[]` from both `relicOffer()` and `discOffer()`. Pre-fix, `run_flow.js`'s
`enterReward`/`enterTreasureReward` set `state.currentOffer = []` and
`state.scene = 'reward'` unconditionally. `rewards.js`'s `drawReward`
does `offer.forEach(...)` (zero cards drawn) and `pickRewardChoice`
loops `for (i < offer.length)` (never returns an index for an empty
array) — a blank reward screen with no click target and no key.

**Status:** fixed — both `enterReward` and `enterTreasureReward` in
`run_flow.js` now check `!offer.length` and call `commitNode(state,
env)` directly instead of switching to the `'reward'` scene, exactly as
if the node had nothing to give (which, at that point, it doesn't).

### QA-062 — S2 — logged, not fixed — held-key state has no
### blur/context-clear path

**Repro (Node, unit-level, deterministic):**
```
node -e "import('./apps/standbattle/input.js').then(({createInputSystem}) => {
  const input = createInputSystem({}, false);
  console.log(input.resolveKey('KeyA', true));   // { action:'left', kind:'held', down:true }
  console.log(Object.keys(input));                // no releaseAll/clearHeld/reset method
});"
```
`input.js`'s `heldState` is only ever written by `resolveKey` itself,
and the returned object has no method to force every held action back
to false. `index.js` has no `blur`/`visibilitychange` listener anywhere
in the file (confirmed by a full `grep -rn "blur\|visibilitychange"`
across `apps/standbattle/` and `kernel/`) that could call such a method
even if one existed. A player holding a movement/guard/project key who
alt-tabs away, releases the physical key in another window, and returns
leaves that action's `heldState` (and `combat`'s own mirrored key state,
since `index.js:244` forwards every down/up straight to
`combat.setKey`) stuck `true` until the *same* key is pressed and
released again with the canvas focused — invisible movement/guard/
Project until then, but always self-correcting on the next tap of that
key, and never blocking any menu, click, or scene exit.

**Status:** not fixed (deferred to 13l per this phase's severity
policy). A correct fix is a `document`-level `blur`/`visibilitychange`
handler in `index.js` that calls a new `input.releaseAll()` (and clears
`combat`'s own held keys the same way `setKey` would on a real keyup)
whenever the window loses focus — small, but a new capability on
`input.js`'s public surface, which this phase's fix budget is S1-only.

### QA-063 — S2 — logged, not fixed — REBIND KEYS lets an action
### (including FLEE) end up with zero bound keys, unwarned

**Repro:** `settings_panel.js`'s `buildRebindPanel`'s `onKeydown`
(`input.rebind(ev.code, waiting)`) unconditionally overwrites
`keymap[code] = waiting` with no check for whether `code` was the only
key still bound to some *other* action. Rebinding Escape's default
binding (the only default key mapped to `flee`) to any other action
(e.g. `light`) leaves `flee` with zero codes in `keymap` — confirmed by
reading `codesFor(action)` (`settings_panel.js:51-53`), which is exactly
`Object.entries(input.keymap).filter(([, a]) => a === action)`, i.e.
legitimately empty after such a rebind. `combat.js:209`'s only path to
`combat.outcome = 'fled'` is `code === 'flee'`, so a player who does this
loses the no-cost early-exit GDD §4.7/§15 gives Stalker/Survive
encounters — they can still win or lose those fights normally (`flee`
was never required to end a fight, only to end it early for free), so
this is not a screen-trap, just a lost affordance with no UI feedback
that it happened.

**Status:** not fixed (deferred to 13l). The correct fix — warn on
"this key was the last one bound to X" or refuse to leave an action
fully unbound — is a UI-policy decision for the rebind panel, not a
one-line hardening patch, and is explicitly out of this phase's S1-only
fix budget.

### QA-064 — S3 — logged, not fixed — several un-wrapped content
### strings overflow their panel's pixel budget

**Repro:** `node apps/standbattle/scripts/qa_string_overflow.js` (new
script this phase, re-runnable, no DOM/canvas required — computes
`font_data.js`'s fixed 5px-glyph width the same way `font.js`'s own
`textWidth` does and checks every un-wrapped `text()` call site's
content string against the pixel width it is actually drawn into). 21
overflows found across 682 checked strings: several Archive node names
in `hub_panels.js`'s row list (e.g. `"DONOR: HIGHWAY STAR"`, 113px vs.
~104px budget), four Menace condition descriptions drawn right-aligned
on the same row as their (already long) name+pips label
(`hub_panels.js:169-180`), one Relic name and several
Boss/Encounter labels in the Training Room's row list
(`training.js:70/74/75`, worst case `"DIRTY DEEDS DONE DIRT CHEAP --
REINFORCED"` at 245px vs. a 158px budget). All of these are un-wrapped
`text()` calls in `hub_ui.js`'s `rowList` (label drawn at `x+6` with no
clip) or a same-row right-aligned sibling — worst case is visual overlap
or a label running under/into the scrollbar, never a lost click target
(every row's hit-rect in `rowList` is still the full row width returned
by the same function that drew it, independent of label overflow) and
never a blocked exit.

**Status:** not fixed (deferred to 13l — either widening these specific
panels or truncating/wrapping `rowList` labels is a UI layout change,
out of this phase's S1-only fix budget). Re-run command above to verify
after any future content addition; the budgets used are documented
per-check in the script's comments and are conservative (they reserve
generous space for each row's right-aligned sibling).

### QA-065 — none found — the classic rebindable-cancel-onto-confirm
### softlock class does not exist in this codebase

**Repro:** read every scene's exit path in `index.js`/`hub_flow.js`/
`map.js`/`shop.js`/`rest.js`/`archive_stub.js`/`scene_continued.js`.
`input.js`'s `ACTIONS` (the only rebindable set, via
`settings_panel.js:11`) is entirely combat verbs — `left/right/forward/
back/light/medium/heavy/dodge/parry/special/rush/guard/project/command/
flee` — none of them a menu confirm/cancel pair. Every non-combat
scene's exit (hub back-out `Escape`, hub scroll `ArrowUp`/`ArrowDown`,
Training's `Enter`) is read via `hubKey(state, env, ev.code)` off the
**raw** `ev.code`, bypassing `input.resolveKey`/`keymap` entirely
(`index.js:236-238`) — rebinding cannot touch any of them. The one
rebindable action that doubles as a scene-exit, `flee`
(`combat.js:209`), is optional (QA-063) rather than the only way out of
a fight, so unbinding it can't trap a run either. No two menu actions
share a rebindable key in this game at all, because menus have no
rebindable keys.

### QA-066 — none found — catch-up-spiral guard and hub-spawn-to-
### run-start latency both verified healthy against current content

**Repro:** `sim_loop.js:16`'s `MAX_FRAMES_PER_ADVANCE = 8` already caps
`createFixedStepLoop.advance()` at 8 stepped frames per call and resets
the accumulator to 0 past that cap (`sim_loop.js:37`) — a long tab-
switch pause cannot replay a backlog of frames in one burst.
`index.js`'s own outer loop (`frame()`, not sim_loop.js — this is the
render-tick -> `combat.update(dt)` boundary) independently clamps
`dt = Math.min(50, now - t0)` per `requestAnimationFrame` tick
(`index.js:255`) before it ever reaches `combat.update`, so even a
multi-second real-time gap between rAF callbacks (backgrounded tab,
debugger break) is presented to the sim as at most 50ms — both guards
were already correct pre-13h, no regression, nothing to fix. Separately,
timed `newRun`'s actual core path (`launchLoadout` + `createFreshRunState`,
the same call `index.js:154`'s `newRun` makes) end-to-end:
```
node -e "import('./apps/standbattle/hub_flow.js').then(async ({createHubState, launchLoadout}) => {
  const { createFreshRunState } = await import('./apps/standbattle/run_flow.js');
  const { createRng } = await import('./apps/standbattle/rng.js');
  const { ensureMetaProgress } = await import('./apps/standbattle/save.js');
  const meta = ensureMetaProgress({});
  const hub = createHubState(meta);
  const t0 = process.hrtime.bigint();
  const loadout = launchLoadout(meta, hub.unlocks);
  const rs = createFreshRunState(Date.now()+'-x', createRng('x'), loadout.standId, loadout);
  console.log('ms:', Number(process.hrtime.bigint()-t0)/1e6, 'nodes:', Object.keys(rs.graph.nodes).length);
});"
```
consistently prints ~3ms for a full Act I map generation (14 nodes) at
current (Phase 10) content volume — GDD §20's "under 8 seconds" rule is
about click count (title -> hub -> LAUNCH is two clicks, `launch()`
does everything synchronously per `index.js:162`'s own comment), and
compute cost is nowhere near a bottleneck.

## Phase 13i — how it looks and sounds

Scope: the pixel/render pipeline, juice/effect stacking, particle caps,
per-character palette distinctness, telegraph legibility, and the audio
graph (SFX/music buses, vocal barks, intensity transitions). Method:
grep-assertion of the pixel rules across every render file; two real
headless stress runs (12-enemy simultaneous crowd death, 120s continuous
combo) via `createCombat`/`createFx`/`createJuice` directly; a
synthetic Playwright harness importing `combat.js`/`render.js` to freeze
and capture every telegraph and every character/enemy/boss sprite; and a
static extraction of every palette ramp/tint in `palette.js`/
`cga_palette.js`/`data_enemies.js`/`data_bosses.js`.

### QA-067 — none found — pixel rasterizer/CSS/shake invariants all hold

**Repro:** grep across `apps/standbattle/*.js` for `.fill(`, `.stroke(`,
`ctx.rotate`, `.arc(`, `.bezierCurveTo`, `.quadraticCurveTo` — the only
hits are two comments in `draw.js:4,56` explaining *why* the rasterizer
avoids them, no live call. `imageSmoothingEnabled = false` is set on all
three canvas contexts that exist (`index.js:111`, `layer.js:27,47`).
`draw.js`'s base `px()` primitive (`draw.js:14-17`) and every other
primitive (`draw.js:33-213`) round every coordinate/dimension with
`Math.round`/`Math.floor`/`Math.ceil` before any `fillRect` call — no
sub-pixel geometry reaches the canvas anywhere. `.gamecv` (shared with
every app, `kernel/theme.css:740-746`) sets `image-rendering: pixelated`
on the canvas element; `index.js:117-119`'s scale is
`Math.max(1, Math.floor(...))`, always an integer. `juice.js:60-61`
rounds `shakeX`/`shakeY` with `Math.round` before they're used as a
`g.translate` in `render.js:193`.

**Status:** no regression across twelve phases of additions; nothing to
fix.

### QA-068 — none found — screen-wide fx stay `solo` under a 12-enemy
### simultaneous chain-detonation

**Repro:** `node` harness building a 12-enemy crowd via `createCombat`
and landing `sp_ora_rush` on all of them stacked in one hitbox, seed
`qa-fx-stack-001`, frame 9 — 12 simultaneous `onKill` dispatches, each
queuing its own `flash`+`burstBg`. Static check: the only two files that
ever call `fx.spawn` are `arena.js`/`fx_wire.js`; every screen-filling
type (`'flash'`: 5 call sites, `'burstBg'`: 4 call sites, all on
onParrySuccess/onKill/onPhaseTransition/onPurge/onPartExposed) passes a
`solo` key (`'flash'`/`'burst'` respectively) consistently. Content
(Fragments/affixes/Relics) never calls `fx.spawn` directly, only
`effect_lib.js` verbs, so no loadout can add an unscoped screen-wide
spawn.

**Symptom (none):** observed max simultaneous `flash` entries in
`fx.list` = 1, max `burstBg` = 1, at frame 9 of the seed above — the
`solo` eviction (`fx.js:36-48`) collapses the 12-way simultaneous spawn
correctly.

**Status:** confirmed healthy, no regression.

### QA-069 — none found — particle hard cap clips correctly under
### worst-case simultaneous crowd death

**Repro:** same seed `qa-fx-stack-001`, frame 9 — each of the 12 deaths
calls `combat.juice.spawnBurst(..., 18, ...)` (`combat_player.js:166`),
216 particles requested in one frame. `juice.js` has exactly one
`particles.push` site (`spawnBurst`, `juice.js:41`), unconditionally
guarded by `this.particles.length < PARTICLE_CAP` in the spawn loop
(`juice.js:38`) — no other code path appends.

**Symptom (none):** `juice.particles.length` peaked at exactly
`PARTICLE_CAP` (140), never higher, at frame 9.

**Status:** confirmed healthy, no regression.

### QA-070 — none found — music intensity/boss-phase transitions never
### click or double-trigger

**Repro:** read of `music.js`'s `musicSetIntensity`/`scheduleStep`.
`musicSetIntensity(level)` is a bare variable read only by
`scheduleStep()` at the next 1/16-step boundary — it never touches an
in-flight oscillator, so there is no "layer" object to double-trigger.
Every tonal note (`noteOsc`) and `kick()` ramp via
`exponentialRampToValueAtTime`; `hat()`'s one hard `gain.value=` is a
legitimate percussive noise-burst whose buffer itself tapers to 0, not a
bug. The only other non-ramped assignment is `bus.gain.value = 0` at
`musicStart()` (silence before anything plays). Boss-phase/combat/
tension transitions (driven every frame from `index.js:266`) are
idempotent reassignments of the same read-only level.

**Status:** confirmed healthy across every transition point, no
regression.

### QA-071 — S2 — logged, not fixed — SFX gain knob doesn't apply live
### after the audio context first wakes

**Repro:** turn the SFX knob after the first click anywhere in the OS
(which calls `Snd.wake()`).

**Symptom:** `kernel/snd.js:13-16` sets `Snd.sfx.gain.value = sfxGain()`
exactly once, inside `wake()`, guarded by `if (!this.sfx)` — the only
write site in the repo. `wirePot('pot-sfx', ...)` (`kernel/hardware.js:
276`) only does `CRT.sfx = v; saveCRT()`, nothing calls back into
`snd.js` to update the live gain node. Every `tone()`/`noise()` call
only checks `Vol.sfx <= 0` as an on/off gate, so playback volume stays
frozen at whatever `CRT.sfx` was at the moment of the first wake — only
crossing zero mutes/unmutes, turning the knob has no other audible
effect. Affects every app's SFX, not just Stand Battle Arena's, since
`snd.js`/`hardware.js` are shared kernel infrastructure.

**Status:** not fixed — `kernel/` is outside this app's boundary and
outside this phase's fix budget; batched to 13l. Suggested fix for the
maintainer: `wirePot`'s SFX callback should call a new
`Snd.setSfxGain(v)` doing `this.sfx.gain.setTargetAtTime(sfxGain(), ...)`
(mirroring how `music.js` polls MUS every 40ms), or poll the same way.

### QA-072 — S2 — logged, not fixed — vocal "ORA" bark fires on every
### hit for the rest of an encounter past combo 9, no frequency cap

**Repro:** 120s of continuous light-attack mashing against a durable
target, seed `qa-bark-rate-001` — 188 hits landed, 180 "ORA ORA ORA"
barks spawned (exactly `hits - 8`).

**Symptom:** `combat_player.js:163`'s `player.comboCount++` increments on
every landed hit and is never reset anywhere in the codebase (zero
`comboCount = 0` sites outside fighter creation, confirmed by repo-wide
grep) — it's a monotonic per-encounter hit counter, not a consecutive
combo. `fx_wire.js:35`'s bark trigger,
`if (ev.combo === 3 || ev.combo === 6 || ev.combo >= 9)`, means once 9
hits have landed, every subsequent hit for the rest of the encounter
re-fires the bark — ≈1.5 barks/sec sustained, thousands of re-triggers
over a 35-minute run. The display itself is `solo`-scoped
(`fx_wire.js:37`, `solo: 'bark'`) so only one bark ever renders at once,
but that's not a rate limiter — no audio vocal-bark path exists
separately from this text-bark system (confirmed: `audio.js` has no
spoken/bark synthesis, only tone/noise SFX). GDD §12 calls for
"frequency-capped so it doesn't become grating over a 25-40 min run."

**Status:** not fixed — the correct repair (should `comboCount`
decay/reset on whiff/idle matching the `===3`/`===6` tier pattern's
evident intent, or should `>=9` become a one-shot `===9`?) is a design
decision about combo semantics that also feeds `hud.js`/`pose_player.js`
energy/aura reads, not a same-behavior patch; batched to 13l.

### QA-073 — S2 — logged, not fixed — 7 of 8 playable Stands render
### pixel-identical to Star Platinum once manifested

**Repro:** contact sheet, every playable Stand, every background,
native + upscaled (`apps/standbattle/scripts/_qa_character_sheet.html`,
untracked).

**Symptom:** `render.js`'s `drawStand` always calls `drawStar` (Star
Platinum's exact geometry + `STAR` ramp) for every Stand, with a
manifest-fade tint `alpha = 0.18 * (1 - manifest)` that hits 0 once
fully materialized. Silver Chariot, Hierophant Green, Crazy Diamond,
Gold Experience, Sticky Fingers, Hermit Purple, and playable Killer
Queen are all the identical purple/teal Star Platinum silhouette for the
majority of every fight; `moves_silver_chariot.js`/
`moves_hierophant_green.js` contain zero color values, confirming no
sprite art exists for these Stands. Spec §11's own example ("Hierophant
Green's green/purple") is unmet. The brief materialize-tint hues
(Crazy Diamond `#B7A0FF`, Hermit Purple `#A64FD0`) also sit close to
Star Platinum's own rim/light steps (`#AC85E8`/`#8355C6`, redmean
distance 37.1/36.9) even during that narrow window.

**Status:** not fixed — this is missing sprite art, a content/art task
outside a behavior-preserving hardening patch; batched to 13l.

### QA-074 — S2 — logged, not fixed — 9 of 10 bosses and several
### crowd-enemy tint groups render indistinguishably from each other

**Repro:** contact sheet + palette table
(`_qa_character_sheet.html`/`_qa_palette_report.html`, both untracked).

**Symptom:** `render.js`'s `ENEMY_ART = { morioh_thug: drawThug,
angelo: drawAngelo }` — every other boss id (Fungami, Hol Horse, N'Doul,
DIO, Formaggio, Illuso, Diavolo, Funny Valentine, Pucci) falls through to
`drawThug` with no `tint` field in `data_bosses.js` (zero matches on
grep), rendering as the exact same brown-jacketed Delinquent as each
other and as the basic crowd enemy. Killer Queen is the only boss with
bespoke art (`drawKillerQueen`). Separately, among the 14 tinted crowd
types in `data_enemies.js`, five groups share an identical `PAL` tint
composited over the identical `THUG_BUILD` silhouette, truly
indistinguishable rather than just close: `warden`/`shielder`
(`PAL.blue`), `knife_thug`/`sniper` (`PAL.lcyan`),
`hound`/`bomber`/`illuso_mirror` (`PAL.lmagenta`),
`puppeteer`/`puppet_minion`/`leech` (`PAL.green`),
`duelist`/`valentine_parallel` (`PAL.lred`) — several are gameplay
opposites (tank vs. flanker vs. ranged) that can appear in the same
crowd per their role tags, with only the HUD's small `shortName` label
to tell them apart mid-fight.

**Status:** not fixed — missing boss art plus a tint-reassignment pass
across enemy data is a content change, not a same-behavior patch;
batched to 13l.

### QA-075 — S2 — logged, not fixed — `bomb_plant`'s telegraph glyph is
### `ring` instead of `crosshair` despite being a ranged pattern

**Repro:** telegraph contact sheet
(`apps/standbattle/scripts/_qa_telegraph_sheet.html`, untracked),
Bomber's `bomb_plant` cell.

**Symptom:** `ai.js:100`'s own convention comment states "ring = sweep,
chevron = slam, crosshair = ranged." Every other pattern with `ranged`
semantics uses `glyph: 'crosshair'` (15 sites in `ai.js`, e.g.
`ai.js:55,83,89,103,129,135,149`). `bomb_plant` (`ai.js:94-96`) is
placed like every other ranged/AoE-placement pattern but is authored
with `glyph: 'ring'` — a colour-blind or fast-reacting player reads it as
a light melee sweep instead of an incoming ranged placement.

**Status:** not fixed — one-line data change
(`ai.js:96` `glyph: 'ring'` -> `'crosshair'`), trivial and low-risk, but
S2 findings are logged and batched to 13l per this phase's fix budget,
not fixed on discovery.

### QA-076 — S3 — logged, not fixed — three non-hazard ranged
### telegraphs (`projectile`/`sniper_shot`/`emperor_curveshot`) flood
### the ground like a full hazard zone

**Repro:** telegraph contact sheet (`_qa_telegraph_sheet.html`), those
three cells.

**Symptom:** `arena.js:138`'s `telegraphOne` sizes the ground
ellipse+ring directly off `ai.pattern.range` (`arena.js:142,144`) for
every pattern, with no check for `pattern.hazard` — patterns that place
a lingering hazard zone (`zone_denial`, `bomb_plant`) are meant to read
that way, but `projectile`/`sniper_shot`/`emperor_curveshot` are single
traveling shots with no `hazard` field and a large `range` (400/420/
420px), so their ground ellipse covers nearly the entire visible arena
floor, reading as "the whole floor is dangerous" rather than "a shot is
incoming."

**Status:** not fixed — batched to 13l alongside QA-075 (same file,
same telegraph-authoring pass).

### QA-077 — S3 — logged, not fixed — Pucci's `made_in_heaven_
### acceleration` telegraph reuses plain UI white

**Repro:** telegraph contact sheet (`_qa_telegraph_sheet.html`), Pucci's
cell.

**Symptom:** `ai.js:162`'s telegraph color is `#FFFFFF`, the same hue
already used for ordinary UI/hit-flash text elsewhere, not a reserved
attack-specific colour. Reads fine against the dark alley background
captured in the sheet; not yet checked against the brighter
`store`/`park` scenes.

**Status:** not fixed, batched to 13l.

### QA-078 — S3 — logged, not fixed — Thug's and Angelo's jacket
### palettes are too close for a crowd that can contain both

**Repro:** palette report (`_qa_palette_report.html`, untracked),
redmean distance computation.

**Symptom:** Delinquent/Thug jacket base `#472C16` vs. Angelo (Elite)
coat base `#45452F` — redmean distance 64.9, both dark muted brown/
olive, and `sprite_enemy.js`'s own header comment confirms these two
co-appear as Morioh's "rank and file." Distinguishable mainly by
silhouette (stocky+pompadour vs. gaunt+hunched), not colour, at native
resolution in a fast crowd fight.

**Status:** not fixed, tagged for the same content/tint pass as QA-074;
batched to 13l. Other borderline pairs checked (Jotaro coat vs. Star
Platinum body, Sticky Fingers tint vs. Star Platinum teal, Thug vs.
Killer Queen black) are tagged BALANCE — same hue family but adequately
separated in lightness/saturation, or low practical co-occurrence.

**Tools:** two throwaway Node repro scripts (`qa_fx_stack.mjs`,
`qa_bark_rate.mjs`) and a throwaway Playwright contact-sheet harness,
all deleted after use per this phase's context-discipline rule — nothing
left in `apps/standbattle/` except the two untracked `_qa_*.html`
review artifacts and the palette report, none committed.
`npm run validate`/`npm run assert` stayed green throughout; no code was
modified this phase (every real finding needs either a design decision
or a content pass, both out of the S1-only fix budget — see each
entry's Status).

## Phase 13i (owner review round) — QA-079 onward

The owner reviewed the contact sheets and the running build and filed the
findings below. Everything here is logged verbatim as reported, then
verified against the code before being written up; where the owner's
report and the measurement disagree, the measurement is stated. Fixes
this round were limited to the app shell and the telegraph geometry —
the art/rig overhaul (QA-085/086/087) is a phase of its own, not a
hardening patch.

### QA-079 — S2 — fixed — the game rendered at 2x in a window sized to
### floor the integer scaler at 2x

**Repro:** open STANDBATTLE.EXE at the default window size and measure
the canvas: `index.js`'s scaler is
`Math.max(1, Math.floor(Math.min(availW / W, availH / H)))` over a
480x270 internal canvas.

**Symptom:** at the old `width: 1000, height: 620`, usable pane space is
996x564 after the 2px window border, the 22px titlebar and the ~30px
appbar — against the 1440x810 needed for 3x, so the floor landed on 2x
(960x540) with 36x24px to spare. The owner's "the game is way too
small" is exactly this: the window was 24 vertical pixels short of
tripling.

**Status:** fixed. `index.js`'s default window is now 1480x920 (1476x864
usable → 3x with 36x54px of slack, so a taller button strip can't
silently drop it back to 2x). `createWindow` still clamps to the
desktop, so a small screen falls back to 2x rather than overflowing.

### QA-080 — S2 — fixed — no way to make the window bigger than its
### default from inside the machine

**Repro:** no maximize affordance existed anywhere — `wm.js`'s titlebar
has `[_]` (minimize) and `[X]` (close) only, and the `ctx` API handed to
apps had no window-bounds capability at all, so an app could not resize
its own window without reaching into kernel DOM (which the app contract
forbids).

**Status:** fixed, as a generic capability rather than an app hack.
`wm.js`'s `createWindow` gained `maximize`/`restore`/`toggleMaximize`
(saving the pre-maximize bounds verbatim so restore is exact), exposed
through `ctx.toggleMaximize()`/`ctx.isMaximized()` — available to every
app, not just this one. `standbattle`'s appbar gained a FULL/WINDOW
button that calls it; the scaler recomputes off the new pane size, so
filling the desktop buys another integer step.

### QA-081 — S2 — fixed — no pause menu; a fight had no stop, and
### quitting one meant closing the window

**Repro:** during combat, press every key. `input.js`'s `ACTIONS` are
all combat verbs; `Escape` is only consumed by hub scenes
(`index.js`'s `hubKey` path, raw `ev.code`). In combat nothing consumed
it, so there was no pause, no way to review controls mid-fight, and no
exit but win/lose/`flee` — and QA-063 showed `flee` can be rebound to
nothing.

**Status:** fixed. New `pause.js` (`createPause`) owns the open state,
the selection, and every input path into it; `Escape` opens it on any
non-hub, non-title scene, checked ahead of the input map so a rebound or
unbound keymap can never take the stop menu away. The sim does not step
while it is open (`index.js`'s `if (!pause.isOpen()) c.update(dt)`), so
the frozen frame underneath is the pause. Deliberately **not** an escape
hatch: ABANDON RUN settles through the same `finishRunLoss` path a death
takes, so pausing is never cheaper than fighting, and the menu does not
offer "quit to hub with the run intact" — that would have sold the
save-scum that closing the window already allows (map checkpoint on
disk, combat state never persisted). Combat also gets the control list
in the panel, which is where the owner's "hud is very hard to read"
complaint is partly answered pending QA-084.

### QA-082 — S2 — FIXED THIS ROUND (see phase report) — no attack
### telegraph in the game matches the hitbox that resolves it

**Repro:** `createCombat(ENEMIES.morioh_thug, [], {shakeEnabled:false},
createRng('qa-telegraph-geom-001'))`; set `enemies[0].ai.patternIds =
[id]`, `ai.approachRange = 10000`, `speedPxPerFrame = 0`; each frame
before `combat.step()` pin `enemy.x/z = (300,130)` and
`player.x/z = (300+dx, 130+dz)`; watch `player.hp`. Frames are byte-
stable across runs.

**Symptom:** the sim has exactly three hit geometries — melee AABB
(`hitbox.js:27-34`, forward-facing box, `|Δz| <= 22`), projectile point
(`hitbox.js:40-43`, `|Δx| <= 25` and `|Δz| <= 10` at a `pr.z` fixed at
spawn and never advanced), and hazard zone (`hazards.js:55-56`,
genuinely radial `hypot <= radius`). The single renderer
`telegraphOne()` (`arena.js:131-153`) drew, for every pattern regardless
of type, a ground ellipse + ring of x-radius `pattern.range*(0.4+k*0.6)`
and y-radius `pattern.range*0.14+3` centred on the attacker. **Zero of
16 patterns matched.** Two directions, the first being the fairness
violation:

- **Melee under-warns forward on every windup frame.** Ring peaks at
  ~0.97*`range` and averages ~0.70*`range`; real forward reach is
  `range+15` (User) / `range+37` (User+Stand pair, `stand_classes.js:
  44,47`). Frames on which the drawn ring reaches the real reach: **0
  of N, for all 8 melee patterns.** Live: `sweep` connects at dx=121
  against a ring drawn at 81.5 max; `the_world_time_stop` at dx=137
  against 100.
- **Hazard zones under-warn in both axes.** `arena.js:189` drew
  `radius*0.7` in x and `0.55*radius+7.5` in z against a true radial
  test — 66-74% coverage, so the real danger *area* is ~2.0x the drawn
  area, an invisible annulus all the way round. Live (`bomb_plant`,
  r55): dz=54 HITs while the drawn ellipse ends at z≈37.8; dx=38,dz=38
  (hypot 53.7) HITs and is not drawn.
- **Ranged over-warns catastrophically in depth** (owner's claim (b),
  confirmed and worse than reported): drawn depth is 12.65x-16.85x the
  real ±10 band, and for 5 patterns the drawn ellipse is *deeper than
  the entire 180-unit belt* (147-187%) — it paints the whole arena
  lethal when a 20-unit lane is. Root cause is documented but not
  honoured: `ai.js:20-23` says ranged `range` is "only an AI
  pattern-selection distance heuristic"; `arena.js:138` read it as a
  radius.
- **Melee draws a symmetric circle for a forward-only box** (owner's
  claim (a)): the entire rear half is false danger. Note the owner's
  premise is half-right — the *visual* reads as radial, but the hitbox
  is a forward AABB, so the answer to "does the hitbox respect the
  visual" is **no**. Making slam genuinely radial is a gameplay change,
  logged separately as QA-088.

**Also found:** `the_world_time_stop.hazard` is unreachable dead data —
`spawnHazard` is only called from the projectile-timeout branch
(`combat_enemy.js:138`) and this is a melee pattern (S3). And
`telegraphOne` early-returns unless `ai.state === 'windup'`
(`arena.js:134`), so on the exact frame a melee hit resolves there is
zero telegraph geometry on screen.

**Process gap (S2):** nothing anywhere ties telegraph geometry to hitbox
geometry. `npm run assert`'s "telegraph fairness floor (>=260ms)" is
time-only — `fairness_check.js:20` is
`p.windupFrames * frameMs >= MIN_TELEGRAPH_MS`, and neither it nor
`checkTelegraphFairnessAtMenace` reads `pattern.hitbox`, `pattern.range`
or `pattern.hazard`. `content_registry.js` does not validate `PATTERNS`
at all. One could set `hitbox.w = 400` on `quick_stab` and every check
would still pass.

**Status:** fixed this round in the render layer only — the sim's
geometry is correct and unchanged; the drawing was the thing lying. See
the phase report for the drawn-vs-real numbers.

### QA-083 — S2 (arguably S1) — logged, not fixed — no enemy in the
### game can move in z, so holding one key is permanent invulnerability

**Repro:** any encounter; hold `back` (`S`/`ArrowDown`) to z=220 and
stand still. Measured over 5400 frames (90s) against 11 targets.

**Symptom:** no enemy AI ever writes `z` — not one type, not one boss,
not one profile. Every movement branch in `combat_enemy.js` writes `x`
only: knockback integration (`:65`), bounds clamp (`:66`, and no z clamp
exists), `flee` (`:85-90`), `approach` (`:91-97`), projectile travel
(`:124-143`, `pr.z` fixed at spawn). `ai.js`'s `stepEnemyAI`
(`:226-271`) is a pure state machine with no position writes; all six
profiles (`profiles.js:18-25`) only weight attack-token eligibility.
Verified empirically across all 28 enemy types and bosses with the
player oscillating in both axes to bait a depth response: **maxΔz = 0
for all 28.**

Hit resolution is depth-gated (melee ±22, ranged ±10 — `hitbox.js:
10-11`). Enemies are frozen at z ∈ {104…156}; the player has the full
40…220 range (`stand_classes.js:26-38`, 180 units of travel). So a
player at z=220 is at least 64 units from the nearest enemy —
permanently outside every hitbox in the game, with no AI able to follow.
Measured: **0 damage taken, indefinitely, from 11/11 targets including
Killer Queen, DIO and Pucci**, and from both crowd encounters tested. It
is a stalemate rather than a free win (the player's hitboxes are
depth-gated too), but any player-side ranged or hazard damage converts
it into a risk-free kill.

Spawn nuance: `encounter.js:46-48`'s `SPAWN_Z_OFFSETS = [0,-26,26,-13,
13]` gives crowds 5 discrete z lines, but **every boss and every
single-enemy/elite node is spawn index 0 → z = 130 exactly**, so a 1v1
has no depth variation at all. Summons and clones inherit z verbatim
(`summons.js:61`, `affixes.js:116`).

Two secondary consequences of the same root cause: the `flanker` profile
is dead logic (`profiles.js:50` grants `flankBonus` at `|Δz| > 20`, a
condition the enemy can never create), and Shielder's designed
counterplay is a 2-unit window (`data_enemies.js:106` says it "must be
flanked (z-offset) or poise-broken"; `resolvers.js:162-165` zeroes
damage at `|Δz| <= 20` while the melee hitbox stops overlapping past
`|Δz| > 22`, and the player crosses 2.87 units per frame) — poise-break
still works, so it is not unkillable.

**Status:** not fixed. Giving 28 enemies depth-tracking movement is a
gameplay/AI feature that re-balances every encounter in the game, not a
hardening patch — it is the single highest-priority item for the next
gameplay phase. Severity is S2 by this ledger's letter (not run-ending)
but it invalidates all combat, so treat it as the top of the queue.

**Adjacent, flagged not acted on:** `forward` (`W`/`ArrowUp`) is
`dz -= 1` (`stand_classes.js:30`), and `zToYOffset` maps lower z to a
*larger* screen y — so Up moves the character *down* the screen, Down
moves them up. Inverted against the beat-'em-up convention, and it is
what makes QA-084's symptom reachable by pressing Down. BALANCE/design
call, not a defect.

### QA-084 — S2 — logged, not fixed (owner decision needed) — the far
### half of the walkable plane has no ground under it

**Repro:** hold `back` to z=220 in any arena.

**Symptom:** feet-y is `GROUND_Y + zToYOffset(z)` with `GROUND_Y = 208`
(`constants.js:29`) and `zToYOffset(z) = round((130 - z) * 0.4)`
(`render_adapter.js:27,34-37`), so the projected feet band is
**172…244**. `buildGround` (`bg_scenes.js:165-198`) starts with
`px(g, 0, groundY, W, H - groundY, ...)` at `:167` — the ground plane
begins exactly at y=208 and fills downward, in every scene, with no
per-scene variation. Ground band 208…270 (62px) vs. projected feet band
172…244 (72px), centred on the horizon instead of sitting below it:
**36px of overshoot, uniform across all 13 scenes**, and feet cross
above the horizon at any z > 130, i.e. **89 of 181 world units (49.2%)
of the legal depth range is unsupported.**

Rasterizing the actual layer buffers for what the character stands in at
y=172: **store 100%** coverage (standing inside the shopfront glass,
`bg_scenes.js:107`, 12px above its own base), **alley 95.7%** (bare
brick, `bg_scenes.js:21-29` — the owner's "walking in the wall",
literally), **street 96.4%** (on top of the awnings, `bg_scenes.js:153`),
**park 7.1%** (a different symptom — floating 8px above the fence top,
`bg_scenes.js:95`, reads as levitating rather than clipping).

**Status:** not fixed — needs an owner call, because no available fix is
visually neutral. Options, with the measurement behind each:
- **(A, recommended)** pass `GROUND_Y - 36` as the `groundY` argument at
  the two backdrop call sites (`render.js:194` `drawBackground`,
  `render.js:227` `drawForeground`). `GROUND_Y` itself stays 208, so
  every sprite/effect/telegraph/hazard y is untouched; ground band
  becomes 172…270 and near-layer scenery baselines at the far edge of
  the walkable plane, which is the correct 2.5D composition. Verified:
  **0px of art pushed off-canvas in any of the 13 scenes.** But it
  reframes every arena — topmost near-layer row before→after: store
  44→8 (loses most of its upper framing), street 90→54, park 81→45,
  alley unchanged at 30 but its wall shortens 146→110px. That is an
  art-direction change needing the owner's eye, and it cuts against
  `scene_defs.js:1-8`'s stated discipline ("a new Act gets a new mood
  via colour data, never new backdrop geometry code").
- **(fallback)** a per-`kind` horizon offset in `scene_defs.js` — data,
  not geometry, so it honours that discipline and lets each arena absorb
  the 36px differently.
- **(B)** remap `zToYOffset` into the existing band — pure render layer,
  one function, but breaks the documented `zToYOffset(Z_REST) === 0`
  contract (`render_adapter.js:16-17`, `arena_bounds.js:10-11`), moves
  every fighter's rest position down 31px and compresses depth travel
  72→54px. A resolver rewrite, not an additive change.
- **(C)** extending only the ground layer upward is not viable — ground
  draws *after* `near` (`background.js:102`), so a 36px apron buries the
  shopfront bases, awnings and plinths (96-100% near coverage in that
  band for three of four kinds).

Worth deciding **after** QA-083: if the depth axis gets clamped, or the
AI gains z-movement, the required ground coverage changes.

### QA-085 — S2 — logged, not fixed — every Stand, Stand user and enemy
### reuses one of three sprites

**Owner's words:** "The character models are reused. This is
unacceptable. Each stand, each stand user, each enemy type should have
its own design based on how they look in JoJo's Bizarre Adventure."

Confirmed and quantified in QA-073/QA-074 above (7 of 8 playable Stands
render as Star Platinum once manifested; 9 of 10 bosses and all 14
tinted crowd types render as `drawThug`; five tint groups are pixel-
identical to each other). Consolidated here as the owner's own filing so
the art phase has one entry to work from.

**Status:** not fixed — this is ~33 bespoke character designs. It is a
content/art phase, not a hardening patch.

### QA-086 — S2 — logged, not fixed — the character rig reads as
### unnatural, and the faces as doodles

**Owner's words:** "The design of the characters is subpar. The pose
itself is unnatural and limb movement looks very unnatural and forced.
The faces look like doodles instead of the iconic JoJo design style with
clear shapes and outlines. They do not look serious, they do not look
polished."

**Status:** not fixed, and deliberately not attempted. This is a rewrite
of `body.js` (the FK humanoid rig), `face.js`, `anim.js` and
`pose_player.js`/`pose_enemy.js` — the pose engine itself, not its
callers. Half-rewriting a character rig during a hardening phase is
exactly the destabilization this phase exists to avoid. Scope it as its
own phase with reference art per character; it pairs naturally with
QA-085 since new sprites and a new rig want to be authored together.

### QA-087 — S2 — logged, not fixed — hits have no impact, given or
### taken

**Owner's words:** "Attacks both given and taken feel like they have no
impact."

**Status:** not fixed. The mechanisms all exist and are individually
healthy — hit-stop (`juice.js`, spec §10's 3-5 frame light / 8 frame
heavy window), directional whole-pixel shake (`juice.js:60-61`,
verified in QA-067), the capped particle burst (verified in QA-069), the
3-layer hit sound (`audio.js`), squash/stretch (`layer.js`) — so this is
a tuning-and-layering problem across all of them, plus spec §10's "juice
budget rule" (reserve the largest responses for crits, parries, boss
staggers and finishers; uniform juice on every hit reads as noise). That
is a feel pass with a human in the loop on every number, not a defect
with a repro. Pairs with QA-086 — impact reads through the rig as much
as through the effects.

### QA-088 — BALANCE — logged, not acted on — should slam-type melee be
### genuinely radial?

**Owner's words:** "Some attacks like Ground slam should hit anything in
a circle around them, not just left to right."

The measurement (QA-082) answers the factual half: slam-type patterns
are forward-facing AABBs, and the circular telegraph was lying about it.
This round fixed the *lie*. Making the *hitbox* radial is a separate,
genuine design change — it would alter the threat profile of all six
chevron patterns (`telegraphed_slam`, `shield_advance`,
`highway_star_dash`, `the_world_time_stop`, `king_crimson_erase`,
`made_in_heaven_acceleration`), invalidate the encounter-composition
assertions' tuning, and interact directly with QA-083 (a radial slam is
the natural counter to depth-camping).

**Status:** not acted on — a gameplay decision for the owner, best taken
together with QA-083 since they are the same question from two sides.

### QA-089 — S3 — logged, not fixed — very powerful attacks are
### distinguished by colour alone

**Owner's words:** "When it comes to very powerful attacks, the
telegraph should also have a texture, not just a color."

Confirmed: `telegraphOne` (`arena.js:131-153`) varies only
`pattern.telegraph` (a flat hex) and the glyph shape; there is no
texture, hatch or fill-pattern channel, so a heavy and a light read
identically to anyone who can't separate the two hues — and QA-077
already found one pattern reusing plain UI white. `draw.js` has
`dither()` (`draw.js:175`), which is the right primitive for this and is
already used elsewhere, so it is a bounded addition rather than new
machinery.

**Status:** not fixed this round — the telegraph geometry rewrite
(QA-082) landed first and a texture channel should be authored on top of
the corrected shapes, not the old ones. Next telegraph pass.
