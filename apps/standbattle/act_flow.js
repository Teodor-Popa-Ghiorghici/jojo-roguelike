/* Act transition — split out of run_flow.js (Phase 9d) to keep that file
   under the 300-line cap now that a run spans 4 Acts instead of 1.
   `enterAct` is the one function both a fresh run (act 1) and a
   boss-clear act transition (act N+1, run_flow.js's commitNode) call, so
   "start a new Act" is never a second code path -- both read `rs.act` and
   hand it straight to map_gen.js's generateActMap. */

import { generateActMap } from './map_gen.js';

export function enterAct(rs, rng) {
  const graph = generateActMap(rng.stream('map'), rs.act);
  const rootId = Object.values(graph.nodes).find(n => n.row === 0).id;
  rs.graph = graph;
  rs.nodeId = rootId;
  rs.visited = [rootId];
}
