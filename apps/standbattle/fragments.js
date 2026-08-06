/* Fragments — GDD §6.1/§6.7, tech §3's schema. Phase 10 splits the pool
   into one file per donor (content/fragments/<donor>.js, ~7-8 entries
   each) since a single 300-line file can't hold 8 donors x ~7.5
   Fragments; this file is only the aggregator so every existing importer
   (combat.js, shop.js, rewards.js, fragment_offers.js, fragment_check.js,
   scripts/validate.js) keeps working against the same FRAGMENTS/
   FRAGMENT_LIST/DONORS shape Phase 7 established -- zero call sites
   changed by the split.

   Every entry clears GDD §6.7 (enforced by content_registry.js's
   validator, not by author honesty) and carries real 3-level clause
   changes -- see each donor file's own `levelDesc`. `donor` values are
   plain strings registered via `registerDonor` (combat.js); `slot` is one
   of the 9 GDD §6.1 slots. Magnitude-per-level is authored as an array
   value (tech §3's `stacks:[1,2,3]` shape), resolved generically by
   content_registry.js's installFragment -- no verb here ever
   special-cases "level". */

import { PURPLE_HAZE_FRAGMENTS } from './content/fragments/purple_haze.js';
import { THE_WORLD_FRAGMENTS } from './content/fragments/the_world.js';
import { STICKY_FINGERS_FRAGMENTS } from './content/fragments/sticky_fingers.js';
import { CRAZY_DIAMOND_FRAGMENTS } from './content/fragments/crazy_diamond.js';
import { GOLD_EXPERIENCE_FRAGMENTS } from './content/fragments/gold_experience.js';
import { ECHOES_ACT3_FRAGMENTS } from './content/fragments/echoes_act3.js';
import { RED_HOT_CHILI_PEPPER_FRAGMENTS } from './content/fragments/red_hot_chili_pepper.js';
import { HERMIT_PURPLE_FRAGMENTS } from './content/fragments/hermit_purple.js';

/* Phase 10 (GDD §9.1/§19): six more donors, 42 more Fragments, every one
   of them behind an Archive node. They are registered and validated
   unconditionally -- being in the POOL and being OFFERABLE are different
   things, exactly as Phase 7 established for owned-vs-registered -- and
   fragment_offers.js filters candidates by the run's unlocked donor set.
   That is what makes the reward pool grow over the first twenty hours
   without any of it making a number bigger: 8 donors and 52 Fragments at
   run 1, 14 and 94 once the tree is bought out, with the last donor
   landing in tier 3 around run 45. */
import { DONORS_META_A, FRAGMENTS_META_A } from './content/donors_meta_a.js';
import { DONORS_META_B, FRAGMENTS_META_B } from './content/donors_meta_b.js';

export const BASE_DONORS = [
  'purple_haze', 'the_world', 'sticky_fingers',
  'crazy_diamond', 'gold_experience', 'echoes_act3', 'red_hot_chili_pepper', 'hermit_purple'
];

export const DONORS = [...BASE_DONORS, ...DONORS_META_A, ...DONORS_META_B];

export const FRAGMENT_LIST = [
  ...PURPLE_HAZE_FRAGMENTS, ...THE_WORLD_FRAGMENTS, ...STICKY_FINGERS_FRAGMENTS,
  ...CRAZY_DIAMOND_FRAGMENTS, ...GOLD_EXPERIENCE_FRAGMENTS, ...ECHOES_ACT3_FRAGMENTS,
  ...RED_HOT_CHILI_PEPPER_FRAGMENTS, ...HERMIT_PURPLE_FRAGMENTS,
  ...FRAGMENTS_META_A, ...FRAGMENTS_META_B
];

export const FRAGMENTS = Object.fromEntries(FRAGMENT_LIST.map(f => [f.id, f]));
