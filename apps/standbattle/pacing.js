/* Pacing telemetry — Phase 13j (the long test). §14/§17 of the GDD make
   wall-clock claims (no run introduces >2 systems in a given slot; 25-40
   min per full clear; menus should stay a small fraction of playtime)
   that had never been checked against real play. This module answers
   that from the same choke point telemetry.js already uses for run
   summaries (ctx.fs, append-only JSONL) but as a separate stream: pacing
   spans hub time and multiple runs, not one run's own collector.

   Purely additive and read-only against sim/render state (rule.md):
   index.js diffs `state.scene`/`state.enteringNodeId` once per animation
   frame via the single `pacingTick` call below — no scene-assignment site
   elsewhere had to change. */

const PACING_PATH = 'standbattle/pacing.jsonl';

// hub_flow.js's own HUB_SCENES plus the two screens it doesn't own.
const MENU_SCENES = new Set(['hub', 'rack', 'terminal', 'menace', 'bonds', 'missions', 'training', 'continued', 'title', 'standselect']);

export function createPacingCollector() {
  return { prevScene: null, sceneStartTsec: 0, hubEnterTsec: null, nodeStartTsec: null, samples: [] };
}

function bucketFor(scene) {
  if (scene === 'combat') return 'encounter';
  if (scene === 'map') return 'transition';
  if (MENU_SCENES.has(scene)) return 'menu';
  return null; // event/rest/shop/archive/reward: counted under node span only, not double-booked as menu
}

/* Called once per rendered frame with the scene about to be drawn.
   Emits one [bucket, ms] sample each time the scene actually changes,
   and one ['launch_latency', ms] sample the moment a fresh run's map
   first appears after the most recent hub visit. */
export function tickPacing(pc, scene, runState, tsec) {
  if (pc.prevScene === null) { pc.prevScene = scene; pc.sceneStartTsec = tsec; if (scene === 'hub') pc.hubEnterTsec = tsec; }
  if (scene === pc.prevScene) return;
  const bucket = bucketFor(pc.prevScene);
  if (bucket) pc.samples.push([bucket, Math.round((tsec - pc.sceneStartTsec) * 1000)]);
  if (scene === 'map' && pc.hubEnterTsec != null && runState && !runState.nodeId && !runState.visited.length) {
    pc.samples.push(['launch_latency', Math.round((tsec - pc.hubEnterTsec) * 1000)]);
    pc.hubEnterTsec = null;
  }
  if (scene === 'hub') pc.hubEnterTsec = tsec;
  pc.sceneStartTsec = tsec;
  pc.prevScene = scene;
}

/* Node span: wall-clock from a map click (resolveNodeEntry sets
   enteringNodeId) to that node's commit (run_flow.js clears it back to
   null) — combat plus whatever reward/choice screens rode along with it,
   the number a player actually experiences as "that node took a while." */
export function tickNodeSpan(pc, enteringNodeId, runState, tsec) {
  const active = enteringNodeId != null;
  const was = pc.nodeStartTsec != null;
  if (active && !was) pc.nodeStartTsec = tsec;
  else if (!active && was) {
    const node = runState && runState.graph.nodes[runState.nodeId];
    pc.samples.push(['node:' + (node ? node.type : 'unknown'), Math.round((tsec - pc.nodeStartTsec) * 1000)]);
    pc.nodeStartTsec = null;
  }
}

/* index.js's single per-frame call: scene bucket + node span + a 15s
   best-effort flush, so index.js's render loop gains one line, not four. */
export function pacingTick(ctx, pc, state, tsec) {
  tickPacing(pc, state.scene, state.runState, tsec);
  tickNodeSpan(pc, state.enteringNodeId, state.runState, tsec);
  if (tsec - (pc.lastFlush || 0) > 15) { pc.lastFlush = tsec; flushPacing(ctx, pc); }
}

export async function flushPacing(ctx, pc) {
  if (!pc.samples.length) return;
  const batch = pc.samples.splice(0, pc.samples.length);
  let existing = '';
  try { existing = (await ctx.fs.read(PACING_PATH)) || ''; } catch (e) { existing = ''; }
  // Best-effort local logging (telemetry.js's own rule): must never throw
  // into the render loop that calls it.
  try { await ctx.fs.write(PACING_PATH, existing + JSON.stringify({ ts: Date.now(), samples: batch }) + '\n'); } catch (e) {}
}
