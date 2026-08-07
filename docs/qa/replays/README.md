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
