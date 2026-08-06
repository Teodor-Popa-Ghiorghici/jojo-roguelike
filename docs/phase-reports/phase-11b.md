# Phase 11-B — Rule Fights, Boss Reprises, Act variants, the Stalker, endgame

**Delivered:** Flee mechanism first (closes 11-A's gap): `combat.outcome =
'fled'` on an `Escape` key, gated per-encounter by `def.fleeable`, forfeits
reward via `commitNode`. **8 Rule Fights** (cut from 12, the authorized
floor — Geb/Man in the Mirror/Highway Star/Death 13 need render-layer or
User/Stand-duality work past this budget): Sheer Heart Attack, Illuso's
Mirror, Formaggio's Shrink, Baby Face, Yellow Temperance, Rolling Stones,
Bites the Dust, Cheap Trick — each one more `objective` id
(`rule_fights.js`/`rule_fights_2.js`, ~34 lines/fight), registered on
`combat.dispatcher` from `onStart` (bespoke by design, not EFFECT_LIB
verbs, GDD §4.5). None needed a one-off field: Cheap Trick's Doom rides
resolvers.js's existing unconditional-status choke point (Frozen's
precedent); Formaggio's Shrink found and closed a real gap (dodge distance
wasn't resolver-routed). **Boss Reprises**: `boss_reprise.js`'s
`deriveReprise` generates all 30 (3×10) from one transform —
`recoveryMult` (composes with Menace's own) for timing, an appended
pattern for "extra module", Phase 11-A's Hazard objective reused whole for
"swapped hazard" — mixed into every Act's elite pool. **Act variants**:
`act_variants.js`, real data + a pure `applyActVariant`, unconsumed by
map_gen.js (flagged, same shape as Requiems). **The Stalker**:
Menace-scaled roll on Act 2+ combat nodes substitutes `the_stalker`,
`fleeable`+`bestLoot` routing the guaranteed-Rare+ reward. **Endgame**:
`endgame.js`'s 3 superbosses reuse `deriveReprise`'s shape (Kars is a
genuine new def); `heavenAscensionConditions` is real and callable (Act IV
+ Menace floor + a tracked cleared Rule Fight, `runState.ruleFightsCleared`),
its Requiem leg a documented permanent `false` (no ownership flow exists).

**Split for the cap:** `run_flow.js` → `run_flow_combat_end.js`;
`encounter_objectives.js` now also folds in both rule-fight files.

**Verification:** `validate`/`assert`/`sweep --runs=3000` pass unchanged.
Headless: all 8 Rule Fights, 30 Reprises, the Stalker, 3 superbosses run
without throwing; scripts confirmed SHA exposure, Mirror's layer gate,
Bites the Dust's mid-frame revive off the real death path, Doom
stacking/decay, and the flee key's per-encounter gating.

**Known gaps:** Act variants and 2 of 3 Heaven Ascension legs are
content-complete but not run-reachable (no Archive/hub entry point yet) —
the same accepted shape Phase 10 left Requiems in, not new debt.
