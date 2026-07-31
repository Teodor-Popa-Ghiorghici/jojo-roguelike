/* Morioh backdrops.

   Each arena is six parallax layers -- sky, far ridge, mid town, near
   town, ground, foreground -- built once into cached buffers and then
   scrolled at different rates against the camera. Building them offline
   is what makes it affordable to draw a genuinely dense town: the
   per-frame cost is six blits plus the handful of things that actually
   move (clouds, light rays, motes, flicker).

   Distance is sold three ways at once: parallax rate, atmospheric haze
   (far layers are mixed toward the sky colour), and detail density. */

import { cached } from './layer.js';
import { poly, px, dither, ellipse, disc, vband, line } from './draw.js';
import { facade, windows, acUnit, fireEscape, shopSign, hills, cloudPuff } from './bg_props.js';
import { buildNear, buildGround } from './bg_scenes.js';
import { SKY, TOWN, FX, haze, S, SH, BASE, LT, RIM } from './palette.js';

const LW = 760;

export const SCENES = {
  alley: {
    sky: SKY.dusk, sunX: 0.22, sunY: 0.30, sun: '#FFD79B', lit: 0.55,
    walls: [TOWN.wallB, TOWN.wallA], ground: TOWN.road, kind: 'alley', hazeTo: '#5B3A7A'
  },
  street: {
    sky: SKY.dusk, sunX: 0.78, sunY: 0.36, sun: '#FFE6B0', lit: 0.4,
    walls: [TOWN.wallA, TOWN.wallB, TOWN.wallC], ground: TOWN.road, kind: 'street', hazeTo: '#9E4E76'
  },
  park: {
    sky: SKY.night, sunX: 0.7, sunY: 0.2, sun: '#EAF2FF', lit: 0.3,
    walls: [TOWN.wallC, TOWN.wallA], ground: TOWN.walk, kind: 'park', hazeTo: '#2C3C72'
  },
  store: {
    sky: SKY.night, sunX: 0.5, sunY: 0.18, sun: '#C8D8FF', lit: 0.85,
    walls: [TOWN.wallA, TOWN.wallC], ground: TOWN.walk, kind: 'store', hazeTo: '#1D2A55'
  }
};

/* ---- layer builders --------------------------------------------------- */

function buildSky(g, W, H, cfg, groundY) {
  vband(g, 0, 0, W, groundY + 20, cfg.sky);
  const sx = W * cfg.sunX, sy = (groundY + 20) * cfg.sunY;
  if (cfg.kind === 'park' || cfg.kind === 'store') {
    disc(g, sx, sy, 11, '#E8EEFF');
    disc(g, sx + 4, sy - 3, 9, cfg.sky[1]);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % W, y = (i * 53) % (groundY * 0.6);
      px(g, x, y, 1, 1, i % 4 ? '#8FA4D8' : '#FFFFFF');
    }
  } else {
    disc(g, sx, sy, 22, cfg.sun);
    disc(g, sx, sy, 16, '#FFF6DC');
    g.save(); g.globalAlpha = 0.20;
    for (let i = -4; i <= 4; i++) {
      poly(g, [[sx, sy], [sx + i * 34 - 60, groundY + 20], [sx + i * 34 + 10, groundY + 20]], cfg.sun);
    }
    g.restore();
  }
}

function buildFar(g, W, H, cfg, groundY) {
  const ridge = haze(cfg.walls[0], 0.62, cfg.hazeTo);
  hills(g, W, groundY - 34, 26, ridge, 3);
  const town = haze(cfg.walls[0], 0.45, cfg.hazeTo);
  let x = -20, seed = 7;
  while (x < W + 30) {
    seed = (seed * 41 + 17) % 113;
    const w = 26 + seed % 30, h = 34 + seed % 46;
    px(g, x, groundY - 26 - h, w, h + 26, town[BASE]);
    px(g, x, groundY - 26 - h, w, 2, town[LT]);
    for (let i = 3; i < w - 3; i += 6) {
      for (let j = 6; j < h - 4; j += 9) {
        if ((seed + i + j) % 5 < 2) px(g, x + i, groundY - 26 - h + j, 3, 4, haze(TOWN.win, 0.5, cfg.hazeTo)[BASE]);
      }
    }
    x += w + 3;
  }
}

