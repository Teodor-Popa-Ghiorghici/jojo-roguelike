/* node apps/standbattle/scripts/qa_ai_probe.js [--runs=N] [--seed=S]
     [--section=tokens|profiles|aggro|all] [--crowded=N] [--verbose]

   Phase 13d crowd-AI instrumentation. Answers the questions a pass/fail
   fuzzer cannot: how long an attack token is HELD, how long the crowd goes
   with nobody holding one, whether a token can be held by an entity that
   cannot act (the encounter-stalling deadlock), whether the ranged pool is
   really separate, and whether two behaviour profiles are statistically
   distinguishable at all.

   Read-only observer: it wraps combat.dispatcher.runEffect to COUNT hooks
   and samples combat.tokenSystem/ai state after each step. It never writes
   sim state, so an instrumented run is byte-identical to an uninstrumented
   one (invariant 8's spirit -- this is a watcher, not a participant).

   Prints a fixed table on success; `--verbose` adds the per-encounter and
   per-enemy-instance breakdowns. */

import { ENCOUNTERS } from '../data_encounters.js';
import { buildCombatFromHeader } from '../replay.js';
import { createMenaceProfile } from '../meta_menace.js';
import { PATTERNS } from '../ai.js';
import { SYNTHETIC, reportTokens, reportRanged, reportProfiles, pct } from './qa_ai_content.js';

