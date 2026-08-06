# Phase 12 — Polish

**Accessibility (GDD §21)**, new appbar row (`settings_panel.js`):
telegraph glyphs already complete (16/16 patterns), colourblind cues
already satisfied by that glyph system. Added: FLASH toggle (`fx.js`'s
`spawn('flash',...)` choke, distinct from shake); reduce-particles;
Ripple Assist as 3 dials (`resolveStepInvulnFrames`/`resolveClashWindow`
in `resolvers.js`; incoming-dmg x0.7 via the same `getDamage` seam
Menace's `enemyDamageMult` uses) — blocks nothing but Menace rank records
(`run_end.js`); Project hold/toggle; full key rebind UI.

**Daily/weekly seeds + leaderboard** (`daily_seed.js`): the seed string IS
the UTC day/ISO week, so `createRng(seed)` alone reproduces the run;
Stand+Aspect+Menace derived deterministically from it, recorded via
`ctx.save` from `finishRun`'s one exit door.
**Telemetry**: no run log existed anywhere (nobody had played the browser
app) — built `scripts/telemetry_sim.js`, 8000 headless runs through the
real `run_flow.js`/`run_choices.js` flow, not a parallel sim. Surfaced and
fixed 3 real bugs: `telemetry.js`'s `recordOffer` and Shop's `buy` action
both assumed every offer was a Fragment (crashed on a Duo, the latter
reachable in real play once a Duo's donors are owned); `run_flow.js`'s
Act-IV boss-clear called `finishRun` without importing it (crashed on
winning the game).

**Balance**: pick rate across all 94 Fragments (offered 30+ times) is
18–37%, none near-zero — pool is healthy, no change made. **GDD §17
curve, measured**: hits-to-kill at 100HP is 7.3/7.0/9.3/6.2 across Acts
I–IV (III/IV samples thin). Bigger finding, from doc reconciliation: boss
HP in `data_bosses.js` (140–240) is 4–20x below §17's table (900–4500) —
flagged per house rule, not fixed (outside this phase's Fragment-only
mandate and "no content changes").

**Doc reconciliation** (delegated): Aspects reauthored during build, not
a gap; tech §5's 5-phase plan became 0–11b in practice; meta-progression
fully implemented; spec §14.1's module list is a responsibility map, not
literal filenames — no contradiction with the layout.
**Self-verify**: `validate`/`assert` pass; `sweep --runs=10000` — all 13
encounters decisive, map constraints hold across 40,000 samples.
**Known gaps, unchanged:** Act variants, 2/3 Heaven Ascension legs still
unreachable (Phase 10/11-B's flagged debt).
