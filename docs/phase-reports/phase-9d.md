# Phase 9d — The remaining roster and Acts

**Goal (GDD §4.6/§5.1/§7, spec §2.2/§9):** 4 Stands, Acts II-IV, 10
bosses, composition over the Phase 6-9b engine. **phase-9c.md doesn't
exist** — a finding, not a blocker; oriented from 9a/9b/10 instead.

**Delivered:** Silver Chariot (mid), Hierophant Green (long), Killer
Queen (mid) — movesets (`moves_<id>.js`, split for the 300-line cap),
each plugging into an *existing* control scheme. A real Stand-select
screen (`standselect.js`) replaces "any click starts as Star Platinum" —
the 3 new Stands were unreachable without it. Bites the Dust (GDD:
"utility, not a damage tool") is a one-shot lethal-save, a new
`STANDS.<id>.innateAbilities` field installed via `installFragment`. 9
more bosses (10 total, `data_bosses.js`): Yuya Fungami, Hol Horse,
N'Doul, DIO, Formaggio, Illuso, Diavolo, Funny
Valentine, Pucci — composition + one signature + 3 phases + purge/parts
each (Illuso/Valentine reuse Phase 9b's `summon` verbatim). Acts II-IV:
generalized `generateAct1Map`→`generateActMap(rng, act)` keyed on
`ACT_CONFIGS`; 1-2 pre-boss Elites per Act wrap a boss def, one true
final boss in the fixed last row; arenas reuse existing geometry, new
palettes only. Fixed 3 hardcoded-to-Act-I bugs this exposed (dead
`SCENE_FOR`, literal "ACT I MORIOH"/"KILLER QUEEN" strings).

**Deviations flagged:** Angelo stays an Elite, not a boss (no Stand in
canon). DIO/King Crimson/Made in Heaven's "stops/erases time" keep a
legal-minimum telegraph — fairness over canon fidelity. No bespoke
sprites for the 3 new Stands/Users (phase-6.md's boss-art gap, same
cause) — a per-Stand tint stands in. Sheer Heart Attack/Emerald Splash
read as reach/single-hit specials, no player-side projectiles exist.

**Verification:** `validate`/`assert` pass; `sweep --runs=2000` — 13
combat/boss targets decisive, 8000 cross-Act map seeds pass fairness.
Control schemes confirmed numerically (orbit/flick/retract, detached
Stand tracking movement, dodge charges), not by hand-clicking the UI.

**Handoff — code-paths across Phase 9:** 9a ~2 (Hound/Warden aggro), 9b
~8 (its own tally), 9d ~6 (Act config, scene wiring, Stand-select/
`combat.js` standId, boss registry, act-progression, innate-ability
install). Two 9d cases *reused* a prior generalization instead of adding
one (summon, tint) — generalizations compound.