const arg = (name, dflt) => {
  const a = process.argv.find(s => s.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : dflt;
};
export const VERBOSE = process.argv.includes('--verbose');

const RUNS = parseInt(arg('runs', '40'), 10);
const BASE_SEED = arg('seed', 'aiprobe');
const SECTION = arg('section', 'all');
const CROWDED = parseInt(arg('crowded', '0'), 10);
const FRAME_CAP = parseInt(arg('frames', '3600'), 10);

/* Crowd encounters only -- a solo boss has 1 candidate for 2 melee slots,
   so every token statistic is trivially "always held" and tells us nothing
   about crowd health. */
export const CROWD_ENCOUNTERS = [
  'morioh_shopping_street', 'morioh_alley_scuffle', 'kameyu_loading_dock',
  'cairo_bazaar_ambush', 'nile_docks_scuffle', 'train_corridor_clash',
  'piazza_gang_skirmish', 'vineyard_ambush', 'villa_hitmen',
  'morioh_alley_ambush', 'kameyu_holdout', 'kameyu_bounty'
].filter(id => ENCOUNTERS[id]);


export function idleFrame(combat) {
  ['left', 'right', 'forward', 'back', 'light', 'medium', 'heavy', 'special',
    'rush', 'dodge', 'parry', 'guard', 'project', 'command'].forEach(a => combat.setKey(a, false));
}

export function isPlayerVulnerable(p) {
  return (p.state === 'attack' && p.movePhase === 'recover') || p.state === 'hitstun' || p.state === 'staggered';
}

/* An enemy holding a token that is in ANY of these states cannot convert it
   into an attack this frame. `flee` is the dangerous one: combat_enemy.js
   returns before stepEnemyAI for a fleeing enemy, so its ai.state can never
   leave 'flee' and token.js's release condition (committed && back in
   'approach') can never fire. */
export function holderCanAct(e) {
  if (!e || e.hp <= 0) return false;
  if ((e.invulnFrames || 0) > 0) return false;
  return e.ai.state !== 'staggered' && e.ai.state !== 'flee';
}

function isRangedDef(def) {
  return (def.attackPatterns || []).every(id => PATTERNS[id] && PATTERNS[id].ranged);
}

/* Counts User-vs-Stand hit routing without touching resolveTarget: the two
   damage paths each fire exactly one distinct hook (combat_stand.js's
   onFeedbackDamage for the Stand, combat_defense.js's onDamageTaken for the
   User). */
export function instrumentHits(combat) {
  const st = { standHits: 0, userHits: 0, seq: [], switches: 0 };
  const bus = combat.dispatcher;
  const raw = bus.runEffect;
  bus.runEffect = (hook, ctx) => {
    if (hook === 'onFeedbackDamage') st.seq.push('S');
    else if (hook === 'onDamageTaken' && ctx && ctx.entity === combat.player) st.seq.push('U');
    return raw.call(bus, hook, ctx);
  };
  st.finish = () => {
    st.standHits = st.seq.filter(c => c === 'S').length;
    st.userHits = st.seq.length - st.standHits;
    for (let i = 1; i < st.seq.length; i++) if (st.seq[i] !== st.seq[i - 1]) st.switches++;
    return st;
  };
  return st;
}

function newAcc() {
  return {
    frames: 0, vulnFrames: 0,
    slots: null,
    holds: [], gaps: [],
    noHolder: { run: 0, max: 0, at: 0 },
    noPressure: { run: 0, max: 0, at: 0 },
    deadlock: { run: 0, max: 0, at: 0, holders: '' },
    deadHoldFrames: 0, heldFrames: 0, meleeSlotFrames: 0,
    rangedSlotHeldFrames: 0, rangedInMeleeSlotFrames: 0,
    rangedFiringDuringMeleeCommit: 0, rangedActiveFrames: 0,
    byUid: new Map()
  };
}

let UID = 0;
function uidOf(e) {
  if (e.__qaUid == null) e.__qaUid = `${e.def.id}#${++UID}`;
  return e.__qaUid;
}

function statOf(acc, e) {
  const uid = uidOf(e);
  let s = acc.byUid.get(uid);
  if (!s) {
    s = {
      uid, defId: e.def.id, profile: e.def.profile || 'aggressor',
      ranged: isRangedDef(e.def), grants: 0, candidateFrames: 0,
      commits: 0, commitsWhileVuln: 0, releasesOutOfRange: 0, releases: 0,
      blockFrames: 0, aliveFrames: 0, lastState: null, hadToken: false
    };
    acc.byUid.set(uid, s);
  }
  return s;
}

/* One post-step sample. Everything here reads state that stepTokens/
   stepEnemyAI already settled this frame. */
export function sampleFrame(combat, acc) {
  const f = combat.getFrame();
  const slots = combat.tokenSystem.slots;
  if (!acc.slots) acc.slots = slots.map(() => ({ uid: null, since: 0, freeSince: 0 }));
  acc.frames++;
  if (isPlayerVulnerable(combat.player)) acc.vulnFrames++;

  const alive = combat.enemies.filter(e => e.hp > 0);
  const meleeSlots = slots.filter(s => s.pool === 'melee');
  acc.meleeSlotFrames += meleeSlots.length;

  // --- per-slot hold/gap spans -------------------------------------------
  slots.forEach((slot, i) => {
    const rec = acc.slots[i];
    const uid = slot.holder ? uidOf(slot.holder) : null;
    if (uid !== rec.uid) {
      if (rec.uid != null) acc.holds.push({ frames: f - rec.since, slot: i, uid: rec.uid, end: f });
      if (rec.uid == null && rec.freeSince > 0) acc.gaps.push({ frames: f - rec.freeSince, slot: i, end: f });
      rec.uid = uid;
      if (uid == null) rec.freeSince = f; else rec.since = f;
    }
    if (slot.holder) {
      acc.heldFrames++;
      if (!holderCanAct(slot.holder)) acc.deadHoldFrames++;
      if (slot.pool === 'ranged') acc.rangedSlotHeldFrames++;
      if (slot.pool === 'melee' && isRangedDef(slot.holder.def)) acc.rangedInMeleeSlotFrames++;
    }
  });

  // --- crowd-level gaps ---------------------------------------------------
  const anyHeld = meleeSlots.some(s => s.holder);
  const anyPressure = alive.some(e => e.ai.state === 'windup' || e.ai.state === 'active');
  const allHeld = meleeSlots.length > 0 && meleeSlots.every(s => s.holder);
  const noneCanAct = allHeld && meleeSlots.every(s => !holderCanAct(s.holder));
  [[acc.noHolder, !anyHeld], [acc.noPressure, !anyPressure], [acc.deadlock, noneCanAct]].forEach(([m, cond]) => {
    if (cond) {
      m.run++;
      if (m.run > m.max) { m.max = m.run; m.at = f; }
    } else m.run = 0;
  });
  if (noneCanAct && acc.deadlock.run === acc.deadlock.max) {
    acc.deadlock.holders = meleeSlots.map(s => `${s.holder.def.id}:${s.holder.ai.state}`).join(',');
  }

  // --- ranged-pool separation --------------------------------------------
  const meleeCommit = alive.some(e => !isRangedDef(e.def) && (e.ai.state === 'windup' || e.ai.state === 'active'));
  alive.filter(e => isRangedDef(e.def)).forEach(e => {
    if (e.ai.state === 'active' || e.ai.state === 'windup') {
      acc.rangedActiveFrames++;
      if (meleeCommit) acc.rangedFiringDuringMeleeCommit++;
    }
  });

  // --- per-instance profile counters --------------------------------------
  const freePools = new Set(slots.filter(s => !s.holder && s.cooldownFrames <= 0).map(s => s.pool));
  alive.forEach(e => {
    const s = statOf(acc, e);
    s.aliveFrames++;
    const pool = e.def.tokenPool === 'ranged' ? 'ranged' : 'melee';
    if (!e.hasToken && !e.def.ignoresToken && e.ai.state !== 'staggered' && freePools.has(pool)) s.candidateFrames++;
    if (e.hasToken && !s.hadToken) s.grants++;
    if (!e.hasToken && s.hadToken) {
      s.releases++;
      if (Math.abs(combat.player.x - e.x) > e.ai.approachRange) s.releasesOutOfRange++;
    }
    s.hadToken = !!e.hasToken;
    if (s.lastState === 'approach' && e.ai.state === 'windup') {
      s.commits++;
      if (acc.lastVuln) s.commitsWhileVuln++;
    }
    if (e.guarding || e.blocking) s.blockFrames++; // no enemy-side guard exists; measured, not assumed
    s.lastState = e.ai.state;
  });
  acc.lastVuln = isPlayerVulnerable(combat.player);
}

export function runEncounter(seed, encounterId, opts) {
  opts = opts || {};
  const header = {
    seed, encounter: ENCOUNTERS[encounterId] || SYNTHETIC[encounterId], standId: opts.standId || 'star_platinum',
    menace: opts.crowded ? createMenaceProfile({ crowded: opts.crowded }) : undefined
  };
  const combat = buildCombatFromHeader(header);
  const acc = opts.acc || newAcc();
  acc.slots = null; // per-run: combat.getFrame() restarts at 0, spans must not straddle runs
  const hits = instrumentHits(combat);
  const policy = opts.policy || idleFrame;
  /* Observer-side HP top-up, used ONLY for steady-state token statistics:
     an idle player dies in ~15s, which is far too short a window to measure
     "the longest gap where nobody held a token". Flagged in the report --
     every deadlock/repro finding below is reproduced WITHOUT it. */
  for (let f = 0; f < (opts.frameCap || FRAME_CAP) && combat.outcome === 'fighting'; f++) {
    if (opts.immortal) combat.player.hp = combat.player.maxHp;
    policy(combat, f);
    combat.step();
    sampleFrame(combat, acc);
  }
  hits.finish();
  return { combat, acc, hits, seed, encounterId };
}

if (process.argv[1] && process.argv[1].endsWith('qa_ai_probe.js')) {
  const acc = newAcc();
  let runs = 0;
  const pool = arg('pool', 'shipped') === 'synthetic' ? Object.keys(SYNTHETIC)
    : arg('pool', 'shipped') === 'both' ? CROWD_ENCOUNTERS.concat(Object.keys(SYNTHETIC)) : CROWD_ENCOUNTERS;
  const IMMORTAL = process.argv.includes('--immortal');
  const hitTotals = { standHits: 0, userHits: 0, switches: 0, seqLen: 0 };
  for (let i = 0; i < RUNS; i++) {
    const encId = pool[i % pool.length];
    const r = runEncounter(`${BASE_SEED}-${i}`, encId, { acc, crowded: CROWDED || 0, immortal: IMMORTAL, standId: arg('stand', 'star_platinum') });
    hitTotals.standHits += r.hits.standHits; hitTotals.userHits += r.hits.userHits;
    hitTotals.switches += r.hits.switches; hitTotals.seqLen += r.hits.seq.length;
    runs++;
  }
  const out = [];
  if (SECTION === 'all' || SECTION === 'tokens') out.push(...reportTokens(acc, runs), ...reportRanged(acc));
  if (SECTION === 'all' || SECTION === 'profiles') out.push(...reportProfiles(acc));
  if (SECTION === 'all' || SECTION === 'aggro') {
    out.push('AGGRO ROUTING (crowd, Close-Range control)',
      '  User hits ' + hitTotals.userHits + ' / Stand hits ' + hitTotals.standHits +
      ' / target switches between consecutive hits ' + pct(hitTotals.switches, Math.max(1, hitTotals.seqLen - 1)));
  }
  console.log(out.join('\n'));
}
