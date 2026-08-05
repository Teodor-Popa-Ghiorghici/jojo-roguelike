# Phase 5 — crowd combat

**Commit:** `629c899` (2026-08-01, "crowd combat (N enemies, attack-token
rule)").

**Goal (GDD §4.1/§4.2/§4.4/§16):** encounters hold N enemies that pressure
the player fairly and legibly, instead of exactly one.

**Delivered:**
- `encounter.js` — waves, spawn scheduling, `WIN_CONDITIONS` registry
  (`killAll` only so far); a legacy solo/boss def is normalized into a
  trivial one-wave encounter (a boss is just an N=1 crowd).
- `encounter_budget.js` — `generateEncounterBudget`, generic composition
  rules (≤2 ranged, ≤1 Caller, ≥1 Clash-able).
- `token.js` — 2 melee token slots + 1 reserved ranged slot; a token is
  held for one full pattern then a 36-72f cooldown.
- `profiles.js` — `aggressor`/`spacer`/`turtle`/`flanker`/`opportunist`/
  `support` as token-usage weights, not bespoke state machines.
- Three enemy types as data: Delinquent (existing, gained `profile`/`cost`/
  `clashable`), Knife Thug (new), Brute (new).
- `hitbox.js`'s `stepMoveHitboxes` signature changed: `defender` → array,
  `spent` becomes a `Map<hitboxIndex, Set<defender>>`.
- Act I wiring: node n3 (generator-composed wave + Brute wave), node n5
  (elite + Delinquent escort).

**Verification:** `headless_harness.js` extended with an `encounter` param,
still byte-identical; headless scripts confirming the token cap holds
across hundreds of frames/seeds; browser session title→n1→n2→n3 with a
debug-overlay screenshot of the token gate live.

**Known gaps:** token cooldown window and the two shipped encounters'
budgets are first-pass numbers, no human playtest for "fun" in this
environment — flagged for a balance pass. Ranged token pool wired but
unexercised (no ranged enemy shipped yet).
