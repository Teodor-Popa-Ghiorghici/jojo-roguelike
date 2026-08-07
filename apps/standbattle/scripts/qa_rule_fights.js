/* node apps/standbattle/scripts/qa_rule_fights.js [--frames=N] [--seed=S]
     [--section=matrix|fail|btd|all] [--verbose]

   Phase 13d test-matrix item 8 -- Rule Fight AI. Only EIGHT of the phase
   brief's "12" Rule Fights shipped (cut per docs/phase-reports/phase-11b.md);
   this drives all eight, against all three Stand Control Schemes
   (stand_classes.js's CONTROL_SCHEMES close/mid/long), and answers three
   questions per cell:

     ACHIEVABLE     -- does a scripted, rule-respecting player actually win
                       inside --frames (default 7200 = 2 min)?
     DAMAGE WINDOW  -- what fraction of boss-alive frames was the boss
                       actually damageable under the rule?
     FAILS CLEANLY  -- does the failure path reach a terminal
                       combat.outcome with finite state, or hang?

   Note recorded by this script, not assumed: none of the eight rewrites
   `winCondition`. All eight ship as winCondition:'killAll'
   (data_encounters.js:113-146) and instead rewrite how damage is allowed
   to LAND (onHitResolve/getDamage) or what standing still costs.

   The script pokes sim state directly in the `btd` section only (forcing
   HP, parking the enemy, spawning a hazard, applying a status) -- that is
   deliberate and called out in the output, so a specific death SOURCE can
   be isolated. The matrix and fail sections drive input only. */

import { ENCOUNTERS } from '../data_encounters.js';
import { buildCombatFromHeader, checksumFrame } from '../replay.js';
import { resolveReach } from '../resolvers.js';
import { spawnHazard } from '../hazards.js';
import { applyStatus } from '../status.js';
import { ARENA_MIN, ARENA_MAX, Z_REST } from '../constants.js';
import {
  makeInput, windowOpen, dmgScale, inHitRange, policyFrame, finiteBad, SHA_SPOT_X, FATE_RADIUS
} from './qa_rule_fight_cases.js';

