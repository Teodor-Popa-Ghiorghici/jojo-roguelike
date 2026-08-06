/* The Track A / Track B firewall, as tests (spec §7, Phase 10
   deliverable 1). Everything in this file exists to make the separation
   between the two meta systems a property the build checks, not a rule a
   future author is trusted to remember.

   Run by `npm run validate` (checkArchiveNodes, checkGrantTargets,
   checkArchiveTreeShape) and `npm run assert` (all five, including the
   two source-level firewalls). Node-only: the two firewall checks read
   source text off disk and are skipped, reporting `skipped: true`, in a
   browser -- nothing here is ever imported by the app itself. */

import { ARCHIVE_NODES, ARCHIVE_TOTAL_FATE } from './meta_archive_tree.js';
import { ARCHIVE_GRANT_KINDS, ARCHIVE_BASELINE, applyArchiveUnlocks } from './meta_archive.js';
import { MENACE_CONDITIONS, MENACE_PROFILE_KEYS, BASE_PROFILE, MENACE_MAX_RANK, createMenaceProfile } from './meta_menace.js';
import { STANDS } from './data.js';
import { ASPECTS, ASPECT_LIST } from './aspects.js';
import { DONORS } from './fragments.js';
import { EFFECT_LIB, QUERY_LIB, VERB_CATEGORIES, QUERY_VERB_CATEGORIES } from './effect_lib.js';
import { hookKindOf } from './hooks.js';

/* Numeric keys a tree node may carry. Everything else in a node -- and
   in particular anything inside `grants` -- must be a string, an array or
   an object of strings. This is the rule that makes "nothing in the
   Archive makes a number bigger" mechanical. */
const NUMERIC_NODE_KEYS = new Set(['cost', 'tier']);

/* Names from the combat number pipeline. If any of these appears in the
   Archive apply path's source, the firewall has been breached. Comments
   are stripped before the scan, so this file can discuss them freely and
   the checked files can document themselves without tripping their own
   guard -- what matters is executable code. */
const FORBIDDEN_IN_ARCHIVE = [
  'addModifier', 'removeModifiersBySource', 'registerClamp', 'createStatPipeline',
  'applyHit', 'resolveDamage', 'resolveMoveFrames', 'resolvePatternFrames',
  'installFragment', 'installRelic', 'installDisc', 'installDuo',
  'dispatcher', 'runQuery', 'runEffect', 'EFFECT_LIB', 'QUERY_LIB'
];
const FORBIDDEN_ARCHIVE_IMPORTS = [
  './stats.js', './resolvers.js', './hooks.js', './effect_lib.js', './item_effect_lib.js',
  './fighter.js', './combat.js', './combat_player.js', './combat_stand.js', './combat_enemy.js'
];
const ARCHIVE_APPLY_PATH = ['meta_archive.js', 'meta_archive_tree.js', 'meta_fate.js'];

/* The reverse direction: Track B may never name a piece of content. */
const FORBIDDEN_IN_MENACE = ['grant', 'unlock', 'Archive', 'ARCHIVE', 'aspect', 'donor', 'Fragment', 'Relic'];
const MENACE_PATH = ['meta_menace.js'];

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

async function readSources(files) {
  if (typeof process === 'undefined') return null;
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const out = {};
  for (const f of files) out[f] = stripComments(await readFile(dir + f, 'utf8'));
  return out;
}

/* ---- 1. no number may hide in a node ---- */
export function checkArchiveNodes() {
  const errors = [];
  const walk = (value, path, nodeId) => {
    if (value == null) return;
    if (typeof value === 'number') {
      const key = path[path.length - 1];
      if (!(path.length === 1 && NUMERIC_NODE_KEYS.has(key))) {
        errors.push(`${nodeId}: numeric value at "${path.join('.')}" -- the Archive may not carry numbers outside cost/tier (spec §7)`);
      }
      return;
    }
    if (Array.isArray(value)) { value.forEach((v, i) => walk(v, path.concat(String(i)), nodeId)); return; }
    if (typeof value === 'object') { for (const k of Object.keys(value)) walk(value[k], path.concat(k), nodeId); }
  };
  for (const node of ARCHIVE_NODES) {
    for (const k of Object.keys(node)) walk(node[k], [k], node.id);
    for (const grant of node.grants || []) {
      if (!ARCHIVE_GRANT_KINDS.includes(grant.kind)) errors.push(`${node.id}: unknown grant kind "${grant.kind}"`);
    }
  }
  return { pass: errors.length === 0, errors };
}

/* ---- 2. every granted id resolves to something real ---- */
const STATIC_TARGETS = {
  nodeType: ['duel', 'gamble', 'arrow_shrine'],
  actVariant: ['act2_night', 'act3_storm', 'act4_heaven'],
  hubScene: ['rooftop', 'bond_annex', 'speedwagon_vault'],
  cosmetic: ['title_case', 'arrow_cursor', 'vault_frame'],
  hudSkin: ['databook', 'stone_mask']
};

