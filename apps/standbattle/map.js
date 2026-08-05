/* Map screen — Phase 8: renders the generated Act I DAG (map_gen.js),
   not a fixed path. The whole graph is visible from the start (icons
   only, like the branch-map genre this borrows from); only the current
   node's direct, unvisited successors are clickable. A tracking camera
   (the same "follow the subject" idiom arena.js already uses for
   combat) scrolls horizontally since 9-11 rows don't fit the 480px
   canvas at once. Also owns the shared panel primitives (`frame`,
   `button`, `backdrop`) that rest.js/shop.js/archive_stub.js reuse, and
   the small Bizarre Encounter event scene. */

import { px, poly, disc, ellipse, dither, ring, vband } from './draw.js';
import { text, paragraph, textWidth } from './font.js';
import { SKY, TOWN, S, SH, BASE, LT, RIM } from './palette.js';
import { drawBuildSummary } from './rewards.js';

const MARGIN = 40;
const ROW_SPACING = 60;
const LANE_SPACING = 28;
const LANE_TOP = 74;

export const TYPE = {
  combat: { c: ['#5C1414', '#8E1E22', '#C8302E', '#F06A56', '#FFB098'], label: 'FIGHT' },
  elite: { c: ['#5C3A08', '#8E5C10', '#C89020', '#F0C24A', '#FFEBA8'], label: 'ELITE' },
  event: { c: ['#0B3A4A', '#125C74', '#1E92AE', '#4FCBE6', '#C4F4FF'], label: 'EVENT' },
  rest: { c: ['#0E4A22', '#17692F', '#2FA34A', '#5FD672', '#B6FFC0'], label: 'REST' },
  boss: { c: ['#4A1030', '#7A1D4E', '#B02F72', '#E15A9C', '#FFA0CB'], label: 'BOSS' },
  treasure: { c: ['#5C3A08', '#8E5C10', '#C89020', '#F0C24A', '#FFEBA8'], label: 'LOOT' },
  shop: { c: ['#0E4A3A', '#176957', '#2FA38A', '#5FD6BE', '#B6FFEE'], label: 'SHOP' },
  archive: { c: ['#2A2A38', '#3E3E4E', '#585868', '#7A7A8C', '#A8A8B8'], label: 'ARCHIVE' }
};

export const LEAN_COLOR = { hard: '#F06A56', long: '#F0C24A', safe: '#5FD672' };

