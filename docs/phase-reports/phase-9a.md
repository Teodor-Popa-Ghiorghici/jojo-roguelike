# Phase 9a — Mid-Range and Long-Range

**Commit:** `73ab8a4` (2026-08-05, "Phase 9a: Mid-Range and Long-Range").

**Goal (GDD §3.4/§4.2):** two more Stand Class control schemes on the
Phase-4 engine, plus enemy types 7 (Hound)/12 (Warden), the counterplay
Long-Range can't be tuned without.

**Delivered:**
- `stand_classes.js`'s `CONTROL_SCHEMES` table (`close`/`mid`/`long`):
  `dodgeChargeMax`/`damageMult` + `updateStandPosition`/`stepUser`, keyed by
  a new `STANDS.controlScheme` field. A 4th class is one table entry,
  nothing else reopens. Close's logic moved here unchanged, byte-identical.
- Mid: wider orbit; `project` read as an edge, flicks to tether length for
  2.5s then auto-retracts; User never rooted, 1 Step charge.
- Long: movement drives the Stand; User is AI (retreat, or a one-shot
  "regroup at Stand" order on new key `command`/KeyC); 1 Step charge; −35%
  damage baseline, both in `resolveDamage` (still the one choke point).
  `player.standDetached` (generic: Close=`projecting`, Mid=`flicked`,
  Long=always) drives Warden's hook and `arena.js`'s tether line.
- Hound: `ignoresToken` + `userTargetWeightMult` generalize `resolveTarget`'s
  aggro split (absent-field enemies unchanged). Warden: `detachedStandPunishMult`
  gated on `standDetached`. Both reuse existing patterns, no new content path.

**Deviations flagged (GDD left these open):** orbit radius/flick reach are
class constants, no settable UI yet; Long's Step count/retreat speed/command
semantics are judgment calls.

**Verification:** `validate`/`assert` pass, harness byte-identical; scratch
checks confirmed Mid's flick/retract, Long's axes-to-Stand/retreat/command
AI, Hound's token-bypass, Warden's 1.7x gated correctly, Long's exact 0.65.

**The honest kiting question:** degenerates, not as asked. A "poke when safe"
policy *loses* every trial (7-9 hits, dead ~13s) with or without a Hound —
melee-reach content forces the Stand into danger. But **never attacking**
(Stand idle, User pure retreat-AI) took zero hits over 100s, Hound included,
vs. ~15s for a stationary Close-Range player. Real failure: stalemate, not
ranged safety — naive direct-chase AI can't corner an instant-turn evader in
the tether+arena bounds if it never engages. Fix: real interception for
Hound/Warden or tighter retreat/tether math, not a global nerf.
