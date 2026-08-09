# Phase 13j — the long test (prep)

**Scope this turn:** the three agent-side prerequisites, before sessions A–F.
No play data exists yet — the pacing table, hits-to-kill curve, onboarding
check and per-class distributions are blocked on those sessions; follow-up
report once notes arrive.

**1. Pacing telemetry — `pacing.js` (new).** One per-frame call
(`pacingTick`, wired into `index.js`) answers all five wall-clock questions:
time in menus (hub screens + title/standselect), transitions (`map` dwell),
per encounter (`combat` dwell), per node (span of `state.enteringNodeId`,
`resolveNodeEntry` to `commitNode`), and hub-spawn-to-run-start latency.
Read-only against sim/render state; flushes to `ctx.fs`
(`standbattle/pacing.jsonl`) every 15s and on unmount, same append-only
JSONL shape `telemetry.js` uses.

**2. Replay recording — now on for every live fight, not just headless/
fuzzer ones.** `attachRecorder` was previously never called outside scripts.
`run_flow.js`'s `startCombatForNode` and `training.js`'s
`startTrainingFight` now attach a recorder at creation; `persistLiveReplay`
(`replay.js`) writes it to `standbattle/replays/<seed>-<node>-<frame>.json`
the moment a fight settles (win/loss/fled). Required a real capability, not
just wiring: `runRng` is one long-lived generator per run, so replaying a
fight in isolation needs its RNG streams resumed mid-run, not from stream 0.
Added `rng.js`'s `snapshotStreams()`/`createRng(seed, resumeStreams)`
(additive, default-off); `run_flow.js` snapshots `runRng` before
`createCombat`. Verified: a resumed stream's draws match the un-resumed
continuation bit-for-bit; `npm run fuzz` still reproduces pre-existing
QA-001 unchanged, confirming ordinary derivation is untouched.

**3. Fresh-save build.** No code needed — meta/run live at
`localStorage['app_standbattle_meta']`/`['app_standbattle_run']`; clear both
before the onboarding session, everything else already falls back to
`ensureMetaProgress(defaultMeta())` when absent.

**Verified:** `headless_harness.js`, `npm run validate`, `npm run assert` all
green post-change. No gameplay/sim code touched — instrumentation plumbing
and one additive RNG capability only.

**Next:** sessions A–F, then the pacing/hits-to-kill/onboarding/per-class report.
