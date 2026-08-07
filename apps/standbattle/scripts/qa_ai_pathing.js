/* node apps/standbattle/scripts/qa_ai_pathing.js [--seed=S] [--frames=N]
     [--only=<enemyId>] [--pos=<posName>] [--no-zband] [--verbose]

   Phase 13d, test-matrix item 3: pathing + stuck states, per enemy type.

   Section A -- every ENEMIES def SOLO against an idle player parked at 7
   arena positions (centre, both x walls, all four x/z corners), then the
   four corners again with the Leashed affix forced on. Each run classified:

     REACHED            that enemy damaged the player (direct, via the
                        Stand's feedback routing, or via one of its hazards)
     IN-RANGE-NEVER-HIT |dx| <= ai.approachRange was reached, no damage ever
     ORBIT              min |dx| never got inside ai.approachRange
     WALL-PRESS         enemy x pinned at ARENA_MIN/ARENA_MAX >600 frames
     OSCILLATE          sign of the enemy's per-frame x delta flipped >100x
     NO-COMMIT          ai.state never entered 'windup'

   Section B -- the depth-axis sweep that quantifies QA-005/QA-007 (enemy z
   is written once at spawn and never again, combat_enemy.js:91-97): with
   the player at arena centre x, walk the player's z across the whole legal
   depth band and record which z values that enemy can still damage from.

   Read-only observer of sim state EXCEPT two declared, deterministic
   harness pokes applied before each measurement window:
     1. player.maxHp/hp raised to SURVIVE_HP so the punching bag cannot die
        and cut a run short (we measure reach, not lethality);
     2. `enemy.affixData.leashed = true` for the leashed variants -- exactly
        the flag encounter.js's affix roll sets.
   Everything else is sampled, never written. Same seed -> same table. */

import { ENEMIES } from '../data.js';
import { buildCombatFromHeader } from '../replay.js';
import { ARENA_MIN, ARENA_MAX, ARENA_Z_MIN, ARENA_Z_MAX, Z_REST } from '../constants.js';

