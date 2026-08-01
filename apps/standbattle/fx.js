/* Combat effects layer.

   Effects are spawned from the existing hook dispatcher rather than from
   inside the combat loop (§0), so a new impact flourish is a listener,
   not a branch in combat.js. Everything is drawn as hard pixels: impact
   flashes are polygon stars, speed lines are 1px wedges, shockwaves are
   scan-converted rings.

   Intensity is deliberately uneven (§10 juice budget): routine jabs get a
   small spark, while parries, staggers and kills get the ring, the
   letters and the screen flash. */

import { poly, px, ring, ellipse, disc, line, place } from './draw.js';
import { text } from './font.js';
import { FX, S, SH, BASE, LT, RIM } from './palette.js';

const BARKS = ['ORA', 'ORA ORA', 'ORA ORA ORA'];

const ease = t => 1 - Math.pow(1 - Math.min(1, t), 3);

export function createFx() {
  const list = [];
  const api = {
    list,
    /* `solo` effects are exclusive: spawning one drops any other of the
       same kind still on screen. Without it a fast combo stacks four
       screen flashes and three ray bursts on top of each other and the
       frame washes out -- the opposite of the juice budget in §10, where
       the big responses are supposed to stay rare enough to mean
       something. */
    spawn(type, o) {
      if (o && o.solo) {
        for (let i = list.length - 1; i >= 0; i--) if (list[i].solo === o.solo) list.splice(i, 1);
      }
      if (list.length > 70) list.shift();
      list.push(Object.assign({ type, t: 0, life: 0.4, x: 0, y: 0, dir: 1 }, o));
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        e.t += dt / 1000;
        if (e.vy != null) { e.x += (e.vx || 0) * dt / 1000; e.y += e.vy * dt / 1000; e.vy += 260 * dt / 1000; }
        if (e.t >= e.life) list.splice(i, 1);
      }
    },
    draw(g, W, H) {
      for (const e of list) DRAW[e.type] && DRAW[e.type](g, e, e.t / e.life, W, H);
    },
    clear() { list.length = 0; }
  };
  return api;
}

/* ---- individual effects ------------------------------------------------ */

function star(g, x, y, r, points, color, rot) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.36 : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  poly(g, pts, color);
}

