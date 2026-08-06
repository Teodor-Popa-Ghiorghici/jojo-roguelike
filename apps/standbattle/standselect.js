/* Stand select — GDD §7's "pre-run choice". One panel per STANDS entry
   (data.js), in insertion order, so this screen never hardcodes which
   Stands exist -- a 5th launch Stand is a new data.js entry, not a new
   line here. No Aspects (out of this phase's scope per the DO NOT list):
   each panel picks the Stand's single base configuration. */

import { backdrop, frame, button } from './map.js';
import { text, paragraph } from './font.js';
import { STANDS } from './data.js';
import { px } from './draw.js';

const BLURB = {
  star_platinum: 'CLOSE-RANGE BRAWLER — HIGHEST RAW DAMAGE',
  silver_chariot: 'MID-RANGE TECHNICIAN — RAPIER THRUSTS, ARMOR TECH',
  hierophant_green: 'LONG-RANGE ZONER — EMERALD SPLASH, CHAIN REACH',
  killer_queen: 'MID-RANGE TRICKSTER — BOMB CONVERSION'
};

function panelRect(i, total, W, H) {
  const w = 96, h = 150, gap = 12;
  const totalW = total * w + (total - 1) * gap;
  return { x: Math.round(W / 2 - totalW / 2 + i * (w + gap)), y: 66, w, h };
}

export function drawStandSelect(g, W, H, tsec) {
  backdrop(g, W, H, tsec || 0);
  g.save(); g.globalAlpha = 0.5; px(g, 0, 0, W, H, '#05060C'); g.restore();
  text(g, 'CHOOSE YOUR STAND', W / 2, 32, { scale: 2, align: 'center', color: '#FFE86A', outline: '#3A2A06' });
  const ids = Object.keys(STANDS);
  ids.forEach((id, i) => {
    const s = STANDS[id];
    const r = panelRect(i, ids.length, W, H);
    frame(g, r.x, r.y, r.w, r.h, '#5FA3D6');
    text(g, s.character.toUpperCase(), r.x + r.w / 2, r.y + 14, { scale: 1, align: 'center', color: '#DCE2FF' });
    text(g, s.standName.toUpperCase(), r.x + r.w / 2, r.y + 26, { scale: 1, align: 'center', color: '#FFE86A' });
    paragraph(g, BLURB[id] || '', r.x + 4, r.y + 46, r.w - 8, { scale: 1, color: '#B8C4E8' });
    button(g, { x: r.x + 6, y: r.y + r.h - 22, w: r.w - 12, h: 16 }, 'SELECT', true);
  });
  text(g, 'CLICK A STAND TO BEGIN', W / 2, H - 12, {
    scale: 1, align: 'center', color: '#FFFFFF', alpha: 0.55 + 0.45 * Math.sin(tsec * 3)
  });
}

export function pickStand(mx, my, W, H) {
  const ids = Object.keys(STANDS);
  for (let i = 0; i < ids.length; i++) {
    const r = panelRect(i, ids.length, W, H);
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return ids[i];
  }
  return null;
}
