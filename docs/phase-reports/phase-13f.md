# Phase 13f — where systems meet

**Built:** `scripts/qa_systems_collision.js` over `qa_collision_cases{,_b,_c,_d}.js`
(74 cases) + `qa_collision_util.js`. Durable, `qa_matrix.js` house style:
`--group=N`, `--case=<id>`, `--verbose`, `--record`.

**Tested,** all 8 matrix items (one case group each, `--group=N`): priority bands ·
36 ordered status pairs + purge/ward gates · cancels vs cost/hit-stop/Project ·
time-stop vs phase transitions/purge/Rush/Bites the Dust · Persistence and Momentum
at 0 and 100 on a spend-and-gain frame · feedback vs User death/i-frames/simultaneous
damage · Menace × Rule Fights and offers · hook×verb validation.
**56 clean, 15 findings, 3 absences, 0 throws.**

**Fixed: nothing — no S1, and one S2 deliberately left unfixed.** QA-033 (five
shipped clauses inert because their hook's ctx carries no `combat`) looks like a
five-line fix. It is not: enabling `hg_barrier`'s clause collides with QA-035 (a
held Guard re-breaks ~1/sec) and QA-034 (Frozen never expires), so fixing it alone
hands one held key a permanent arena-wide freeze. **QA-033/034/035 land together in
13l or not at all.** A one-line fix that is safe only in combination is precisely
what this sub-phase existed to find.

**S2 (5):** QA-033 five inert clauses (incl. a wholly dead Fragment,
`frag_moody_blues_special_2`) · QA-034 Frozen permanent, `breaksOnHits` dead ·
QA-035 guard-break repeats ~1/sec · QA-036 Crowded inflates all 8 Rule Fight rosters
1→4 while the rule binds `enemies[0]` only · QA-037 5 of 14 Menace conditions inert.
**S3 (7):** QA-038/039 hit-stop freezes the frame pipeline and input outruns it ·
QA-040 time-stop suspends boss i-frames/purge (arguably BALANCE) · QA-041 silent
unaffordable cancel · QA-042 feedback ignores Step i-frames · QA-043 Warded spent by
a benign status · QA-044 unvalidated effect priority.

**Could not reproduce:** nothing — every finding replays from its seed and frame.
Five items are **untested rather than clean** (bugs.md "Phase 13f additions"): four
named mechanics don't exist (QA-046); two Menace collisions are unconstructable
(QA-037); tie determinism rides on unasserted `Array.sort` stability;
`frozenSolid`/`gravity` have no movement consumer, so "Frozen plus forced movement"
has no rule to break; `runStatusDeathHooks` has zero call sites.

**Self-verify:** collision map in bugs.md — menace×rule-fight **2**, 1 each across 13
further pairs. 25 fixtures in `docs/qa/replays/` cover the 16 cases that build and step
a combat; the other 58 are pure-function or spawn-count checks with nothing to
record (itemised in the replays README). `validate`/`assert`/`determinism`/`sweep --runs=4000` pass; no engine file
was modified.

**Next (13l):** (1) QA-033/034/035 are one fix, not three. (2) The validator has no
hook→verb requirement table; adding one kills the whole QA-033 class rather than its
five instances. (3) **time-stop and hit-stop appear in 4 collision pairs and
`combat.js`'s per-frame sequence is the cause in all 4** — same root as
QA-001/QA-016, so scope the step-ordering batch to that, not to the symptoms.
(4) QA-036 makes QA-025's Yellow Temperance four times worse.
