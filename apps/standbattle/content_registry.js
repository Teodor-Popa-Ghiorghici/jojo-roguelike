/* Content registry + validator — tech §2.9, GDD §6.6/§6.7, Phase 3
   deliverable 5. "With 200+ content entries this is the only thing that
   keeps the pool honest" (tech doc). No real content exists yet (Phase 4+
   adds Fragments/Relics); this file is the load-bearing plumbing those
   phases plug into, exercised this phase by content_check.js's regression
   test and the two throwaway test Fragments (deleted before reporting,
   per the mission).

   Every content file registers raw data (registerFragment/registerRelic/
   registerDonor) instead of calling bus.effect() directly -- that lets
   validateContent() check ALL of it and collect every problem before any
   hook is touched, instead of throwing at the first bad entry the way
   hooks.js's own assertions do at the dispatcher level. loadContent() only
   installs into the dispatcher once validation is clean. */

import { checkTelegraphFairness } from './fairness_check.js';
import { STATUS_DEFS } from './status.js';
import { EFFECT_LIB, QUERY_LIB, VERB_CATEGORIES, QUERY_VERB_CATEGORIES } from './effect_lib.js';
import { PRIORITY } from './hooks.js';

/* Fragment slot vocabulary — GDD §6.1. */
export const SLOTS = ['light', 'medium', 'heavy', 'special_1', 'special_2', 'rush', 'step', 'clash', 'aura'];

/* Disc slot vocabulary — GDD §6.4: "swap a Special or your Rush for a
   different Stand's". A strict subset of SLOTS; a Disc on 'light' or
   'aura' would just be an unlabelled second Fragment, not the "weapon
   swap" axis the GDD describes. */
export const DISC_SLOTS = ['special_1', 'special_2', 'rush'];

/* Item tag vocabulary — GDD §6.6. Distinct from the move/hitbox tag set in
   moves.js/ai.js (`light`/`heavy`/`melee`/`ranged`/...), which describes
   what an attack *is*; this vocabulary describes what a Fragment/Relic
   *does*, and drives offer weighting/Duo eligibility once those exist. */
export const TAGS = ['time', 'virus', 'heal', 'mobility', 'crowd', 'single-target', 'economy', 'risk', 'projection'];

export function createContentRegistry() {
  return {
    fragments: [],
    relics: [],
    affixes: [],
    discs: [],
    requiems: [],
    duos: [],
    donors: new Set(),
    registerDonor(id) { this.donors.add(id); },
    registerFragment(def) { this.fragments.push(def); },
    registerRelic(def) { this.relics.push(def); },
    registerAffix(def) { this.affixes.push(def); },
    registerDisc(def) { this.discs.push(def); },
    registerRequiem(def) { this.requiems.push(def); },
    registerDuo(def) { this.duos.push(def); }
  };
}

/* GDD §6.7 enforcement, Phase 7 deliverable 3: unions the synergy
   categories of every effect/query a Fragment registers (VERB_CATEGORIES/
   QUERY_VERB_CATEGORIES, effect_lib.js) and rejects it if the union is
   empty -- i.e. every clause it has is pure damage/crit arithmetic. This
   is the actual enforcement mechanism the mission asks for: a Fragment
   authored with only `chainedDamageMult` fails here exactly like an
   unknown hook name would, regardless of what the author intended. */
function synergyCategoriesOf(def) {
  const cats = new Set();
  (def.effects || []).forEach(eff => (VERB_CATEGORIES[eff.fn] || []).forEach(c => cats.add(c)));
  (def.queries || []).forEach(q => (QUERY_VERB_CATEGORIES[q.fn] || []).forEach(c => cats.add(c)));
  return cats;
}