function buildMid(g, W, H, cfg, groundY) {
  const ramps = cfg.walls.map(r => haze(r, 0.24, cfg.hazeTo));
  const win = haze(TOWN.win, 0.18, cfg.hazeTo);
  let x = -24, seed = 13, i = 0;
  while (x < W + 30) {
    seed = (seed * 37 + 29) % 127;
    const w = 52 + seed % 46, h = 62 + (seed % 58);
    const ramp = ramps[i % ramps.length];
    facade(g, x, groundY - h, w, h, ramp, { ledges: seed % 3 === 0 ? 26 : 0 });
    windows(g, x + 4, groundY - h + 6, w - 8, h - 18, ramp, win, seed, cfg.lit, 0);
    if (seed % 4 === 0) acUnit(g, x + 6, groundY - h + 22, haze(TOWN.metal, 0.25, cfg.hazeTo));
    if (seed % 5 === 1) fireEscape(g, x + w - 26, groundY - h + 24, 22, h - 40, haze(TOWN.metal, 0.3, cfg.hazeTo));
    if (seed % 3 === 1) shopSign(g, x + w - 12, groundY - h + 12, 9, 40, haze(TOWN.neon, 0.2, cfg.hazeTo), '#FFEFC8');
    x += w + 6; i++;
  }
}

/* ---- public ----------------------------------------------------------- */

function layers(sceneId, W, H, groundY) {
  const cfg = SCENES[sceneId] || SCENES.street;
  const k = sceneId + W + 'x' + H;
  return {
    cfg,
    sky: cached(k + 'sky', LW, H, (g, w, h) => buildSky(g, w, h, cfg, groundY)),
    far: cached(k + 'far', LW, H, (g, w, h) => buildFar(g, w, h, cfg, groundY)),
    mid: cached(k + 'mid', LW, H, (g, w, h) => buildMid(g, w, h, cfg, groundY)),
    near: cached(k + 'near', LW, H, (g, w, h) => buildNear(g, w, h, cfg, groundY)),
    ground: cached(k + 'gnd', LW, H, (g, w, h) => buildGround(g, w, h, cfg, groundY))
  };
}

const RATES = { sky: 0.03, far: 0.12, mid: 0.3, near: 0.62, ground: 1 };

export function drawBackground(g, W, H, sceneId, camX, tsec, groundY) {
  const L = layers(sceneId, W, H, groundY);
  const off = k => -((camX * RATES[k] + LW * 0.5 - W * 0.5) % LW);
  for (const k of ['sky', 'far', 'mid', 'near', 'ground']) {
    const x = off(k);
    g.drawImage(L[k].cv, Math.round(x), 0);
    if (x + LW < W) g.drawImage(L[k].cv, Math.round(x + LW), 0);
    if (k === 'sky') drawClouds(g, W, H, L.cfg, camX, tsec, groundY);
  }
  atmosphere(g, W, H, L.cfg, tsec, groundY);
}

/* Framing silhouettes drawn OVER the fighters. Nothing sells depth in a
   2D scene like something passing in front of the action, and it also
   darkens the frame edges so the eye stays on the middle. */