export function checkGrantTargets() {
  const errors = [];
  const known = {
    stand: new Set(Object.keys(STANDS)),
    aspect: new Set(Object.keys(ASPECTS)),
    donor: new Set(DONORS),
    ...Object.fromEntries(Object.entries(STATIC_TARGETS).map(([k, v]) => [k, new Set(v)]))
  };
  for (const node of ARCHIVE_NODES) {
    for (const grant of node.grants || []) {
      const set = known[grant.kind];
      if (set && !set.has(grant.id)) errors.push(`${node.id}: grants ${grant.kind} "${grant.id}", which does not exist`);
    }
  }
  return { pass: errors.length === 0, errors };
}

/* ---- 3. tree shape and GDD §19 pacing ---- */
const TIER_BANDS = { 1: [40, 80], 2: [100, 160], 3: [200, 280], 4: [300, 400] };

export function checkArchiveTreeShape() {
  const errors = [];
  const ids = new Set();
  for (const node of ARCHIVE_NODES) {
    if (ids.has(node.id)) errors.push(`duplicate node id "${node.id}"`);
    ids.add(node.id);
    const band = TIER_BANDS[node.tier];
    if (!band) errors.push(`${node.id}: unknown tier ${node.tier}`);
    else if (node.cost < band[0] || node.cost > band[1]) errors.push(`${node.id}: cost ${node.cost} outside tier ${node.tier} band ${band[0]}-${band[1]} (GDD §19)`);
    if (!node.grants || node.grants.length === 0) errors.push(`${node.id}: grants nothing`);
  }
  for (const node of ARCHIVE_NODES) {
    for (const req of node.requires || []) {
      if (!ids.has(req)) errors.push(`${node.id}: requires unknown node "${req}"`);
      else {
        const parent = ARCHIVE_NODES.find(n => n.id === req);
        if (parent.tier > node.tier) errors.push(`${node.id}: tier ${node.tier} requires higher-tier "${req}"`);
      }
    }
  }
  if (ARCHIVE_NODES.length < 30 || ARCHIVE_NODES.length > 38) errors.push(`tree has ${ARCHIVE_NODES.length} nodes, GDD §9.1 asks for ~34`);
  if (ARCHIVE_TOTAL_FATE < 4000 || ARCHIVE_TOTAL_FATE > 4400) errors.push(`tree totals ${ARCHIVE_TOTAL_FATE} Fate, GDD §19 asks for ~4,200`);
  const tier1 = ARCHIVE_NODES.filter(n => n.tier === 1).length;
  if (tier1 < 12) errors.push(`only ${tier1} tier-1 nodes -- GDD §19 wants an unlock every 1-2 runs early`);
  /* The apply path must survive a fully-bought tree without throwing, and
     must still hand back nothing but strings. */
  const all = { purchased: ARCHIVE_NODES.map(n => n.id), seen: {} };
  const unlocks = applyArchiveUnlocks(all);
  for (const [field, set] of Object.entries(unlocks)) {
    for (const v of set) if (typeof v !== 'string') errors.push(`applyArchiveUnlocks returned a non-string in ${field}`);
  }
  for (const field of Object.keys(ARCHIVE_BASELINE)) {
    if (!unlocks[field]) errors.push(`applyArchiveUnlocks dropped baseline field ${field}`);
  }
  return { pass: errors.length === 0, errors };
}

/* ---- 4. the Archive apply path cannot reach the number pipeline ---- */
export async function checkArchiveFirewall() {
  const sources = await readSources(ARCHIVE_APPLY_PATH);
  if (!sources) return { pass: true, skipped: true, errors: [] };
  const errors = [];
  for (const [file, src] of Object.entries(sources)) {
    for (const token of FORBIDDEN_IN_ARCHIVE) {
      if (src.includes(token)) errors.push(`${file}: names "${token}" -- the Archive apply path may not touch the combat number pipeline (spec §7)`);
    }
    for (const mod of FORBIDDEN_ARCHIVE_IMPORTS) {
      if (new RegExp(`from\\s+['"]${mod.replace('.', '\\.')}['"]`).test(src)) errors.push(`${file}: imports ${mod}`);
    }
  }
  return { pass: errors.length === 0, skipped: false, errors };
}

