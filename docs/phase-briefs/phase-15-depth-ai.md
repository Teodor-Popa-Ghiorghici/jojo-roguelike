# PHASE 15 — ENEMIES LEARN THE THIRD AXIS. Read this entire prompt before acting.

This phase closes QA-083, the most serious finding of Phase 13: **no
enemy in this game has ever moved in z.** Not one of 28 types, not one
boss, not one AI profile. Only the player has the depth axis. Because
hit resolution is depth-gated, holding one movement key is permanent
invulnerability — measured **0 damage over 90 seconds against 11 of 11
targets, including Killer Queen, DIO and Pucci.**

This is a gameplay phase. It re-balances every encounter in the game. It
is also the phase most likely to break determinism, so read the sim
invariants before you write a line.

## CONTEXT DISCIPLINE

- `CLAUDE.md` and `.claude/rules/sim.md` load automatically. Do not
  re-read them.
- Read ONLY what each stage's READ block names. `docs/qa/bugs.md`
  QA-083 and QA-088 are your specification and already contain every
  measurement — do not re-measure what is measured there.
- Delegate verbose work to subagents: sweep logs, balance runs,
  per-profile behaviour traces, determinism checks. Ask for a verdict
  and a table, never a transcript.
- Never paste file contents back. Cite `path:line`.

## THE INVARIANTS YOU CAN BREAK BY ACCIDENT HERE

1. **Determinism (invariant 1).** Same seed → byte-identical output. Any
   randomness in the new movement goes through `rng.js`'s seeded,
   stream-separated generators. Never `Math.random()`. Run
   `npm run determinism` after every stage.
2. **Frames, not ms (invariant 2).** All new timers are frame counts at
   `SIM_HZ`.
3. **Resolver choke points (invariant 5).** Every new derived number —
   depth-approach speed, strafe rate, preferred z, flank threshold —
   gets exactly one choke point in `resolvers.js`. No inline arithmetic
   on a stat at the call site.
4. **Content is data (invariant 6).** Per-enemy depth behaviour is a
   field on the enemy/profile entry, resolved through the existing verb
   vocabulary — never an `if (enemy.id === 'shielder')` in the engine.
5. **The sim knows nothing about pixels (invariant 4).** z is a world
   unit. Projection stays in `render_adapter.js`/`render.js`.

## HARD SCOPE FENCE

**Do not clamp or shrink the player's z range as a shortcut.** 40…220 is
180 units of design space and Phase 14 is authoring ground art against
exactly that range. Making the exploit unreachable by deleting the axis
is not a fix, it is a retreat, and it silently invalidates Phase 14's
work. If you believe the range genuinely must change, stop and ask.

