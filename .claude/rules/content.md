---
description: Stand Battle Arena content/data rules (Fragments, Relics, enemy/encounter data)
globs: apps/standbattle/fragments.js, apps/standbattle/fragment_offers.js, apps/standbattle/content_registry.js, apps/standbattle/effect_lib.js, apps/standbattle/data.js, apps/standbattle/moves.js
---

# Content rules

Content is data, never a new code path. A new Fragment/Relic/enemy is an
entry in a data file (`fragments.js`, `data.js`) referencing verbs already
in `effect_lib.js`'s `EFFECT_LIB`/`QUERY_LIB` — it never adds an `if` to the
engine. If a Fragment idea needs a verb that doesn't exist yet, that's a
generic engine primitive to add to `effect_lib.js`, available to every
future Fragment, not a one-off branch for this one.

## GDD §6.7 — the synergy rule

No Fragment may be purely additive (pure damage/crit number bumps with no
other clause). Every Fragment's clauses must union with at least one of:
apply / amplify / consume / convert a status; convert a resource; rewrite a
slot's behaviour; change the economy. `effect_lib.js`'s
`VERB_CATEGORIES`/`QUERY_VERB_CATEGORIES` classify every verb by which of
these it can satisfy; `content_registry.js`'s `validateEntry` enforces it.
A Relic (or Fragment) tagged `'risk'` must also carry a non-null
`tradeoff` string.

## Schemas

The authoritative schema for Fragment/Relic/donor entries is
`docs/stand-battle-arena-tech.md` §3. Magnitude-per-level is an array on
the relevant field (`stacks: [1,2,3]`); a whole new clause at a higher
level is a separate effect/query entry with `minLevel`, never a bespoke
per-Fragment branch.

## Before reporting done

Run `npm run validate` — it must pass with zero errors before any content
change is considered finished.
