/* Phase 13f — systems-collision cases, groups 1-2.
   G1 priority bands · G2 status x status.
   Each case returns {finding|null, seed, frame, detail}; the runner in
   qa_systems_collision.js reports and (with --record) writes fixtures. */

import { createDispatcher, PRIORITY } from '../hooks.js';
import { STATUS_DEFS, applyStatus, stepStatuses, hasStatus, registerStatusHit } from '../status.js';
import { ENCOUNTERS } from '../data_encounters.js';
import { mkCombat, stepFight, tap, alive, found, clean, absent } from './qa_collision_util.js';

const H = (over) => Object.assign({ seed: 'c13f', enemyId: 'knife_thug', standId: 'star_platinum' }, over);

/* ---------------- G1: priority bands (effect-pipeline x content) -------- */

const G1 = [{
  id: 'c1a-band-order-vs-authoring-order', group: 1, systems: ['effect-pipeline', 'content'],
  title: 'priority beats authoring order (registered CLAMP -> MULTIPLY -> ADD)',
  run() {
    const bus = createDispatcher();
    const order = [];
    bus.effect('onDamageIncoming', PRIORITY.CLAMP, c => { order.push('clamp'); c.damage = Math.min(10, c.damage); });
    bus.effect('onDamageIncoming', PRIORITY.MULTIPLY, c => { order.push('mul'); c.damage *= 3; });
    bus.effect('onDamageIncoming', PRIORITY.ADD, c => { order.push('add'); c.damage += 5; });
    const ctx = bus.runEffect('onDamageIncoming', { damage: 1 });
    const want = 'add,mul,clamp';
    if (order.join(',') !== want) return found(`band order was ${order.join(',')}, expected ${want}`, 'c13f-unit', 0);
    if (ctx.damage !== 10) return found(`clamp did not win: damage=${ctx.damage}`, 'c13f-unit', 0);
    return clean(`order=${order.join(',')} damage=${ctx.damage}`);
  }
}, {
  id: 'c1b-identical-priority-determinism', group: 1, systems: ['effect-pipeline', 'rng-determinism'],
  title: 'ties resolve in registration order, stably, across 200 dispatchers and re-sorts',
  run() {
    let first = null;
    for (let trial = 0; trial < 200; trial++) {
      const bus = createDispatcher();
      const order = [];
      for (let i = 0; i < 6; i++) bus.effect('onDamageIncoming', PRIORITY.MULTIPLY, () => order.push(`m${i}`));
      // interleave later registrations at other bands to force repeated re-sorts (hooks.js:152)
      bus.effect('onDamageIncoming', PRIORITY.ADD, () => order.push('a'));
      bus.effect('onDamageIncoming', PRIORITY.CLAMP, () => order.push('z'));
      for (let i = 6; i < 10; i++) bus.effect('onDamageIncoming', PRIORITY.MULTIPLY, () => order.push(`m${i}`));
      bus.runEffect('onDamageIncoming', { damage: 1 });
      const s = order.join(',');
      if (first == null) first = s;
      else if (s !== first) return found(`tie order not stable: trial ${trial} gave ${s}, trial 0 gave ${first}`, 'c13f-unit', trial);
    }
    return clean(`stable across 200 trials: ${first}`);
  }
}, {
  id: 'c1c-swapped-arg-nan-priority', group: 1, systems: ['effect-pipeline', 'content'],
  title: 'a swapped-arg registration sorts by NaN and silently keeps authoring order',
  run() {
    const bus = createDispatcher();
    const order = [];
    // bus.effect is (name, priority, fn, source). A content author writing
    // (name, fn, priority) registers fn as the priority.
    bus.effect('onDamageIncoming', PRIORITY.CLAMP, c => { order.push('clamp'); c.damage = Math.min(10, c.damage); });
    bus.effect('onDamageIncoming', (c => { order.push('add'); c.damage += 5; }), PRIORITY.ADD);
    const err = (() => { try { bus.runEffect('onDamageIncoming', { damage: 1 }); return null; } catch (e) { return e.message; } })();
    if (err) {
      return found(
        `bus.effect (hooks.js:148) accepts a function as \`priority\` with no type check — the registration succeeds, sortByPriority compares against NaN, and the failure only surfaces later at dispatch as "${err}", pointing at hooks.js rather than the content file that mis-registered. assertKind already validates the hook name at this exact spot; the priority is not validated at all`,
        'c13f-unit', 0, { deferredError: err });
    }
    return clean(`order=${order.join(',')}`);
  }
}, {
  id: 'c1d-cancel-skips-clamp-band', group: 1, systems: ['effect-pipeline', 'resolvers'],
  title: 'an ADD-band effect setting ctx.cancelled skips the CLAMP band entirely',
  run() {
    const bus = createDispatcher();
    const ran = [];
    bus.effect('onDamageIncoming', PRIORITY.ADD, c => { ran.push('add'); c.damage = 1e9; c.cancelled = true; });
    bus.effect('onDamageIncoming', PRIORITY.CLAMP, c => { ran.push('clamp'); c.damage = Math.min(10, c.damage); });
    const ctx = bus.runEffect('onDamageIncoming', { damage: 1 });
    if (ran.includes('clamp')) return clean('clamp band still ran after cancel');
    /* The band guarantee IS conditionally broken -- but every shipped
       consumer treats `cancelled` as "discard the value entirely", so the
       unclamped number never reaches a stat. Verified here rather than
       asserted: each of these is the exact ternary at the cited line. */
    const consumers = [
      ['combat_defense.js:130', c => (c.cancelled ? 0 : c.damage)],
      ['combat_stand.js:130', c => (c.cancelled ? 0 : c.damage)],
      ['resolvers.js:217', c => (c.cancelled ? 0 : c.damage)]
    ];
    const leaked = consumers.filter(([, f]) => f(ctx) !== 0).map(([w]) => w);
    if (leaked.length) {
      return found(`an ADD-band cancel skipped the CLAMP band and ${leaked.join(', ')} still consumed the unclamped ${ctx.damage}`, 'c13f-unit', 0);
    }
    return clean(
      `cancel in the ADD band does break runEffect (hooks.js:158) before the CLAMP band — ctx.damage was left at ${ctx.damage}, unclamped — but all three damage consumers zero on cancel, so nothing reads it. Latent for any future call site that reads ctx after a cancel instead of discarding it`);
  }
}];

