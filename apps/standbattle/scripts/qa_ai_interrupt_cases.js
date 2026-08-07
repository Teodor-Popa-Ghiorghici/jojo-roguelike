/* Phase 13d: the shared player driver and the legality assertion behind
   qa_ai_interrupts.js. Split out for the repo's 300-line file cap -- same
   tool, second half.

   `assertLegal` is the whole point of test-matrix item 6: every interrupt
   (poise break, stagger, death mid-pattern, a summoner cut off mid-summon)
   must leave the encounter in a state the engine can keep stepping. It
   checks the invariants that would otherwise only surface as a crash three
   seconds later -- non-finite transforms, HP outside [0,max], an AI state
   outside the machine's own vocabulary, a committed AI state with no
   pattern behind it, negative status stacks/timers, and a token slot still
   pointing at a corpse. */

const STATES = ['approach', 'windup', 'active', 'recover', 'staggered', 'flee'];
const COMMITTED = ['windup', 'active', 'recover'];

/* Crude on purpose: this is a driver that puts the player in contact so an
   interrupt has something to interrupt, not a bot whose skill is under
   test. */
export function chase(c, f) {
  const e = c.enemies.find(x => x.hp > 0);
  ['left', 'right', 'forward', 'back', 'light', 'medium', 'heavy', 'dodge', 'parry', 'guard', 'project']
    .forEach(k => c.setKey(k, false));
  if (!e) return;
  c.setKey('right', e.x > c.player.x + 4);
  c.setKey('left', e.x < c.player.x - 4);
  c.setKey('forward', e.z < c.player.z - 4); // QA-003: 'forward' DECREASES z
  c.setKey('back', e.z > c.player.z + 4);
  if (f % 24 === 0) c.setKey('light', true);
}

export function makeAssertLegal(fail) {
  return function assertLegal(c, seed, tag) {
    const fr = c.getFrame();
    c.entities.concat(c.enemies).forEach(e => {
      const id = e.def ? e.def.id : e.id;
      [e.x, e.z, e.hp].forEach(v => {
        if (v != null && !Number.isFinite(v)) fail('LEGAL/nan:' + tag, seed, fr, `${id} non-finite transform/hp`);
      });
      if (e.hp != null && e.hp < 0) fail('LEGAL/neg-hp:' + tag, seed, fr, `${id} hp=${e.hp}`);
      if (e.hp != null && e.maxHp != null && e.hp > e.maxHp + 1e-6) fail('LEGAL/over-hp:' + tag, seed, fr, `${id} hp>maxHp`);
      (e.statuses || []).forEach(s => {
        if (s.stacks < 0 || s.timer < 0) fail('LEGAL/status:' + tag, seed, fr, `${id} ${s.id} stacks=${s.stacks} t=${s.timer}`);
      });
      if (!e.ai) return;
      if (!STATES.includes(e.ai.state)) fail('LEGAL/ai-state:' + tag, seed, fr, `${id} ai.state=${e.ai.state}`);
      if (COMMITTED.includes(e.ai.state) && !e.ai.pattern) {
        fail('LEGAL/pattern:' + tag, seed, fr, `${id} in '${e.ai.state}' with no ai.pattern`);
      }
    });
    (c.tokenSystem ? c.tokenSystem.slots : []).forEach((s, i) => {
      if (s.holder && s.holder.hp <= 0) fail('LEGAL/token:' + tag, seed, fr, `slot ${i} still holds a dead enemy`);
    });
  };
}
