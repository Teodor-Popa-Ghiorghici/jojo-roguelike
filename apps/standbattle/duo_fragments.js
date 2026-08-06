/* Duo Fragments — GDD §6.1, tech §3's schema. Phase 10. Aggregator over
   content/duos/*.js, same split-by-file discipline fragments.js/relics.js
   established. ~20 curated: offered only when both `requires[].donor`
   entries are owned somewhere in fragmentsBySlot (fragment_offers.js's
   `duoCandidates`); once taken, a Duo installs into combat exactly like a
   Relic (no level, always fully active -- content_registry.js's
   installDuo, combat.js). */

import { DUO_FRAGMENTS_CORE } from './content/duos/core.js';
import { DUO_FRAGMENTS_EXTENDED } from './content/duos/extended.js';

export const DUO_LIST = [...DUO_FRAGMENTS_CORE, ...DUO_FRAGMENTS_EXTENDED];
export const DUOS = Object.fromEntries(DUO_LIST.map(d => [d.id, d]));
