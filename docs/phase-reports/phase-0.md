# Phase 0 — unblock

**Commits:** `ddcddc6` (2026-07-31, seeded RNG/save/constants/input),
`e86fd42` (2026-07-31, dodge/input-buffer/arena-bounds fixes).

**Goal (build plan):** fix audit items 1, 2, 3, 13 — Step charges, input
buffer, dead code, shared arena constants. Small, unblocks Phase 1.

**Delivered:**
- `rng.js` — seeded xorshift128 PRNG with named sub-streams.
- `save.js` — the `ctx.save`/`ctx.load` choke point, versioned blobs.
- `constants.js` / `arena_bounds.js` — arena bounds centralized, shared by
  sim (`combat.js`) and camera (`render.js`).
- `input.js` — rebindable keymap, edge- vs held-triggered action
  classification.
- Dodge (Step) made edge-triggered and gated by a 2-charge meter, closing
  the "hold Space for ~77% invulnerability" exploit.
- 9-frame input buffer so queued actions fire on return to idle instead of
  being dropped.

**Verification:** unknown — no test/verification note found in the commit
message or CLAUDE.md for this phase specifically; later phases reference
`headless_harness.js` determinism, which did not exist yet at Phase 0.

**Known gaps:** none recorded.
