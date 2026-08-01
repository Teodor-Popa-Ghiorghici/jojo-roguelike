/* Hook wiring for fx.js's effect catalog -- split out once Phase 6 pushed
   fx.js itself over the repo's 300-line file cap (two more cues: the
   purge beat and the exposed-User reveal, GDD §18B/§4.6). One
   dispatcher.on() per cue, each just calling fx.spawn() with the
   catalog's existing effect types -- no new effect types were needed for
   Phase 6's cues, only new colour/text combinations of what already
   existed. */

import { FX } from './palette.js';

const BARKS = ['ORA', 'ORA ORA', 'ORA ORA ORA'];

export function wireFx(combat, fx, groundY) {
  const d = combat.dispatcher;
  const P = combat.player, E = combat.enemy;
  const mid = () => ({ x: (P.x + E.x) / 2, y: groundY - 52 });

  d.on('onHit', ev => {
    const big = ev.moveType === 'heavy' || ev.finishing;
    /* Phase 5: onHit now carries `target` (combat_player.js) -- the
       specific crowd enemy that was actually hit -- so impact fx land on
       it rather than always anchoring near combat.enemy (enemies[0]). */
    const hitX = ev.target ? ev.target.x : E.x;
    const x = hitX - P.facing * 12, y = groundY - 54 - Math.random() * 12;
    fx.spawn('impact', { x, y, size: big ? 15 : 9, dir: P.facing > 0 ? 0 : Math.PI, life: big ? 0.3 : 0.2, big });
    fx.spawn('lines', { x, y, dir: P.facing, count: big ? 11 : 6, len: big ? 54 : 30, life: 0.22, color: '#FFFFFF' });
    if (big) fx.spawn('shock', { x, y, size: 46, life: 0.3, color: FX.spark[4], squash: 0.7 });
    for (let i = 0; i < (big ? 7 : 3); i++) {
      fx.spawn('spark', {
        x, y, vx: (Math.random() - 0.5) * 220 + P.facing * 120, vy: -Math.random() * 190,
        size: Math.random() < 0.4 ? 3 : 2, life: 0.3 + Math.random() * 0.3,
        color: FX.spark[Math.floor(Math.random() * 3) + 2]
      });
    }
    if (ev.combo === 3 || ev.combo === 6 || ev.combo >= 9) {
      const i = ev.combo >= 9 ? 2 : ev.combo === 6 ? 1 : 0;
      fx.spawn('bark', { text: BARKS[i], x: P.x + P.facing * 30, y: groundY - 96, scale: 2 + i, life: 0.55, solo: 'bark' });
    }
  });

  d.on('onParrySuccess', () => {
    const x = P.x + P.facing * 20, y = groundY - 56;
    fx.spawn('flash', { color: '#FFFFFF', alpha: 0.34, life: 0.14, solo: 'flash' });
    fx.spawn('burstBg', { x, y, life: 0.34, color: FX.guard[4], solo: 'burst' });
    fx.spawn('shock', { x, y, size: 66, life: 0.4, color: FX.guard[4] });
    fx.spawn('impact', { x, y, size: 16, dir: 0, life: 0.35, big: true });
    fx.spawn('bark', { text: 'PARRY', x, y: groundY - 100, scale: 3, life: 0.6, color: FX.guard[4], shadow: '#0B2E4A', solo: 'bark' });
  });

  d.on('onDodgeSuccess', () => {
    fx.spawn('dust', { x: P.x, y: groundY - 2, dir: -P.facing, size: 20, life: 0.4 });
    fx.spawn('bark', { text: 'MISS', x: P.x, y: groundY - 94, scale: 2, life: 0.5, color: FX.ghost[4], shadow: '#152A55', solo: 'bark' });
  });

  d.on('onDamageTaken', ev => {
    const x = P.x + P.facing * 8, y = groundY - 58;
    fx.spawn('impact', { x, y, size: ev.heavy ? 14 : 9, dir: P.facing > 0 ? Math.PI : 0, life: 0.26, big: ev.heavy });
    fx.spawn('lines', { x, y, dir: -P.facing, count: 8, len: 44, life: 0.24, color: FX.blood[4] });
    for (let i = 0; i < 6; i++) {
      fx.spawn('spark', {
        x, y, vx: (Math.random() - 0.5) * 200 - P.facing * 90, vy: -Math.random() * 170,
        size: 2, life: 0.4, color: FX.blood[2 + (i % 3)]
      });
    }
  });

  d.on('onKill', () => {
    const x = E.x, y = groundY - 54;
    fx.spawn('flash', { color: '#FFFFFF', alpha: 0.30, life: 0.18, solo: 'flash' });
    fx.spawn('burstBg', { x, y, life: 0.5, color: FX.spark[3], solo: 'burst' });
    fx.spawn('shock', { x, y, size: 90, life: 0.5, color: FX.spark[4] });
    fx.spawn('shock', { x, y: groundY, size: 70, life: 0.45, color: FX.dust[3], squash: 0.25 });
    for (let i = 0; i < 16; i++) {
      fx.spawn('spark', {
        x, y, vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 260,
        size: Math.random() < 0.5 ? 3 : 2, life: 0.5 + Math.random() * 0.4,
        color: FX.spark[Math.floor(Math.random() * 4) + 1]
      });
    }
  });

  d.on('onPhaseTransition', () => {
    fx.spawn('flash', { color: '#FF4A7E', alpha: 0.38, life: 0.3, solo: 'flash' });
    fx.spawn('burstBg', { x: E.x, y: groundY - 60, life: 0.6, color: '#FF4A7E', solo: 'burst' });
    fx.spawn('shock', { x: E.x, y: groundY - 60, size: 120, life: 0.6, color: '#FFC2D8' });
    for (let i = 0; i < 20; i++) {
      fx.spawn('aura', { x: E.x + (Math.random() - 0.5) * 40, y: groundY - Math.random() * 20, size: 30 + Math.random() * 30, life: 0.8, color: '#FF6B9E' });
    }
  });

  d.on('onTelegraphStart', ev => {
    if (!ev.pattern) return;
    fx.spawn('shock', { x: E.x, y: groundY - 2, size: ev.pattern.range * 1.2, life: 0.45, color: ev.pattern.telegraph, squash: 0.22, alpha: 0.7 });
  });

  /* GDD §18B purge beat -- a distinct cool-white/steel cue so it never
     reads as just another phase transition (onPhaseTransition's flash is
     pink, this one is deliberately a different colour and text). */
  d.on('onPurge', () => {
    fx.spawn('flash', { color: '#CFE8FF', alpha: 0.34, life: 0.3, solo: 'flash' });
    fx.spawn('burstBg', { x: E.x, y: groundY - 60, life: 0.5, color: '#CFE8FF', solo: 'burst' });
    fx.spawn('shock', { x: E.x, y: groundY - 60, size: 100, life: 0.5, color: '#FFFFFF' });
    fx.spawn('bark', { text: 'DEFEND MODE', x: E.x, y: groundY - 110, scale: 2, life: 0.7, color: '#CFE8FF', shadow: '#0B2E4A', solo: 'bark' });
  });

  /* GDD §4.6 Phase 3 -- the exposed-User reveal's own cue, layered on top
     of the onPhaseTransition cue that always fires alongside it. */
  d.on('onPartExposed', () => {
    fx.spawn('flash', { color: '#FFE86A', alpha: 0.2, life: 0.3, solo: 'flash' });
    fx.spawn('shock', { x: E.x, y: groundY - 60, size: 70, life: 0.45, color: '#FFE86A' });
    fx.spawn('bark', { text: 'WEAK POINT', x: E.x, y: groundY - 100, scale: 2, life: 0.6, color: '#FFE86A', shadow: '#3A2A06', solo: 'bark' });
  });
}
