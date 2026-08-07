# Phase 13g — the window closes

**Tested:** mount/unmount lifecycle (fast-close race, 100x loop, two-window
concurrency), save corruption, version migration, storage growth,
ctx/kernel boundary — via Node repro scripts (`save.js`/`combat.js`) and a
Playwright agent for DOM-shaped cases (listener/timer counts, localStorage
dumps across two windows).

**S1 (7):** QA-047 fast-close race left the frame loop + music running
forever · QA-048 permanent `document` keydown listener leaked every mount
· QA-049 unknown Fragment id bricked every future combat entry · QA-050
the app object is a module singleton shared by every window, so no
per-instance mount/unmount state is expressible · QA-052 concurrent
windows silently revert each other's meta/Archive/Fate writes · QA-053 a
future-version save was trusted instead of falling back · QA-054 unknown
Fragment id crashed the map's render loop every frame. **S2 (4):** QA-051
music shares QA-050's root cause · QA-055 resume guard missed
`graph.edges`/`paths` · QA-056 every window leaked two `document`
listeners on close (kernel-wide) · QA-058 telemetry has no cap/rotation.
**S3 (1):** QA-057 `ctx.close()` unmounted twice.

**Fixed (9):** QA-047/048/049/053/054/055/056/057, plus telemetry's
quota-exceeded write (no longer an unhandled rejection). Pre-fix repros
crash/leak, post-fix pass; `validate`/`assert`/`headless_harness`/
`sweep --runs=500` green throughout.

**Not fixed:** QA-050/051/052 — `unmount()` gets no argument identifying
which window closed, so no per-instance cleanup (app state, music engine,
meta clobber-on-save) is correct without an instance token through
`mount`/`unmount`; a shallow on-disk merge doesn't fix QA-052 either,
every top-level key collides. Design changes, not hardening patches.
QA-058's retention policy is a product decision. All four left open.

**Could not reproduce:** nothing — every finding replays from a logged
Node script, localStorage payload, or Playwright sequence. QA-059 is
confirmed-clean: all four `run`-key corruption payloads fail closed,
`meta` untouched. Self-verify: two Node repro scripts diffed pre/post-fix
plus a Playwright loop over 100 mount/unmounts and 25 fast closes,
listener/timer counts back to baseline.

**Next:** QA-050/051/052 need one deliberate decision — per-window
instance tokens, or one-window-per-app-id — not piecemeal patches to
QA-052's symptom. QA-058 needs a retention policy.
