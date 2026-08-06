# Phase 11-A — encounter objectives

**Goal (GDD §15):** Ambush, Survive, Pinned, Hazard, Bounty, Sudden Death —
near-free variety over the existing `winCondition` abstraction, on enemies
that already exist, before Rule Fights build on top of it.

**Delivered:** `OBJECTIVES` registry (`encounter_objectives.js`, split out
of `encounter.js` for the 300-line cap): optional `onStart`/`onTick`/
`checkWin` hooks `stepEncounter` calls each frame. Ambush recenters the
player and mirrors half the wave to the far side, zeroing the intro
banner. Survive drip-spawns via the existing generator on its own timer.
Pinned forces `stand_classes.js`'s existing Long-Range scheme (User is
AI-retreated, Stand takes input) for a self-lifting window via one field
`combat_player.js` reads ahead of `player.stand.controlScheme`. Hazard
times `hazards.js`'s existing `spawnHazard` onto a data list — zero new
hazard mechanism. Bounty marks one enemy; killing it sets
`combat.bountyEarly` (read by `run_flow.js` for the reused elite Yen-bonus
roll); leaving it alive stacks `affixData.enraged` on the others through
the resolver's existing multiplier field. Sudden Death needed no registry
entry: one `flees: true` def field starts an enemy in a new `flee` AI
state (`combat_enemy.js`, reusable later for the Stalker) and ordinary
killAll ends it on the first hit. 6 Act I encounters exercise all six,
mixed into `ACT1_COMBAT_POOL`.

**Abstraction change (the finding):** `checkWin`, when an objective
defines one, now fully bypasses the old wave-completion gate instead of
only short-circuiting it. Self-verify caught Survive resolving via
leftover killAll ~5s into its 30s hold, the instant its one starting wave
died — fixed before any Rule Fight could inherit the bug.

**Verification:** `validate`/`assert`/`sweep --runs=5000` pass unchanged.
Headless: all 6 new encounters run without throwing; scripts confirm
Survive resolves by timer not early kill, Bounty ends on `bountyEarly:
true` + stacks `enraged` (1.2544× at 2 stacks). Multi-enemy losses vs. the
harness's dumb policy match pre-existing multi-enemy encounters.

**Known gaps:** Survive's "leaving early forfeits the reward" has no
counterpart (no retreat-from-fight mechanic exists yet). Pinned's win
condition is under-spec'd beyond the Long-Range/40s rule; implemented as
the restriction, not the win condition (ordinary killAll) — flagged.