function hash(str) {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (h * 131 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function layoutGraph(graph) {
  const pos = {};
  Object.values(graph.nodes).forEach(node => {
    const h = hash(node.id);
    pos[node.id] = {
      x: Math.round(MARGIN + node.row * ROW_SPACING + Math.sin(h * 0.0021) * 5),
      y: Math.round(LANE_TOP + node.lane * LANE_SPACING + Math.cos(h * 0.0037) * 4)
    };
  });
  return pos;
}

function cameraXFor(pos, W) {
  const xs = Object.values(pos).map(p => p.x);
  return { min: Math.min(...xs) - MARGIN, max: Math.max(...xs) + MARGIN - W };
}

export function mapCameraX(graph, runState, W) {
  const pos = layoutGraph(graph);
  const cur = pos[runState.nodeId] || pos[Object.keys(graph.nodes)[0]];
  const { min, max } = cameraXFor(pos, W);
  return Math.max(min, Math.min(Math.max(min, max), cur.x - W / 2));
}

export function backdrop(g, W, H, tsec) {
  vband(g, 0, 0, W, H, SKY.dusk);
  disc(g, W * 0.76, H * 0.3, 20, '#FFD79B');
  disc(g, W * 0.76, H * 0.3, 14, '#FFF6DC');
  let x = -10, seed = 9;
  while (x < W + 20) {
    seed = (seed * 41 + 23) % 113;
    const w = 30 + seed % 34, h = 40 + seed % 60;
    const ramp = seed % 2 ? TOWN.wallA : TOWN.wallB;
    px(g, x, H - 46 - h, w, h + 46, ramp[S]);
    px(g, x, H - 46 - h, w, 2, ramp[SH]);
    for (let i = 4; i < w - 4; i += 8) {
      for (let j = 8; j < h - 6; j += 12) {
        if ((seed + i * 3 + j) % 4 < 2) px(g, x + i, H - 46 - h + j, 4, 5, '#3A2E48');
      }
    }
    x += w + 4;
  }
  px(g, 0, H - 46, W, 46, '#171526');
  dither(g, 0, H - 46, W, 12, null, '#241F38', 7);
  g.save(); g.globalAlpha = 0.5;
  for (let i = 0; i < 30; i++) {
    const t = tsec * 0.2 + i;
    px(g, (i * 131 + Math.sin(t) * 20) % W, (i * 47 + t * 6) % (H - 40), 1, 1, '#FFE0B0');
  }
  g.restore();
}

function medallion(g, x, y, type, state, tsec) {
  const t = TYPE[type] || TYPE.combat;
  const c = state === 'done' ? ['#1A1A22', '#26262F', '#3A3A46', '#55555F', '#70707C'] : t.c;
  if (state === 'available') {
    const pulse = 0.5 + 0.5 * Math.sin(tsec * 5);
    g.save(); g.globalAlpha = 0.22 + pulse * 0.3;
    disc(g, x, y, 15 + pulse * 3, c[3]);
    g.restore();
    ring(g, x, y, 13 + pulse * 1.5, 1, c[4]);
  }
  g.save();
  if (state === 'future') g.globalAlpha = 0.6;
  disc(g, x, y, 10, '#05060C');
  disc(g, x, y, 8.5, c[BASE]);
  ellipse(g, x, y - 2, 7, 4.5, c[LT]);
  ellipse(g, x, y + 4, 6, 2, c[S]);
  const ink = '#0A0A12';
  if (type === 'combat') {
    poly(g, [[x - 5, y + 3], [x + 3, y - 4], [x + 4, y - 3], [x - 4, y + 4]], ink);
  } else if (type === 'elite') {
    poly(g, [[x, y - 6], [x + 2, y - 1], [x + 6, y - 1], [x + 3, y + 2], [x + 4, y + 6],
      [x, y + 4], [x - 4, y + 6], [x - 3, y + 2], [x - 6, y - 1], [x - 2, y - 1]], ink);
  } else if (type === 'event') {
    poly(g, [[x - 3, y - 5], [x + 2, y - 5], [x + 3, y - 1], [x - 1, y + 1], [x - 1, y + 2], [x - 2, y + 2], [x - 2, y - 1], [x + 1, y - 2]], ink);
    px(g, x - 1, y + 4, 2, 2, ink);
  } else if (type === 'rest') {
    poly(g, [[x - 5, y - 1], [x + 4, y - 1], [x + 4, y + 4], [x - 5, y + 4]], ink);
    poly(g, [[x + 4, y], [x + 7, y + 1], [x + 4, y + 2]], ink);
  } else if (type === 'boss') {
    poly(g, [[x - 5, y + 5], [x - 4, y - 2], [x, y - 6], [x + 4, y - 2], [x + 5, y + 5], [x + 2, y + 2], [x - 2, y + 2]], ink);
  } else if (type === 'shop') {
    poly(g, [[x - 5, y - 2], [x + 5, y - 2], [x + 4, y], [x - 4, y]], ink);
    px(g, x - 2, y, 4, 5, ink);
  } else if (type === 'archive') {
    poly(g, [[x - 5, y - 3], [x, y - 4], [x, y + 4], [x - 5, y + 3]], ink);
    poly(g, [[x + 5, y - 3], [x, y - 4], [x, y + 4], [x + 5, y + 3]], ink);
  } else if (type === 'treasure') {
    px(g, x - 5, y - 1, 10, 5, ink);
    poly(g, [[x - 5, y - 1], [x, y - 4], [x + 5, y - 1]], ink);
    px(g, x - 1, y, 2, 2, c[LT]);
  }
  g.restore();
}

export function drawMap(g, W, H, graph, runState, tsec) {
  const pos = layoutGraph(graph);
  const cam = mapCameraX(graph, runState, W);
  backdrop(g, W, H, tsec);

  const doneSet = new Set(runState.visited);
  const availableTargets = new Set(graph.edges.filter(([a]) => a === runState.nodeId).map(([, b]) => b));
  const stateOf = id => id === runState.nodeId ? 'done' : doneSet.has(id) ? 'done' : availableTargets.has(id) ? 'available' : 'future';

  graph.paths.forEach((path, pi) => {
    const leanColor = LEAN_COLOR[graph.leans[pi]] || '#6A7396';
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const pa = pos[a], pb = pos[b];
      const ax = pa.x - cam, ay = pa.y, bx = pb.x - cam, by = pb.y;
      const bState = stateOf(b);
      const edgeDone = doneSet.has(a) && (doneSet.has(b) || b === runState.nodeId);
      const edgeAvailable = a === runState.nodeId && bState === 'available';
      for (let s = 0; s <= 16; s++) {
        const t = s / 16;
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 4;
        g.save();
        g.globalAlpha = edgeAvailable ? (0.6 + 0.4 * Math.sin(tsec * 5)) : edgeDone ? 0.85 : 0.3;
        px(g, x - (s % 2 === 0 ? 1 : 0), y, s % 2 === 0 ? 2 : 1, s % 2 === 0 ? 2 : 1, edgeAvailable ? '#FFE86A' : edgeDone ? '#C8D0F0' : leanColor);
        g.restore();
      }
    }
  });

  Object.values(graph.nodes).forEach(node => {
    const p = pos[node.id];
    const sx = p.x - cam, sy = p.y;
    if (sx < -16 || sx > W + 16) return;
    const state = stateOf(node.id);
    medallion(g, sx, sy, node.type, state, tsec);
    if (state === 'available' || node.id === runState.nodeId) {
      const words = node.label.split(' ');
      const lines = []; let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (textWidth(test, 1) > 60 && cur) { lines.push(cur); cur = w; } else cur = test;
      }
      if (cur) lines.push(cur);
      const bw = Math.max(...lines.map(l => textWidth(l, 1)));
      const ly = node.lane < 3 ? sy + 14 : sy - 14 - lines.length * 9;
      px(g, sx - bw / 2 - 3, ly - 2, bw + 6, lines.length * 9 + 2, '#080910');
      lines.forEach((l, li) => text(g, l, sx, ly + li * 9, {
        scale: 1, align: 'center', color: node.id === runState.nodeId ? '#6A7080' : '#FFE86A'
      }));
    }
  });

  px(g, 0, 0, W, 26, '#0A0B14');
  px(g, 0, 26, W, 1, '#6A7396');
  text(g, 'ACT I  MORIOH', 8, 4, { scale: 2, color: '#FFE6F0', outline: '#3A0A1E' });
  text(g, 'DIAMOND IS UNBREAKABLE', 8, 18, { scale: 1, color: '#B08AC8' });
  text(g, 'HP ' + Math.round(runState.hp) + '/' + runState.maxHp, W - 8, 4, { scale: 1, align: 'right', color: '#5FD672' });
  text(g, runState.yen + ' YEN', W - 8, 12, { scale: 1, align: 'right', color: '#FFE86A' });
  text(g, 'TENSION ' + runState.tension + '/5', W - 8, 20, { scale: 1, align: 'right', color: '#F06A56' });
  drawBuildSummary(g, 6, H - 18, runState);
  const leanText = (graph.leans || []).filter((l, i, a) => a.indexOf(l) === i)
    .map(l => l.toUpperCase()).join(' / ');
  text(g, leanText, W / 2, H - 22, { scale: 1, align: 'center', color: '#8A90A8' });
  text(g, 'CLICK A GLOWING NODE', W / 2, H - 12, {
    scale: 1, align: 'center', color: '#C8D0F0', shadow: '#05060C',
    alpha: 0.6 + 0.4 * Math.sin(tsec * 3)
  });
}

