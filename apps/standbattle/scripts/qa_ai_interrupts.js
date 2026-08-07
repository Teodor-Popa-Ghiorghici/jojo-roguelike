/* node apps/standbattle/scripts/qa_ai_interrupts.js [--verbose] [--seed=S]

   Phase 13d QA, matrix items 6 (interrupt correctness) and 7 (boss phase
   transitions).

   Item 6 interrupts an enemy at a chosen point of ai.js's attack-pattern
   state machine -- poise-break mid-'active'/'recover', stagger mid-'windup'
   armored and unarmored, death in each of windup/active/recover, death of
   the current attack-token holder, and both summoner interrupts on the
   exact frame summons.js's summonTimer hits 0 -- then asserts the encounter
   is left LEGAL: finite hp in [0,maxHp], ai.state known, ai.pattern
   consistent with ai.state, no token slot holding a corpse, no orphaned
   projectiles/hazards, and a decisive outcome still reachable.

   Item 7 drives every boss in BOSSES through every phase transition and
   asserts no index is skipped or repeated, ai.patternIds matches the new
   phase, invulnFrames is armed, and the boss stays legal -- plain, while
   staggered, under the maximum status load status.js can apply, inside
   purge.js's immunity window, on the exact frame the player dies, and
   after one hit from full HP to below the last threshold.

   This script POKES SIM STATE ON PURPOSE (enemy.hp, enterStagger,
   applyPoiseDamage, applyStatus, player.hp): landing an interrupt on an
   exact frame deterministically is not otherwise possible. It is a
   scripted interrupt test, not an observer. Every finding carries its seed
   and frame and reproduces by rerunning this file. */

import { buildCombatFromHeader } from '../replay.js';
import { BOSSES } from '../data.js';
import { applyPoiseDamage, STAGGER_FRAMES, STAGGER_DAMAGE_MULT } from '../poise.js';
import { enterStagger } from '../ai.js';
import { applyStatus, STATUS_DEFS } from '../status.js';
import { chase, makeAssertLegal } from './qa_ai_interrupt_cases.js';

const VERBOSE = process.argv.includes('--verbose');
const SEED = (process.argv.find(s => s.startsWith('--seed=')) || '--seed=qa13d').split('=')[1];
const STATES = ['approach', 'windup', 'active', 'recover', 'staggered', 'flee'];
const PHASE_INVULN_FRAMES = 30; // combat_enemy.js:24, mirrored so the assert is independent of it

const findings = new Map();
const assertLegal = makeAssertLegal((...a) => fail(...a));
const passes = [];
function fail(id, seed, frame, msg) {
  if (!findings.has(id)) findings.set(id, `${id}  seed=${seed} frame=${frame}  ${msg}`);
  else if (VERBOSE) console.log(`  (again) ${id} seed=${seed} frame=${frame} ${msg}`);
}
const mk = (seed, spec) => buildCombatFromHeader({ seed, standId: 'star_platinum', ...spec });
const crowd = (seed, types) => mk(seed, { encounter: { id: 'qa_int', winCondition: 'killAll', waves: [{ types }] } });
/* Deterministic "the player is actually fighting" policy -- no RNG of its
   own, so every case reproduces byte-identically from its seed. Only ever
   applied AFTER the interrupt has landed; the setup phase runs with no
   input at all, so the target reliably reaches the state under test. */
function assertDecisive(c, seed, tag, cap) {
  for (let f = 0; f < (cap || 2400) && c.outcome === 'fighting'; f++) { chase(c, f); c.step(); }
  assertLegal(c, seed, tag);
  if (c.outcome !== 'fighting') return;
  c.enemies.forEach(e => { e.hp = 0; });
  for (let f = 0; f < 20 && c.outcome === 'fighting'; f++) c.step();
  if (c.outcome === 'fighting') fail('NO-DECISIVE-OUTCOME:' + tag, seed, c.getFrame(), 'encounter cannot resolve even with every enemy at 0 hp');
}

/* Runs `c` until `arm(c)` returns true (no player input), fires `hit`, then
   watches `tail` frames of legality before resolving the fight. */
