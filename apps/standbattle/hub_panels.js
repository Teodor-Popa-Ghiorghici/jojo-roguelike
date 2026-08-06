/* Hub stations, part 1 — the Archive terminal and the Menace board (GDD
   §9.1, §8.3). Both are pure views over the meta blob drawn entirely out
   of hub_ui.js's chrome, so they read as two rooms in one building.

   Two rules this file lives under:
     - It never spends Fate. A click on an affordable node returns
       {type:'purchase', nodeId} and the caller runs purchaseNode, so the
       only writer of the Archive stays meta_fate.js.
     - Layout is computed once, by `*Layout()`, and both draw and pick call
       it -- pick with a no-op context. A pick function that re-derived row
       geometry is exactly how a menu drifts out of sync with its hitboxes.
   The Menace board is the one exception to "views don't write": a pact
   rank is view state, so it edits meta.menace.pacts[standId] through
   setCondition and still returns an action so the caller can persist. */

import { px } from './draw.js';
import { text } from './font.js';
import {
  backdrop, frame, header, backButton, hit, rowList, clampTop, detailLines, wrap,
  HUB_TEXT, HUB_DIM, HUB_GOLD, HUB_OK, HUB_WARN, HUB_LINE
} from './hub_ui.js';
import { ARCHIVE_NODES } from './meta_archive_tree.js';
import { archiveNodeById, isPurchased, isAvailable } from './meta_archive.js';
import { archiveProgress } from './meta_fate.js';
import {
  MENACE_CONDITIONS, MENACE_MAX_RANK, MENACE_TITLES,
  setCondition, menaceRankOf, bestRankFor, pactFor
} from './meta_menace.js';

/* A context that records nothing and draws nothing, so pick() can run the
   real layout pass without touching the canvas. */
const NOOP_G = { fillStyle: '', globalAlpha: 1, fillRect() {}, save() {}, restore() {} };

const GRANT_WORDS = {
  stand: 'Stand', aspect: 'Aspect', donor: 'Donor pool', nodeType: 'Map node',
  actVariant: 'Act variant', hubScene: 'Hub scene', cosmetic: 'Cosmetic', hudSkin: 'HUD skin'
};

function pretty(id) { return String(id || '').replace(/_/g, ' '); }

/* The shared scroll pair, bottom-right, so every station scrolls the same
   way without inventing a widget per screen. */
function scrollRects(W, H) {
  return { up: { x: W - 58, y: H - 14, w: 25, h: 11 }, down: { x: W - 30, y: H - 14, w: 25, h: 11 } };
}

function drawScroll(g, W, H, on) {
  if (!on) return;
  const r = scrollRects(W, H);
  frame(g, r.up.x, r.up.y, r.up.w, r.up.h, HUB_DIM);
  text(g, 'UP', r.up.x + 6, r.up.y + 3, { scale: 1, color: HUB_TEXT });
  frame(g, r.down.x, r.down.y, r.down.w, r.down.h, HUB_DIM);
  text(g, 'DN', r.down.x + 6, r.down.y + 3, { scale: 1, color: HUB_TEXT });
}

function scrollPick(mx, my, W, H, ui, count, maxRows) {
  if (count <= maxRows) return null;
  const r = scrollRects(W, H);
  const by = hit(r.up, mx, my) ? -3 : hit(r.down, mx, my) ? 3 : 0;
  if (!by) return null;
  ui.top = clampTop((ui.top || 0) + by, count, maxRows);
  return { type: 'scroll', by };
}

/* ---- the Archive terminal -------------------------------------------- */

const A_X = 6, A_Y = 24, A_W = 176, A_MAX = 15;

function archiveRows(meta) {
  const rows = [];
  const fate = (meta.fate && meta.fate.fate) || 0;
  for (const tier of [1, 2, 3, 4]) {
    const nodes = ARCHIVE_NODES.filter(n => n.tier === tier);
    if (!nodes.length) continue;
    rows.push({ sep: true, label: `-- TIER ${tier} --`, locked: true, accent: HUB_LINE });
    for (const node of nodes) {
      const owned = isPurchased(meta.archive, node.id);
      const open = isAvailable(meta.archive, node.id);
      const afford = open && fate >= node.cost;
      rows.push({
        node, owned, open, afford, label: node.name,
        right: owned ? 'OWNED' : String(node.cost),
        rightColor: owned ? HUB_OK : afford ? HUB_GOLD : HUB_WARN,
        accent: owned ? HUB_OK : afford ? HUB_GOLD : HUB_LINE,
        locked: !owned && !open
      });
    }
  }
  return rows;
}