export function pickNode(mx, my, graph, runState, W) {
  const pos = layoutGraph(graph);
  const cam = mapCameraX(graph, runState, W);
  const successors = graph.edges.filter(([a]) => a === runState.nodeId).map(([, b]) => b);
  const visited = new Set(runState.visited);
  for (const id of successors) {
    if (visited.has(id)) continue;
    const p = pos[id];
    if (Math.abs(mx - (p.x - cam)) <= 14 && Math.abs(my - p.y) <= 14) return id;
  }
  return null;
}

/* ---- shared panel primitives, reused by rest.js/shop.js/archive_stub.js */

export function frame(g, x, y, w, h, accent) {
  px(g, x - 3, y - 3, w + 6, h + 6, '#05060C');
  px(g, x - 2, y - 2, w + 4, h + 4, accent);
  px(g, x, y, w, h, '#101322');
  px(g, x, y, w, 1, '#2A3050');
  dither(g, x, y, w, h, null, '#161B30', 5);
}

export function button(g, r, label, hot) {
  px(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, '#05060C');
  px(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, hot ? '#FFE86A' : '#6A7396');
  px(g, r.x, r.y, r.w, r.h, hot ? '#1A2038' : '#181A28');
  px(g, r.x, r.y, r.w, 2, hot ? '#2C3556' : '#20222E');
  px(g, r.x, r.y + r.h - 2, r.w, 2, '#0C1020');
  text(g, label, r.x + r.w / 2, r.y + r.h / 2 - 3, { scale: 1, align: 'center', color: hot ? '#FFE86A' : '#DCE2FF' });
}

/* ---- Bizarre Encounter event scene (unchanged from Phase 0/7) -------- */

export function drawEvent(g, W, H, ev, tsec) {
  backdrop(g, W, H, tsec || 0);
  g.save(); g.globalAlpha = 0.55; px(g, 0, 0, W, H, '#05060C'); g.restore();
  frame(g, 40, 44, W - 80, 116, '#1E92AE');
  text(g, ev.title, W / 2, 54, { scale: 2, align: 'center', color: '#4FCBE6', outline: '#0B3A4A' });
  paragraph(g, ev.text, W / 2, 82, W - 120, { scale: 1, align: 'center', color: '#DCE2FF' });
  ev.choices.forEach((c, i) => button(g, choiceRect(i, W, H), c.label, true));
}

export function choiceRect(i, W, H) {
  const w = 150, h = 26;
  return { x: Math.round(W / 2 - w - 8 + i * (w + 16)), y: H - 62, w, h };
}

export function pickChoice(mx, my, ev, W, H) {
  for (let i = 0; i < ev.choices.length; i++) {
    const r = choiceRect(i, W, H);
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i;
  }
  return -1;
}
