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

const verbose = process.argv.includes('--verbose');

const registry = createContentRegistry();
DONORS.forEach(d => registry.registerDonor(d));
FRAGMENT_LIST.forEach(f => registry.registerFragment(f));
RELIC_LIST.forEach(r => registry.registerRelic(r));
DISCS.forEach(d => registry.registerDisc(d));
DUO_LIST.forEach(d => registry.registerDuo(d));
REQUIEMS.forEach(r => registry.registerRequiem(r));
AFFIX_LIST.forEach(a => registry.registerAffix(a));

const dispatcher = createDispatcher();
const { pass, errors } = validateContent(registry, dispatcher);

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
  console.log(`OK   ${FRAGMENT_LIST.length} fragments / ${DONORS.length} donors / ${RELIC_LIST.length} relics / ` +
    `${DISCS.length} discs / ${DUO_LIST.length} duos / ${REQUIEMS.length} requiems / ${AFFIX_LIST.length} affixes validate with zero errors.`);
} else {
  console.log(`FAIL ${errors.length} problem(s):`);
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
