/* Phase 13e — Stand x Aspect full-run matrix. Drives every (standId,
   aspectId) combination that aspects.js actually defines through N seeds
   each of the same real-flow driver qa_run_sweep.js uses
   (run_flow.js/run_choices.js, never a parallel sim), reporting per-config
   completion rate, mean run length (node visits), and mean damage taken.
   Only 4 of the 8 Stands currently carry any Aspect entries
   (star_platinum, silver_chariot, hierophant_green, killer_queen; 4 each
   = 16 configs) -- the other 4 Stands have no ASPECT_LIST rows at all, so
   they are reported separately with aspectId: null rather than silently
   padded to a fake 32-row matrix.

   node apps/standbattle/scripts/qa_matrix.js --seeds=N [--verbose] */

if (typeof globalThis.window === 'undefined') globalThis.window = {};

import { createRng } from '../rng.js';
import { STANDS } from '../data.js';
import { ASPECT_LIST, aspectsForStand } from '../aspects.js';
import { createSaveStore, ensureMetaProgress } from '../save.js';
import {
  createFreshRunState, resolveNodeEntry, commitNode, onCombatWin, onCombatFled, finishRunLoss
} from '../run_flow.js';
import { applyRewardChoice, applyEventChoice, applyRestChoice, applyShopAction } from '../run_choices.js';
import { fragmentPrice, healCost, canAfford } from '../economy.js';
import { ARCHIVE_BASELINE } from '../meta_archive.js';

const SEEDS = (() => {
  const a = process.argv.find(x => x.startsWith('--seeds='));
  return a ? parseInt(a.split('=')[1], 10) : 15;
})();
const verbose = process.argv.includes('--verbose');

