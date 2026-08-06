# Phase 10 — Fragments, Relics, Discs, Duos, Requiems

**Commit:** `0fe92db` (2026-08-06, post-merge audit fixes included).

**Goal (GDD §6, tech §3):** 8 donors / ~60 Fragments, ~20 Duos, ~55 Relics, ~14 Discs, 12 Requiems — the full item-system pool.

**Delivered:** 52 Fragments/8 donors, 48 Relics, 14 Discs, 20 Duos, 12 Requiems — validator-enforced (§6.7 union, `requires[]`/`DISC_SLOTS`, universal risk→tradeoff). Content split into `content/<kind>/<file>.js` per the 300-line cap; `content_registry.js` gained Disc/Requiem/Duo kinds + unlevelled installers. Real owned-Relic system (resolves Phase 8's flagged gap): `runState.relics`/`.duosOwned`/`.discsBySlot`, installed every fight. Treasure nodes roll real Relic/Disc offers instead of Fragment offers; Duos mix into the normal offer pool once both donors are owned. 10 new generic verbs generalize Phase 7 patterns; 3 new statuses (gravity/charge/mark); new `onCombatTick` hook for periodic Relics/Requiems. Hermit Purple's `economyMods` reads outside the dispatcher entirely.

**Bugs found and fixed:** `applyStatusToNearby`/`damageNearby`'s `from:'target'` read `ctx.target` (real only on `onKill`), not `ctx.defender` (`onHitLanded`/`onHitResolve`) — silently no-op'd, fixed at the verb. Post-merge audit then found 10 Fragments (1 legendary/5 epic/4 rare) magnitude-only across all 3 levels, violating deliverable 3 — each got a real `minLevel`-gated clause. One Requiem (Crazy Diamond) was a numeric bump dressed as a rewrite; gave it a real structural change (zero Persistence cost) instead.

**Deviations flagged:** Discs can't literally swap in another Stand's move (only Star Platinum has one) — scoped to full slot-override, single-level, `special_1`/`special_2`/`rush` only. Requiems have no live selection flow (no Act III/Altar; DO NOT forbids adding one) — content-complete, not run-reachable. Pool counts (52/48 vs. ~60/~55 targets) are honest curation, not padding; absent-system Relic mechanics were reinterpreted as combat-time effects, canon names kept as flavor.

**Verification:** `validate` — 52/8/48/14/20/12/18, zero errors. `assert`/`sweep --runs=500`/harness pass. No duplicate ids across all 6 pools; all 20 Duos have 2 distinct, non-repeating donor pairs. Scripted integration test (offer/take/combat with Relic+Duo+Disc installed) ran with no throw.
