/* Shared chrome for the hub's six stations (GDD §20). One backdrop, one
   panel frame, one scrolling list, one button -- so the Archive terminal,
   the Menace board, the Bond room, the Mission board, the Stand rack and
   the Training Room all read as rooms in the same building instead of six
   separately-invented menus, and so adding a seventh costs a data row.

   Render-layer rules apply here as everywhere: whole pixels only, no
   fill()/stroke()/rotate, and nothing in this file reads or writes sim
   state -- every draw function is handed what it should show. */

import { px, dither } from './draw.js';
import { text, textWidth } from './font.js';

export const HUB_BG = '#141024';
export const HUB_INK = '#0A0714';
export const HUB_LINE = '#4A4370';
export const HUB_TEXT = '#C8CCE8';
export const HUB_DIM = '#6E7398';
export const HUB_GOLD = '#FFD24A';
export const HUB_OK = '#5FD672';
export const HUB_WARN = '#FF6B6B';

export const ROW_H = 15;

export function backdrop(g, W, H, tsec) {
  px(g, 0, 0, W, H, HUB_BG);
  dither(g, 0, 0, W, H, null, '#191434', 11);
  for (let i = 0; i < 3; i++) {
    const y = (((tsec || 0) * 9 + i * 90) % (H + 30)) - 15;
    px(g, 0, Math.round(y), W, 1, '#1D1838');
  }
  px(g, 0, 0, W, 1, HUB_LINE);
  px(g, 0, H - 1, W, 1, HUB_LINE);
}

export function frame(g, x, y, w, h, color) {
  px(g, x, y, w, h, HUB_INK);
  px(g, x, y, w, 1, color || HUB_LINE);
  px(g, x, y + h - 1, w, 1, color || HUB_LINE);
  px(g, x, y, 1, h, color || HUB_LINE);
  px(g, x + w - 1, y, 1, h, color || HUB_LINE);
}

export function header(g, W, title, subtitle) {
  px(g, 0, 0, W, 16, HUB_INK);
  px(g, 0, 16, W, 1, HUB_LINE);
  text(g, title, 6, 5, { scale: 1, color: HUB_GOLD });
  if (subtitle) text(g, subtitle, W - 6, 5, { scale: 1, align: 'right', color: HUB_DIM });
}

/* The one-key escape every station honours (GDD §20: "every line skippable
   with one key"). Drawn bottom-left, and every station's pick function
   treats a click on it as "back". */
export function backButton(g, W, H, label) {
  const w = textWidth(label || 'BACK  [ESC]', 1, 1) + 10;
  frame(g, 4, H - 14, w, 11, HUB_DIM);
  text(g, label || 'BACK  [ESC]', 9, H - 11, { scale: 1, color: HUB_TEXT });
  return { x: 4, y: H - 14, w, h: 11 };
}

export function hit(rect, mx, my) {
  return rect && mx >= rect.x && mx < rect.x + rect.w && my >= rect.y && my < rect.y + rect.h;
}

/* A vertical list of selectable rows, scrolled by `top`. Returns the rects
   it drew, so a station's pick function never re-derives the layout (the
   bug that made every hand-rolled menu in this codebase drift). */
export function rowList(g, x, y, w, rows, top, maxRows, opts) {
  const o = opts || {};
  const rects = [];
  const shown = rows.slice(top, top + maxRows);
  shown.forEach((row, i) => {
    const ry = y + i * ROW_H;
    const rect = { x, y: ry, w, h: ROW_H - 1, index: top + i, row };
    px(g, x, ry, w, ROW_H - 1, row.locked ? '#171331' : '#1E1940');
    px(g, x, ry, 2, ROW_H - 1, row.accent || HUB_LINE);
    const label = row.label == null ? '' : row.label;
    text(g, label, x + 6, ry + 3, { scale: 1, color: row.locked ? HUB_DIM : HUB_TEXT });
    if (row.right != null) {
      text(g, String(row.right), x + w - 5, ry + 3, {
        scale: 1, align: 'right', color: row.rightColor || (row.locked ? HUB_DIM : HUB_GOLD)
      });
    }
    rects.push(rect);
  });
  if (rows.length > maxRows) {
    const barH = Math.max(6, Math.round((maxRows / rows.length) * (maxRows * ROW_H)));
    const barY = y + Math.round((top / rows.length) * (maxRows * ROW_H));
    px(g, x + w + 2, y, 2, maxRows * ROW_H, '#211C42');
    px(g, x + w + 2, barY, 2, barH, HUB_DIM);
  }
  if (o.emptyText && rows.length === 0) text(g, o.emptyText, x + 6, y + 4, { scale: 1, color: HUB_DIM });
  return rects;
}

export function clampTop(top, count, maxRows) {
  return Math.max(0, Math.min(Math.max(0, count - maxRows), top));
}

/* A wrapped detail block for the pane beside a list. */
export function detailLines(g, x, y, w, lines, color) {
  lines.forEach((ln, i) => text(g, ln, x, y + i * 9, { scale: 1, color: color || HUB_TEXT }));
}

/* Wraps a long string to `cols` characters without splitting words -- the
   font is fixed-width, so a character count is a pixel count. */
export function wrap(str, cols) {
  const out = [];
  let line = '';
  for (const word of String(str || '').split(' ')) {
    if (!line.length) line = word;
    else if ((line + ' ' + word).length <= cols) line += ' ' + word;
    else { out.push(line); line = word; }
  }
  if (line.length) out.push(line);
  return out;
}
