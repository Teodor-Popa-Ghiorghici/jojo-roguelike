# Phase 4 — User and Stand

**Commit:** `d57e6a3` (2026-08-01, "the Stand as a real second entity
(User/Stand duality)").

**Goal (GDD §3.1-3.4):** the Stand becomes a real second entity sharing the
User's one HP pool, connected by a leash — the core mechanic everything
before this phase was scaffolding for.

**Delivered:**
- `fighter.js`'s `createStandFighter(owner)` — Stand entity, no Health
  component, linked via `standLink`. `combat.entities` becomes
  `[player, stand, enemy]`.
- `combat_stand.js` — Close-Range anchoring vs. Project (held), tether
  Strain check, aggro-weighted target picker, `applyFeedbackDamage`/
  `staggerStand`.
- `resolvers.js` gained `resolveTetherLength`/`resolveFeedbackRate`,
  wrapping Phase 3's dormant tether/feedback stats; `resolveDamage` gained
  the Strain damage penalty.
- Damage routing: player hitboxes now originate from the Stand's transform,
  not the User's. `combat_defense.js`'s `resolveIncomingAttack` routes a
  Stand hit straight through feedback, skipping Step/Guard/Clash entirely.
- `input.js` adds `project` (KeyF, held); Step denied while projecting,
  movement rooted.
- New hooks: `onProjectStart`/`onProjectEnd`, `onTetherStrain`,
  `onFeedbackDamage`.
- HUD: tether fill bar, `FEEDBACK NN%`, pulsing `STRAIN` label; `arena.js`'s
  `tetherLine`.

**Verification:** `headless_harness.js` byte-identical; scripted headless
scenarios for Project/Strain/snap-back/Step-denial/feedback-routing/
Stand-stagger; a real browser session via a minimal mount harness.

**Known gaps:** `pose_player.js` has no dedicated Project pose — legible
only through HUD/tetherLine, not the Stand sprite itself.