const arg = (n, d) => { const a = process.argv.find(s => s.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const FRAME_CAP = parseInt(arg('frames', '7200'), 10);
const SEED = arg('seed', 'rf');
const SECTION = arg('section', 'all');
const VERBOSE = process.argv.includes('--verbose');

export const FIGHTS = [
  ['rf_sheer_heart_attack', 'budogaoka_sheer_heart_attack'],
  ['rf_illusos_mirror', 'kameyu_illusos_mirror'],
  ['rf_formaggios_shrink', 'alley_formaggios_shrink'],
  ['rf_baby_face', 'shopping_street_baby_face'],
  ['rf_yellow_temperance', 'loading_dock_yellow_temperance'],
  ['rf_rolling_stones', 'park_rolling_stones'],
  ['rf_bites_the_dust', 'budogaoka_bites_the_dust'],
  ['rf_cheap_trick', 'alley_cheap_trick']
];
/* One Stand per CONTROL_SCHEMES entry, each with NO innateAbilities, so a
   Stand's own kit can never be mistaken for the Rule Fight's behaviour. */
export const CLASSES = [['close', 'star_platinum'], ['mid', 'silver_chariot'], ['long', 'hierophant_green']];

const TERMINAL = new Set(['win', 'lose', 'fled']);

export function runFight(fightId, encId, scheme, standId, seed, opts) {
  opts = opts || {};
  const combat = buildCombatFromHeader({ seed, encounter: ENCOUNTERS[encId], standId });
  const inp = makeInput(combat);
  const boss = combat.enemies[0];
  const st = {
    scheme, ri: 0, pressed: null, rotation: ['light', 'medium', 'heavy'],
    reach: resolveReach(combat.player.stand.stats.range, 1.0), reckless: !!opts.reckless
  };
  st.engage = Math.max(18, st.reach * 0.45);
  /* Sustained-window probe only: one setup poke that makes the boss
     unkillable, so a rule slower than the shipped enemy's 22-95 HP
     lifespan is still sampled over its full cycle. */
  if (opts.bossImmortal) combat.enemies.forEach(e => { e.maxHp = 1e6; e.hp = 1e6; });
  const m = {
    frames: 0, aliveFrames: 0, openFrames: 0, doomMax: 0, fateFrames: 0, projectFrames: 0,
    rewindFrame: null, deadStateAfterRewind: false, greedy: false, deadLockFrames: 0, unlockFrame: null
  };
  const cap = opts.frameCap || FRAME_CAP;
  for (let f = 0; f < cap && combat.outcome === 'fighting'; f++) {
    if (opts.immortal) combat.player.hp = combat.player.maxHp;
    if (opts.pre) opts.pre(combat, f);
    if (!opts.passive) policyFrame(combat, inp, fightId, st);
    combat.step();
    m.frames++;
    if (combat.player.projecting) m.projectFrames++;
    if (boss.hp > 0) { m.aliveFrames++; if (!opts.noProbe && windowOpen(combat, boss)) m.openFrames++; }
    const d = (combat.player.statuses || []).find(s => s.id === 'doom');
    if (d && d.stacks > m.doomMax) m.doomMax = d.stacks;
    const fs = combat.encounter.fateSpot;
    if (fs && Math.hypot(combat.player.x - fs.x, combat.player.z - fs.z) <= FATE_RADIUS) m.fateFrames++;
    if (combat.encounter.btdUsed && m.rewindFrame == null) {
      m.rewindFrame = combat.getFrame();
      m.deadStateAfterRewind = combat.player.state === 'dead';
    }
    /* combat_player.js's updatePlayer has no branch for state 'dead' (see
       its 262-295 chain), so a rewound player is input-locked until some
       OTHER writer moves it -- only combat_defense.js:143, i.e. being hit
       again. Count how long that lock actually lasted. */
    if (m.rewindFrame != null && m.unlockFrame == null) {
      if (combat.player.state === 'dead') m.deadLockFrames++;
      else m.unlockFrame = combat.getFrame();
    }
  }
  m.greedy = !!combat.rollingStonesGreedy;
  m.outcome = TERMINAL.has(combat.outcome) ? combat.outcome : 'TIMEOUT';
  m.terminal = TERMINAL.has(combat.outcome);
  m.bad = finiteBad(combat);
  m.checksum = checksumFrame(combat);
  m.endFrame = combat.getFrame();
  m.dmg100 = dmgScale(combat, boss, 'light');
  m.win = combat.outcome === 'win';
  return { combat, m };
}

const pct = (n, d) => (d ? ((100 * n) / d).toFixed(0) : '--') + '%';

/* Determinism guard for the probe itself (sim invariant 8 in spirit: a QA
   watcher must not become a participant). */
function probeIsInert() {
  const bad = [];
  FIGHTS.forEach(([fid, eid]) => {
    const a = runFight(fid, eid, 'close', 'star_platinum', SEED + '-inert', { frameCap: 900 }).m;
    const b = runFight(fid, eid, 'close', 'star_platinum', SEED + '-inert', { frameCap: 900, noProbe: true }).m;
    if (a.checksum !== b.checksum || a.endFrame !== b.endFrame || a.outcome !== b.outcome) bad.push(fid);
  });
  return bad;
}

/* `live` = window over the real fight; `sust` = window over a 1440f
   sustained probe (player HP + boss HP held up) so a rule whose own clock
   is slower than the shipped enemy's lifespan is still measured. */
function matrix() {
  const lines = [], fails = [];
  lines.push('RULE FIGHT x STAND CLASS  cell = outcome@frame live-window%/sustained-window%   (seed ' + SEED + ', cap ' + FRAME_CAP + 'f)');
  lines.push('  ' + 'fight'.padEnd(23) + CLASSES.map(c => (c[0] + ' (' + c[1] + ')').padEnd(26)).join(''));
  FIGHTS.forEach(([fid, eid]) => {
    const cells = CLASSES.map(([scheme, standId]) => {
      const { m } = runFight(fid, eid, scheme, standId, SEED, {});
      const s = runFight(fid, eid, scheme, standId, SEED, { immortal: true, bossImmortal: true, frameCap: 1440 }).m;
      if (!m.win) fails.push(`${fid}/${scheme}: ${m.outcome}@${m.endFrame} live-window ${pct(m.openFrames, m.aliveFrames)} sustained ${pct(s.openFrames, s.aliveFrames)}`);
      if (s.openFrames === 0) fails.push(`${fid}/${scheme}: ZERO sustained damage window`);
      if (m.bad.length || s.bad.length) fails.push(`${fid}/${scheme}: non-finite ${m.bad.concat(s.bad).join(',')}`);
      const extra = s.doomMax ? ' doom' + s.doomMax : (m.greedy ? ' GREEDY' : '');
      return `${(m.win ? 'WIN' : m.outcome)}@${m.endFrame} ${pct(m.openFrames, m.aliveFrames)}/${pct(s.openFrames, s.aliveFrames)}${extra}`;
    });
    lines.push('  ' + fid.padEnd(23) + cells.map(c => c.padEnd(26)).join(''));
  });
  return { lines, fails };
}

/* Three failure paths per fight, one line of verdict for all of them:
   (a) passive  -- player never acts, dies to the crowd;
   (b) reckless -- swings regardless of the rule (the deliberate violation);
   (c) starved  -- immortal idle player, to show whether ANY timer exists. */
function failPaths() {
  const lines = [], bad = [];
  let passiveLose = 0, recklessTerm = 0, starveTimeout = 0;
  FIGHTS.forEach(([fid, eid]) => {
    CLASSES.forEach(([scheme, standId]) => {
      const p = runFight(fid, eid, scheme, standId, SEED + '-f', { passive: true, frameCap: 3600 }).m;
      if (p.outcome === 'lose') passiveLose++;
      else bad.push(`passive ${fid}/${scheme} -> ${p.outcome}@${p.endFrame}`);
      if (p.bad.length) bad.push(`passive ${fid}/${scheme} non-finite ${p.bad.join(',')}`);
      const r = runFight(fid, eid, scheme, standId, SEED + '-v', { reckless: true, frameCap: 3600 }).m;
      if (r.terminal) recklessTerm++; else bad.push(`reckless ${fid}/${scheme} -> TIMEOUT@${r.endFrame}`);
      if (r.bad.length) bad.push(`reckless ${fid}/${scheme} non-finite ${r.bad.join(',')}`);
      const s = runFight(fid, eid, scheme, standId, SEED + '-s', { passive: true, immortal: true, frameCap: 1800 }).m;
      if (s.outcome === 'TIMEOUT') starveTimeout++;
    });
  });
  const n = FIGHTS.length * CLASSES.length;
  lines.push(`FAIL PATHS (${n} cells x3): passive->lose ${passiveLose}/${n}, rule-violation->terminal ${recklessTerm}/${n}, immortal-idle->no terminal ${starveTimeout}/${n} (no Rule Fight has a timer)`);
  return { lines, bad };
}

/* Bites the Dust death-source isolation. Every case parks the knife thug at
   ARENA_MAX and the player at ARENA_MIN so the ONLY death source is the one
   under test -- a scripted state poke, stated here so it is never read as
   organic behaviour. */
function btdSource(kind) {
  const eid = 'budogaoka_bites_the_dust';
  const pre = (combat, f) => {
    combat.enemies[0].x = ARENA_MAX; combat.player.x = ARENA_MIN;
    if (f !== 120) return;
    combat.player.hp = 4;
    if (kind === 'hazard') spawnHazard(combat, combat.player.x, combat.player.z, { radius: 60, tickFrames: 10, dmg: 99, lifeFrames: 300 });
    if (kind === 'dot') applyStatus(combat.player, 'virus', 4);
  };
  const { combat, m } = runFight('rf_bites_the_dust', eid, 'close', 'star_platinum', SEED + '-btd-' + kind,
    { passive: true, pre, frameCap: 1200 });
  return { kind, used: !!combat.encounter.btdUsed, outcome: m.outcome, at: m.endFrame, rewindFrame: m.rewindFrame, dead: m.deadStateAfterRewind };
}

function btd() {
  const lines = [], bad = [];
  const enemy = runFight('rf_bites_the_dust', 'budogaoka_bites_the_dust', 'close', 'star_platinum', SEED + '-btd-enemy',
    { passive: true, frameCap: 3600 }).m;
  lines.push(`BTD enemy-attack death (stepCrowd, before stepEncounter): rewind=${enemy.rewindFrame != null} @f${enemy.rewindFrame} -> final ${enemy.outcome}@${enemy.endFrame}` +
    (enemy.rewindFrame != null ? `; post-rewind player.state==='dead' for ${enemy.deadLockFrames}f, unlocked @f${enemy.unlockFrame} only by being hit again` : ''));
  if (enemy.deadLockFrames > 0) bad.push(`BTD: ${enemy.deadLockFrames}f input lock after rewind (combat_player.js has no 'dead' state branch)`);
  ['hazard', 'dot'].forEach(k => {
    const r = btdSource(k);
    lines.push(`BTD ${k === 'hazard' ? 'hazard  ' : 'DoT     '} death (latched AFTER stepCrowd): rewind=${r.used} -> ${r.outcome}@${r.at}`);
    if (r.used) bad.push(`BTD ${k}: rewind unexpectedly fired`);
  });
  const src = 'budogaoka_bites_the_dust = 1x knife_thug / quick_stab: no hazard field, no DoT status';
  lines.push('BTD shipped encounter reach: ' + src + ' -> post-stepCrowd death sources UNREACHABLE as shipped');
  return { lines, bad };
}

/* Two rule-specific probes that the win/lose matrix cannot show:
   (a) Illuso's Mirror agency -- rule_fights.js:74 gates on
       combat.player.projecting, which ONLY stand_classes.js:53 (Close)
       writes; does holding `project` change the window at all per class?
   (b) Rolling Stones greed -- rule_fights_2.js:57 latches the reward-
       doubling flag on the FIRST frame in radius, while the damage needs
       FATE_TICK_FRAMES(20) consecutive frames (rule_fights_2.js:61-64). */
/* Yellow Temperance is a pure trade: rule_fights_2.js:28-33 reflects a flat
   YT_CONTACT_DMG(6) per LANDED HITBOX, so the fight is winnable only if the
   best single-hitbox swing beats 6 by enough to clear the boss's 95 HP
   inside the player's 100. Measured with the boss parked in its own
   'recover' punish window and the player topped up -- a scripted poke, so
   the ratio is the CLASS's ceiling with no AI noise in it. */
function ytTrade() {
  const lines = [], bad = [];
  const cells = CLASSES.map(([scheme, standId]) => {
    const combat = buildCombatFromHeader({ seed: SEED + '-yt', encounter: ENCOUNTERS.loading_dock_yellow_temperance, standId });
    const inp = makeInput(combat), boss = combat.enemies[0], p = combat.player;
    const bossHp0 = 1e6; boss.hp = bossHp0; boss.maxHp = bossHp0;
    let pressed = null, swings = 0;
    for (let f = 0; f < 1800 && combat.outcome === 'fighting'; f++) {
      boss.ai.state = 'recover'; boss.ai.timer = 999; p.hp = p.maxHp;
      boss.x = combat.stand.x + (combat.stand.facing || 1) * 30; boss.z = combat.stand.z;
      if (pressed) { inp.set(pressed, false); pressed = null; }
      if (p.state === 'idle') { inp.set('heavy', true); pressed = 'heavy'; swings++; }
      combat.step();
    }
    const per = (bossHp0 - boss.hp) / Math.max(1, swings);
    const need = Math.ceil(95 / per) * 6; // 95 = brute HP (data_enemies.js), 6 = YT_CONTACT_DMG
    if (need >= p.maxHp) bad.push(`yellow_temperance/${scheme}: unwinnable -- ${per.toFixed(2)} dmg/heavy vs 6 self, needs ${need} self-damage > ${p.maxHp} maxHp`);
    return `${scheme} ${per.toFixed(2)}dmg/6self=${(per / 6).toFixed(2)}x self-cost ${need}/${p.maxHp}hp`;
  });
  lines.push('YT TRADE CEILING (boss parked in recover, heavy only): ' + cells.join(' | '));
  return { lines, bad };
}

function ruleProbes() {
  const lines = [];
  const agency = CLASSES.map(([scheme, standId]) => {
    const on = runFight('rf_illusos_mirror', 'kameyu_illusos_mirror', scheme, standId, SEED + '-mir',
      { immortal: true, bossImmortal: true, frameCap: 1440 }).m;
    return `${scheme} window=${pct(on.openFrames, on.aliveFrames)} projectingFrames=${on.projectFrames}`;
  }).join(' | ');
  lines.push('MIRROR agency (1440f sustained, holding project on the boss layer): ' + agency +
    '  -- 0 projecting frames => the layer toggle is unreachable for that class');
  // Tap the fate zone for exactly 3 frames at f=200, then leave.
  const pre = (combat, f) => {
    const fs = combat.encounter.fateSpot;
    if (f >= 200 && f < 203) { combat.player.x = fs.x; combat.player.z = fs.z; }
  };
  const { combat, m } = runFight('rf_rolling_stones', 'park_rolling_stones', 'close', 'star_platinum',
    SEED + '-greed', { passive: true, immortal: true, bossImmortal: true, pre, frameCap: 400 });
  lines.push(`ROLLING STONES 3-frame zone tap @f200: greedy=${!!combat.rollingStonesGreedy} ` +
    `damage taken from zone=0 (needs 20 consecutive frames) -> reward doubling is free`);
  return { lines, bad: combat.rollingStonesGreedy ? ['rolling_stones: greed flag latches in <20f, before any fate damage can tick'] : [] };
}

if (process.argv[1] && process.argv[1].endsWith('qa_rule_fights.js')) {
  const out = [], defects = [];
  const inert = probeIsInert();
  if (inert.length) defects.push('PROBE NOT INERT for: ' + inert.join(','));
  if (SECTION === 'all' || SECTION === 'matrix') {
    const r = matrix(); out.push(...r.lines); defects.push(...r.fails);
  }
  if (SECTION === 'all' || SECTION === 'btd') {
    const r = btd(); out.push(...r.lines); defects.push(...r.bad);
  }
  if (SECTION === 'all' || SECTION === 'matrix') {
    const r = ruleProbes(); out.push(...r.lines); defects.push(...r.bad);
    const y = ytTrade(); out.push(...y.lines); defects.push(...y.bad);
  }
  if (SECTION === 'all' || SECTION === 'fail') {
    const r = failPaths(); out.push(...r.lines); defects.push(...r.bad);
  }
  if (defects.length) {
    console.log('FAILING CASES (' + defects.length + '):');
    console.log(defects.slice(0, VERBOSE ? defects.length : 18).map(s => '  ' + s).join('\n'));
  }
  console.log(out.join('\n'));
}
