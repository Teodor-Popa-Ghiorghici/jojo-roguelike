# Phase 11 — Meta (briefed as "Phase 10")

**NUMBERING CONFLICT, flagged not silently resolved.** The brief called this
Phase 10 and told me to write `phase-10.md`. That file already exists and
documents a *different* phase — the item system (52 Fragments/48 Relics/14
Discs/20 Duos/12 Requiems). Overwriting it would have destroyed real history,
so this is `phase-11.md`. **Known debt:** source comments added by this phase
say "Phase 10", colliding with the item phase's own "Phase 10" comments; I did
not mass-rename them because the two are not mechanically distinguishable and
the risk outweighed the tidiness. Next phase should settle the numbering.

**Goal (spec §7, GDD §8.3/§9/§10.2/§19/§20):** two structurally separate meta
systems, the Fate economy, 16 Aspects, ~120 Missions, Bonds, and the hub.

**The firewall (deliverable 1), designed first, enforced four ways.** Each
track's apply path is a pure function whose *return type cannot express the
other's effect*. `meta_archive.js: applyArchiveUnlocks(meta) -> Unlocks`
returns eight frozen `Set<string>` — no numeric channel out of the module
exists. `meta_menace.js: createMenaceProfile(pact) -> MenaceProfile` returns a
frozen closed struct keyed by `MENACE_PROFILE_KEYS` — no content id, and
deliberately **no windup/telegraph key**. `meta_check.js`, run by
`validate`/`assert`: (1) closed `ARCHIVE_GRANT_KINDS`; (2) a walker failing the
build on any number in a node outside `cost`/`tier`; (3) a source scan of the
Archive apply path for the stat pipeline; (4) the reverse scan over Track B.
Layer 3 was proven non-vacuous by injecting an `addModifier` call — it failed
with the right message and passed again on revert.

**Delivered.** Fate exactly per §19 (15/30/50/70, win 120, ×(1+0.06·rank));
34-node tree totalling **4,295** Fate, 16 in tier 1. Grants Stands 5–8, 12
Aspects, 6 donors (**+42 Fragments: pool 52→94, donors 8→14**, last at tier 3),
node types, act variants, hub content. 16 Aspects (4×4) as pure effect/query
entries installed via `installFragment` — the seam Phase 9d's `innateAbilities`
proved; **zero Aspect code paths**. 14 Menace conditions, ranks 0–30, per
Stand, off by default. 121 Missions in six batches, tracked through `hooks.js`'s
read-only `bus.on` with **no new sim instrumentation** — this wired the four
dead hooks `onRunStart`/`onFloorStart`/`onNodeClear`/`onRunEnd`. 72 Bond beats
+ 8 Keepsakes (Relics, `risk`-tagged, real tradeoffs). Both run terminators now
settle through one `run_end.js: settleRun()` onto one TO BE CONTINUED screen.
Hub with 7 stations including a real Training Room sandbox.

**Findings.** `resolvePatternFrames` was a choke point with **zero callers** —
`ai.js` read `PATTERNS` directly, so the comment promising Menace "exactly one
place to apply" was not on the path. Routed through it; Sharpened Instinct
reaches `recoverFrames` only. 8 new generic verbs (`aspect_effect_lib.js`),
none naming content.

**Deviations.** GDD §8.3 says a new highest Menace Rank grants "an Archive
unlock"; spec §7 and GDD §9.2 forbid Track B unlocking anything — spec wins,
rank clears pay **Fate + a title**. Stands 5–8 reuse an existing moveset family
(stats/innate/tint differ) — Phase 9d's flagged art gap, same cause.
**`MISSION_COMPLETIONS_PER_RUN = 3` is mine, not the GDD's**: a 40-run
simulation showed the fundamentals missions all satisfying at once, paying ~400
Fate on run 1 and buying 13/34 nodes in two runs, against §19's "every 1–2
runs". Capping completions (not payouts) keeps each mission worth its stated
40–150. Act variants are unlockable but their alternate layouts do not exist.

**Verification.** `validate`: 94 fragments/14 donors/56 relics/121 missions/
tree/Aspects/firewall — zero errors. `assert`: 6 groups pass, including the new
**telegraph floor at Menace 30** (exhaustive over the only condition reaching a
frame count + 20,000 sampled rank-30 pacts through the real resolver; worst
telegraph unchanged at 283 ms). `sweep --runs=2000`: 13 combat targets
decisive, 8,000 map seeds pass — identical to 9d, no regression. Required
greps: **zero hits both directions**. Hub smoke: 8 scenes × 2 save states,
21,120 clicks, no throw, **no `fill`/`stroke`/`rotate`**. **Hub spawn → run
start: 1 click, 5.9 ms** (budget 8 s). Pacing: 51 Fate/run avg (target ~60),
15/40 runs unlock something. All files under the 300-line cap.

**Handoff.** ~8 new code-paths (menace threading, aspect install, mission
tracker, run-end settle, hub dispatch, donor gating, pattern-frame routing,
armor flag) against ~380 new content rows. Files split for the cap:
`run_choices.js`, `aspect_effect_lib.js`. Not built per brief: Rule Fights,
Reprises, act-variant content, superbosses.
