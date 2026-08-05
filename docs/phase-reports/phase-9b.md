# Phase 9b — Enemy Roster and Affixes

**Goal (GDD §4.2/§4.3/§4.4):** roster to 14 types, 18 spawn-rolled affixes visible pre-fight, composition rules enforced at generation.

**Delivered:**
- 9 `ENEMIES` entries (#4/5/6/8/9/10/11/13/14; #1/2/3/7/12 pre-existed), in
  new `data_enemies.js`/`cga_palette.js` (300-line cap). `puppet_minion`
  fodder isn't a 15th type.
- 18 affixes (`affixes.js`): elites (or `opts.isElite`) roll 1-2,
  `opts.menaceRank` adds one. Install per-INSTANCE via `content_registry.js`'s
  `installAffix` — same EFFECT_LIB/QUERY_LIB verbs Fragments use (invariant
  6), scoped by an `AFFIX_SCOPE` ctx-field table, not global.
- Visible pre-fight (spec §5): reuses `combat.banner`/`tint` verbatim —
  zero render-layer changes.
- Composition rules needed **zero** engine changes (Phase 5's
  `encounter_budget.js` already generalizes cost/ranged/role/clashable);
  `encounter_check.js`'s POOL now exercises all 14, not 3.

**Engine findings** (generalized once, authored as data after — the honest
count this sub-phase measures), each 1-4 lines at an existing choke point:
`ai.js` 3 pattern shapes (2 reuse `hazard`, previously boss-only);
`resolvers.js` (frontalBlock/intangible/cornered/enraged/reckless/Requiem);
`poise.js` (Ironclad/Undying); `status.js` (Warded); `combat_enemy.js`
(Leashed, `stepSummon`); `combat_defense.js` (symmetric `pendingStatuses`
for Toxic, completing an existing player-only mechanism; fixed a
pre-existing `onKill` ctx missing `combat` on the Clash-kill path);
`fighter.js` (`affixData` default incl. summons); `summons.js` (new
generic mid-fight spawn, shared by Puppeteer/Caller/Split/Mirrored).

**Deviations flagged:** `summon` is a def-level timer field, not a
`PATTERNS` module. Duelist has no real parry engine, just a mirror kit.
Only 5/16 GDD pattern names got entries — the rest weren't needed. Elite/
Menace propagation from map/run doesn't exist yet (Menace itself is
unimplemented); `rollAffixes` takes `isElite`/`menaceRank` as opts.

**Verification:** `validate`/`assert`/`sweep` pass; harness byte-identical
across two runs. Scratch: all 9 types + 18 affixes fought solo, no throw;
frontalBlock denies damage head-on; Requiem-Touched revives once then dies
for real; Toxic applies Virus (caught+fixed a real `onHitResolve` scope
bug: must key on `attacker`, not `defender` — the enemy is attacking).
