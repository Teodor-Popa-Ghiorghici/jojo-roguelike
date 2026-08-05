/* Requiems — GDD §6.2, tech §3's schema (extended: Requiems reuse the
   Duo `requires:[{donor}]` shape, 1 entry for a single-donor Requiem, 2
   for a cross-donor one). 12 curated: one per donor (8) + 4 cross-donor.

   Rule rewrites, not numeric upgrades (mission deliverable 5) -- every
   entry's `effects`/`queries` must change what a mechanic DOES, never
   just scale an existing number.

   FLAGGED GAP (content-complete, not run-reachable): GDD's "Once per run,
   at the Act III Requiem Altar" has nowhere to fire from -- this game has
   no Act II/III yet (CLAUDE.md: "a 6-node Act 1 (Morioh) map"), and the
   mission's own DO NOT list forbids adding acts. content_registry.js's
   installRequiem is real and validated content installs cleanly, but
   nothing in run_flow.js ever calls it yet. Whichever phase adds Act III
   gets a real Altar to build on top of instead of inventing one blind. */

export const REQUIEMS = [];