function archiveLayout(g, W, H, meta, ui) {
  const rows = archiveRows(meta);
  ui.top = clampTop(ui.top || 0, rows.length, A_MAX);
  const rects = rowList(g, A_X, A_Y, A_W, rows, ui.top, A_MAX, {});
  return { rows, rects };
}

function archiveDetail(node, meta) {
  const lines = [];
  for (const ln of wrap(node.desc, 44)) lines.push(ln);
  lines.push('');
  lines.push('GRANTS:');
  for (const gr of node.grants) lines.push(`  ${GRANT_WORDS[gr.kind] || gr.kind}: ${pretty(gr.id)}`);
  const unmet = (node.requires || []).filter(id => !isPurchased(meta.archive, id));
  if (unmet.length) {
    lines.push('');
    lines.push('NEEDS FIRST:');
    for (const id of unmet) lines.push(`  ${(archiveNodeById(id) || {}).name || id}`);
  }
  return lines;
}

export function drawArchiveTerminal(g, W, H, meta, unlocks, ui, tsec) {
  backdrop(g, W, H, tsec);
  const fate = (meta.fate && meta.fate.fate) || 0;
  const prog = archiveProgress(meta.archive);
  header(g, W, 'ARCHIVE TERMINAL', `FATE ${fate}   OPEN ${prog.purchased}/${prog.total}`);

  const { rows, rects } = archiveLayout(g, W, H, meta, ui);
  const dx = A_X + A_W + 12, dw = W - dx - 6;
  frame(g, dx, A_Y, dw, H - A_Y - 20, HUB_LINE);

  const sel = rows[ui.sel] && !rows[ui.sel].sep ? rows[ui.sel] : null;
  if (!sel) {
    text(g, 'SELECT AN ENTRY.', dx + 6, A_Y + 6, { scale: 1, color: HUB_DIM });
    text(g, 'NOTHING HERE MAKES A NUMBER BIGGER.', dx + 6, A_Y + 18, { scale: 1, color: HUB_DIM });
  } else {
    const node = sel.node;
    text(g, node.name, dx + 6, A_Y + 6, { scale: 1, color: HUB_GOLD });
    text(g, sel.owned ? 'OWNED' : sel.afford ? `COST ${node.cost}` : sel.open ? `NEED ${node.cost - fate} MORE` : 'LOCKED',
      dx + dw - 6, A_Y + 6, { scale: 1, align: 'right', color: sel.owned ? HUB_OK : sel.afford ? HUB_GOLD : HUB_WARN });
    detailLines(g, dx + 6, A_Y + 20, dw - 12, archiveDetail(node, meta), HUB_TEXT);
  }
  const marked = rects.find(r => r.index === ui.sel);
  if (marked) px(g, marked.x, marked.y, 2, marked.h, HUB_GOLD);

  drawScroll(g, W, H, rows.length > A_MAX);
  backButton(g, W, H);
}

export function pickArchiveTerminal(mx, my, W, H, meta, unlocks, ui) {
  if (hit(backButton(NOOP_G, W, H), mx, my)) return { type: 'back' };
  const { rows, rects } = archiveLayout(NOOP_G, W, H, meta, ui);
  const scrolled = scrollPick(mx, my, W, H, ui, rows.length, A_MAX);
  if (scrolled) return scrolled;
  const r = rects.find(rc => hit(rc, mx, my));
  if (!r || r.row.sep) return null;
  ui.sel = r.index;
  if (r.row.afford) return { type: 'purchase', nodeId: r.row.node.id };
  return { type: 'select', index: r.index };
}

/* ---- the Menace board ------------------------------------------------- */

const M_X = 6, M_Y = 40, M_MAX = 14;

function pips(rank, max) { return '#'.repeat(rank) + '.'.repeat(Math.max(0, max - rank)); }