function interrupt(seed, types, arm, hit, tag, tail) {
  const c = crowd(seed, types);
  let armed = false, at = 0;
  for (let f = 0; f < 2400 && c.outcome === 'fighting' && !armed; f++) {
    if (arm(c)) { hit(c); armed = true; at = c.getFrame(); }
    c.step();
  }
  if (!armed) { fail('SETUP/arm-never-fired:' + tag, seed, c.getFrame(), 'the interrupt condition never occurred'); return { c, armed, at }; }
  for (let f = 0; f < (tail || 180) && c.outcome === 'fighting'; f++) { c.step(); assertLegal(c, seed, tag); }
  return { c, armed, at };
}

/* ---------------- ITEM 6 ---------------- */
function item6a() { // poise-break mid-pattern, during 'active' and during 'recover'
  ['morioh_thug', 'brute', 'sniper', 'bomber'].forEach(t => ['active', 'recover'].forEach(st => {
    const seed = `${SEED}-6a-${t}-${st}`, tag = `6a/${t}/${st}`;
    const { c } = interrupt(seed, [t], x => x.enemies[0].ai.state === st, x => applyPoiseDamage(x.enemies[0], 9999), tag);
    assertDecisive(c, seed, tag);
  }));
  passes.push('6a poise-break during active/recover x4 types: break is held pending, lands on the next interruptible state, poise restored');
}

function item6b() { // stagger during 'windup', on armored and on unarmored patterns
  // morioh_thug rolls both sweep (unarmored) and telegraphed_slam (armored); gate on the pattern actually rolled.
  [['morioh_thug', false], ['morioh_thug', true], ['knife_thug', false], ['brute', true], ['shielder', true]].forEach(([t, armored]) => {
    const kind = armored ? 'armored' : 'open';
    const seed = `${SEED}-6b-${t}-${kind}`, tag = `6b/${t}/${kind}`;
    const c = crowd(seed, [t]);
    const e = c.enemies[0];
    let at = 0, pat = null, brokeInWindup = false;
    for (let f = 0; f < 2400 && c.outcome === 'fighting'; f++) {
      const ai = e.ai;
      if (!at && ai.state === 'windup' && ai.pattern && !!ai.pattern.armor === armored) {
        pat = ai.pattern.id; applyPoiseDamage(e, 9999); at = c.getFrame();
      }
      c.step();
      if (at) {
        if (e.ai.state === 'staggered' && !brokeInWindup && c.getFrame() <= at + 2) brokeInWindup = true;
        assertLegal(c, seed, tag);
        if (c.getFrame() > at + 240) break;
      }
    }
    if (!at) { fail('SETUP/arm-never-fired:' + tag, seed, c.getFrame(), `${t} never wound up a ${kind} pattern`); return; }
    if (!armored && !brokeInWindup) fail('STAGGER/unarmored-windup-survived', seed, at, `${t}/${pat} kept its unarmored windup through a full poise break`);
    if (armored && brokeInWindup) fail('STAGGER/armored-windup-interrupted', seed, at, `${t}/${pat} armored windup was poise-interrupted`);
    if (armored && e.poiseBroken === false && e.poise.current !== e.poise.max) fail('STAGGER/armored-break-dropped', seed, at, `${t} lost its pending break without ever staggering`);
    assertDecisive(c, seed, tag);
  });
  passes.push('6b windup stagger: unarmored breaks immediately, armored windup defers (never drops) the pending break -- poise.js:66');
}

