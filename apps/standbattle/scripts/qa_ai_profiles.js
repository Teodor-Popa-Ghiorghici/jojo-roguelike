/* node apps/standbattle/scripts/qa_ai_profiles.js [--runs=N] [--seed=S] [--verbose]

   Phase 13d, test-matrix items 4 (profile fidelity) and 5 (aggro).

   Item 4 asks whether each behaviour profile is OBSERVABLY distinct. The
   honest way to answer is a controlled comparison: put one instance of every
   profile in the SAME encounter against the SAME scripted player, so the
   player-vulnerability baseline, the arena and the token pool are shared, and
   the only variable left is `def.profile`. A profile whose numbers sit on top
   of another's is not implemented, whatever its table entry claims.

   The player policy is scripted, not idle: `opportunist` is defined against
   the player's RECOVERY frames, and an idle player never has any. A heavy
   attack every 90f gives a deterministic, repeatable vulnerability window.

   Item 5 measures aggro routing. resolveTarget (combat_stand.js:103) is
   evaluated per LANDED HIT, not per frame, and only when a hitbox overlaps
   BOTH hurtboxes -- so there is no per-frame target to thrash. What this
   measures instead is whether consecutive hits alternate at the rate an
   independent coin flip would (no hysteresis) or stickier (hysteresis), and
   whether the Hound/Warden hooks actually fire. */

import { buildCombatFromHeader } from '../replay.js';
import { PROFILES } from '../profiles.js';
import { idleFrame } from './qa_ai_probe.js';