const LIGHT_RANGE = 60, Z_TOLERANCE = 20;
function scriptFrame(combat) {
  const p = combat.player;
  const e = combat.enemies.find(x => x.hp > 0);
  if (!e) return;
  const dx = Math.abs(e.x - p.x), dz = Math.abs((e.z || 0) - (p.z || 0));
  const closingX = dx > LIGHT_RANGE, closingZ = dz > Z_TOLERANCE;
  combat.setKey('right', closingX && e.x >= p.x);
  combat.setKey('left', closingX && e.x < p.x);
  combat.setKey('forward', closingZ && (e.z || 0) < (p.z || 0));
  combat.setKey('back', closingZ && (e.z || 0) >= (p.z || 0));
  if (!closingX && !closingZ && p.state === 'idle') { combat.setKey('light', true); combat.setKey('light', false); }
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

const COMBAT_FRAME_CAP = 5400;
const GUARD_LIMIT = 400;

async function driveRun(seed, standId, aspectId, kv, files) {
  const rng = createRng(seed);
  const ctx = createFakeCtx(kv, files);
  const saveStore = createSaveStore(ctx);
  const meta = ensureMetaProgress(await saveStore.loadMeta());
  const loadout = { standId, aspectId, keepsakeId: null, menacePact: {}, donors: [...ARCHIVE_BASELINE.donors], assist: null };
  const state = {
    scene: 'map', runState: createFreshRunState(seed, rng, standId, loadout), runRng: rng, combat: null,
    currentEvent: null, currentOffer: null, shop: null, enteringNodeId: null, combatStartTsec: 0
  };
  const env = { ctx, saveStore, meta, tsec: 0, shakeEnabled: false, debugEnabled: false, flashEnabled: false, reduceParticles: true };
  const navRng = rng.stream('sim-nav');

  let guard = 0, nodeVisits = 0, damageTaken = 0, err = null;
  try {
    while (state.scene !== 'continued' && guard++ < GUARD_LIMIT) {
      if (state.scene === 'map') {
        nodeVisits++;
        const next = pickNextNode(state, navRng);
        if (!next) return { completed: false, reason: 'noEdge', nodeVisits, damageTaken };
        resolveNodeEntry(state, next, env);
      } else if (state.scene === 'combat') {
        const combat = state.combat;
        const hpBefore = state.runState.hp;
        let frames = 0;
        while (combat.outcome === 'fighting' && frames++ < COMBAT_FRAME_CAP) {
          scriptFrame(combat);
          combat.step();
          if (!Number.isFinite(combat.player.hp)) throw new Error('non-finite player hp');
        }
        if (combat.outcome === 'win') onCombatWin(state, env);
        else if (combat.outcome === 'fled') onCombatFled(state, env);
        else finishRunLoss(state, env);
        const hpAfter = state.runState.hp;
        damageTaken += Math.max(0, hpBefore - hpAfter);
      } else if (state.scene === 'reward') {
        if (state.currentOffer && state.currentOffer.length) applyRewardChoice(state, 0, env);
        else commitNode(state, env);
      } else if (state.scene === 'event') {
        applyEventChoice(state, 0, env);
      } else if (state.scene === 'rest') {
        const { restChoices } = await import('../rest.js');
        const choices = restChoices(state.runState);
        const heal = choices.find(c => c.id === 'heal');
        applyRestChoice(state, heal ? 'heal' : choices[0].id, env);
      } else if (state.scene === 'shop') {
        const offer = state.shop.offer[0];
        const rarity = offer && (offer.kind === 'duo' ? offer.duo.rarity : offer.frag.rarity);
        const price = offer ? fragmentPrice(rarity) : 0;
        if (offer && canAfford(state.runState, price)) applyShopAction(state, { type: 'buy' }, env);
        else if (canAfford(state.runState, healCost(state.runState.maxHp - state.runState.hp)) && state.runState.hp < state.runState.maxHp) {
          applyShopAction(state, { type: 'heal' }, env);
        }
        applyShopAction(state, { type: 'leave' }, env);
      } else if (state.scene === 'archive') {
        commitNode(state, env);
      } else break;
    }
  } catch (e) {
    err = e.message;
  }
  if (err) return { completed: false, reason: 'error:' + err, nodeVisits, damageTaken };
  if (guard >= GUARD_LIMIT && state.scene !== 'continued') return { completed: false, reason: 'guardExhausted', nodeVisits, damageTaken };
  if (state.scene === 'continued') return { completed: true, nodeVisits, damageTaken, outcome: state.summary && state.summary.outcome };
  return { completed: false, reason: 'unknown-scene:' + state.scene, nodeVisits, damageTaken };
}

async function main() {
  const kv = new Map();
  const files = new Map();
  const configs = [];
  for (const standId of Object.keys(STANDS)) {
    const aspects = aspectsForStand(standId);
    if (aspects.length === 0) { configs.push({ standId, aspectId: null }); continue; }
    for (const a of aspects) configs.push({ standId, aspectId: a.id });
  }

  console.log(`-- qa_matrix: ${configs.length} Stand x Aspect configs, ${SEEDS} seeds each --`);
  const rows = [];
  for (const cfg of configs) {
    let completed = 0, totalNodes = 0, totalDmg = 0;
    const fails = [];
    for (let i = 0; i < SEEDS; i++) {
      const seed = `matrix-${cfg.standId}-${cfg.aspectId || 'none'}-${i}`;
      const r = await driveRun(seed, cfg.standId, cfg.aspectId, kv, files);
      if (r.completed) completed++; else fails.push({ seed, reason: r.reason });
      totalNodes += r.nodeVisits;
      totalDmg += r.damageTaken;
    }
    const rate = (completed / SEEDS * 100).toFixed(1);
    rows.push({ standId: cfg.standId, aspectId: cfg.aspectId || '(none)', rate, meanNodes: (totalNodes / SEEDS).toFixed(1), meanDmg: (totalDmg / SEEDS).toFixed(1), fails });
    console.log(`${cfg.standId} / ${cfg.aspectId || '(none)'}: ${rate}% complete, meanNodes=${(totalNodes / SEEDS).toFixed(1)}, meanDmgTaken=${(totalDmg / SEEDS).toFixed(1)}${fails.length ? '  FAILS: ' + JSON.stringify(fails.slice(0, 3)) : ''}`);
  }
  const allFull = rows.every(r => r.rate === '100.0');
  console.log(allFull ? '\nALL CONFIGS 100% COMPLETION' : '\nSOME CONFIGS BELOW 100% -- see FAILS above');
}

main();
