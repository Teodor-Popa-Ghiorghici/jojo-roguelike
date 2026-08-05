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
    donors: new Set(),
    registerDonor(id) { this.donors.add(id); },
    registerFragment(def) { this.fragments.push(def); },
    registerRelic(def) { this.relics.push(def); },
    registerAffix(def) { this.affixes.push(def); }
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
  /* spec §6.3: "every one of those has a downside stated at pickup...
     never a hidden clause". Originally Relic-only; Phase 7 extends it to
     Fragments too (tech §3's own Fragment schema carries the same
     `tradeoff` field, and GDD §6.1's Purple Haze — Aura example is a
     Fragment with an explicit downside) -- anything tagged 'risk', by
     this vocabulary's own definition, is declaring a downside, so it must
     carry a non-null tradeoff string regardless of which pool it's in. */
  if ((kind === 'relic' || kind === 'fragment' || kind === 'affix') && def.tags && def.tags.includes('risk') && !def.tradeoff) {
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
   content's own id (hooks.js's ctx.source). Relics have no ownership/
   level concept yet (out of Phase 7's scope), so "registered" and
   "active" are still the same thing for them -- this is the path they'll
   keep using. Fragments (Phase 7) go through installFragment instead,
   since being registered in the pool no longer means being owned. */
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

/* Phase 9b finding: Fragments/Relics above install GLOBALLY -- one
   registration lasts the whole fight, correct because there is exactly one
   player. Affixes are rolled per spawned ENEMY INSTANCE (affixes.js), so
   the same effect/query registration needs a filter identifying "is this
   firing actually about MY enemy" before it may run at all -- the one
   piece Fragment installation never needed. AFFIX_SCOPE says which ctx
   field names that enemy for each hook this content type actually uses;
   `scopeInvert` (Enraged-on-Kill) flips the match to "about anyone ELSE".
   Every verb an affix names still comes from the same EFFECT_LIB/QUERY_LIB
   Fragments use (invariant 6) -- this only changes WHO it's scoped to. */
const AFFIX_SCOPE = {
  onKill: 'target', onDamageTaken: 'attacker', onHitLanded: 'defender',
  // onHitResolve fires for either attack direction (resolvers.js) -- every
  // affix that uses it today (Toxic) reacts to the affixed enemy attacking
  // the player, so it scopes on 'attacker', not 'defender'.
  onHitResolve: 'attacker', getDamage: 'defender'
};

export function installAffix(dispatcher, def, entity) {
  (def.effects || []).forEach(eff => {
    const fn = EFFECT_LIB[eff.fn];
    const priority = eff.priority == null ? PRIORITY.ADD : eff.priority;
    const field = AFFIX_SCOPE[eff.hook];
    const data = { ...(eff.data || {}), self: entity };
    dispatcher.effect(eff.hook, priority, ctx => {
      if (field) {
        const matches = ctx[field] === entity;
        if (eff.scopeInvert ? matches : !matches) return;
      }
      fn(ctx, data);
    }, def.id + ':' + entity.id);
  });
  (def.queries || []).forEach(q => {
    const fn = QUERY_LIB[q.fn];
    const priority = q.priority == null ? PRIORITY.MULTIPLY : q.priority;
    const field = AFFIX_SCOPE[q.hook];
    const data = { ...(q.data || {}), self: entity };
    dispatcher.query(q.hook, priority, (value, ctx) => {
      if (field) {
        const matches = ctx[field] === entity;
        if (q.scopeInvert ? matches : !matches) return value;
      }
      return fn(value, ctx, data);
    }, def.id + ':' + entity.id);
  });
}
