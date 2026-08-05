# Phase 3 — the pipeline

**Commit:** `c926ffc` (2026-07-31, "effect-hook pipeline, stat pipeline,
status system, content validator").

**Goal (build plan):** turn the Phase 0 notification bus into a real effect
pipeline, wire the four dead stats, add a generic status system, build the
content validator. No new gameplay — acceptance test was two throwaway
Fragments working as pure data, then deleted.

**Delivered:**
- `hooks.js` — flat name→kind registry (`EVENT_HOOKS`/`EFFECT_HOOKS`/
  `QUERY_HOOKS`). EVENT: `bus.on`/`fire`, pure notification. EFFECT:
  `bus.effect`/`runEffect`, mutable `ctx` in priority order
  (`ADD < MULTIPLY < CLAMP`), any effect can set `ctx.cancelled`. QUERY:
  `bus.query`/`runQuery`, pure `(value, ctx) => value` reducer chains.
- `stats.js` — stat pipeline (`base -> flat -> multiplicative -> set/
  override -> clamp`), wires Range/Speed/Precision/devPotential.
- `status.js` — generic status system (`stackRule`, `tickRateFrames`,
  `onTick`/`onExpire`/`onDeath`); proof entries `virus` (real DoT) and
  `frozen` (data-only, unconsumed until Phase 7).
- `effect_lib.js` — string-addressable verb vocabulary; `installRunBuffs`
  ports the three prototype run buffs onto queries with zero buff-specific
  engine code.
- `content_registry.js` — `createContentRegistry`/`validateContent`/
  `loadContent`, empty registry (no real content until Phase 7).

**Verification:** `headless_harness.js` byte-identical before/after the
diff (stashed and diffed both ways per the commit's own claim — this report
did not re-run it).

**Known gaps:** none recorded beyond Frozen being data-only.