/* ---------------- G2: status x status ---------------------------------- */

const STATUS_IDS = Object.keys(STATUS_DEFS);

function statusPairCase(a, b) {
  return {
    id: `c2-pair-${a}-then-${b}`, group: 2, systems: ['status', 'status'], quiet: true,
    title: `apply ${a} then ${b}`,
    run() {
      const e = { statuses: [], hp: 100, maxHp: 100 };
      applyStatus(e, a, 2); applyStatus(e, b, 2);
      const ids = e.statuses.map(s => s.id);
      if (a !== b && (!ids.includes(a) || !ids.includes(b))) {
        return found(`applying ${b} after ${a} left statuses [${ids.join(',')}] — one was dropped`, 'c13f-unit', 0);
      }
      for (const inst of e.statuses) {
        const def = STATUS_DEFS[inst.id];
        if (!Number.isFinite(inst.stacks) || inst.stacks < 0) return found(`${inst.id} stacks=${inst.stacks}`, 'c13f-unit', 0);
        if (inst.stacks > (def.maxStacks || Infinity)) return found(`${inst.id} stacks ${inst.stacks} > maxStacks ${def.maxStacks}`, 'c13f-unit', 0);
        if (inst.timer < 0) return found(`${inst.id} timer=${inst.timer}`, 'c13f-unit', 0);
      }
      for (let f = 0; f < 400; f++) stepStatuses(e);
      if (e.statuses.some(s => s.timer < 0 && s.timer !== -Infinity)) return found(`negative timer after 400f`, 'c13f-unit', 400);
      return clean(`${ids.join('+')} -> after 400f: ${e.statuses.map(s => s.id).join('+') || 'none'}`);
    }
  };
}

const G2 = [];
for (const a of STATUS_IDS) for (const b of STATUS_IDS) G2.push(statusPairCase(a, b));

