/* Map fairness — the declarative constraint language (Phase 8 deliverable
   1). A constraint is a plain object: `check(graph)` reports pass/fail
   without mutating anything; `repair(graph)` deterministically mutates
   `graph.nodes[id].type` to fix its own violation. `graph` shape:
     { rows, nodes: {id: {id, row, lane, type}}, edges: [[a,b],...],
       paths: [[id0, id1, ...], ...] }
   `paths` are the literal generated walks (map_gen.js), one node per row,
   not a general DAG path-enumeration — every check here stays O(paths x
   rows), never combinatorial.

   Never touches row 0 (the fixed opener) or the last row (the fixed
   boss) when repairing — `FIXED_ROW` below is the single place that
   knows that rule. */

function isFixedRow(node, graph) {
  return node.row === 0 || node.row === graph.rows - 1;
}

/* Preferred conversion order when a repair needs to turn *some* node on
   a path into `type`: prefer thinning a Combat slot first, then an
   Event, then Treasure/Archive — never a Rest/Shop/Elite (those are
   themselves scarce/meaningful) and never a fixed-row node. */
const REPAIR_DONOR_PRIORITY = ['combat', 'event', 'treasure', 'archive'];

function neighborsOf(graph, id) {
  const out = [];
  graph.edges.forEach(([a, b]) => { if (a === id) out.push(b); if (b === id) out.push(a); });
  return out;
}

/* `avoidType`, when given, skips any candidate adjacent to an existing
   node of that type -- without this, converting a donor to `type` right
   next to an existing `type` node just recreates a `noAdjacent`
   violation, which that constraint's own repair then "fixes" by
   demoting the very node this just placed, and the pair can oscillate
   forever across repair rounds instead of converging. Falls back to
   ignoring adjacency only if every same-priority candidate on the path
   is adjacency-blocked, so a donor is still found whenever one
   structurally exists. */
function pickDonor(path, graph, exclude, avoidType) {
  for (const strict of avoidType ? [true, false] : [false]) {
    for (const donorType of REPAIR_DONOR_PRIORITY) {
      for (let i = 1; i < path.length - 1; i++) {
        const node = graph.nodes[path[i]];
        if (node.type !== donorType || isFixedRow(node, graph) || exclude.has(node.id)) continue;
        if (strict && neighborsOf(graph, node.id).some(nid => graph.nodes[nid].type === avoidType)) continue;
        return node;
      }
    }
  }
  return null;
}

export function atLeastOnePerPath(type) {
  return {
    kind: 'atLeastOnePerPath', type,
    check(graph) {
      const bad = graph.paths.filter(p => !p.some(id => graph.nodes[id].type === type));
      return { pass: bad.length === 0, detail: `${bad.length} path(s) missing '${type}'` };
    },
    repair(graph) {
      const touched = new Set();
      graph.paths.forEach(path => {
        if (path.some(id => graph.nodes[id].type === type)) return;
        const donor = pickDonor(path, graph, touched, type);
        if (donor) { donor.type = type; touched.add(donor.id); }
      });
    }
  };
}

export function noAdjacent(type) {
  return {
    kind: 'noAdjacent', type,
    check(graph) {
      const bad = graph.edges.filter(([a, b]) => graph.nodes[a].type === type && graph.nodes[b].type === type);
      return { pass: bad.length === 0, detail: `${bad.length} adjacent '${type}' pair(s)` };
    },
    repair(graph) {
      graph.edges.forEach(([a, b]) => {
        const nb = graph.nodes[b];
        if (graph.nodes[a].type === type && nb.type === type && !isFixedRow(nb, graph)) nb.type = 'event';
      });
    }
  };
}

export function maxRun(type, n) {
  return {
    kind: 'maxRun', type, n,
    check(graph) {
      let worst = 0;
      graph.paths.forEach(path => {
        let run = 0;
        path.forEach(id => {
          run = graph.nodes[id].type === type ? run + 1 : 0;
          if (run > worst) worst = run;
        });
      });
      return { pass: worst <= n, detail: `longest '${type}' run is ${worst} (max ${n})` };
    },
    repair(graph) {
      graph.paths.forEach(path => {
        let run = 0;
        for (let i = 0; i < path.length; i++) {
          const node = graph.nodes[path[i]];
          run = node.type === type ? run + 1 : 0;
          if (run > n && !isFixedRow(node, graph)) { node.type = 'event'; run = 0; }
        }
      });
    }
  };
}

/* Generic over `act` for forward-compat with Act III's Requiem Altar;
   Act I's own constraint list (map_data.js) doesn't include this one. */
export function exactlyOnce(type, opts = {}) {
  return {
    kind: 'exactlyOnce', type, act: opts.act,
    check(graph) {
      const count = Object.values(graph.nodes).filter(n => n.type === type).length;
      return { pass: count === 1, detail: `${count} '${type}' node(s) (want exactly 1)` };
    },
    repair(graph) {
      const matches = Object.values(graph.nodes).filter(n => n.type === type);
      if (matches.length === 0) {
        const donor = pickDonor(graph.paths[0], graph, new Set(), type);
        if (donor) donor.type = type;
      } else if (matches.length > 1) {
        matches.slice(1).forEach(n => { if (!isFixedRow(n, graph)) n.type = 'event'; });
      }
    }
  };
}

export function checkAll(graph, constraints) {
  const violations = constraints
    .map(c => ({ constraint: c, ...c.check(graph) }))
    .filter(r => !r.pass);
  return { pass: violations.length === 0, violations };
}

/* Deterministic repair floor (§1's layer 2): run each still-failing
   constraint's own repair, most structurally important first. A single
   pass can make one constraint's fix re-break an earlier one (e.g.
   inserting a Rest to satisfy `atLeastOnePerPath` can land it next to
   an existing Rest, which `noAdjacent` then has to fix in turn) so the
   whole priority-ordered pass re-runs until every constraint holds
   simultaneously or nothing changed in a round (a real fixed point,
   deterministic since no repair() ever consults `rng`). `ROUND_LIMIT`
   is just a termination backstop for a graph this small, never expected
   to bind in practice. */
const REPAIR_PRIORITY = ['exactlyOnce', 'atLeastOnePerPath', 'noAdjacent', 'maxRun'];
const ROUND_LIMIT = 8;

export function repairToFit(graph, constraints) {
  const ordered = [...constraints].sort((a, b) => REPAIR_PRIORITY.indexOf(a.kind) - REPAIR_PRIORITY.indexOf(b.kind));
  for (let round = 0; round < ROUND_LIMIT; round++) {
    let anyRepaired = false;
    ordered.forEach(c => {
      if (!c.check(graph).pass) { c.repair(graph); anyRepaired = true; }
    });
    const result = checkAll(graph, constraints);
    if (result.pass || !anyRepaired) return result;
  }
  return checkAll(graph, constraints);
}
