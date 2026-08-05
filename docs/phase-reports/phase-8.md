# Phase 8 — The Run

**Commit:** `7c6eba5` (2026-08-05, "The Run — seeded, branching Act I").

**Goal (GDD §5/§6.5/§6.8, tech §2.8-2.11):** Act I from a fixed 6-node
path to a seeded, branching, resumable run: DAG generator, Yen economy,
new node types, Tension, run-save, telemetry.

**Delivered:**
- `map_constraints.js` — constraint language: `atLeastOnePerPath`,
  `noAdjacent`, `maxRun`, `exactlyOnce` (kept generic, unused by Act I);
  each a `check`+deterministic `repair` pair.
- `map_gen.js`/`map_data.js` — seeded generator (6 lanes, 9-11 rows, 2-4
  leaned paths to a fixed boss); <=40 resamples then a fixed-point
  repair floor (hit 0.04%/10k seeds) — never unbounded.
- `economy.js`/`tension.js` — Yen (escalating Shop costs, §6.5), Tension
  0-5 scaling budget + reward rarity via a new `rarityMult` param.
- `shop.js`/`rest.js`/`archive_stub.js` — Owson, the real Rest 3-choice
  menu, the Archive stub. `map.js` rewritten for DAG rendering.
- `run_flow.js` — transition orchestration out of `index.js` (DAG
  lifecycle: `enteringNodeId` -> `commitNode` into `nodeId`/`visited`).
- `telemetry.js` — append-only `ctx.fs` JSONL, one line/finished run.
  `save.js` v2->v3 (`graph`/`nodeId`/`visited`/`yen`/`tension`); v2 falls
  back to a fresh run instead (no sound index->graph mapping exists).

**Flagged deviation / known gaps:** GDD §5.3's Rest/Treasure Relic
options are Fragment offers (no owned-Relic system exists yet); Archive/
boss-victory weren't directly screenshotted.

**Verification:** `validate`/`assert` pass; `sweep -- --runs=10000`: 0
seeds with a 0-Rest/0-Shop path, worst pity gap 4/4, retry mean 5.1;
`headless_harness.js` byte-identical; browser playtest (map/combat/
elite/rest/shop/reward, zero console errors) caught/fixed a HUD glyph bug.

**Handoff (9a/10 depend on this):** constraint shape —
`{kind, check(graph), repair(graph)}` + `checkAll`/`repairToFit`
(`map_constraints.js`). Telemetry schema — `appendRunSummary`'s `{ts,
seed, stand, actReached, killer, fragmentsOffered, fragmentsTaken,
encounterDurationsMs, yenEarned, yenSpent, tensionMax}` (`telemetry.js`).
Run-save shape — `save.js` v3, per `createFreshRunState` (`run_flow.js`).