const arg = (n, d) => { const a = process.argv.find(s => s.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const RUNS = parseInt(arg('runs', '30'), 10);
const SEED = arg('seed', 'aiprof');
const FRAMES = parseInt(arg('frames', '3600'), 10);
const VERBOSE = process.argv.includes('--verbose');

/* One instance per profile, same wave. `shielder` carries frontalBlock and
   `warden` carries detachedStandPunishMult; both are `turtle`, so the two
   turtles also test whether "turtle" means anything beyond its eagerness. */
const PROFILE_WAVE = ['morioh_thug', 'knife_thug', 'brute', 'sniper', 'puppeteer', 'leech', 'shielder', 'warden'];

function encounterOf(types) { return { id: 'qa_prof', winCondition: 'killAll', waves: [{ types }] }; }

function vulnerable(p) {
  return (p.state === 'attack' && p.movePhase === 'recover') || p.state === 'hitstun' || p.state === 'staggered';
}

/* Deterministic recovery windows: a heavy every 90f. Also walks toward the
   crowd so the enemies are in range at all -- a player who never closes never
   generates the commit opportunities this is trying to count. */
function punishBaitPolicy(combat, f) {
  idleFrame(combat);
  combat.setKey('right', f % 240 < 120);
  combat.setKey('left', f % 240 >= 120);
  if (f % 90 === 0) combat.setKey('heavy', true);
  if (f % 90 === 1) combat.setKey('heavy', false);
}

function newStat(profile, defId) {
  return {
    profile, defId, instances: 0, aliveFrames: 0, candidateFrames: 0, grants: 0,
    commits: 0, commitsWhileVuln: 0, activeWhileVuln: 0, activeFrames: 0,
    releases: 0, releasesOutOfRange: 0, blockedHits: 0
  };
}

function runProfileTrial(seed) {
  const combat = buildCombatFromHeader({ seed, encounter: encounterOf(PROFILE_WAVE), standId: 'star_platinum' });
  const byProfile = new Map();
  const prev = new Map();
  let vulnFrames = 0, frames = 0;
  /* frontalBlock is the only enemy-side damage denial in the engine
     (resolvers.js:162). Counted here so "a turtle should block" is measured
     rather than assumed. */
  const bus = combat.dispatcher;
  const rawQuery = bus.runQuery;
  const blocked = new Map();
  bus.runQuery = (hook, value, ctx) => {
    const out = rawQuery.call(bus, hook, value, ctx);
    if (hook === 'getDamage' && ctx && ctx.isPlayerAttacker && out === 0 && ctx.defender && ctx.defender.def) {
      blocked.set(ctx.defender.def.id, (blocked.get(ctx.defender.def.id) || 0) + 1);
    }
    return out;
  };

  for (let f = 0; f < FRAMES && combat.outcome === 'fighting'; f++) {
    combat.player.hp = combat.player.maxHp; // observer-side: measure steady state, not how fast we die
    punishBaitPolicy(combat, f);
    combat.step();
    frames++;
    const vuln = vulnerable(combat.player);
    if (vuln) vulnFrames++;
    const freeSlot = combat.tokenSystem.slots.some(s => !s.holder && s.cooldownFrames <= 0);
    combat.enemies.forEach((e, i) => {
      if (e.hp <= 0) return;
      const key = (e.def.profile || 'aggressor') + '|' + e.def.id;
      let s = byProfile.get(key);
      if (!s) { s = newStat(e.def.profile || 'aggressor', e.def.id); s.instances = 1; byProfile.set(key, s); }
      s.aliveFrames++;
      if (!e.hasToken && !e.def.ignoresToken && e.ai.state !== 'staggered' && freeSlot) s.candidateFrames++;
      const was = prev.get(i);
      if (!was || !was.tok) { if (e.hasToken) s.grants++; }
      if (was && was.tok && !e.hasToken) {
        s.releases++;
        if (Math.abs(combat.player.x - e.x) > e.ai.approachRange) s.releasesOutOfRange++;
      }
      if (was && was.state === 'approach' && e.ai.state === 'windup') {
        s.commits++;
        if (was.vuln) s.commitsWhileVuln++;
      }
      if (e.ai.state === 'active') { s.activeFrames++; if (vuln) s.activeWhileVuln++; }
      prev.set(i, { state: e.ai.state, tok: !!e.hasToken, vuln });
    });
  }
  byProfile.forEach(s => { s.blockedHits = blocked.get(s.defId) || 0; });
  return { byProfile, vulnFrames, frames };
}

/* Item 5: does anything persist a target between hits? Compares the observed
   switch rate between consecutive landed hits against the rate an independent
   Bernoulli draw with the same marginal would give. Equal => no hysteresis. */
function runAggroTrial(seed, standId, wave) {
  const combat = buildCombatFromHeader({ seed, encounter: encounterOf(wave), standId });
  const seq = [];
  let detachedDmg = 0, attachedDmg = 0, detachedFrames = 0, wardenHits = 0;
  const bus = combat.dispatcher;
  const raw = bus.runEffect;
  bus.runEffect = (hook, ctx) => {
    if (hook === 'onFeedbackDamage') seq.push('S');
    else if (hook === 'onDamageTaken' && ctx && ctx.entity === combat.player) {
      seq.push('U');
      if (ctx.attacker && ctx.attacker.def && ctx.attacker.def.detachedStandPunishMult) {
        wardenHits++;
        if (combat.player.standDetached) detachedDmg += ctx.dmg; else attachedDmg += ctx.dmg;
      }
    }
    return raw.call(bus, hook, ctx);
  };
  let standChased = 0, userChased = 0;
  for (let f = 0; f < FRAMES && combat.outcome === 'fighting'; f++) {
    combat.player.hp = combat.player.maxHp;
    idleFrame(combat);
    combat.setKey('project', standId === 'star_platinum' ? f % 120 < 90 : false);
    if (standId === 'sticky_fingers' && f % 200 === 0) combat.setKey('project', true);
    if (standId !== 'star_platinum') combat.setKey('right', f % 300 < 150);
    combat.step();
    if (combat.player.standDetached) detachedFrames++;
    // does ANY enemy move toward the Stand rather than the User?
    combat.enemies.forEach(e => {
      if (e.hp <= 0 || !e.moving) return;
      const toUser = Math.sign(combat.player.x - e.x), toStand = Math.sign(combat.stand.x - e.x);
      if (toUser !== toStand) { if (e.facing === toStand) standChased++; else userChased++; }
    });
  }
  let switches = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) switches++;
  const u = seq.filter(c => c === 'U').length, n = seq.length;
  const pU = n ? u / n : 0;
  return {
    n, u, s: n - u, switches, switchRate: n > 1 ? switches / (n - 1) : 0,
    memorylessRate: 2 * pU * (1 - pU), detachedDmg, attachedDmg, wardenHits, detachedFrames, standChased, userChased
  };
}

const agg = new Map();
let totalVuln = 0, totalFrames = 0;
for (let i = 0; i < RUNS; i++) {
  const t = runProfileTrial(`${SEED}-${i}`);
  totalVuln += t.vulnFrames; totalFrames += t.frames;
  t.byProfile.forEach((s, k) => {
    const cur = agg.get(k) || newStat(s.profile, s.defId);
    Object.keys(s).forEach(f => { if (typeof s[f] === 'number') cur[f] += s[f]; });
    cur.profile = s.profile; cur.defId = s.defId;
    agg.set(k, cur);
  });
}

const base = totalVuln / Math.max(1, totalFrames);
const pctS = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '--').padStart(7);
const out = [];
out.push(`PROFILE FIDELITY  (${RUNS} trials, all 6 profiles in ONE wave, scripted heavy every 90f)`);
out.push(`  player-vulnerable baseline: ${(base * 100).toFixed(1)}% of frames`);
out.push('  profile     enemy       grants/1k-cand  commits  %commit-vuln  %active-vuln  %rel@bad-rng  blocked');
[...agg.values()].sort((a, b) => a.profile.localeCompare(b.profile)).forEach(s => {
  out.push('  ' + s.profile.padEnd(12) + s.defId.padEnd(12) +
    (1000 * s.grants / Math.max(1, s.candidateFrames)).toFixed(1).padStart(10) +
    String(s.commits).padStart(9) + pctS(s.commitsWhileVuln, s.commits) + '      ' +
    pctS(s.activeWhileVuln, s.activeFrames) + '      ' + pctS(s.releasesOutOfRange, s.releases) + '   ' +
    String(s.blockedHits).padStart(6));
});
out.push('  declared: ' + Object.entries(PROFILES).map(([k, v]) => `${k}=${v.eagerness}`).join(' ') +
  '  (flanker +flankBonus, opportunist +punishBonus; nothing else differs)');

