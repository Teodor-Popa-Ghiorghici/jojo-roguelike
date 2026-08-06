/* npm run telemetry-sim -- Phase 12 polish deliverable: no run log existed
   anywhere in the repo (nobody had played through the browser app), and
   the phase brief needs measured pick/win rate per Fragment and a measured
   hits-to-kill curve, not invented numbers. This drives N full headless
   runs through the REAL flow (run_flow.js/run_choices.js/act_flow.js --
   the exact functions index.js's click handlers call), never a parallel
   sim, with a naive scripted combat bot (headless_harness.js's own
   close-and-tap policy) standing in for a human player. Writes one
   telemetry.js-shaped JSONL line per finished run via a fake ctx.fs kept
   in memory, then dumps it to disk for a subagent to read. Also listens to
   the real `onDamageTaken` effect hook (dispatcher.on, read-only, same
   seam fx_wire.js's screen-flash cues use) to record every incoming hit's
   damage against the run's Act -- telemetry.js itself only tracks
   fight-level aggregates, not per-hit damage, and GDD §17's rule is a
   per-hit rule. */

// run_flow.js's startCombatForNode wires audio.js (a browser-only concern,
// window.Snd) the same way index.js does -- stub it so this headless
// driver can call the real flow functions unmodified rather than forking
// a parallel "no audio" version of startCombatForNode.
if (typeof globalThis.window === 'undefined') globalThis.window = {};

import { createRng } from '../rng.js';
import { STANDS } from '../data.js';
import { createSaveStore, ensureMetaProgress } from '../save.js';
import {
  createFreshRunState, resolveNodeEntry, commitNode, onCombatWin, onCombatFled, finishRunLoss
} from '../run_flow.js';
import { applyRewardChoice, applyEventChoice, applyRestChoice, applyShopAction } from '../run_choices.js';
import { fragmentPrice, canAfford } from '../economy.js';

const RUNS = (() => {
  const a = process.argv.find(x => x.startsWith('--runs='));
  return a ? parseInt(a.split('=')[1], 10) : 200;
})();

const LIGHT_RANGE = 60;
function scriptFrame(combat) {
  const p = combat.player;
  const e = combat.enemies.find(x => x.hp > 0);
  if (!e) return;
  const dist = Math.abs(e.x - p.x);
  const closing = dist > LIGHT_RANGE;
  combat.setKey('right', closing && e.x >= p.x);
  combat.setKey('left', closing && e.x < p.x);
  if (!closing && p.state === 'idle') { combat.setKey('light', true); combat.setKey('light', false); }
}

function createFakeCtx(kv, files) {
  return {
    async save(key, value) { kv.set(key, value); },
    async load(key) { return kv.has(key) ? kv.get(key) : null; },
    fs: {
      async read(path) { return files.has(path) ? files.get(path) : null; },
      async write(path, data) { files.set(path, data); },
      async list() { return [...files.keys()]; },
      async remove(path) { files.delete(path); }
    }
  };
}

function pickNextNode(state, rng) {
  const graph = state.runState.graph;
  const from = state.runState.nodeId;
  const options = graph.edges.filter(([a]) => a === from).map(([, b]) => b);
  return options.length ? rng.pick(options) : null;
}

const hitLog = []; // { act, dmg }

async function driveRun(seed, standId, kv, files) {
  const rng = createRng(seed);
  const ctx = createFakeCtx(kv, files);
  const saveStore = createSaveStore(ctx);
  const meta = ensureMetaProgress(await saveStore.loadMeta());
  const loadout = { standId, aspectId: null, keepsakeId: null, menacePact: {}, donors: null, assist: null };
  const state = {
    scene: 'map', runState: createFreshRunState(seed, rng, standId, loadout), runRng: rng, combat: null,
    currentEvent: null, currentOffer: null, shop: null, enteringNodeId: null, combatStartTsec: 0
  };
  const env = { ctx, saveStore, meta, tsec: 0, shakeEnabled: false, debugEnabled: false, flashEnabled: false, reduceParticles: true };
  const navRng = rng.stream('sim-nav');

  let guard = 0;
  while (state.scene !== 'continued' && guard++ < 400) {
    if (state.scene === 'map') {
      const next = pickNextNode(state, navRng);
      if (!next) break;
      resolveNodeEntry(state, next, env);
    } else if (state.scene === 'combat') {
      const combat = state.combat;
      const act = state.runState.act;
      combat.dispatcher.on('onDamageTaken', ev => { if (!ev.cancelled) hitLog.push({ act, dmg: ev.dmg }); });
      let frames = 0;
      while (combat.outcome === 'fighting' && frames++ < 5400) { scriptFrame(combat); combat.step(); }
      if (combat.outcome === 'win') onCombatWin(state, env);
      else if (combat.outcome === 'fled') onCombatFled(state, env);
      else finishRunLoss(state, env); // 'lose' or a 5400-frame timeout alike
    } else if (state.scene === 'reward') {
      if (state.currentOffer && state.currentOffer.length) applyRewardChoice(state, 0, env);
      else commitNode(state, env);
    } else if (state.scene === 'event') {
      applyEventChoice(state, 0, env); // choices[0] is always the 'fragment' branch (data_events.js)
    } else if (state.scene === 'rest') {
      applyRestChoice(state, 'heal', env);
    } else if (state.scene === 'shop') {
      const offer = state.shop.offer[0];
      const rarity = offer && (offer.kind === 'duo' ? offer.duo.rarity : offer.frag.rarity);
      if (offer && canAfford(state.runState, fragmentPrice(rarity))) applyShopAction(state, { type: 'buy' }, env);
      applyShopAction(state, { type: 'leave' }, env);
    } else if (state.scene === 'archive') {
      commitNode(state, env);
    } else break;
  }
}

async function main() {
  const kv = new Map();
  const files = new Map();
  const standIds = Object.keys(STANDS);
  for (let i = 0; i < RUNS; i++) {
    const standId = standIds[i % standIds.length];
    await driveRun(`telemetry-sim-${i}`, standId, kv, files);
  }
  const jsonl = files.get('standbattle/telemetry.jsonl') || '';
  // Written under the OS temp dir, never into the repo -- this output is
  // regenerable analysis scratch (npm run telemetry-sim), not a build artifact.
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'sba-telemetry-'));
  const outPath = join(dir, 'runs.jsonl');
  const hitsOutPath = join(dir, 'hits.jsonl');
  writeFileSync(outPath, jsonl);
  writeFileSync(hitsOutPath, hitLog.map(h => JSON.stringify(h)).join('\n'));
  console.log(`${RUNS} simulated runs -- ${jsonl.trim().split('\n').filter(Boolean).length} run summaries, ${hitLog.length} recorded hits.`);
  console.log(`Written to ${outPath} and ${hitsOutPath}`);
}

main();