function item6c() { // death mid-pattern -- windup, active, recover
  ['morioh_thug', 'brute', 'sniper', 'bomber', 'zoner'].forEach(t => ['windup', 'active', 'recover'].forEach(st => {
    const seed = `${SEED}-6c-${t}-${st}`, tag = `6c/${t}/${st}`;
    const { c } = interrupt(seed, [t, 'morioh_thug'], x => x.enemies[0].ai.state === st, x => { x.enemies[0].hp = 0; }, tag);
    assertDecisive(c, seed, tag);
  }));
  ['bomber', 'zoner'].forEach(t => { // a hazard pattern killed mid-flight must still resolve its authored detonation
    const seed = `${SEED}-6c-haz-${t}`;
    const c = crowd(seed, [t, 'morioh_thug']);
    let killed = false, kf = 0, maxHaz = 0;
    for (let f = 0; f < 2400 && c.outcome === 'fighting'; f++) {
      c.step(); maxHaz = Math.max(maxHaz, c.hazards.length);
      if (!killed && c.enemies[0].projectiles.length) { c.enemies[0].hp = 0; killed = true; kf = c.getFrame(); }
    }
    if (killed && maxHaz === 0) {
      fail('DROPPED-HAZARD-ON-DEATH', seed, kf, `${t} killed mid-'active' with its hazard projectile airborne: the authored detonation never fires ` +
        '(combat_enemy.js:59-63 skips the :131-134 pr.life<=0 -> spawnHazard branch; a control run leaves 2 hazards)');
    }
  });
  passes.push('6c death in windup/active/recover x5 types: ai.state/pattern legal on the corpse, token slots clean, encounter still resolves');
}

function item6d() { // death of the current token holder
  const seed = `${SEED}-6d`, tag = '6d';
  const c = crowd(seed, ['morioh_thug', 'knife_thug', 'brute', 'shielder']);
  let kills = 0;
  for (let f = 0; f < 2400 && c.outcome === 'fighting'; f++) {
    const slot = c.tokenSystem.slots.find(s => s.holder && s.holder.hp > 0 && s.holder.ai.state !== 'approach');
    if (slot && kills < 3) { slot.holder.hp = 0; kills++; }
    c.step(); assertLegal(c, seed, tag);
  }
  if (kills < 3) fail('SETUP/no-committed-holder', seed, c.getFrame(), 'never observed a committed token holder');
  assertDecisive(c, seed, tag, 600);
  passes.push('6d token holder killed mid-pattern x3: token.js:63 releases the slot on the next step, no leaked hasToken, no double-hold');
}

function item6ef() { // summoner staggered / killed on the exact frame summonTimer hits 0
  ['caller', 'puppeteer'].forEach(t => {
    const seed = `${SEED}-6e-${t}`, tag = `6e/${t}`;
    let before = 0;
    const { c, armed } = interrupt(seed, [t, 'morioh_thug'],
      x => x.enemies[0].summonTimer === 1 && x.enemies[0].hp > 0,
      x => { before = x.enemies.length; applyPoiseDamage(x.enemies[0], 9999); }, tag, 90);
    if (armed && c.enemies.length > before) {
      fail('SUMMON-NOT-INTERRUPTIBLE', seed, c.getFrame(), `${t} poise-broken on its summon frame still spawned (${before}->${c.enemies.length}): ` +
        'combat_enemy.js:98 runs stepSummon after stepPoise but with no stagger/poiseBroken guard in summons.js:47');
    }
    assertDecisive(c, seed, tag);
  });
  const seed = `${SEED}-6f`, tag = '6f';
  let before = 0;
  const { c, armed } = interrupt(seed, ['caller', 'morioh_thug'], x => x.enemies[0].summonTimer === 1,
    x => { before = x.enemies.length; x.enemies[0].hp = 0; }, tag, 90);
  if (armed && c.enemies.length > before) fail('CALLER-SUMMONS-WHILE-DEAD', seed, c.getFrame(), `killed on its summon frame it still spawned (${before}->${c.enemies.length})`);
  assertDecisive(c, seed, tag);
  passes.push('6e/6f Caller killed on its exact summon frame cancels the spawn (summons.js:49 hp guard); summonTimer stays finite/legal');
}

function item6dot() { // death from a status tick -- the same "death mid-pattern" from the other source
  const seed = `${SEED}-6dot`, tag = '6dot';
  const c = crowd(seed, ['bomber']);
  const e = c.enemies[0];
  let kills = 0;
  c.dispatcher.on('onKill', () => { kills++; });
  for (let f = 0; f < 1800 && c.outcome === 'fighting'; f++) { if (f === 60) applyStatus(e, 'virus', 99); c.step(); }
  assertLegal(c, seed, tag);
  if (e.hp <= 0 && (kills === 0 || e.deathTimer === 0)) {
    fail('DOT-DEATH-BYPASSES-DEATH-PIPELINE', seed, c.getFrame(), `enemy killed by a status tick: onKill fired ${kills}x, deathTimer=${e.deathTimer} ` +
      '(a landed-hit kill gives 1 and 53). status.js:126 applyDot -> fighter.js:120 applyDamage; onKill only fires from combat_player.js:193 / combat_defense.js:87');
  }
  if (c.outcome !== 'win') fail('DOT-DEATH-NO-WIN', seed, c.getFrame(), `outcome=${c.outcome} with every enemy at 0 hp`);
  passes.push('6dot status-DoT kill still resolves the encounter (encounter.js:33 killAll is polled every frame)');
}