/* ---- 5. Track B cannot reach content, and cannot reach a telegraph ---- */
export async function checkMenaceFirewall() {
  const errors = [];
  const profileKeys = new Set(MENACE_PROFILE_KEYS);
  for (const key of Object.keys(BASE_PROFILE)) {
    if (!profileKeys.has(key)) errors.push(`BASE_PROFILE has key "${key}" outside MENACE_PROFILE_KEYS`);
  }
  for (const key of MENACE_PROFILE_KEYS) {
    if (!(key in BASE_PROFILE)) errors.push(`MENACE_PROFILE_KEYS names "${key}" with no BASE_PROFILE default`);
    if (/windup|telegraph/i.test(key)) errors.push(`MENACE_PROFILE_KEYS names "${key}" -- Track B may never reach a telegraph (spec §5.1)`);
  }
  for (const cond of MENACE_CONDITIONS) {
    if (!profileKeys.has(cond.key)) errors.push(`condition "${cond.id}" writes "${cond.key}", which is not a profile key`);
    if (!['add', 'ladder', 'flag'].includes(cond.mode)) errors.push(`condition "${cond.id}" has unknown mode "${cond.mode}"`);
    if (cond.mode === 'ladder' && (!cond.ladder || cond.ladder.length !== cond.ranks)) errors.push(`condition "${cond.id}": ladder length must equal ranks`);
  }
  const total = MENACE_CONDITIONS.reduce((n, c) => n + c.ranks, 0);
  if (total < MENACE_MAX_RANK) errors.push(`conditions offer ${total} ranks, below the ${MENACE_MAX_RANK} ladder`);
  /* A maxed profile must still be a closed struct of numbers/booleans. */
  const maxPact = Object.fromEntries(MENACE_CONDITIONS.map(c => [c.id, c.ranks]));
  const profile = createMenaceProfile(maxPact);
  for (const [k, v] of Object.entries(profile)) {
    if (!profileKeys.has(k)) errors.push(`resolved profile grew an unexpected key "${k}"`);
    if (typeof v !== 'number' && typeof v !== 'boolean') errors.push(`resolved profile key "${k}" is a ${typeof v}, not a number or boolean`);
  }
  const sources = await readSources(MENACE_PATH);
  if (sources) {
    for (const [file, src] of Object.entries(sources)) {
      for (const token of FORBIDDEN_IN_MENACE) {
        if (src.includes(token)) errors.push(`${file}: names "${token}" -- Track B may never unlock content (spec §7)`);
      }
    }
  }
  return { pass: errors.length === 0, skipped: !sources, errors };
}

/* ---- 6. Aspects rewrite rules; none of them adds a stat ---- */
export function checkAspects() {
  const errors = [];
  const byStand = {};
  for (const a of ASPECT_LIST) {
    if (!STANDS[a.standId]) errors.push(`${a.id}: unknown standId "${a.standId}"`);
    byStand[a.standId] = (byStand[a.standId] || 0) + 1;
    const clauses = [...(a.effects || []), ...(a.queries || [])];
    if (clauses.length === 0) errors.push(`${a.id}: has no clauses`);
    /* GDD §6.7's synergy bar, applied to Aspects for the same reason it is
       applied to Fragments: a set of clauses whose categories union to
       nothing is, by definition, pure arithmetic -- which for an Aspect
       would be exactly the power creep spec §7 forbids. */
    const cats = new Set();
    for (const c of a.effects || []) (VERB_CATEGORIES[c.fn] || []).forEach(x => cats.add(x));
    for (const c of a.queries || []) (QUERY_VERB_CATEGORIES[c.fn] || []).forEach(x => cats.add(x));
    if (cats.size === 0) errors.push(`${a.id}: no apply/consume/convert/rewrite clause -- it only moves numbers (GDD §6.7)`);
    for (const c of a.effects || []) {
      if (!EFFECT_LIB[c.fn]) errors.push(`${a.id}: unknown effect verb "${c.fn}"`);
      if (hookKindOf(c.hook) !== 'effect') errors.push(`${a.id}: "${c.hook}" is not an effect hook`);
    }
    for (const c of a.queries || []) {
      if (!QUERY_LIB[c.fn]) errors.push(`${a.id}: unknown query verb "${c.fn}"`);
      if (hookKindOf(c.hook) !== 'query') errors.push(`${a.id}: "${c.hook}" is not a query hook`);
    }
    if ((a.tags || []).includes('risk') && !a.tradeoff) errors.push(`${a.id}: tagged 'risk' with no tradeoff`);
  }
  for (const [standId, n] of Object.entries(byStand)) {
    if (n !== 4) errors.push(`${standId} has ${n} Aspects, GDD §9.1 asks for 4 per Stand`);
  }
  if (ASPECT_LIST.length !== 16) errors.push(`${ASPECT_LIST.length} Aspects, GDD §9.1 asks for 16`);
  const baseline = ASPECT_LIST.filter(a => a.baseline);
  if (baseline.length !== 4) errors.push(`${baseline.length} baseline Aspects, GDD §9.1 asks for 4 free from the start`);
  return { pass: errors.length === 0, errors };
}

export async function runMetaChecks() {
  const results = {
    archiveNodes: checkArchiveNodes(),
    grantTargets: checkGrantTargets(),
    treeShape: checkArchiveTreeShape(),
    aspects: checkAspects(),
    archiveFirewall: await checkArchiveFirewall(),
    menaceFirewall: await checkMenaceFirewall()
  };
  const errors = Object.entries(results).flatMap(([name, r]) => r.errors.map(e => `[${name}] ${e}`));
  return { pass: errors.length === 0, errors, results };
}