function validateEffectsAndQueries(kind, def, errors) {
  (def.effects || []).forEach(eff => {
    if (eff.minLevel != null && (eff.minLevel < 1 || eff.minLevel > 3)) {
      errors.push(`${kind} "${def.id}": effect "${eff.fn}" has an out-of-range minLevel ${eff.minLevel}`);
    }
    if (!eff.fn || !EFFECT_LIB[eff.fn]) errors.push(`${kind} "${def.id}": unknown effect function "${eff.fn}"`);
    const statusId = eff.data && eff.data.status;
    if (statusId && !STATUS_DEFS[statusId]) errors.push(`${kind} "${def.id}": unknown status "${statusId}"`);
  });
  (def.queries || []).forEach(q => {
    if (q.minLevel != null && (q.minLevel < 1 || q.minLevel > 3)) {
      errors.push(`${kind} "${def.id}": query "${q.fn}" has an out-of-range minLevel ${q.minLevel}`);
    }
    if (!q.fn || !QUERY_LIB[q.fn]) errors.push(`${kind} "${def.id}": unknown query function "${q.fn}"`);
  });
}

function validateHooks(kind, def, dispatcher, errors) {
  (def.effects || []).forEach(eff => {
    if (!eff.hook || !dispatcher.hasHook(eff.hook)) {
      errors.push(`${kind} "${def.id}": unknown hook "${eff.hook}"`);
    } else if (!dispatcher.isEffectHook(eff.hook)) {
      errors.push(`${kind} "${def.id}": "${eff.hook}" is registered as an EFFECT target, but its hook kind is ${dispatcher.hookKind(eff.hook).toUpperCase()}`);
    }
  });
  (def.queries || []).forEach(q => {
    if (!q.hook || !dispatcher.hasHook(q.hook)) {
      errors.push(`${kind} "${def.id}": unknown hook "${q.hook}"`);
    } else if (!dispatcher.isQueryHook(q.hook)) {
      errors.push(`${kind} "${def.id}": "${q.hook}" is registered as a QUERY target, but its hook kind is ${dispatcher.hookKind(q.hook).toUpperCase()}`);
    }
  });
}

/* requires[] validation shared by Duo Fragments (GDD §6.1: "two specific
   donors") and cross-donor Requiems (GDD §6.2 table: "one per donor + 4
   cross-donor") -- both name donors, neither names a slot (tech §3's own
   Duo schema omits slot: owning ANY Fragment from that donor qualifies). */
function validateRequires(kind, def, registry, errors) {
  if (!Array.isArray(def.requires) || def.requires.length === 0) {
    errors.push(`${kind} "${def.id}": missing "requires" (array of {donor})`);
    return;
  }
  if (kind === 'duo' && def.requires.length !== 2) {
    errors.push(`${kind} "${def.id}": Duo Fragments require exactly 2 donors, got ${def.requires.length}`);
  }
  def.requires.forEach(r => {
    if (!r || !r.donor || !registry.donors.has(r.donor)) {
      errors.push(`${kind} "${def.id}": unknown donor "${r && r.donor}" in "requires"`);
    }
  });
}

function validateEntry(kind, def, registry, dispatcher, errors) {
  if (!def || !def.id) { errors.push(`${kind}: entry is missing an "id"`); return; }
  validateHooks(kind, def, dispatcher, errors);
  validateEffectsAndQueries(kind, def, errors);
  (def.tags || []).forEach(t => {
    if (!TAGS.includes(t)) errors.push(`${kind} "${def.id}": unknown tag "${t}"`);
  });
  if (kind === 'fragment') {
    if (def.slot && !SLOTS.includes(def.slot)) errors.push(`fragment "${def.id}": unknown slot "${def.slot}"`);
    if (def.donor && !registry.donors.has(def.donor)) errors.push(`fragment "${def.id}": unknown donor "${def.donor}"`);
    if (synergyCategoriesOf(def).size === 0) {
      errors.push(`fragment "${def.id}": every clause is purely additive damage -- GDD §6.7 requires ` +
        'apply/amplify/consume/convert a status, convert a resource, rewrite a slot\'s behaviour, or change the economy');
    }
  }
  /* Discs (GDD §6.4) are the "weapon swap" axis, not the boon-synergy
     chase -- real hooks/tags are required, GDD §6.7's synergy union is
     deliberately NOT enforced on them. */
  if (kind === 'disc' && !DISC_SLOTS.includes(def.slot)) {
    errors.push(`disc "${def.id}": unknown Disc slot "${def.slot}" (must be one of ${DISC_SLOTS.join(', ')})`);
  }
  if (kind === 'duo' || kind === 'requiem') validateRequires(kind, def, registry, errors);
  /* spec §6.3: "every one of those has a downside stated at pickup...
     never a hidden clause". Originally Relic-only; Phase 7 extended it to
     Fragments; Phase 10 makes it universal -- anything tagged 'risk', by
     this vocabulary's own definition, is declaring a downside, so it must
     carry a non-null tradeoff string regardless of which pool it's in. */
  if (def.tags && def.tags.includes('risk') && !def.tradeoff) {
    errors.push(`${kind} "${def.id}": tagged 'risk' but has no "tradeoff" string`);
  }
}