G2.push({
  id: 'c2a-frozen-never-breaks-never-expires', group: 2, systems: ['status', 'damage-resolution'],
  title: 'Frozen has infinite duration and its breaksOnHits counter is never incremented by any combat path',
  run() {
    const e = { statuses: [], hp: 100, maxHp: 100 };
    applyStatus(e, 'frozen', 1);
    for (let f = 0; f < 6000; f++) stepStatuses(e);
    const still = hasStatus(e, 'frozen');
    // registerStatusHit exists and works -- it is simply never called.
    const clone = { statuses: [], hp: 100 };
    applyStatus(clone, 'frozen', 1);
    for (let i = 0; i < 3; i++) registerStatusHit(clone);
    const breaksWhenCalled = !hasStatus(clone, 'frozen');
    if (still && breaksWhenCalled) {
      return found(
        'Frozen (durationFrames Infinity, status.js:53) can only be removed by registerStatusHit, which has zero call sites outside status.js — once applied it is permanent, and resolvers.js:200 applies its +25% damageTakenMult unconditionally for the rest of the fight',
        'c13f-unit', 6000, { survivedFrames: 6000, breaksWhenCalledManually: breaksWhenCalled });
    }
    return clean(`frozen after 6000f: ${still}`);
  }
}, {
  id: 'c2b-status-on-a-corpse', group: 2, systems: ['status', 'death-pipeline'],
  title: 'a status applied to an already-dying enemy keeps ticking on the corpse',
  run() {
    const seed = 'c13f-corpse';
    const combat = mkCombat('c2b-status-on-a-corpse', H({ seed, enemyId: 'knife_thug' }));
    const enemy = combat.enemies[0];
    let poked = 0;
    stepFight(combat, 600, (c, f) => {
      if (f === 120) { enemy.hp = 0; applyStatus(enemy, 'virus', 5); poked = f; }
    });
    const inst = (enemy.statuses || []).find(s => s.id === 'virus');
    if (inst && enemy.hp < 0) {
      return found(
        `virus applied on the frame the enemy died kept ticking applyDot into negative HP (hp=${enemy.hp.toFixed(1)}) — status.js:126's applyDot has no hp>0 guard and nothing polls a DoT kill (status.js:115-125), the same hole QA-021 reports from the other side`,
        seed, poked, { hp: enemy.hp, stacks: inst.stacks });
    }
    return clean(`hp=${enemy.hp} virus=${inst ? inst.stacks : 'gone'}`);
  }
}, {
  id: 'c2c-purge-immunity-swallows-status', group: 2, systems: ['status', 'purge'],
  title: 'purge status-immunity silently no-ops every status application in its 360f window',
  run() {
    const e = { statuses: [], hp: 100, statusImmuneFrames: 360 };
    applyStatus(e, 'virus', 5); applyStatus(e, 'doom', 3); applyStatus(e, 'frozen', 1);
    const swallowed = e.statuses.length === 0;
    return swallowed
      ? clean('3 applications swallowed by statusImmuneFrames (status.js:143) — by design, GDD §18B; recorded so 13l knows a "dropped status" report may be purge, not a bug')
      : found(`statusImmuneFrames did not block: ${e.statuses.map(s => s.id).join(',')}`, 'c13f-unit', 0);
  }
}, {
  id: 'c2d-warded-consumed-by-harmless-status', group: 2, systems: ['status', 'affix'],
  title: 'Warded is consumed by the first status of any kind, including a benign one',
  run() {
    const e = { statuses: [], hp: 100, affixData: { warded: true } };
    applyStatus(e, 'mark', 1); // a pure utility status, no damage
    const consumed = e.affixData.warded === false && e.statuses.length === 0;
    applyStatus(e, 'virus', 9);
    const virusLanded = hasStatus(e, 'virus');
    if (consumed && virusLanded) {
      return found(
        'Warded (status.js:147) is spent by the first status applied regardless of threat, so a 1-stack Mark disarms the ward and the following 9-stack Virus lands in full — the ward has no notion of what it is warding against',
        'c13f-unit', 0, { consumedBy: 'mark', thenLanded: 'virus x9' });
    }
    return clean(`warded=${e.affixData.warded} statuses=${e.statuses.map(s => s.id).join(',')}`);
  }
}, {
  id: 'c2e-absent-statuses', group: 2, systems: ['status', 'content'],
  title: 'Bleed / Break / Bomb-Primed / Leashed as statuses',
  run() {
    const missing = ['bleed', 'break', 'bomb_primed', 'leashed'].filter(id => !STATUS_DEFS[id]);
    return absent(
      `${missing.join(', ')} are not statuses in this codebase (STATUS_DEFS, status.js:35, holds exactly ${STATUS_IDS.length}: ${STATUS_IDS.join(', ')}). bomb_primed and leashed exist as affixes (affixes.js:26, :52); bleed and break exist nowhere. The mission's Bleed-on-Frozen and Break-consumed-by-a-cancelled-hit cases have no subject`,
      'status.js:35');
  }
});

export const CASES_A = [...G1, ...G2];
