/* npm run validate -- wraps content_registry.js's validator over the real,
   shipped content pool (Fragments + donors; no Relics exist as data yet).
   Prints at most 20 lines on success, only the failing items on failure.
   --verbose prints every registered entry's id. */

import { createDispatcher } from '../hooks.js';
import { createContentRegistry, validateContent } from '../content_registry.js';
import { FRAGMENT_LIST, DONORS } from '../fragments.js';
import { AFFIX_LIST } from '../affixes.js';

const verbose = process.argv.includes('--verbose');

const registry = createContentRegistry();
DONORS.forEach(d => registry.registerDonor(d));
FRAGMENT_LIST.forEach(f => registry.registerFragment(f));
AFFIX_LIST.forEach(a => registry.registerAffix(a));

const dispatcher = createDispatcher();
const { pass, errors } = validateContent(registry, dispatcher);

if (verbose) {
  console.log(`${DONORS.length} donor(s): ${DONORS.join(', ')}`);
  console.log(`${FRAGMENT_LIST.length} fragment(s): ${FRAGMENT_LIST.map(f => f.id).join(', ')}`);
  console.log(`${AFFIX_LIST.length} affix(es): ${AFFIX_LIST.map(a => a.id).join(', ')}`);
}

if (pass) {
  console.log(`OK   ${FRAGMENT_LIST.length} fragments / ${DONORS.length} donors / ${AFFIX_LIST.length} affixes validate with zero errors.`);
} else {
  console.log(`FAIL ${errors.length} problem(s):`);
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