export function drawForeground(g, W, H, sceneId, camX, tsec, groundY) {
  const cfg = SCENES[sceneId] || SCENES.street;
  const p = camX * 1.35;
  const dark = '#070810';
  if (cfg.kind === 'alley') {
    const lx = -40 - p * 0.1, rx = W + 40 - p * 0.1;
    poly(g, [[lx, 0], [lx + 62, 0], [lx + 30, H], [lx - 20, H]], dark);
    poly(g, [[lx + 52, 0], [lx + 62, 0], [lx + 30, H], [lx + 22, H]], '#151726');
    poly(g, [[rx, 0], [rx - 66, 0], [rx - 34, H], [rx + 20, H]], dark);
    poly(g, [[rx - 56, 0], [rx - 66, 0], [rx - 34, H], [rx - 26, H]], '#151726');
    for (let x = 0; x < W; x += 3) {
      px(g, x, 10 + Math.sin((x + p) / W * Math.PI * 2) * 9, 3, 2, dark);
    }
    const bx = W * 0.34 - p * 0.2;
    px(g, bx, 14 + Math.sin(tsec * 0.9) * 2, 3, 16, dark);
    poly(g, [[bx - 7, 30], [bx + 10, 30], [bx + 6, 40], [bx - 3, 40]], dark);
    px(g, bx - 4, 34, 10, 4, '#FFE9A8');
  } else if (cfg.kind === 'park') {
    for (const [ox, flip] of [[0, 1], [W, -1]]) {
      const sway = Math.sin(tsec * 0.7 + ox) * 2;
      poly(g, [[ox, -4], [ox + flip * 120, -4], [ox + flip * 80, 20 + sway], [ox + flip * 30, 40 + sway], [ox, 34]], '#08160E');
      for (let i = 0; i < 6; i++) {
        const bx = ox + flip * (18 + i * 18), by = 16 + (i % 3) * 12 + sway;
        ellipse(g, bx, by, 16, 10, '#08160E');
        ellipse(g, bx - flip * 4, by - 3, 8, 5, '#0E2418');
      }
    }
  } else if (cfg.kind === 'store') {
    const cx = ((-p * 0.5) % 240 + 240) % 240 - 60;
    for (const x of [cx, cx + 240]) {
      px(g, x, 0, 26, H, dark);
      px(g, x, 0, 6, H, '#151726');
      px(g, x + 22, 0, 4, H, '#0B0C14');
    }
  } else {
    poly(g, [[-10, H], [-10, H - 60], [10, H - 62], [26, H]], dark);
    poly(g, [[W + 10, H], [W + 10, H - 78], [W - 16, H - 80], [W - 30, H]], dark);
    px(g, W - 26, H - 92, 5, 30, dark);
    poly(g, [[W - 36, H - 96], [W - 8, H - 96], [W - 12, H - 88], [W - 32, H - 88]], dark);
  }
  g.save();
  g.globalAlpha = 0.22;
  for (let i = 0; i < 16; i++) {
    px(g, 0, i, W, 1, '#000000');
    px(g, 0, H - 1 - i, W, 1, '#000000');
    px(g, i, 0, 1, H, '#000000');
    px(g, W - 1 - i, 0, 1, H, '#000000');
  }
  g.restore();
}

function drawClouds(g, W, H, cfg, camX, tsec, groundY) {
  const ramp = cfg.kind === 'park' || cfg.kind === 'store' ? haze(TOWN.cloud, 0.55, '#12203E') : TOWN.cloud;
  for (let i = 0; i < 5; i++) {
    const speed = 2.6 + i * 1.1;
    const x = ((i * 173 + tsec * speed - camX * 0.05) % (W + 160)) - 80;
    cloudPuff(g, x, 18 + (i * 37) % Math.max(20, groundY * 0.4), 46 + (i % 3) * 22, 15 + (i % 2) * 6, ramp);
  }
}

/* per-frame atmosphere: god rays, drifting motes, a vignette. Cheap, and
   it is what stops a static painted backdrop from feeling dead. */
function atmosphere(g, W, H, cfg, tsec, groundY) {
  g.save();
  g.globalAlpha = 0.07 + Math.sin(tsec * 0.6) * 0.015;
  const sx = W * cfg.sunX;
  for (let i = -2; i <= 2; i++) {
    poly(g, [[sx + i * 26, 0], [sx + i * 26 + 30, 0], [sx + i * 60 - 40, groundY + 30], [sx + i * 60 - 96, groundY + 30]], cfg.sun);
  }
  g.restore();
  g.save();
  g.globalAlpha = 0.5;
  for (let i = 0; i < 22; i++) {
    const t = tsec * (0.1 + (i % 5) * 0.03) + i;
    const x = ((i * 131 + Math.sin(t) * 30) % W + W) % W;
    const y = ((i * 71 + t * 7) % (groundY + 40));
    px(g, x, y, 1, 1, i % 3 ? cfg.sun : '#FFFFFF');
  }
  g.restore();
  g.save();
  g.globalAlpha = 0.30;
  for (let i = 0; i < 26; i++) {
    const a = i / 26;
    px(g, 0, 0, W, 1 + i * 0.6, '#000000');
    if (i > 12) break;
    px(g, 0, H - 1 - i * 0.8, W, 1, '#000000');
  }
  g.restore();
}
