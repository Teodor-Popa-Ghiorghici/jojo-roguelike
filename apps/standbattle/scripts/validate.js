/* npm run validate -- wraps content_registry.js's validator over the real,
   shipped content pool: Fragments/donors, Relics, Discs, Duo Fragments,
   Requiems, affixes. Prints at most 20 lines on success, only the failing
   items on failure. --verbose prints every registered entry's id. */

import { createDispatcher } from '../hooks.js';
import { createContentRegistry, validateContent } from '../content_registry.js';
import { FRAGMENT_LIST, DONORS } from '../fragments.js';
import { RELIC_LIST } from '../relics.js';
import { DISCS } from '../content/discs.js';
import { DUO_LIST } from '../duo_fragments.js';
import { REQUIEMS } from '../content/requiems.js';
import { AFFIX_LIST } from '../affixes.js';
/* Phase 10: Keepsakes are Relics (GDD §9.3 -- "a starting Relic you may
   equip, sidegrade only"), so they register and validate as Relics rather
   than as a new kind. The meta checks and the mission table validate
   alongside them: Missions and the Archive tree are content, and content
   is validated at load (invariant 6). */
import { KEEPSAKE_LIST } from '../keepsakes.js';
import { validateMissions } from '../missions.js';
import { runMetaChecks } from '../meta_check.js';

const verbose = process.argv.includes('--verbose');

const registry = createContentRegistry();
DONORS.forEach(d => registry.registerDonor(d));
FRAGMENT_LIST.forEach(f => registry.registerFragment(f));
RELIC_LIST.forEach(r => registry.registerRelic(r));
KEEPSAKE_LIST.forEach(k => registry.registerRelic(k));
DISCS.forEach(d => registry.registerDisc(d));
DUO_LIST.forEach(d => registry.registerDuo(d));
REQUIEMS.forEach(r => registry.registerRequiem(r));
AFFIX_LIST.forEach(a => registry.registerAffix(a));

const dispatcher = createDispatcher();
const content = validateContent(registry, dispatcher);
const missions = validateMissions();
const meta = await runMetaChecks();
const errors = [...content.errors, ...missions.errors, ...meta.errors];
const pass = errors.length === 0;

if (verbose) {
  console.log(`${DONORS.length} donor(s): ${DONORS.join(', ')}`);
  console.log(`${FRAGMENT_LIST.length} fragment(s): ${FRAGMENT_LIST.map(f => f.id).join(', ')}`);
  console.log(`${RELIC_LIST.length} relic(s): ${RELIC_LIST.map(r => r.id).join(', ')}`);
  console.log(`${DISCS.length} disc(s): ${DISCS.map(d => d.id).join(', ')}`);
  console.log(`${DUO_LIST.length} duo(s): ${DUO_LIST.map(d => d.id).join(', ')}`);
  console.log(`${REQUIEMS.length} requiem(s): ${REQUIEMS.map(r => r.id).join(', ')}`);
  console.log(`${AFFIX_LIST.length} affix(es): ${AFFIX_LIST.map(a => a.id).join(', ')}`);
}

if (pass) {
  console.log(`OK   ${FRAGMENT_LIST.length} fragments / ${DONORS.length} donors / ${RELIC_LIST.length + KEEPSAKE_LIST.length} relics (${KEEPSAKE_LIST.length} Keepsakes) / ` +
    `${DISCS.length} discs / ${DUO_LIST.length} duos / ${REQUIEMS.length} requiems / ${AFFIX_LIST.length} affixes validate with zero errors.`);
  console.log(`OK   ${missions.count} Bizarre Missions validate.`);
  console.log('OK   Archive tree: no numbers outside cost/tier, every grant resolves, ~4,200 Fate.');
  console.log('OK   16 Aspects: every clause is a real rewrite, none is pure arithmetic.');
  console.log('OK   Track A / Track B firewall holds.');
} else {
  console.log(`FAIL ${errors.length} problem(s):`);
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
