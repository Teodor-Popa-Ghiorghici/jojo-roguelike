# Phase 7 — Fragments, and the gate

**Commit:** `dff1b69` (2026-08-01, "Fragments, the boon system, and the
gate").

**Goal (GDD §6.1/§6.7/§6.8, tech §3/§5 Phase 2 gate):** the real boon
system — 9 slots, 3-choice offer flow with overwrite-as-commitment, exactly
12 Fragments across exactly 3 donors, pity/starvation/convergence offer
weighting, 3 levels per Fragment — then the mandatory stop-and-play gate.
Retires Phase 3's placeholder `RUN_BUFFS`.

**Delivered:**
- `fragments.js` — 12 entries as pure data (schema: `id, donor, slot,
  rarity, tags, tradeoff?, levelDesc[3], effects[], queries[]`). Purple
  Haze (Virus), The World (Time — new `combat.timeStopFrames` primitive,
  first real Frozen consumer), Sticky Fingers (Mobility+Break — new
  `armorStripped` flag, Live Wire hooks `onTetherStrain`).
- `effect_lib.js`'s `VERB_CATEGORIES`/`QUERY_VERB_CATEGORIES` — GDD §6.7
  "not purely additive" is a real validator check, not authored judgement.
- `content_registry.js` gained `queries[]` validation, `assertContentValid`,
  `installFragment` (installs only owned Fragments' clauses at their
  level).
- `fragment_offers.js` — `generateOffer` with pity (nodesSinceRare ≥4
  forces Rare+), slot starvation (≥6 unfilled offers triples weight),
  convergence (+25%/shared tag, capped at 3 tags).
- `rewards.js` — `drawReward`/`drawBuildSummary` UI; `index.js` gained a
  `'reward'` scene as the single offer/pick code path.

**Verification:** `fragment_check.js` proves §6.7 compliance and
pity/starvation/convergence numerically over the real pool;
`headless_harness.js` still byte-identical; a real browser session played
multiple full Act-1 attempts.

**THE GATE:** answered, not skipped — core loop judged fun, Project stays a
live decision, no unreactable death found in sweeps/sessions.
**Recommendation: proceed.** Noted weak point: Sticky Fingers' kit
under-rewards a naive playstyle relative to Purple Haze's (tuning note, not
a gate failure).