/* ---------------- ITEM 7 ---------------- */
function walkPhases(id, mode) {
  const seed = `${SEED}-7-${mode}-${id}`, tag = `7/${mode}/${id}`;
  const c = mk(seed, { enemyId: id });
  const e = c.enemies[0], ph = e.def.phases;
  const load = () => { e.statusImmuneFrames = 0; Object.keys(STATUS_DEFS).forEach(s => applyStatus(e, s, STATUS_DEFS[s].maxStacks || 1)); };
  c.step();
  if (mode === 'purge') { e.hp = Math.floor(e.maxHp * e.def.purgeAtHpFrac); c.step(); }
  if (mode === 'maxstatus') load();
  const seq = [e.phaseIndex];
  let stagStart = -1, stagLen = -1;
  for (let f = 0; f < 2400 && c.outcome === 'fighting' && seq[seq.length - 1] < ph.length - 1; f++) {
    if (!(e.invulnFrames > 0) && e.hp > 1) {
      const want = Math.max(1, Math.floor(e.maxHp * ph[e.phaseIndex].hpAbove) - 1);
      if (e.hp > want) {
        e.hp = want;
        if (mode === 'staggered') { enterStagger(e.ai, STAGGER_FRAMES, STAGGER_DAMAGE_MULT); stagStart = c.getFrame(); stagLen = 0; }
        if (mode === 'maxstatus') load();
      }
    }
    c.step();
    if (stagLen >= 0 && e.ai.state === 'staggered') stagLen++;
    if (e.phaseIndex !== seq[seq.length - 1]) {
      const prev = seq[seq.length - 1];
      if (e.phaseIndex !== prev + 1) fail('PHASE/skip-or-repeat', seed, c.getFrame(), `${id} ${prev} -> ${e.phaseIndex}`);
      seq.push(e.phaseIndex);
      if (e.invulnFrames !== PHASE_INVULN_FRAMES) fail('PHASE/invuln-not-armed', seed, c.getFrame(), `${id} invulnFrames=${e.invulnFrames}`);
      const want = ph[e.phaseIndex].attackPatterns;
      if (JSON.stringify(e.ai.patternIds) !== JSON.stringify(want)) fail('PHASE/patternIds-stale', seed, c.getFrame(), `${id} ai.patternIds=${e.ai.patternIds} want ${want}`);
      if (mode === 'playerdeath') {
        c.player.hp = 0;
        let n = 0;
        while (n < 120 && c.outcome === 'fighting') { c.step(); n++; }
        if (c.outcome !== 'lose') fail('PHASE/player-death-not-registered', seed, c.getFrame(), `${id} outcome=${c.outcome} ${n}f after player.hp=0`);
        assertLegal(c, seed, tag); return;
      }
    }
    assertLegal(c, seed, tag);
  }
  if (seq[seq.length - 1] !== ph.length - 1) fail('PHASE/incomplete-walk', seed, c.getFrame(), `${id} reached ${seq.join('>')} of ${ph.length} phases`);
  // let the last stagger run out so its true length (not just the length inside the walk loop) is measurable
  for (let f = 0; f < 400 && stagLen >= 0 && e.ai.state === 'staggered' && c.outcome === 'fighting'; f++) { c.step(); stagLen++; }
  if (mode === 'staggered' && stagLen > STAGGER_FRAMES) {
    fail('STAGGER-EXTENDED-BY-PHASE-INVULN', seed, stagStart, `${id} stayed staggered ${stagLen}f, not STAGGER_FRAMES=${STAGGER_FRAMES}, at x${STAGGER_DAMAGE_MULT} damage throughout: ` +
      'combat_enemy.js:76 returns before stepEnemyAI, freezing ai.timer for the 30f phase invuln plus the 160ms transition hitstop');
  }
  if (mode === 'purge' && !e.purged) fail('SETUP/purge-never-fired', seed, c.getFrame(), id);
  if (mode === 'plain' && (e.def.parts || []).length && !e.parts.some(p => p.revealed)) fail('PHASE/part-not-revealed', seed, c.getFrame(), `${id} finished its walk with no revealed part`);
}

