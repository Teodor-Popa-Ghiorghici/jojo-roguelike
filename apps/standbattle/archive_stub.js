/* Archive Node — stub. Archive-locked content (lore drops, Fate, the
   Archive entries themselves, spec §8) is out of Phase 8's scope; the
   node type exists so the map/telemetry/save shapes are already correct
   for whichever phase fills it in, per the mission's "Archive-locked
   types stub out." */

import { backdrop, frame, button } from './map.js';
import { px } from './draw.js';
import { text } from './font.js';

function continueRect(W, H) { return { x: W / 2 - 75, y: H - 62, w: 150, h: 26 }; }

export function drawArchiveStub(g, W, H, tsec) {
  backdrop(g, W, H, tsec || 0);
  g.save(); g.globalAlpha = 0.55; px(g, 0, 0, W, H, '#05060C'); g.restore();
  frame(g, 60, 60, W - 120, 84, '#585868');
  text(g, 'ARCHIVE', W / 2, 78, { scale: 2, align: 'center', color: '#A8A8B8', outline: '#2A2A38' });
  text(g, 'SEALED. NOTHING HERE YET.', W / 2, 104, { scale: 1, align: 'center', color: '#7A7A8C' });
  button(g, continueRect(W, H), 'CONTINUE', true);
}

export function pickArchiveContinue(mx, my, W, H) {
  const r = continueRect(W, H);
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}
