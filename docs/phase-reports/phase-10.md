# Phase 10 — Fragments, Relics, Discs, Duos, Requiems

**Commit:** `3612b1c` (2026-08-06).

**Goal (GDD §6, tech §3):** 8 donors / ~60 Fragments, ~20 Duo Fragments,
~55 Relics, ~14 Discs, 12 Requiems — the full item-system pool.

**Delivered:** 52 Fragments/8 donors, 48 Relics, 14 Discs, 20 Duo
Fragments, 12 Requiems — validator-enforced (§6.7 union, `requires[]`/
`DISC_SLOTS`, universal risk→tradeoff). Content split into
`content/<kind>/<file>.js` per the 300-line cap; `content_registry.js`
gained Disc/Requiem/Duo kinds + unlevelled `installRelic`/`installDisc`/
`installDuo`/`installRequiem`. Real owned-Relic system (resolves Phase
8's flagged gap): `runState.relics`/`.duosOwned`/`.discsBySlot`,
installed every fight. Treasure nodes roll real Relic/Disc offers instead
of Fragment offers; Duo candidates mix into the normal offer pool once
both donors are owned. 10 new generic verbs generalize Phase 7 patterns
for the 5 new donors; 3 new statuses (gravity/charge/mark); new
`onCombatTick` hook for periodic Relics/Requiems. Hermit Purple's economy
identity (`economyMods`) reads outside the combat dispatcher entirely.

**Bug found and fixed:** `applyStatusToNearby`/`damageNearby`'s
`from:'target'` read `ctx.target`, which only exists on `onKill` —
`onHitLanded`/`onHitResolve` name it `ctx.defender`, so every entry using
it on a hit hook was silently no-op'ing. Fixed at the one verb.

**Deviations flagged:** Discs can't literally swap in another Stand's
move (only Star Platinum has one) — scoped to full slot-override,
single-level, `special_1`/`special_2`/`rush` only. Requiems have no live
selection flow (no Act III/Altar; DO NOT list forbids adding one) —
content-complete, not run-reachable. Pool counts (52/48 vs. ~60/~55 GDD
targets) are honest curation, not padding. Canon Relic mechanics needing
absent systems (Shop pricing, map reveal, Rule Fights) were reinterpreted
as combat-time effects, names kept as flavor.

**Verification:** `validate` — 52/8/48/14/20/12/18, zero errors. `assert`
and `sweep -- --runs=200` pass; harness byte-identical. Scripted
integration test: Duo offer/take, `economyMods` extra-choice, real
Treasure→Relic pick, and a fight with Relic+Duo+Disc all installed ran
180 frames with no throw.