out.push('AGGRO (item 5) -- per-stand-class routing, Hound/Warden hooks');
const AGGRO_WAVES = { control: ['morioh_thug', 'brute'], hound: ['hound', 'morioh_thug'], warden: ['warden', 'morioh_thug'] };
[['star_platinum', 'close'], ['sticky_fingers', 'mid'], ['hierophant_green', 'long']].forEach(([standId, cls]) => {
  Object.entries(AGGRO_WAVES).forEach(([label, wave]) => {
    const t = { n: 0, u: 0, switches: 0, memo: 0, dd: 0, ad: 0, wh: 0, df: 0, sc: 0, uc: 0 };
    for (let i = 0; i < Math.min(RUNS, 10); i++) {
      const r = runAggroTrial(`${SEED}-ag-${i}`, standId, wave);
      t.n += r.n; t.u += r.u; t.switches += r.switches; t.memo += r.memorylessRate * Math.max(0, r.n - 1);
      t.dd += r.detachedDmg; t.ad += r.attachedDmg; t.wh += r.wardenHits; t.df += r.detachedFrames;
      t.sc += r.standChased; t.uc += r.userChased;
    }
    out.push(`  ${cls.padEnd(6)} ${label.padEnd(8)} hits=${String(t.n).padStart(4)} user=${pctS(t.u, t.n)}%` +
      ` switch=${pctS(t.switches, Math.max(1, t.n - 1))}% vs memoryless=${pctS(t.memo, Math.max(1, t.n - 1))}%` +
      (label === 'warden' ? ` wardenHits=${t.wh} dmg detached/attached=${t.dd.toFixed(0)}/${t.ad.toFixed(0)}` : '') +
      (VERBOSE ? ` chasedStand=${t.sc} chasedUser=${t.uc}` : ''));
  });
});
console.log(out.join('\n'));