/* Collects every validation problem across the whole registry instead of
   throwing at the first (deliverable 5: "list every problem at once").
   Also re-runs the pattern telegraph fairness floor (spec §5.1 / GDD §6.8)
   as part of the same load-time gate, since a content load is exactly the
   moment new patterns could have been introduced. */
export function validateContent(registry, dispatcher) {
  const errors = [];
  registry.fragments.forEach(f => validateEntry('fragment', f, registry, dispatcher, errors));
  registry.relics.forEach(r => validateEntry('relic', r, registry, dispatcher, errors));
  registry.affixes.forEach(a => validateEntry('affix', a, registry, dispatcher, errors));
  registry.discs.forEach(d => validateEntry('disc', d, registry, dispatcher, errors));
  registry.requiems.forEach(r => validateEntry('requiem', r, registry, dispatcher, errors));
  registry.duos.forEach(d => validateEntry('duo', d, registry, dispatcher, errors));

  /* "...after all Menace modifiers are applied" (GDD §6.8) is deferred:
     Menace ranks (tech §5 Phase 5) don't exist yet, so there is no
     modifier to apply. This checks the same floor every pattern must
     clear before any modifier ever gets to shrink it -- a real but
     narrower check, flagged here rather than silently treated as the
     full requirement. */
  const telegraph = checkTelegraphFairness();
  telegraph.results.filter(r => !r.ok).forEach(r => {
    errors.push(`pattern "${r.id}": telegraph ${r.ms.toFixed(0)}ms is below the 260ms fairness floor`);
  });

  return { errors, pass: errors.length === 0 };
}

/* The shared "fail loudly, list every problem at once" throw -- both
   loadContent (below, Relics) and combat.js's Fragment path (which
   installs a specific owned subset rather than everything, see
   installFragment) validate the WHOLE registry through this one
   function first, so a bad Fragment definition is caught at fight-setup
   time regardless of whether the player actually owns it yet. */
export function assertContentValid(registry, dispatcher) {
  const { errors } = validateContent(registry, dispatcher);
  if (errors.length) {
    throw new Error(
      `[content] Load-time validation failed — ${errors.length} problem(s):\n` +
      errors.map(e => ' - ' + e).join('\n')
    );
  }
}

/* Validates, then (only if clean) installs every Fragment/Relic effect
   and query into the dispatcher unconditionally, attributed to the
   content's own id (hooks.js's ctx.source). Historical Phase 3 path, kept
   only for content_check.js's own regression test ("validate the whole
   registry and install everything, no ownership concept at all"). Real
   fights never call this: Fragments go through installFragment (owned +
   levelled, Phase 7), Relics/Discs through installRelic/installDisc
   (owned, unlevelled, Phase 10) -- see combat.js. */
