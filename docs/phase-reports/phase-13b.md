# Phase 13b — can a run always finish?

**Goal:** prove no seed, on any path, produces a run that cannot be
finished or exited. Wide, cheap, headless.

**Tested:** `npm run sweep -- --runs=20000` (260,000 combat fights across
3 fodder + 10 bosses, 80,000 Act I-IV map generations) plus a new
`apps/standbattle/scripts/qa_run_sweep.js` (250 lines) driving 20,000 full
headless runs end-to-end through `run_flow.js`/`run_choices.js` — graph
reachability, termination, encounter clearability, node-type coverage,
economy solvency, reward-pool integrity. `npm run validate`/`npm run
assert` re-run clean before and after.

**Found, by severity:**
- **S1: 0.** No non-terminating run, no zero-choice offer, no Caller-over-
  cap, no Leashed-unreachable enemy, no immortal enemy stack, no map
  seed without a Shop, no save/crash softlock across 40,000 seeds.
- QA-003 (not a bug) — the shared headless test-bot never drives the
  z-axis, so 1592/20,000 crowd fights false-positive as combat-frame-cap
  "timeouts" in the sweep's own accounting; hand-verified the same
  seed/encounter resolves once the bot closes z. Never blocks the run's
  single exit door (`finishRun` still fires; all 20,000 runs reach
  `'continued'`). `qa_run_sweep.js`'s bot was corrected; the shared
  `headless_harness.js`/`telemetry_sim.js` bot was left as-is (widening
  it to model Stand Control-Scheme redirection is a real feature, not a
  narrow fix).
- QA-004 (not a bug) — clean baseline: 0 zero-choice offers, 0 duplicate
  offer candidates, 0 Rest offers missing the heal option, 0 enemy OOB
  events (all 3,827 OOB events are the player's own Stand — QA-001's
  already-logged shape). Node-type frequency all well above the 0.1%
  flag line (elite lowest at 3.17%). Yen 778,459 generated / 206,555
  spent (~3.8x headroom, not GDD §6.5-comparable since most runs are
  partial — 60/20,000 full clears with the naive bot); no path is ever
  Shop-less; Rest's heal is free, so Yen never locks out recovery.
- Retry distribution (map gen): mean 4.9, p50 3, p95 16, max 40
  (`MAX_ATTEMPTS`, hit 42/80,000 = 0.05%, caught by the deterministic
  repair floor every time) — no fat tail, constraints are not close to
  unsatisfiable.
- QA-001 (from 13a) remains open, unchanged, correctly deferred to 13l —
  a step-ordering fix to `combat.js`'s per-frame sequence, not a narrow
  behavior fix.

**Fixed this sub-phase:** nothing — zero S1s to fix.

**Could not reproduce:** nothing new; QA-001 through QA-004 all
reproduced deterministically on first retry from their logged seeds.

**Next sub-phase should know:** `qa_run_sweep.js` is now a durable script
— the only one covering node-type frequency, full-run economy totals, and
reward-pool integrity at scale; reach for it alongside `sweep`/`fuzz`/
`assert`. The z-axis gap means any future headless bot work should close
both axes, not just x. QA-001 is the one open item carried into 13l.
