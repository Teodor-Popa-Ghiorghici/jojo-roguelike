/* The pause menu -- the "stop menu" the machine never had.

   Before this, a fight had exactly three exits: win, lose, or `flee`
   (which QA-063 showed can be unbound to nothing). There was no way to
   stop, no way to check the controls mid-fight, and no way to walk away
   from a run except by closing the window -- which silently left the map
   checkpoint on disk, i.e. the worst possible version of quitting.

   Deliberately NOT an escape hatch from a losing fight. ABANDON RUN
   settles the run through the same loss path a death takes, so pausing
   can never be cheaper than fighting; `flee` remains the only free early
   exit, and it still costs what it always cost. Quitting to the hub with
   the run intact is exactly the save-scum this menu refuses to sell.

   Rendered as a scrim over whatever frame was last drawn -- the caller
   stops stepping the sim, so the frozen frame underneath is the pause. */

import { px, dither } from './draw.js';
import { text } from './font.js';
import { isHubScene } from './hub_flow.js';
import { frame, HUB_TEXT, HUB_DIM, HUB_GOLD, HUB_LINE, HUB_WARN } from './hub_ui.js';

const PANEL_W = 190, ROW_H = 15;

/* Same two choices everywhere a run can be paused. The controls block
   below is what varies by scene -- it only appears in combat, where the
   keys it lists actually do something. */
export function pauseOptions() {
  return [
    { id: 'resume', label: 'RESUME' },
    { id: 'abandon', label: 'ABANDON RUN', warn: true }
  ];
}

const CONTROLS = [
  'A / D      MOVE',
  'W / S      DEPTH',
  'J / K / L  LIGHT / MED / HEAVY',
  'SPACE      STEP',
  'SHIFT      CLASH',
  'G          GUARD',
  'U / I      SPECIAL / RUSH',
  'F          PROJECT STAND'
];

function panelRect(W, H, rows, showControls) {
  const h = 34 + rows * ROW_H + (showControls ? CONTROLS.length * 8 + 12 : 0);
  return {
    x: Math.round((W - PANEL_W) / 2),
    y: Math.round((H - h) / 2),
    w: PANEL_W,
    h: h
  };
}

export function drawPause(g, W, H, opts, index, scene, tsec) {
  const showControls = scene === 'combat';
  /* A dithered scrim, not a translucent fill -- alpha over a pixel-art
     frame gives blended half-tones that never appear in the palette. */
  dither(g, 0, 0, W, H, null, '#05040C', 3);

  const r = panelRect(W, H, opts.length, showControls);
  frame(g, r.x, r.y, r.w, r.h, HUB_GOLD);
  px(g, r.x, r.y + 15, r.w, 1, HUB_LINE);
  text(g, 'PAUSED', r.x + r.w / 2, r.y + 5, { scale: 1, align: 'center', color: HUB_GOLD });

  opts.forEach((o, i) => {
    const y = r.y + 22 + i * ROW_H;
    const on = i === index;
    if (on) px(g, r.x + 4, y - 2, r.w - 8, ROW_H - 2, '#221B3A');
    const color = o.warn ? HUB_WARN : (on ? HUB_TEXT : HUB_DIM);
    text(g, (on ? '> ' : '  ') + o.label, r.x + 10, y + 2, { scale: 1, color: color });
  });

  if (showControls) {
    const cy = r.y + 26 + opts.length * ROW_H;
    px(g, r.x + 4, cy - 4, r.w - 8, 1, HUB_LINE);
    CONTROLS.forEach((line, i) => {
      text(g, line, r.x + 10, cy + 2 + i * 8, { scale: 1, color: HUB_DIM });
    });
  }
}

/* Same hit-rect the highlight above is drawn into, so what looks
   clickable is what is clickable. */
export function pickPauseChoice(mx, my, W, H, opts, scene) {
  const r = panelRect(W, H, opts.length, scene === 'combat');
  for (let i = 0; i < opts.length; i++) {
    const y = r.y + 22 + i * ROW_H;
    if (mx >= r.x + 4 && mx <= r.x + r.w - 4 && my >= y - 2 && my <= y + ROW_H - 4) return i;
  }
  return -1;
}

/* The controller owns the open/selection state and every input path into
   it, so index.js only has to ask "did the pause menu take this?" and
   skip its own handling when the answer is yes. Hub scenes keep Escape
   as their own back-out and the title has nothing to stop, so neither is
   pausable. */
export function createPause(handlers) {
  let open = false, index = 0;

  function choose(i) {
    const opts = pauseOptions();
    const o = opts[i];
    if (!o) return;
    if (window.Snd) window.Snd.select();
    open = false;
    if (o.id === 'abandon' && handlers.onAbandon) handlers.onAbandon();
  }

  return {
    isOpen() { return open; },

    /* Checked ahead of the input map so an unbound or rebound keymap can
       never take the stop menu away, the way QA-063 showed it can take
       `flee`. Returns true when it consumed the event. */
    key(ev, down, scene) {
      const pausable = !isHubScene(scene) && scene !== 'title';
      if (down && ev.code === 'Escape' && pausable) {
        open = !open;
        index = 0;
        if (window.Snd) window.Snd.click();
        return true;
      }
      if (!open) return false;
      if (down) {
        const opts = pauseOptions();
        if (ev.code === 'ArrowUp') index = (index + opts.length - 1) % opts.length;
        else if (ev.code === 'ArrowDown') index = (index + 1) % opts.length;
        else if (ev.code === 'Enter') choose(index);
      }
      return true;
    },

    click(mx, my, W, H, scene) {
      if (!open) return false;
      const i = pickPauseChoice(mx, my, W, H, pauseOptions(), scene);
      if (i >= 0) choose(i); else if (window.Snd) window.Snd.click();
      return true;
    },

    draw(g, W, H, scene, tsec) {
      if (open) drawPause(g, W, H, pauseOptions(), index, scene, tsec);
    }
  };
}
