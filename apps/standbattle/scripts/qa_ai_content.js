/* Phase 13d reporting + QA-only encounter compositions for
   qa_ai_probe.js. Split out purely for the repo's 300-line file cap -- this
   is the same tool, second half: the formatters that turn one accumulator
   into the token/ranged/profile tables, plus the synthetic waves that reach
   the 13 enemy types no shipped encounter references (QA-010). */

import { ENEMIES } from '../data.js';
import { PROFILES } from '../profiles.js';


/* QA-only compositions. 13 of 18 ENEMIES entries are referenced by NO
   shipped encounter (see the phase report) -- including every ranged type,
   both summoners and both Long-Range counterplay types -- so the only way
   to exercise those code paths at all is to author the encounter here.
   These are valid encounter defs, not engine changes: same `waves` shape
   stepEncounter already consumes. */
const W = types => ({ types });
export const SYNTHETIC = {
  qa_mixed_profiles: { id: 'qa_mixed_profiles', winCondition: 'killAll', waves: [W(['morioh_thug', 'knife_thug', 'brute', 'shielder', 'duelist', 'leech'])] },
  qa_ranged_pool: { id: 'qa_ranged_pool', winCondition: 'killAll', waves: [W(['sniper', 'zoner', 'bomber', 'morioh_thug', 'brute'])] },
  qa_ranged_max: { id: 'qa_ranged_max', winCondition: 'killAll', waves: [W(['sniper', 'sniper', 'zoner', 'bomber', 'morioh_thug', 'knife_thug', 'brute', 'shielder'])] },
  qa_summoners: { id: 'qa_summoners', winCondition: 'killAll', waves: [W(['caller', 'puppeteer', 'morioh_thug'])] },
  qa_hound_warden: { id: 'qa_hound_warden', winCondition: 'killAll', waves: [W(['hound', 'warden', 'morioh_thug', 'knife_thug'])] },
  qa_support_flank: { id: 'qa_support_flank', winCondition: 'killAll', waves: [W(['puppeteer', 'caller', 'leech', 'illuso_mirror', 'phaser', 'valentine_parallel'])] },
  /* The token-deadlock probe: a fleeing enemy alongside enemies that want
     to attack. encounter.js:98 parks a `flees` enemy in ai.state 'flee'
     permanently, and token.js's candidate filter only excludes 'staggered'. */
  qa_flee_deadlock: {
    id: 'qa_flee_deadlock', winCondition: 'killAll',
    waves: [W([{ ...ENEMIES.knife_thug, id: 'runner_a', hp: 400, flees: true },
      { ...ENEMIES.knife_thug, id: 'runner_b', hp: 400, flees: true },
      'morioh_thug', 'brute'])]
  }
};

export function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
export function pct(n, d) { return d ? ((100 * n) / d).toFixed(1) + '%' : 'n/a'; }

export function reportTokens(acc, runs) {
  const lines = [];
  lines.push('TOKEN SYSTEM HEALTH  (' + runs + ' crowd runs, idle player, ' + acc.frames + ' sim frames)');
  lines.push('  mean token hold        ' + mean(acc.holds.map(h => h.frames)).toFixed(1) + 'f  (n=' + acc.holds.length + ')');
  lines.push('  mean gap between holds ' + mean(acc.gaps.map(g => g.frames)).toFixed(1) + 'f  (n=' + acc.gaps.length + ')');
  lines.push('  longest NO-token gap   ' + acc.noHolder.max + 'f  (ends frame ' + acc.noHolder.at + ')');
  lines.push('  longest NO-pressure gap ' + acc.noPressure.max + 'f  (no enemy in windup/active, ends frame ' + acc.noPressure.at + ')');
  lines.push('  token-frames held by an entity that cannot act: ' + pct(acc.deadHoldFrames, acc.heldFrames));
  lines.push('  DEADLOCK (all melee tokens held, none can act) longest run: ' + acc.deadlock.max +
    'f' + (acc.deadlock.max ? ' at frame ' + acc.deadlock.at + ' [' + acc.deadlock.holders + ']' : ''));
  lines.push('  melee-slot occupancy ' + pct(acc.heldFrames - acc.rangedSlotHeldFrames, acc.meleeSlotFrames));
  return lines;
}

export function reportRanged(acc) {
  return [
    'RANGED POOL SEPARATION',
    '  frames the reserved RANGED slot was held: ' + acc.rangedSlotHeldFrames + ' (0 => pool is dead capacity)',
    '  frames a ranged-only enemy occupied a MELEE slot: ' + acc.rangedInMeleeSlotFrames,
    '  ranged windup/active frames overlapping a melee commitment: ' +
      acc.rangedFiringDuringMeleeCommit + '/' + acc.rangedActiveFrames +
      ' (' + pct(acc.rangedFiringDuringMeleeCommit, acc.rangedActiveFrames) + ')'
  ];
}

export function reportProfiles(acc) {
  const byProfile = new Map();
  acc.byUid.forEach(s => {
    let p = byProfile.get(s.profile);
    if (!p) { p = { profile: s.profile, grants: 0, candidateFrames: 0, commits: 0, commitsWhileVuln: 0, releases: 0, releasesOutOfRange: 0, blockFrames: 0, aliveFrames: 0, n: 0 }; byProfile.set(s.profile, p); }
    ['grants', 'candidateFrames', 'commits', 'commitsWhileVuln', 'releases', 'releasesOutOfRange', 'blockFrames', 'aliveFrames'].forEach(k => { p[k] += s[k]; });
    p.n++;
  });
  const baseVuln = acc.vulnFrames / Math.max(1, acc.frames);
  const lines = ['PROFILE DISTINCTNESS  (player-vulnerable baseline ' + (baseVuln * 100).toFixed(1) + '% of frames)',
    '  profile      n   grants/1k cand-f   commits  %while-vuln  releases@bad-range  block-f'];
  [...byProfile.values()].sort((a, b) => a.profile.localeCompare(b.profile)).forEach(p => {
    lines.push('  ' + p.profile.padEnd(12) + String(p.n).padStart(3) +
      (1000 * p.grants / Math.max(1, p.candidateFrames)).toFixed(2).padStart(11) +
      String(p.commits).padStart(10) + pct(p.commitsWhileVuln, p.commits).padStart(13) +
      pct(p.releasesOutOfRange, p.releases).padStart(20) + String(p.blockFrames).padStart(9));
  });
  lines.push('  declared weights: ' + Object.entries(PROFILES)
    .map(([k, v]) => k + '=' + v.eagerness + (v.flankBonus ? '/flank' + v.flankBonus : '') + (v.punishBonus ? '/punish' + v.punishBonus : '')).join(' '));
  return lines;
}

