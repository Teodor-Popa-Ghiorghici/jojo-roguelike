# Phase 13c — spatial edge cases

**Goal:** every reachable position must also be leaveable — corners,
tether vs. bounds, Pinned, knockback, z-axis, hazards, Long-Range
retreat, projectiles — driven deliberately, not left to random fuzz.

**Built:** a `spatial` profile for `scripts/fuzz.js` (`--profile=spatial`)
— 5 scripted scenarios (corner+Project hold/release x Close/Mid,
corner+knockback+Clash, z-axis slam, Long-Range retreat-into-corner)
cycled by run index, reusing the existing invariant monitor. `--runs=1000`:
436/1000 fail, all 3 shapes below, zero new classes; Close-Range
corner+Project and pure z-axis are 100% clean. 9 replays under
`docs/qa/replays/` (README covers a `tailFrames` caveat on the
in-progress snapshots).

**Found, by severity:**
- **S1: 0.** No crash, no true softlock, no new OOB shape, no corruption.
- QA-005 (S2, new) — Long-Range retreat AI has no z-awareness; enemies
  never move in z after spawn; it reliably parks the User at a z-extreme
  melee can't reach. Reproduced through the shipped Pinned encounter
  (`shopping_street_pinned`): zero damage for its whole 2400f window.
- QA-006 (S2, new) — Mid-Range's flicked Stand freezes with no per-frame
  clamp; Mid never roots the User, so held movement outraces the generic
  Strain drag, growing the tether well past Close's 1.4x-equivalent for
  the whole flick. Long-Range shows the same gap in its base case. Same
  seam as QA-001.
- QA-007 (S2, new) — z-parking (any scheme, no AI needed) causes a mutual
  melee whiff stalemate; not a true softlock (self-resolved by moving
  back) — 13l should judge if it's worth acting on.
- #1/#2/#4 clean for Close-Range at all 4 corners. #3 moot (no collision
  system, per `fighter.js`, so no body can wall off the player). #6:
  Cairo/Naples "moving floor"/"terraces" aren't implemented as position
  mechanics (`hazardSet` is a documented, unwired gap); only the static
  damage-zone exists. #8: self-capping via life/x-OOB removal, by
  inspection.

**Fixed:** nothing — zero S1s. **Could not reproduce:** QA-006's
ARENA-unclamped flick position is confirmed by inspection but a
natural-play OOB repro needs a timing window this phase didn't hit — said
explicitly rather than claimed found.

**Next:** QA-001/005/006 are one "Strain vs. clamp-ordering" family in
`combat_stand.js`/`stand_classes.js` — batch them in 13l. QA-007 may not
need a fix at all. `npm run validate`/`assert` both clean.