function titleFor(rank) {
  let t = 'UNSWORN';
  for (const e of MENACE_TITLES) if (rank >= e.at) t = e.title;
  return t;
}

function menaceLayout(g, W, H, meta, ui) {
  const standId = ui.standId || meta.lastStandId || 'star_platinum';
  const pact = pactFor(meta.menace, standId);
  const rows = MENACE_CONDITIONS.map(c => {
    const rank = Math.max(0, Math.min(c.ranks, Math.floor(Number(pact[c.id]) || 0)));
    return {
      cond: c, rank, locked: rank === 0,
      label: `${c.name}  [${pips(rank, c.ranks)}]`,
      right: c.desc, rightColor: HUB_DIM,
      accent: rank > 0 ? HUB_WARN : HUB_LINE
    };
  });
  ui.top = clampTop(ui.top || 0, rows.length, M_MAX);
  const rects = rowList(g, M_X, M_Y, W - M_X * 2 - 6, rows, ui.top, M_MAX, {});
  return { standId, pact, rows, rects, rank: menaceRankOf(pact) };
}

export function drawMenaceBoard(g, W, H, meta, unlocks, ui, tsec) {
  backdrop(g, W, H, tsec);
  const { standId, rows, rects, rank } = menaceLayout(g, W, H, meta, ui);
  header(g, W, 'MENACE BOARD', `${pretty(standId).toUpperCase()}   BEST ${bestRankFor(meta.menace, standId)}`);

  const mult = (1 + 0.06 * rank).toFixed(2);
  text(g, `RANK ${rank}/${MENACE_MAX_RANK}`, M_X, 20, { scale: 1, color: rank ? HUB_WARN : HUB_DIM });
  text(g, `TITLE ${titleFor(rank)}`, M_X + 92, 20, { scale: 1, color: rank ? HUB_GOLD : HUB_DIM });
  text(g, `FATE x${mult}`, W - 6, 20, { scale: 1, align: 'right', color: HUB_GOLD });
  text(g, 'ENTIRELY OPT-IN. EVERY CONDITION STARTS AT ZERO.', M_X, 30, { scale: 1, color: HUB_DIM });
  text(g, 'CLICK LEFT OF A ROW TO LOWER, RIGHT TO RAISE.', W - 6, 30,
    { scale: 1, align: 'right', color: HUB_DIM });

  /* The two click zones, made visible: everything left of this divider
     lowers a rank, everything right of it raises one. */
  rects.forEach(r => {
    px(g, r.x + Math.round(r.w / 2), r.y, 1, r.h, HUB_LINE);
    if (r.index === ui.sel) px(g, r.x, r.y, 2, r.h, HUB_GOLD);
  });
  if (rank >= MENACE_MAX_RANK) {
    text(g, 'LADDER TOPPED OUT — 30 IS THE CEILING.', W / 2, H - 11,
      { scale: 1, align: 'center', color: HUB_WARN });
  }
  drawScroll(g, W, H, rows.length > M_MAX);
  backButton(g, W, H);
}

export function pickMenaceBoard(mx, my, W, H, meta, unlocks, ui) {
  if (hit(backButton(NOOP_G, W, H), mx, my)) return { type: 'back' };
  const { standId, pact, rows, rects, rank } = menaceLayout(NOOP_G, W, H, meta, ui);
  const scrolled = scrollPick(mx, my, W, H, ui, rows.length, M_MAX);
  if (scrolled) return scrolled;
  const r = rects.find(rc => hit(rc, mx, my));
  if (!r) return null;
  ui.sel = r.index;
  const row = rows[r.index];
  const raise = mx >= r.x + r.w / 2;
  if (raise && (row.rank >= row.cond.ranks || rank >= MENACE_MAX_RANK)) return { type: 'select', index: r.index };
  if (!raise && row.rank <= 0) return { type: 'select', index: r.index };

  const next = setCondition(pact, row.cond.id, row.rank + (raise ? 1 : -1));
  meta.menace = meta.menace || { pacts: {}, best: {} };
  meta.menace.pacts = meta.menace.pacts || {};
  meta.menace.pacts[standId] = next;
  return { type: 'menace', standId };
}