**Do not touch the render layer.** Telegraphs already read `enemy.z`
correctly (Phase 13i's `telegraph_geom.js`), so they follow enemies into
depth for free. If a telegraph looks wrong once enemies move, that is a
finding to log, not a licence to edit art.

---

## STAGE 0 — THE BEHAVIOUR TABLE, BEFORE ANY CODE

READ: `profiles.js:18-25,40-57` · `ai.js:226-271` ·
`combat_enemy.js:65-66,85-97,124-143` · `data_enemies.js` ·
`data_bosses.js` · `docs/qa/bugs.md` QA-083 · GDD §4 and §15

All six profiles (aggressor, spacer, turtle, flanker, opportunist,
support) currently only weight attack-token eligibility. None has
movement logic of any kind.

Write me a table — one row per profile — proposing what that profile
*does* with depth, and hand it to me before implementing. My starting
intuitions, argue with them if you disagree:

- **aggressor** closes z as well as x — it should be able to reach you.
- **spacer** holds x distance but matches z, so its ranged lane
  (`±10`, the narrowest in the game) can actually connect.
- **turtle** mostly holds its line; that is the point of a turtle.
- **flanker** actively seeks a z offset. Note `profiles.js:50` already
  grants a `flankBonus` at `|Δz| > 20` — **dead logic today**, because
  the enemy can never create that condition. This profile is the one
  that most obviously wants the axis.
- **opportunist / support** — you propose.

Also decide and tell me: do ranged attacks track in z? Today `pr.z` is
fixed at spawn (`combat_enemy.js:118`) and homing only flips x
(`:128`) — so a projectile can never follow you in depth. Leading the
player's depth is a real difficulty lever; converging on it exactly may
be too strong.

---

## STAGE 1 — THE MOVEMENT PRIMITIVE

READ: `combat_enemy.js:60-100` · `arena_bounds.js:20-22` ·
`stand_classes.js:26-38` (how the player's z movement works) ·
`resolvers.js` · `constants.js:24`

Give enemies a z movement primitive that mirrors the player's, resolved
through `resolvers.js`. Two things to get right:

- **There is no z clamp on the enemy side today.** `combat_enemy.js:66`
  clamps x only. Add the `ARENA_Z_MIN`/`ARENA_Z_MAX` clamp, or enemies
  will walk out of the arena the moment they can move in depth.
- **Knockback integrates x only** (`:65`). Decide whether knockback
  should have a z component and say so explicitly.

Speed matters: the player moves 2.87 world units per frame
(`constants.js:24`, 172/60). An enemy that matches that exactly is
inescapable; one far slower is still campable. This is a tuning number
and it belongs in a resolver.

DONE WHEN: one enemy type provably tracks the player in z, determinism
holds, and nothing else has moved.

---

## STAGE 2 — PER-PROFILE BEHAVIOUR

Implement the Stage 0 table as **data on the profile/enemy entry**, not
branches in the engine. Every one of the 28 types and bosses must have a
defined depth behaviour — including bosses, which today all spawn at
z=130 exactly and never leave it.

Fix these two while you are here, both consequences of the same root
cause and both already measured:

- **Shielder's designed counterplay is a 2-unit window.**
  `data_enemies.js:106` says it "must be flanked (z-offset) or
  poise-broken." `resolvers.js:162-165` zeroes damage at `|Δz| <= 20`
  while the melee hitbox stops overlapping past `|Δz| > 22` — so the
  flank lands only in `Δz ∈ (20, 22]`, a 2-unit band the player crosses
  in a single frame. Widen the window so the stated counterplay is real.
- **`flankBonus` becomes live logic** the moment flankers can move.
  Check its magnitude is still sane when it can actually fire.

---

## STAGE 3 — SPAWN VARIETY

READ: `encounter.js:30,46-48` · `summons.js:61` · `affixes.js:116`

`SPAWN_Z_OFFSETS = [0,-26,26,-13,13]` gives crowds five discrete depth
lines, but **every boss and every solo/elite node is spawn index 0**, so
a 1v1 has no depth variation whatsoever. Summons and clones inherit
their parent's z verbatim, so a mirrored Angelo spawns exactly on top of
its original.

Give solo fights and bosses a reason to use the axis, and give summons a
depth spread.

---

## STAGE 4 — REBALANCE, AND PROVE THE EXPLOIT IS DEAD

This is the acceptance gate for the whole phase.

- **Write the regression test first**: the QA-083 repro — hold `back` to
  z=220, stand still, 5400 frames — must no longer yield 0 damage,
  against every enemy type and every boss. Add it as a re-runnable
  `apps/standbattle/scripts/qa_*.js` and wire it into `npm run assert`,
  the way 13i wired the telegraph geometry check. A fix without a
  regression test will be re-broken.
- **Then re-validate balance.** `npm run assert`'s encounter composition
  (500 trials) and the telegraph fairness floor both encode assumptions
  about how reachable enemies are. `npm run sweep -- --runs=N` over a
  large N is the real signal — win rates will move, and I want the
  before/after numbers, not a reassurance.
- Encounters that were tuned around an unreachable player may now be
  brutal. Report what moved; do not quietly re-tune damage to hide it.

---

## STAGE 5 — THE TWO DESIGN QUESTIONS I OWE AN ANSWER ON

Bring these back to me with a recommendation once the axis works — they
are cheap to decide once, expensive to decide twice:

1. **QA-088 — should slam-type melee be genuinely radial?** Phase 13i
   fixed the telegraph that *lied* about this (it drew a circle for a
   forward box). Making the hitbox itself radial affects all six chevron
   patterns and is the natural counter to depth-camping — which is why
   it belongs to this phase, not the last one.
2. **Inverted depth controls.** `forward` (`W`/`ArrowUp`) is `dz -= 1`
   (`stand_classes.js:30`), and `zToYOffset` maps lower z to a *larger*
   screen y — so **Up moves the character down the screen.** Inverted
   against the beat-'em-up convention, and it is what makes the
   walking-in-the-wall symptom reachable by pressing Down. Flipping it
   is a one-line change with a large feel consequence.

---

## FINISH BY

`docs/phase-reports/phase-15.md`, 40 lines max: the behaviour table as
built, what the regression test asserts, the before/after balance
numbers, what got harder, and what still can't use the axis.

Every defect found on the way goes in `docs/qa/bugs.md` in the existing
format with a seed and a frame number, same as Phase 13. A finding
without a repro is a rumour.
