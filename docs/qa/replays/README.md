# Phase 13c spatial-edge replays

All 9 files are headless replays (`replay.js`'s `{header, log, checkpoints,
final}` shape) driven by scripted spatial policies, not real play —
generated to pin down the QA-005/006/007 findings in
`docs/qa/bugs.md` and the four corner clamp baselines.

**Every file here snapshots an in-progress fight** (`outcome: "fighting"`),
recorded at a fixed frame count rather than run to a decisive outcome, on
purpose — the bug is a mid-fight geometry state, not a fight result.
Because of that, plain `npm run replay -- docs/qa/replays/<file>.json`
reports a `FAIL` on the final-frame count: `replayRun`'s default
`tailFrames` (300) keeps stepping the fresh run past the point the
original recording stopped, using whatever keys were last held, so it
naturally advances further than the recorded run did. That is expected,
not a determinism regression — re-run with `tailFrames: 0` (or
`frameCap` equal to the recorded `final.frame`) and every file here
diverges nowhere; verified for all 9 before landing.

| File | Bug | Corner/scheme |
|---|---|---|
| `qa005-long-retreat-corner-freeze.json` | QA-005 | Long-Range retreat AI, corner 2 |
| `qa005-pinned-objective-corner-safe.json` | QA-005 | shopping_street_pinned, forced Long |
| `qa006-mid-flick-tether-unbounded.json` | QA-006 | Mid-Range (sticky_fingers), corner 0 |
| `qa006-long-tether-unbounded.json` | QA-006 | Long-Range (hierophant_green), corner 1 |
| `qa007-z-extreme-mutual-whiff.json` | QA-007 | Close-Range, corner 2, z-parked |
| `baseline-close-corner-{0..3}.json` | none (clean) | Close-Range Project-into-wall at all 4 corners — clamp holds |

## Phase 13f systems-collision fixtures (`c*.json`)

25 files covering the 16 cases that build **and step** a combat, written by
`node apps/standbattle/scripts/qa_systems_collision.js --record`. Each is the **real run** of a case — a recorder is attached to the
combat the case itself builds (`qa_collision_util.js`'s `mkCombat`), not a
re-enactment of it — in the same `{header, log, checkpoints, final}` shape as
the 13c files above. A case that builds several fights writes `<id>.json`,
`<id>-2.json`, and so on (`c5c` and `c6b` record two each, `c7e` eight).

**These are evidence, not self-checking replays.** Most 13f cases poke sim state
on an exact frame — `player.persistence = 34` in a cancel window,
`combat.timeStopFrames = 240` on a phase-transition frame — and a poke is not an
input, so it never lands in `log`. Feeding one of these back through
`npm run replay` reproduces the *inputs* but not the *conditions*, and will
diverge. **The deterministic repro for every 13f finding is
`qa_systems_collision.js --case=<id>`**, which is what each ledger entry cites;
the fixture exists so the recorded run's per-second checksums and final state can
be diffed against a future build. (The 13c `tailFrames: 0` caveat above applies
here too — these also snapshot mid-fight.)

The other 58 cases have no fixture, and are listed rather than quietly omitted.
Most build no combat at all — the priority-band cases (`c1*`), the 36 status-pair
cases (`c2-pair-*`), the Menace and validator cases (`c7a`, `c7b`, `c8*`) and the
three structural-absence records (`c2e`, `c4d`, `c6d`) are pure-function checks
over `hooks.js`, `status.js`, `meta_menace.js` and `content_registry.js`. Two
(`c7c`, `c7d`) build combats but never step them: they compare spawn counts at
frame 0 with and without Crowded, so a replay would record an empty log and one
checkpoint.
