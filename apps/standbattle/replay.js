/* Replay recording/playback — Phase 13a foundation. A replay is
   {header, log, checkpoints, final}: header names the exact fight
   (seed + build), log is an ordered (action, frame, down) triple per
   setKey edge (matches input.js's own ring-buffer shape, just persisted),
   checkpoints are per-second folded state checksums so a divergence can be
   localized to a ~60-frame window without storing one checksum per frame
   (that would blow the 100KB/35min budget), and final is the recorded
   outcome/frame/hp for the cheap top-level assertion `npm run replay`
   makes first.

   This file is the only place that builds a combat instance from a replay
   header and the only place that folds combat state into a checksum, so
   the harness, the fuzzer and the CLI never duplicate that logic. */

import { createCombat } from './combat.js';
import { createRng } from './rng.js';
import { ENEMIES, BOSSES } from './data.js';

export const CHECKPOINT_INTERVAL = 60; // 1 real second at SIM_HZ

export function buildCombatFromHeader(header) {
  const rng = createRng(header.seed);
  const encounterDef = header.encounter || ENEMIES[header.enemyId] || BOSSES[header.enemyId];
  return createCombat(encounterDef, header.ownedFragments || [], {
    standId: header.standId, aspectId: header.aspectId, menace: header.menace,
    relics: header.relics, duos: header.duos, discs: header.discs,
    hpMult: header.hpMult, speedMult: header.speedMult,
    shakeEnabled: false
  }, rng);
}

/* Folds every entity's Transform/Health/Poise/Persistence/Momentum into
   one 32-bit int. Not cryptographic -- it only needs to change whenever
   sim state does, which a simple accumulating multiply-xor over scaled
   integers does well enough for divergence detection. */
export function checksumFrame(combat) {
  let h = 0x811c9dc5;
  const mix = n => { h = (Math.imul(h ^ (n | 0), 0x01000193)) >>> 0; };
  const all = combat.entities.concat(combat.enemies);
  all.forEach(e => {
    mix(Math.round(e.x * 4));
    mix(Math.round((e.z || 0) * 4));
    mix(Math.round((e.hp || 0) * 4));
    if (e.poise) mix(Math.round((e.poise.current === Infinity ? -1 : e.poise.current) * 4));
    (e.statuses || []).forEach(s => { mix(Math.round(s.stacks * 4)); mix(s.timer | 0); });
  });
  mix(combat.player.persistence | 0);
  mix(combat.player.momentum | 0);
  return h >>> 0;
}

export function createReplayRecorder(header) {
  const log = [];
  const checkpoints = [];
  return {
    header,
    logInput(action, frame, down) { log.push([action, frame, down ? 1 : 0]); },
    tick(combat) {
      const frame = combat.getFrame();
      if (frame % CHECKPOINT_INTERVAL === 0) checkpoints.push([frame, checksumFrame(combat)]);
    },
    finish(combat) {
      return {
        header,
        log,
        checkpoints,
        final: {
          frame: combat.getFrame(), outcome: combat.outcome,
          playerHp: combat.player.hp,
          enemyHp: combat.enemies.reduce((s, e) => s + e.hp, 0)
        }
      };
    }
  };
}

/* Wires a recorder onto a live combat instance (real gameplay or a
   headless policy loop) without combat.js needing to know replays exist.
   Wraps both entry points -- step() (headless, one frame per call) and
   update() (real rAF usage, zero-or-more frames per call via the fixed
   accumulator) -- so a checkpoint lands wherever the frame counter
   actually advances. */
export function attachRecorder(combat, recorder) {
  const rawSetKey = combat.setKey;
  combat.setKey = (code, down) => {
    recorder.logInput(code, combat.getFrame(), down);
    rawSetKey(code, down);
  };
  const rawStep = combat.step;
  combat.step = () => { rawStep(); recorder.tick(combat); };
  const rawUpdate = combat.update;
  combat.update = dtMs => { rawUpdate(dtMs); recorder.tick(combat); };
  return combat;
}

/* Records a full headless fight under a scripted/random policy function
   `policyFn(combat, frame)`, called once before each combat.step(). Used
   both to manufacture the fixture replays `npm run replay` self-checks
   against and by the fuzzer to produce a replay file for any run that
   trips an invariant. */
export function recordHeadlessRun(header, policyFn, maxFrames) {
  const combat = buildCombatFromHeader(header);
  const recorder = createReplayRecorder(header);
  attachRecorder(combat, recorder);
  let f = 0;
  for (; f < maxFrames && combat.outcome === 'fighting'; f++) {
    policyFn(combat, combat.getFrame());
    combat.step();
  }
  return recorder.finish(combat);
}

/* Reruns a saved replay headlessly: rebuilds combat from `header`, feeds
   `log` back in at the exact recorded frames, and steps until the log is
   exhausted plus a tail so the fight actually resolves. Returns the fresh
   run's own final/checkpoints so the caller can diff them against the
   recorded ones. */
export function replayRun(replayData, opts) {
  opts = opts || {};
  const { header, log } = replayData;
  const combat = buildCombatFromHeader(header);
  const maxLogFrame = log.reduce((m, e) => Math.max(m, e[1]), 0);
  const recordedFrame = (replayData.final && replayData.final.frame) || 0;
  const target = Math.max(maxLogFrame, recordedFrame);
  const frameCap = opts.frameCap || (target + (opts.tailFrames != null ? opts.tailFrames : 300));
  const checkpoints = [];
  let li = 0;
  let f = 0;
  for (; f < frameCap && combat.outcome === 'fighting'; f++) {
    while (li < log.length && log[li][1] === combat.getFrame()) {
      combat.setKey(log[li][0], !!log[li][2]);
      li++;
    }
    combat.step();
    if (combat.getFrame() % CHECKPOINT_INTERVAL === 0) checkpoints.push([combat.getFrame(), checksumFrame(combat)]);
  }
  return {
    combat, checkpoints,
    final: {
      frame: combat.getFrame(), outcome: combat.outcome,
      playerHp: combat.player.hp,
      enemyHp: combat.enemies.reduce((s, e) => s + e.hp, 0)
    }
  };
}

/* First checkpoint frame where two checkpoint lists disagree, or null if
   they match everywhere they both have data. Granularity is
   CHECKPOINT_INTERVAL frames -- the true divergence happened at or before
   the reported frame, within that window. */
export function firstDivergence(recordedCheckpoints, freshCheckpoints) {
  const n = Math.min(recordedCheckpoints.length, freshCheckpoints.length);
  for (let i = 0; i < n; i++) {
    const [rf, rc] = recordedCheckpoints[i];
    const [ff, fc] = freshCheckpoints[i];
    if (rf !== ff || rc !== fc) return Math.min(rf, ff);
  }
  if (recordedCheckpoints.length !== freshCheckpoints.length) {
    const shorter = n;
    const longer = recordedCheckpoints.length > freshCheckpoints.length ? recordedCheckpoints : freshCheckpoints;
    return longer[shorter] ? longer[shorter][0] : null;
  }
  return null;
}