const DRAW = {
  /* the flash that sells a connecting hit: a hard white core, a coloured
     star behind it, and a few streaks along the strike vector */
  impact(g, e, k) {
    const r = e.size * (0.4 + k * 1.5);
    const fade = 1 - k;
    g.save();
    g.globalAlpha = Math.min(1, fade * 1.6);
    star(g, e.x, e.y, r * 1.25, 6, FX.spark[e.big ? 1 : 2], e.t * 5 + e.dir);
    star(g, e.x, e.y, r * 0.8, 5, FX.spark[3], -e.t * 4);
    if (k < 0.45) star(g, e.x, e.y, r * 0.5, 4, '#FFFFFF', e.t * 9);
    for (let i = 0; i < (e.big ? 7 : 4); i++) {
      const a = (i / (e.big ? 7 : 4)) * Math.PI * 2 + e.dir;
      const L = r * (1.4 + (i % 3) * 0.5);
      line(g, e.x + Math.cos(a) * r * 0.5, e.y + Math.sin(a) * r * 0.5,
        e.x + Math.cos(a) * L, e.y + Math.sin(a) * L, 1, FX.spark[4]);
    }
    g.restore();
  },

  shock(g, e, k) {
    g.save();
    g.globalAlpha = Math.max(0, 1 - k) * (e.alpha || 0.9);
    ring(g, e.x, e.y, 4 + k * e.size, Math.max(1, 4 * (1 - k)), e.color || '#FFFFFF', e.squash == null ? 1 : e.squash);
    g.restore();
  },

  /* manga speed lines converging on a point */
  lines(g, e, k) {
    g.save();
    g.globalAlpha = Math.max(0, 1 - k) * 0.85;
    const n = e.count || 9;
    for (let i = 0; i < n; i++) {
      const spread = (i / (n - 1) - 0.5) * (e.spread || 1.3);
      const a = Math.atan2(-1, e.dir) + spread;
      const near = 10 + k * 26, far = near + (e.len || 40) * (1 - k * 0.4);
      line(g, e.x - Math.cos(a) * near, e.y - Math.sin(a) * near,
        e.x - Math.cos(a) * far, e.y - Math.sin(a) * far, i % 3 === 0 ? 2 : 1, e.color || '#FFFFFF');
    }
    g.restore();
  },

  bark(g, e, k) {
    const rise = -14 * (1 - Math.pow(1 - k, 2));
    const sc = e.scale || 3;
    g.save();
    g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    text(g, e.text, e.x + Math.sin(k * 20) * (1 - k) * 2, e.y + rise, {
      scale: sc, align: 'center', color: e.color || FX.spark[3],
      outline: FX.ink, shadow: e.shadow || '#7A2A0E', shadowDy: 2,
      jitter: k < 0.3 ? 1 : 0
    });
    g.restore();
  },

  dust(g, e, k) {
    g.save();
    g.globalAlpha = Math.max(0, 0.75 - k * 0.75);
    const r = 3 + k * (e.size || 16);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.7 + e.dir;
      ellipse(g, e.x + Math.cos(a) * r * 1.2 * e.dir, e.y - Math.abs(Math.sin(a)) * r * 0.5,
        r * 0.6, r * 0.4, FX.dust[2 + (i % 3)]);
    }
    g.restore();
  },

  /* rising ember/aura licks, used for combo heat and Stand manifestation */
  aura(g, e, k) {
    g.save();
    g.globalAlpha = Math.max(0, 1 - k) * (e.alpha || 0.8);
    const h = (e.size || 20) * k;
    poly(g, [[e.x - 3, e.y], [e.x, e.y - h], [e.x + 3, e.y]], e.color || FX.aura[3]);
    poly(g, [[e.x - 1.5, e.y], [e.x + 0.5, e.y - h * 0.6], [e.x + 1.5, e.y]], FX.spark[4]);
    g.restore();
  },

  spark(g, e, k) {
    g.save();
    g.globalAlpha = Math.max(0, 1 - k);
    px(g, e.x, e.y, e.size || 2, e.size || 2, e.color || FX.spark[3]);
    g.restore();
  },

  /* the crescent a fist carves through the air on a heavy swing --
     drawn as a thinning arc that sweeps forward and fades */
  arc(g, e, k) {
    const sweep = e.sweep || 1.5;
    const a0 = e.a0 == null ? -1.1 : e.a0;
    const a = a0 + sweep * ease(k);
    g.save();
    g.globalAlpha = Math.max(0, 1 - k) * 0.9;
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const aa = a - t * 0.85;
      const w = (1 - t) * 5 + 1;
      const r = e.r * (1 - t * 0.06);
      const cx = e.x + Math.cos(aa) * r * e.dir;
      const cy = e.y + Math.sin(aa) * r;
      poly(g, [[cx - w, cy - w], [cx + w, cy - w * 0.6], [cx + w * 0.7, cy + w], [cx - w, cy + w * 0.7]],
        i < 3 ? '#FFFFFF' : i < 6 ? e.color || FX.spark[3] : FX.spark[1]);
    }
    g.restore();
  },

  /* gathering charge on a wind-up: motes pulled inward plus a tightening
     ring, so a heavy attack is legible as "loading" before it fires */
  charge(g, e, k) {
    g.save();
    const pull = 1 - k;
    for (let i = 0; i < 8; i++) {
      const a = i * 0.9 + e.t * 3;
      const r = 6 + pull * 26 + Math.sin(e.t * 9 + i) * 3;
      g.globalAlpha = (1 - pull) * 0.9;
      px(g, e.x + Math.cos(a) * r * 1.3, e.y + Math.sin(a) * r, 2, 2, e.color || FX.aura[4]);
    }
    g.globalAlpha = 0.5 * (1 - k);
    ring(g, e.x, e.y, 8 + pull * 20, 1, e.color || FX.aura[4]);
    g.restore();
  },

  /* full-screen white/colour wash for parries and phase changes */
  flash(g, e, k, W, H) {
    g.save();
    g.globalAlpha = Math.max(0, 1 - k) * (e.alpha || 0.5);
    px(g, 0, 0, W, H, e.color || '#FFFFFF');
    g.restore();
  },

  /* radial "impact" background lines behind a big moment */
  burstBg(g, e, k, W, H) {
    g.save();
    g.globalAlpha = Math.max(0, 1 - k) * 0.20;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + e.t;
      const r0 = 30 + k * 120;
      poly(g, [
        [e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0],
        [e.x + Math.cos(a + 0.035) * (r0 + 200), e.y + Math.sin(a + 0.035) * (r0 + 200)],
        [e.x + Math.cos(a - 0.035) * (r0 + 200), e.y + Math.sin(a - 0.035) * (r0 + 200)]
      ], e.color || '#FFFFFF');
    }
    g.restore();
  }
};

/* Hook wiring lives in fx_wire.js -- this file was pushing the repo's
   300-line file cap once Phase 6 added two more listeners, so the
   catalog (this file: createFx + the DRAW renderers) and the wiring
   (fx_wire.js: wireFx, one dispatcher.on() per cue) split along the same
   seam combat_enemy.js/combat_player.js already established. */
export { wireFx } from './fx_wire.js';
