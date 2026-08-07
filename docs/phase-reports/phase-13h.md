# Phase 13h — can the player always get out of a screen?

**Tested:** static trace of every scene transition + rebind surface (a
single `state.scene` FSM means no two scenes are ever simultaneously
live, resolving matrix 1/2/5/6 mostly by reading, not clicking); Node
unit repros against real content/module state for degenerate-offer/
rebinding scenarios (matrix 3/5); a new `qa_string_overflow.js` over
every content registry (matrix 7); a timed core-path repro for hub
latency (matrix 8); `sim_loop.js`/`index.js`'s dt-clamp for the catch-up
guard (matrix 6). A Playwright harness (chromium-1194 via `server.js`)
was confirmed working but no finding needed it once the `input.js` unit
repro (QA-062) reproduced the mechanism directly.

**Screen graph:** `title`->`hub`->{6 stations, all BACK/`Escape`->`hub`},
or LAUNCH->`map`. `training`->`combat`(training). `map`->{`event`,
`rest`,`shop`,`treasure`(`reward`),`archive`,`combat`}, each committing
back to `map` (or `reward` first). `combat`(settled)->`map`/`training`/
`continued`. `continued`-click anywhere->`hub`. Every scene has >=1
outbound edge post-fix; `rest` did not, pre-fix (QA-060, S1).

**S1 (2, fixed):** QA-060 Rest could reach all-three-choices-disabled
(full HP, 0 upgrade points/no eligible slot, Tension 5) with no LEAVE —
a true screen trap; fixed with an always-enabled LEAVE (`rest.js`/
`index.js`), mirroring `shop.js`. QA-061 an empty Fragment offer (pool
owned-and-maxed, documented in `fragment_offers.js`) or empty Treasure
offer (every Relic+Disc owned) routed to `'reward'` with zero cards and
no clickable index — same trap; fixed by short-circuiting
`enterReward`/`enterTreasureReward` (`run_flow.js`) to `commitNode` when
the offer is empty.

**S2 (2, logged only):** QA-062 held-key state has no blur/
visibilitychange release path (`input.js` has no releaseAll, `index.js`
no blur listener) — self-correcting on the next keypress, never blocks a
scene. QA-063 REBIND KEYS can unbind an action (incl. `flee`) to zero
keys unwarned — loses the free early-exit on Stalker/Survive fights but
never blocks winning/losing them.

**S3 (1, logged only):** QA-064 21/682 checked strings overflow their
`rowList` panel budget (Archive/Menace/Training rows) — visual overlap
only, hit-rects unaffected, no exit blocked.

**None found (2):** QA-065 rebind-cancel-onto-confirm softlock can't
exist here — every non-combat exit reads raw `ev.code`, bypassing
`input.resolveKey`; the one rebindable exit (`flee`) is optional. QA-066
`sim_loop.js`'s `MAX_FRAMES_PER_ADVANCE=8` + `index.js`'s
`Math.min(50,dt)` already guard the catch-up spiral; hub-spawn core path
measured ~3ms, nowhere near the 8s budget.

**Fixed:** QA-060, QA-061. **Not fixed (13l):** QA-062/063/064, each
needs a capability addition (blur hook, rebind guard, panel width/
truncation), not a same-behavior patch. **Could not reproduce:** nothing
above lacks a deterministic repro.

**Tools:** `node apps/standbattle/scripts/qa_string_overflow.js` (new,
re-runnable, exits 1 on overflow). `validate`/`assert`/
`headless_harness.js` all green pre- and post-fix.
