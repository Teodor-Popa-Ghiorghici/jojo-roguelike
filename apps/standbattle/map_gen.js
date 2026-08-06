/* Act map generator — Phase 8 (Act I) + Phase 9d (generalized to N Acts).
   Draws only from `rng.stream('map')` (rng.js's independent-by-name
   streams), once per run/Act at creation time, never lazily as the player
   walks the graph, so the whole map can render (including unvisited
   branches) from the start. Two-layer retry per §1 of the phase plan: a
   bounded resample loop first, a deterministic repair floor if that's
   exhausted -- the same shape as encounter_budget.js's own fairness-floor
   repair pass. `generateActMap(rng, actNumber)` is the one generator for
   every Act; ACT_CONFIGS (map_data.js) supplies the only thing that
   varies. */

import {
  LANES, MAX_ATTEMPTS, INTERIOR_TYPES, LEAN_BY_PATH_COUNT, weightOf,
  PATH_COUNT_MIN, PATH_COUNT_MAX, ACT_CONFIGS
} from './map_data.js';
import { checkAll, repairToFit } from './map_constraints.js';
import { ENEMIES, ENCOUNTERS } from './data.js';

function nodeId(row, lane) { return `r${row}_${lane}`; }

function generateTopology(rng, rows, pathCount) {
  const nodes = {};
  const edgeSet = new Set();
  const edges = [];
  const paths = [];

  function ensureNode(row, lane) {
    const id = nodeId(row, lane);
    if (!nodes[id]) {
      nodes[id] = { id, row, lane, type: row === 0 ? 'combat' : row === rows - 1 ? 'boss' : null, firstPathLean: null };
    }
    return nodes[id];
  }
  function addEdge(a, b) {
    const key = a + '>' + b;
    if (!edgeSet.has(key)) { edgeSet.add(key); edges.push([a, b]); }
  }

  const leans = LEAN_BY_PATH_COUNT[pathCount];
  for (let p = 0; p < pathCount; p++) {
    const lean = leans[p];
    const path = [nodeId(0, 0)];
    ensureNode(0, 0);
    let lane = rng.int(0, LANES - 1);
    for (let row = 1; row <= rows - 2; row++) {
      if (row > 1) lane = Math.max(0, Math.min(LANES - 1, lane + rng.int(-1, 1)));
      const node = ensureNode(row, lane);
      if (node.firstPathLean == null) node.firstPathLean = lean;
      path.push(node.id);
    }
    ensureNode(rows - 1, 0);
    path.push(nodeId(rows - 1, 0));
    for (let i = 0; i < path.length - 1; i++) addEdge(path[i], path[i + 1]);
    paths.push(path);
  }

  return { rows, nodes, edges, paths };
}

function assignTypes(rng, graph) {
  Object.values(graph.nodes).forEach(node => {
    if (node.type) return; // row 0 / boss row already fixed
    const lean = node.firstPathLean || 'safe';
    const weights = INTERIOR_TYPES.map(t => weightOf(t, lean));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng.random() * total;
    let type = INTERIOR_TYPES[INTERIOR_TYPES.length - 1];
    for (let i = 0; i < INTERIOR_TYPES.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { type = INTERIOR_TYPES[i]; break; }
    }
    node.type = type;
  });
}

function labelForCombat(node) {
  if (node.encounter) return ENCOUNTERS[node.encounter].label;
  if (node.enemy) return ENEMIES[node.enemy].name;
  return 'FIGHT';
}

/* Picks *what* each typed node actually is (which encounter/enemy/event
   id) and which background scene it renders with, always after types are
   final (post-repair) so a repaired node gets real content instead of
   stale leftovers from before its type changed. */
function assignContent(rng, graph, cfg) {
  Object.values(graph.nodes).forEach(node => {
    if (node.row === 0) {
      node.enemy = cfg.rowZero.enemy; node.label = cfg.rowZero.label; node.scene = cfg.scenes.combat;
      return;
    }
    if (node.row === graph.rows - 1) {
      node.boss = cfg.boss.id; node.label = cfg.boss.label; node.scene = cfg.scenes.boss;
      return;
    }
    node.scene = cfg.scenes[node.type] || 'street';
    if (node.type === 'combat') { Object.assign(node, rng.pick(cfg.combatPool)); node.label = labelForCombat(node); }
    else if (node.type === 'elite') { Object.assign(node, rng.pick(cfg.elitePool)); node.label = 'ELITE: ' + labelForCombat(node); }
    else if (node.type === 'event') { node.event = rng.pick(cfg.eventPool); node.label = 'BIZARRE ENCOUNTER'; }
    else if (node.type === 'rest') { node.label = 'REST'; }
    else if (node.type === 'shop') { node.label = 'SHOP'; }
    else if (node.type === 'treasure') { node.label = 'TREASURE'; }
    else if (node.type === 'archive') { node.label = 'ARCHIVE'; }
  });
}

function finalize(graph, pathCount) {
  graph.pathCount = pathCount;
  graph.leans = LEAN_BY_PATH_COUNT[pathCount];
  return graph;
}

/* `graph.attempts` (0 = first try passed) and `graph.repaired` are the
   numbers map_check.js/sweep.js report the retry distribution from. */
export function generateActMap(rng, actNumber) {
  const cfg = ACT_CONFIGS[actNumber];
  let attemptGraph = null, pathCount = PATH_COUNT_MIN;
  let attempt = 0;
  for (; attempt < MAX_ATTEMPTS; attempt++) {
    const rows = rng.int(cfg.rowsMin, cfg.rowsMax);
    pathCount = rng.int(PATH_COUNT_MIN, PATH_COUNT_MAX);
    const graph = generateTopology(rng, rows, pathCount);
    assignTypes(rng, graph);
    attemptGraph = graph;
    if (checkAll(graph, cfg.constraints).pass) {
      graph.attempts = attempt;
      graph.repaired = false;
      assignContent(rng, graph, cfg);
      return finalize(graph, pathCount);
    }
  }
  const { pass } = repairToFit(attemptGraph, cfg.constraints);
  if (!pass) {
    throw new Error(`[map_gen] Act ${actNumber} map failed its fairness constraints even after the deterministic repair floor -- structurally unreachable, treat as a generator bug.`);
  }
  attemptGraph.attempts = attempt;
  attemptGraph.repaired = true;
  assignContent(rng, attemptGraph, cfg);
  return finalize(attemptGraph, pathCount);
}

/* Back-compat alias -- Phase 8 call sites (sweep.js, map_check.js) import
   this name directly; keeping it means those scripts need zero edits. */
export function generateAct1Map(rng) { return generateActMap(rng, 1); }