const arg = (n, d) => { const a = process.argv.find(s => s.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const VERBOSE = process.argv.includes('--verbose');
const NO_ZBAND = process.argv.includes('--no-zband');
const SEED = arg('seed', 'qapath');
const FRAMES = parseInt(arg('frames', '2400'), 10);
const ONLY = arg('only', null);
const ONLY_POS = arg('pos', null);

const SURVIVE_HP = 1e6;
const WARMUP_CAP = 620;
const WALL_PRESS_FRAMES = 600;
const OSCILLATE_FLIPS = 100;
const EPS = 0.01;
const CENTRE_X = (ARENA_MIN + ARENA_MAX) / 2;
const ZBAND_STEP = 5;
const ZBAND_FRAMES = 1500;

const POSITIONS = [
  { name: 'centre', x: CENTRE_X, z: Z_REST }, { name: 'xmin', x: ARENA_MIN, z: Z_REST },
  { name: 'xmax', x: ARENA_MAX, z: Z_REST }, { name: 'nw', x: ARENA_MIN, z: ARENA_Z_MIN },
  { name: 'sw', x: ARENA_MIN, z: ARENA_Z_MAX }, { name: 'ne', x: ARENA_MAX, z: ARENA_Z_MIN },
  { name: 'se', x: ARENA_MAX, z: ARENA_Z_MAX }
];
const CORNERS = POSITIONS.filter(p => ['nw', 'sw', 'ne', 'se'].includes(p.name));
const RANK = { REACHED: 0, 'IN-RANGE-NEVER-HIT': 2, ORBIT: 3, 'NO-COMMIT': 4 };
const SHORT = { REACHED: 'R', 'IN-RANGE-NEVER-HIT': 'I', ORBIT: 'O', 'NO-COMMIT': 'N' };

const KEYS = ['left', 'right', 'forward', 'back', 'light', 'medium', 'heavy', 'special',
  'rush', 'dodge', 'parry', 'guard', 'project', 'command'];
const idle = combat => KEYS.forEach(k => combat.setKey(k, false));
const fmt = n => Number.isFinite(n) ? String(Math.round(n * 10) / 10) : '-';

/* Damage attribution. hp-delta is the ground truth (a hit on the Stand
   routes through applyFeedbackDamage -> 'onFeedbackDamage', NOT
   'onDamageTaken', so hooks alone under-count); the wrapped runEffect only
   labels the source. Wrapper passes through, so the sim is unchanged. */
function observe(combat, sink) {
  const orig = combat.dispatcher.runEffect.bind(combat.dispatcher);
  combat.dispatcher.runEffect = (name, ctx) => {
    if (name === 'onDamageTaken' && ctx && ctx.entity && ctx.entity.kind !== 'enemy') {
      if (ctx.attacker) sink.direct += 1; else sink.hazard += 1;
    } else if (name === 'onFeedbackDamage') sink.stand += 1;
    return orig(name, ctx);
  };
}

/* Walks the player to (tx,tz) with real movement keys. QA-003: 'forward'
   DECREASES z, 'back' increases it. DEADBAND must exceed the player's
   per-frame step (~2.87u) or the walk never settles and jitters between
   two positions ~2.87 apart for the whole cap -- which silently moved the
   measured depth band by a step. Achieved position is returned and every
   depth number downstream is the ACHIEVED |dz|, never the requested one. */
const DEADBAND = 1.6;
function warmup(combat, tx, tz) {
  for (let f = 0; f < WARMUP_CAP; f++) {
    const p = combat.player;
    p.hp = p.maxHp;
    const dx = tx - p.x, dz = tz - p.z;
    if (Math.abs(dx) <= DEADBAND && Math.abs(dz) <= DEADBAND) break;
    combat.setKey('left', dx < -DEADBAND); combat.setKey('right', dx > DEADBAND);
    combat.setKey('forward', dz < -DEADBAND); combat.setKey('back', dz > DEADBAND);
    combat.step();
  }
  idle(combat);
  return { x: combat.player.x, z: combat.player.z };
}

function build(enemyId, seed, leashed) {
  const combat = buildCombatFromHeader({
    seed, standId: 'star_platinum',
    encounter: { id: 'qa_path_' + enemyId, winCondition: 'killAll', waves: [{ types: [enemyId] }] }
  });
  const enemy = combat.enemies[0];
  combat.player.maxHp = SURVIVE_HP; combat.player.hp = SURVIVE_HP;
  if (leashed) { enemy.affixData.leashed = true; if (enemy.spawnX == null) enemy.spawnX = enemy.x; }
  return { combat, enemy };
}

function runOne(enemyId, pos, leashed, frames) {
  const seed = `${SEED}:${enemyId}:${pos.name}${leashed ? ':leash' : ''}`;
  const { combat, enemy } = build(enemyId, seed, leashed);
  const spawnZ = enemy.z;
  const placed = warmup(combat, pos.x, pos.z);
  const sink = { direct: 0, stand: 0, hazard: 0 };
  observe(combat, sink);
  const r = {
    enemyId, pos: pos.name, leashed, seed, spawnZ, placed, affixes: (enemy.affixIds || []).join('+') || '-',
    approachRange: enemy.ai.approachRange, minDx: Infinity, minDxFrame: -1,
    inRange: false, windups: 0, actives: 0, dmg: 0, firstHitFrame: -1,
    wallPress: 0, wallPressFrame: -1, flips: 0, zDelta: 0, enemyZMoved: false, endEnemyX: 0
  };
  let prevX = enemy.x, prevSign = 0, press = 0, prevState = enemy.ai.state;

  for (let f = 0; f < frames; f++) {
    const before = combat.player.hp;
    combat.step();
    const frame = combat.getFrame();
    const lost = before - combat.player.hp;
    if (lost > 0) { r.dmg += lost; if (r.firstHitFrame < 0) r.firstHitFrame = frame; }
    combat.player.hp = combat.player.maxHp;
    if (enemy.z !== spawnZ) r.enemyZMoved = true;
    const dx = Math.abs(combat.player.x - enemy.x);
    if (dx < r.minDx) { r.minDx = dx; r.minDxFrame = frame; }
    if (dx <= r.approachRange) r.inRange = true;
    const st = enemy.ai.state;
    if (st === 'windup' && prevState !== 'windup') r.windups += 1;
    if (st === 'active' && prevState !== 'active') r.actives += 1;
    prevState = st;
    const d = enemy.x - prevX;
    if (Math.abs(d) > EPS) {
      const s = Math.sign(d);
      if (prevSign !== 0 && s !== prevSign) r.flips += 1;
      prevSign = s;
    }
    prevX = enemy.x;
    if (enemy.x <= ARENA_MIN + EPS || enemy.x >= ARENA_MAX - EPS) {
      press += 1;
      if (press > r.wallPress) { r.wallPress = press; r.wallPressFrame = frame - press + 1; }
    } else press = 0;
  }
  r.endEnemyX = enemy.x;
  r.zDelta = Math.abs(combat.player.z - enemy.z);
  r.direct = sink.direct; r.stand = sink.stand; r.hazard = sink.hazard;
  if (r.dmg > 0) r.cls = 'REACHED';
  else if (r.windups === 0) r.cls = 'NO-COMMIT';
  else if (r.inRange) r.cls = 'IN-RANGE-NEVER-HIT';
  else r.cls = 'ORBIT';
  r.flags = (r.wallPress > WALL_PRESS_FRAMES ? 'W' : '') + (r.flips > OSCILLATE_FLIPS ? 'S' : '') +
    (r.dmg > 0 && r.direct === 0 && r.stand === 0 ? 'h' : '');
  return r;
}

/* Section B: how far off its own (permanently fixed) spawn depth an enemy
   can still damage the player. Sweeps the player's z across the whole
   legal band at the x where the enemy is guaranteed to close to range
   (arena centre) and reports the ACHIEVED |player.z - enemy.z| envelope. */
function zBand(enemyId) {
  const samples = [];
  /* One seed for the whole sweep (pos.name fixed) so the ONLY variable
     across samples is the player's depth -- a per-z seed made the AI roll
     differently at each sample and produced a ragged, meaningless band. */
  for (let z = ARENA_Z_MIN; z <= ARENA_Z_MAX; z += ZBAND_STEP) {
    const r = runOne(enemyId, { name: 'zsweep', x: CENTRE_X, z }, false, ZBAND_FRAMES);
    samples.push({ target: z, dz: r.zDelta, hit: r.dmg > 0, seed: r.seed, frame: r.firstHitFrame });
  }
  const hit = samples.filter(s => s.hit);
  const maxDz = hit.length ? Math.max(...hit.map(s => s.dz)) : -1;
  // reachable slice of the legal depth axis, as an interval centred on the enemy's fixed z
  const lo = Math.max(ARENA_Z_MIN, Z_REST - maxDz), hi = Math.min(ARENA_Z_MAX, Z_REST + maxDz);
  const first = samples.findIndex(s => s.hit), last = samples.map(s => s.hit).lastIndexOf(true);
  const holes = first < 0 ? 0 : samples.slice(first, last + 1).filter(s => !s.hit).length;
  return { enemyId, samples, maxDz, holes, width: maxDz < 0 ? 0 : hi - lo };
}

function main() {
  const ids = Object.keys(ENEMIES).filter(id => !ONLY || id === ONLY);
  const rows = [], all = [];
  for (const id of ids) {
    const idleRuns = POSITIONS.filter(p => !ONLY_POS || p.name === ONLY_POS).map(p => runOne(id, p, false, FRAMES));
    const leashRuns = CORNERS.filter(p => !ONLY_POS || p.name === ONLY_POS).map(p => runOne(id, p, true, FRAMES));
    all.push(...idleRuns, ...leashRuns);
    const tally = rs => { const c = { R: 0, I: 0, O: 0, N: 0 }; rs.forEach(r => { c[SHORT[r.cls]] += 1; }); return c; };
    const worst = rs => rs.slice().sort((a, b) => RANK[b.cls] - RANK[a.cls] || b.minDx - a.minDx)[0];
    rows.push({
      id, idleRuns, leashRuns, idleC: tally(idleRuns), leashC: tally(leashRuns),
      wIdle: worst(idleRuns), wLeash: worst(leashRuns),
      flags: [...new Set(idleRuns.concat(leashRuns).map(r => r.flags).join(''))].filter(Boolean).join('')
    });
  }
  const bands = NO_ZBAND ? [] : ids.map(zBand);

  const out = [];
  out.push(`QA PATHING seed=${SEED} frames=${FRAMES} solo | ${ids.length} enemies x 7 idle pos + 4 leashed corners`);
  out.push(`ONE global arena rect x[${ARENA_MIN},${ARENA_MAX}] z[${ARENA_Z_MIN},${ARENA_Z_MAX}] (arena_bounds.js) -- arenas are cosmetic, no per-arena variance exists`);
  const c = r => { const t = k => `${r.idleC[k]}`; return `${r.id.padEnd(19)}${SHORT[r.wIdle.cls]} R${t('R')}I${t('I')}O${t('O')}N${t('N')} |${SHORT[r.wLeash.cls]} R${r.leashC.R}I${r.leashC.I}O${r.leashC.O}${r.flags ? '+' + r.flags : ''}`.padEnd(46); };
  for (let i = 0; i < rows.length; i += 2) out.push(' ' + c(rows[i]) + (rows[i + 1] ? c(rows[i + 1]) : ''));
  out.push('legend  <worst-of-7-idle> R#I#O#N# | <worst-of-4-leashed>  R=REACHED I=IN-RANGE-NEVER-HIT O=ORBIT N=NO-COMMIT h=hazard-only');

  const failIdle = rows.filter(r => RANK[r.wIdle.cls] > 0);
  out.push(`idle: ${rows.length - failIdle.length}/${rows.length} types damage the player from all 7 positions; ${failIdle.length} fail at >=1. ` +
    `wall-press=${all.filter(r => r.wallPress > WALL_PRESS_FRAMES).length}/${all.length} oscillate=${all.filter(r => r.flips > OSCILLATE_FLIPS).length}/${all.length} no-commit=${all.filter(r => r.cls === 'NO-COMMIT').length}/${all.length}`);
  out.push(`leashed(90u from spawnX=602): ${rows.filter(r => r.leashC.O > 0).length}/${rows.length} types ORBIT forever at the two x-min corners; enemy z written after spawn in ${all.filter(r => r.enemyZMoved).length}/${all.length} runs`);
  if (bands.length) {
    const span = ARENA_Z_MAX - ARENA_Z_MIN;
    const grp = {};
    bands.forEach(b => { const k = `${fmt(b.maxDz)}${b.holes ? '*' : ''}|${fmt(b.width)}`; (grp[k] = grp[k] || []).push(b.enemyId); });
    out.push(`z-band (player z sweep @x=${CENTRE_X}, enemy z pinned at spawn ${Z_REST} forever; legal depth span ${span}u):`);
    Object.keys(grp).sort((a, b) => parseFloat(b) - parseFloat(a)).forEach(k => {
      const [dz, w] = k.split('|');
      out.push(`  maxHitDz=${dz.padStart(5)}u -> ${String(Math.round(w / span * 100)).padStart(3)}% of depth axis lethal, ${String(100 - Math.round(w / span * 100)).padStart(3)}% is a permanent safe lane : ${grp[k].join(' ')}`);
    });
  }

  const detail = [];
  for (const row of failIdle) {
    const b = row.wIdle;
    detail.push(` ${row.id.padEnd(19)}${b.cls.padEnd(19)}pos=${b.pos.padEnd(7)}minDx=${fmt(b.minDx)}@f${b.minDxFrame} ar=${b.approachRange} ` +
      `dz=${fmt(b.zDelta)} windups=${b.windups} actives=${b.actives} dmg=0 seed=${b.seed}`);
  }
  const cap = VERBOSE ? detail.length : Math.max(0, 24 - out.length);
  out.push(...detail.slice(0, cap));
  if (detail.length > cap) out.push(`(+${detail.length - cap} more failing idle rows -- rerun with --verbose)`);
  console.log(out.join('\n'));

  if (VERBOSE) {
    console.log('\n-- every section A run --');
    console.log(['enemy', 'pos', 'leash', 'cls', 'flags', 'minDx', 'minDxF', 'ar', 'dz', 'wind', 'act', 'dmg',
      'direct', 'stand', 'haz', 'hit@f', 'press', 'flips', 'plyX', 'plyZ', 'endEnemyX', 'affixes', 'seed'].join('\t'));
    all.forEach(r => console.log([r.enemyId, r.pos, r.leashed ? 1 : 0, r.cls, r.flags || '-', fmt(r.minDx), r.minDxFrame,
      r.approachRange, fmt(r.zDelta), r.windups, r.actives, fmt(r.dmg), r.direct, r.stand, r.hazard, r.firstHitFrame,
      r.wallPress, r.flips, fmt(r.placed.x), fmt(r.placed.z), fmt(r.endEnemyX), r.affixes, r.seed].join('\t')));
    if (bands.length) {
      console.log('\n-- section B z-band --');
      bands.forEach(b => console.log(`${b.enemyId}\tmaxHitDz=${fmt(b.maxDz)}\t` + b.samples.map(s => `${fmt(s.dz)}:${s.hit ? 'H' : '.'}`).join(' ')));
    }
  }
}

main();
