# Phase 6 — the first boss

**Commit:** `895ab5a` (2026-08-01, "Killer Queen's 3-phase boss fight").

**Goal (GDD §4.6/§18B, spec §9):** Killer Queen goes from a 2-phase
pattern-reading fight to the full 3-phase structure — module composition +
exactly one bespoke signature + a phase 3 resolving onto the User/Stand
duality. No boss-specific engine branch.

**Delivered:**
- `data.js`'s `BOSS_KILLER_QUEEN` — 3 phases (hpAbove 0.66/0.33/0), each
  with its own `transitionLine`. Phase 2 debuts `sheer_heart_attack`
  (bespoke signature) + a hazard rule; phase 3 exposes Kira.
- `boss_parts.js` — generic exposed-part mechanism (`parts` array on any
  enemy def); Kira sits `dz: 56` behind Killer Queen, beyond melee depth
  tolerance, ×3 damage via `ctx.partMult` in `resolvers.js`.
- `purge.js` — generic `def.purgeAtHpFrac` beat; clears statuses and sets
  `statusImmuneFrames` for 6s, reuses `fighter.js`'s `.tint` for the visual
  cue.
- `hazards.js` — generic `pattern.hazard` field; a homing projectile that
  times out detonates into a lingering damage zone, swept every frame.
- New EVENT hooks: `onPurge`, `onPartExposed`. `fx.js` split into
  `fx_wire.js` to stay under the 300-line cap.

**Verification:** scripted headless fight confirming all 3 phase
transitions, the purge beat firing exactly once, the part reveal, and a
bot landing part-multiplied hits; direct unit checks of `hazards.js` and
`status.js`'s immunity gate; `headless_harness.js` default fight still
byte-identical (no-op for fights that don't opt in); browser screenshots of
phase pips, transition banner, HUD callouts, Defend Mode tint.

**Known gaps:** Kira has no sprite of his own — legible only through HUD
callout and world-space reticle.