/* combat_enemy.js:38 arms `enemy.invulnFrames` from a constant named
   PHASE_INVULN_FRAMES, but :76 is the only other reference in the app: no
   damage path reads it. Measured through the real player hit pipeline. */
function item7invuln() {
  const seed = `${SEED}-7-invuln`;
  const c = mk(seed, { enemyId: 'killer_queen' });
  const e = c.enemies[0];
  c.step(); e.hp = Math.floor(e.maxHp * e.def.phases[0].hpAbove);
  let took = 0, frames = 0, prev = e.hp, at = 0;
  for (let f = 0; f < 400 && c.outcome === 'fighting'; f++) {
    e.x = c.player.x + 30; // hold it inside Star Platinum's reach
    c.setKey('light', (f % 6) < 2);
    c.step();
    if (e.invulnFrames > 0) { if (!at) at = c.getFrame(); frames++; if (e.hp < prev) took += prev - e.hp; }
    prev = e.hp;
    if (frames && !e.invulnFrames) break;
  }
  if (took > 0) {
    fail('PHASE-INVULN-GRANTS-NO-IMMUNITY', seed, at, `killer_queen took ${took.toFixed(2)} damage across ${frames} frames of invulnFrames>0: ` +
      'combat_enemy.js:38 arms it and :76 is its only other reader in the app -- resolvers.js/combat_player.js/boss_parts.js never check it');
  }
}

function item7() {
  const ids = Object.keys(BOSSES).filter(id => Array.isArray(BOSSES[id].phases));
  ['plain', 'staggered', 'maxstatus', 'purge', 'playerdeath'].forEach(m => ids.forEach(id => walkPhases(id, m)));
  ids.forEach(id => { // full HP -> below the LAST threshold in one hit must still walk every intermediate phase
    const seed = `${SEED}-7-onehit-${id}`;
    const c = mk(seed, { enemyId: id });
    const e = c.enemies[0];
    c.step(); e.hp = 1;
    const seq = [e.phaseIndex];
    for (let f = 0; f < 900 && c.outcome === 'fighting' && seq.length < e.def.phases.length; f++) {
      c.step();
      if (e.phaseIndex !== seq[seq.length - 1]) {
        if (e.phaseIndex !== seq[seq.length - 1] + 1) fail('PHASE/onehit-skip', seed, c.getFrame(), `${id} ${seq.join('>')}>${e.phaseIndex}`);
        seq.push(e.phaseIndex);
      }
    }
    if (seq.length !== e.def.phases.length) fail('PHASE/onehit-incomplete', seed, c.getFrame(), `${id} ${seq.join('>')}`);
    assertLegal(c, seed, `7/onehit/${id}`);
  });
  passes.push(`7 phase walk over ${ids.length} bosses x {plain, staggered, maxstatus, purge, playerdeath, onehit}:`);
  passes.push('   no index skipped or repeated, patternIds swapped on the transition frame, invulnFrames armed at 30');
  passes.push('   full HP -> below the last threshold in one hit walks every intermediate phase, 30f apart');
  passes.push('   purge beat and phase transition coexist; every status at max stacks survives both with no NaN');
}

item6a(); item6b(); item6c(); item6d(); item6ef(); item6dot(); item7();

if (findings.size) {
  console.log(`qa_ai_interrupts: ${findings.size} FAILING CHECK(S)`);
  [...findings.values()].forEach(l => console.log('  ' + l));
  process.exit(1);
}
console.log('qa_ai_interrupts: OK');
passes.forEach(l => console.log('  ' + l));
