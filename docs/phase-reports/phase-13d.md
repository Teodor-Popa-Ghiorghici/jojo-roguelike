# Phase 13d — how smart, and where stuck

**Built:** 5 read-only QA scripts — `qa_ai_probe`(+`_content`, tokens +
synthetic waves reaching the 13 unreferenced enemy types), `qa_ai_profiles`,
`qa_ai_pathing`, `qa_ai_interrupts`, `qa_rule_fights`.

**Tokens** (shipped crowds, idle, 24 runs, 82,929f, post-fix): mean hold
**56.5f**, mean gap **55.4f**, longest gap with NO token held **68f**,
longest with nobody in windup/active **196f** (fight opening). The gap
tracks the authored 36–72f cooldown — design, not starvation. Pre-fix:
33.5f / 60.0f / 82f.

**S1 — both FIXED. QA-008:** the attack-token gate never gated anything.
`combat_enemy.js` built it with `||` over an absent def field → `undefined`,
which `ai.js`'s `canCommit === false` waved through: **376 of 381 commits
(98.7%) had no token.** GDD §16, Phase 5's headline deliverable, inert since
it shipped — it survived 13a–13c because `fuzz.js` drives only solo fights,
where the gate's value never matters. **QA-009:** a holder in a state
`stepEnemyAI` can't advance (`flee`) keeps its slot forever; two fleeing
enemies stall the melee pool (3379f, deadlocked at the cap) — latent in
shipped content, and *masked* by QA-008.

**S2 (13).** QA-012 Hound prefers the User 98.6%/96.2% close/mid but **1.0%
on Long-Range**, Warden lands **0 hits** on it — the counterplay pair fails
on the one class it exists for; QA-018 **78% of the depth axis is a
permanent safe lane** (72 corner runs = 2,585 attacks, 0 damage); QA-010
13/18 enemy types spawn in no encounter, which is why nobody found QA-012.
Also QA-011/013/016/017/021/022/023/024/025/026 — see `bugs.md`.

**S3 (6):** QA-014 (4 of 6 profiles are just a scalar; `turtle` never
blocks, `spacer` never yields at bad range; only `opportunist` delivers,
32.8% vs 23.7% baseline), QA-015 (no aggro hysteresis, none needed — nothing
ever chases the Stand), QA-019/020/027/028.

**Clean:** all 10 bosses walk `[0,1,2]`, no skip/repeat, correct
patterns/invuln even when one hit crosses every threshold; Rule Fights fail
cleanly (passive→lose 24/24, violation→terminal 22/24); validate/assert/
determinism/`sweep --runs=4000` pass; **`fuzz --runs=2000 --profile=idle`
clean**; 240/240 shipped crowds still resolve vs a passive player.

**Not tested — not "clean"** (`bugs.md` tail): wall-press/oscillation/
no-commit are unreachable under an idle player, so 0/198 is not evidence;
"each arena" is one global rect; Crowded's `TOKEN_MELEE_COUNT` is
unimplemented; the Rule Fight win/lose grid is **not** cited (driver partly
rebuilt, weaker) — only policy-independent ceilings are.

**Next:** QA-008 drops crowd attack volume ~80% — every Phase 5/9b encounter
budget is now unverified, re-tune first. QA-005/007/012/017/018 are one "no
z-axis, no interception" family; QA-001/016/024/028 one frame-ordering
family. Batch each.
