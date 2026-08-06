/* The Archive — Track A (spec §7, GDD §9.1). Permanent unlocks bought
   with Fate. Breadth, never power.

   THE FIREWALL (spec §7, deliverable 1). The apply path below is a pure
   function of the meta blob whose entire return value is an Unlocks
   record: eight frozen Sets of strings. There is no numeric channel out
   of this module -- not a weak convention but the literal shape of the
   only thing it returns, so "this node gives +5% damage" is not a rule
   this file declines to honour, it is a sentence this file has no way to
   say. Three mechanical guards back that up, all in meta_check.js and all
   run by `npm run validate` / `npm run assert`:

     checkArchiveNodes()    -- walks every tree entry; a number is legal
                               only on `cost` and `tier`. Any number inside
                               a node's `grants` fails the build.
     checkArchiveFirewall() -- reads this file's own source and asserts it
                               names nothing from the combat number
                               pipeline, and imports from none of its
                               modules.
     checkGrantTargets()    -- every id a node hands out must resolve to a
                               real Stand / Aspect / donor / node type /
                               act variant / hub scene / cosmetic.

   Consumers of an Unlocks record are standselect.js (what is pickable),
   combat.js's content registry build (which donors enter the pool),
   map_gen.js (which node types appear) and hub.js. None of them is the
   place where a combat number is decided, and that is the whole design.

   Everything here therefore adds OPTIONS at equal power. Unlocking a
   donor grows the reward pool -- GDD §19 wants it still growing at run
   45 -- which changes how many different runs exist, not how strong one
   run is. */

/* The closed unlock vocabulary. A node's grants may name one of these
   kinds and nothing else; `applyArchiveUnlocks` throws on anything it
   does not recognise rather than silently ignoring it, because a typo
   that quietly does nothing is how a tree rots. There is deliberately no
   'stat' kind, and adding one would be a one-line diff to a constant
   whose name makes the intent impossible to miss in review. */
export const ARCHIVE_GRANT_KINDS = Object.freeze([
  'stand', 'aspect', 'donor', 'nodeType', 'actVariant', 'hubScene', 'cosmetic', 'hudSkin'
]);

const KIND_TO_FIELD = Object.freeze({
  stand: 'stands', aspect: 'aspects', donor: 'donors', nodeType: 'nodeTypes',
  actVariant: 'actVariants', hubScene: 'hubScenes', cosmetic: 'cosmetics', hudSkin: 'hudSkins'
});

export const UNLOCK_FIELDS = Object.freeze(Object.values(KIND_TO_FIELD));

import { ARCHIVE_NODES } from './meta_archive_tree.js';

const NODE_BY_ID = new Map(ARCHIVE_NODES.map(n => [n.id, n]));

export function archiveNodeById(id) { return NODE_BY_ID.get(id) || null; }

export function defaultArchiveState() {
  return { purchased: [], seen: {} };
}

/* Baseline options, available before a single point of Fate is spent
   (GDD §9.1: "4 Aspects are available from the start"). Everything else
   arrives through the tree. */
export const ARCHIVE_BASELINE = Object.freeze({
  stands: ['star_platinum', 'silver_chariot', 'hierophant_green', 'killer_queen'],
  aspects: ['sp_ora_barrage', 'sc_fencer', 'hg_web', 'kq_detonator'],
  donors: ['purple_haze', 'the_world', 'sticky_fingers', 'crazy_diamond',
    'gold_experience', 'echoes_act3', 'red_hot_chili_pepper', 'hermit_purple'],
  nodeTypes: ['combat', 'elite', 'boss', 'event', 'rest', 'shop', 'treasure'],
  actVariants: [], hubScenes: ['rack', 'terminal', 'board', 'bonds', 'missions', 'training'],
  cosmetics: [], hudSkins: ['default']
});

/* THE APPLY PATH. meta -> Unlocks. Strings in, strings out, nothing else
   reachable from here. */
export function applyArchiveUnlocks(archiveState) {
  const out = {};
  for (const field of UNLOCK_FIELDS) out[field] = new Set(ARCHIVE_BASELINE[field] || []);
  const purchased = (archiveState && archiveState.purchased) || [];
  for (const nodeId of purchased) {
    const node = NODE_BY_ID.get(nodeId);
    if (!node) continue; // a node retired between versions must not brick the blob
    for (const grant of node.grants) {
      const field = KIND_TO_FIELD[grant.kind];
      if (!field) throw new Error(`archive: unknown grant kind "${grant.kind}" on node "${nodeId}"`);
      out[field].add(grant.id);
    }
  }
  for (const field of UNLOCK_FIELDS) Object.freeze(out[field]);
  return Object.freeze(out);
}

/* Tree navigation. A node is available when every prerequisite is already
   purchased; `requires` is a plain list of node ids, so the tree shape is
   data like everything else. */
export function isPurchased(archiveState, nodeId) {
  return !!archiveState && Array.isArray(archiveState.purchased) && archiveState.purchased.includes(nodeId);
}

export function isAvailable(archiveState, nodeId) {
  const node = NODE_BY_ID.get(nodeId);
  if (!node || isPurchased(archiveState, nodeId)) return false;
  return (node.requires || []).every(req => isPurchased(archiveState, req));
}

export function availableNodes(archiveState) {
  return ARCHIVE_NODES.filter(n => isAvailable(archiveState, n.id));
}

export function nodesByTier(tier) {
  return ARCHIVE_NODES.filter(n => n.tier === tier);
}

export function markPurchased(archiveState, nodeId) {
  if (!archiveState.purchased.includes(nodeId)) archiveState.purchased.push(nodeId);
}

/* GDD §9.4 -- the collection log. "seen" is a plain id -> state map;
   states are ordered strings, and a lower state never overwrites a
   higher one, so a re-encounter can't demote a mastered entry. */
export const SEEN_STATES = Object.freeze(['seen', 'defeated', 'mastered']);

export function recordSeen(archiveState, entryId, state) {
  const cur = archiveState.seen[entryId];
  const nextIdx = SEEN_STATES.indexOf(state);
  if (nextIdx < 0) return false;
  if (cur != null && SEEN_STATES.indexOf(cur) >= nextIdx) return false;
  archiveState.seen[entryId] = state;
  return true;
}

export function seenCount(archiveState) {
  return Object.keys((archiveState && archiveState.seen) || {}).length;
}
