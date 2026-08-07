/* Phase 13f shared helpers for the systems-collision matrix.

   Every case in qa_collision_cases*.js builds its fight through
   replay.js's buildCombatFromHeader -- the same entry scripts/fuzz.js and
   qa_ai_probe.js use, and the only one that accepts standId/aspectId/
   menace/relics/duos/discs. Nothing here touches canvas/DOM (invariant 1)
   and nothing steps on wall-clock time (invariant 2).

   State pokes (setting player.persistence to 0 on an exact frame) are
   deliberately NOT part of a replay's `log`, so `npm run replay` alone
   cannot reproduce a poked case -- the runner's own `--case=<id>` is the
   deterministic repro, and every ledger entry cites that. Same honesty
   caveat docs/qa/replays/README.md already carries for the 13c fixtures. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCombatFromHeader, createReplayRecorder, attachRecorder, checksumFrame } from '../replay.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPLAY_DIR = resolve(HERE, '../../../docs/qa/replays');

export { buildCombatFromHeader, checksumFrame };

/* Steps a combat forward, calling `preFrame(combat, frame)` before each
   step and `perFrame(combat, frame)` after it. Either may return the
   string 'stop' to halt early. Returns the frame count reached. */
export function stepFight(combat, frames, preFrame, perFrame) {
  let f = 0;
  for (; f < frames && combat.outcome === 'fighting'; f++) {
    const frame = combat.getFrame();
    if (preFrame && preFrame(combat, frame) === 'stop') break;
    combat.step();
    if (perFrame && perFrame(combat, combat.getFrame()) === 'stop') break;
  }
  return combat.getFrame();
}

/* Recording is opt-in per process (the runner's --record). A case builds
   its fight through mkCombat(id, header) instead of calling
   buildCombatFromHeader directly; when recording is on, a recorder is
   attached to that very run, so the fixture is the case's real inputs and
   per-second checksums rather than a re-enactment of them. */
let RECORDING = false;
const PENDING = [];

export function setRecording(on) { RECORDING = !!on; }

export function mkCombat(id, header) {
  const combat = buildCombatFromHeader(header);
  if (RECORDING) {
    const recorder = createReplayRecorder(header);
    attachRecorder(combat, recorder);
    PENDING.push({ id, recorder, combat });
  }
  return combat;
}

/* Writes one fixture per combat built under mkCombat since the last call.
   A case that builds several fights gets one file per fight, suffixed. */
export function flushRecords() {
  if (!PENDING.length) return [];
  mkdirSync(REPLAY_DIR, { recursive: true });
  const byId = new Map();
  const written = [];
  for (const { id, recorder, combat } of PENDING) {
    const n = (byId.get(id) || 0) + 1;
    byId.set(id, n);
    const name = n === 1 ? id : `${id}-${n}`;
    writeFileSync(resolve(REPLAY_DIR, `${name}.json`), JSON.stringify(recorder.finish(combat)));
    written.push(name);
  }
  PENDING.length = 0;
  return written;
}

/* Presses a key for exactly one frame's worth of edge (down then up on
   the next call), matching how input.js edges an action. */
export function tap(combat, code, frame, at) {
  if (frame === at) combat.setKey(code, true);
  else if (frame === at + 1) combat.setKey(code, false);
}

export function alive(combat) { return combat.enemies.filter(e => e.hp > 0); }

export function firstEnemy(combat) { return combat.enemies[0]; }

/* A finding result. `frame` and `seed` are mandatory per the phase brief:
   a finding without a deterministic repro is a rumour. */
export function found(text, seed, frame, detail) {
  return { finding: text, seed, frame, detail: detail || null };
}

export function clean(detail) { return { finding: null, detail: detail || null }; }

/* Structural absence: the mission asked for a mechanic this codebase does
   not have. Recorded explicitly rather than silently skipped. */
export function absent(text, where) {
  return { finding: null, absent: text, detail: where || null };
}

export function isFinite2(n) { return typeof n === 'number' && Number.isFinite(n); }