export function loadContent(registry, dispatcher) {
  assertContentValid(registry, dispatcher);
  [...registry.fragments, ...registry.relics].forEach(def => {
    (def.effects || []).forEach(eff => {
      const fn = EFFECT_LIB[eff.fn];
      const priority = eff.priority == null ? PRIORITY.ADD : eff.priority;
      dispatcher.effect(eff.hook, priority, ctx => fn(ctx, eff.data || {}), def.id);
    });
    (def.queries || []).forEach(q => {
      const fn = QUERY_LIB[q.fn];
      const priority = q.priority == null ? PRIORITY.MULTIPLY : q.priority;
      dispatcher.query(q.hook, priority, (value, ctx) => fn(value, ctx, q.data || {}), def.id);
    });
  });
}

/* tech §3's own Fragment schema authors magnitude-per-level as an array
   value (`stacks:[1,2,3]`) rather than three near-duplicate effect
   entries. This resolves that generically for ANY data field on ANY
   verb -- an Array value picks its (level-1)th entry, everything else
   passes through unchanged -- so a verb function never has to know
   levels exist at all. */
function resolveLevelData(data, level) {
  if (!data) return data;
  const out = {};
  Object.keys(data).forEach(k => {
    const v = data[k];
    out[k] = Array.isArray(v) ? v[Math.min(v.length, level) - 1] : v;
  });
  return out;
}

/* Installs one OWNED Fragment's clauses at a specific level. Two
   independent ways a level changes what's active, both deliverable 5
   asks for: `minLevel` gates whether a WHOLE clause is registered at all
   (a level-1 owner never even registers a level-3-only listener, "the
   level changes clauses"), and resolveLevelData above scales an
   already-registered clause's own numbers ("...not just magnitude" reads
   both ways: magnitude scaling is real too, just not the only mechanism).
   combat.js calls this once per entry in `runState.fragments` when
   building a fresh fight. */
export function installFragment(dispatcher, def, level) {
  (def.effects || []).forEach(eff => {
    if ((eff.minLevel || 1) > level) return;
    const fn = EFFECT_LIB[eff.fn];
    const priority = eff.priority == null ? PRIORITY.ADD : eff.priority;
    const data = resolveLevelData(eff.data, level);
    dispatcher.effect(eff.hook, priority, ctx => fn(ctx, data || {}), def.id);
  });
  (def.queries || []).forEach(q => {
    if ((q.minLevel || 1) > level) return;
    const fn = QUERY_LIB[q.fn];
    const priority = q.priority == null ? PRIORITY.MULTIPLY : q.priority;
    const data = resolveLevelData(q.data, level);
    dispatcher.query(q.hook, priority, (value, ctx) => fn(value, ctx, data || {}), def.id);
  });
}

/* Phase 10: Relics/Discs/Requiems have no level concept (tech §3's own
   schemas never gave them one) -- one shared installer, no
   resolveLevelData/minLevel gating, unlike installFragment. Requiems have
   no live in-run selection flow yet (no Act III/Altar exists -- flagged
   in the phase report), but the installer is real so the moment one does
   exist it has somewhere to call. */
function installUnleveled(dispatcher, def) {
  (def.effects || []).forEach(eff => {
    const fn = EFFECT_LIB[eff.fn];
    const priority = eff.priority == null ? PRIORITY.ADD : eff.priority;
    dispatcher.effect(eff.hook, priority, ctx => fn(ctx, eff.data || {}), def.id);
  });
  (def.queries || []).forEach(q => {
    const fn = QUERY_LIB[q.fn];
    const priority = q.priority == null ? PRIORITY.MULTIPLY : q.priority;
    dispatcher.query(q.hook, priority, (value, ctx) => fn(value, ctx, q.data || {}), def.id);
  });
}
export function installRelic(dispatcher, def) { installUnleveled(dispatcher, def); }
export function installDisc(dispatcher, def) { installUnleveled(dispatcher, def); }
export function installRequiem(dispatcher, def) { installUnleveled(dispatcher, def); }
export function installDuo(dispatcher, def) { installUnleveled(dispatcher, def); }

/* installAffix moved to content_registry_affix.js (Phase 10, 300-line cap) --
   affixes.js/encounter.js import it from there directly now. */
