/* The app's DOM chrome: the canvas pane, the integer scaler that sizes
   it, and the button strip underneath (SHAKE, DEBUG, FULL, key hints).

   Split out of index.js (repo's 300-line cap) when FULL was added. It is
   pure presentation plumbing -- it owns no game state, only the elements
   and the ResizeObserver. Every button is handed the getter it should
   read and the side effect it should fire, so index.js keeps owning the
   state these toggles describe.

   mousedown (not click) with stopPropagation everywhere, matching the
   rest of the machine: wm.js raises and drags a window on mousedown, so
   a button waiting for click would drag the window out from under the
   pointer first. */

export function mountShell(root, W, H, opts) {
  const pane = document.createElement('div');
  pane.className = 'gamepane sbpane';
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.className = 'gamecv sbcanvas';
  cv.tabIndex = 0;
  pane.appendChild(cv);
  root.appendChild(pane);

  const bar = document.createElement('div');
  bar.className = 'appbar';

  function button(getLabel, onFire) {
    const b = document.createElement('button');
    b.className = 'appbtn';
    const refresh = () => { b.textContent = getLabel(); };
    b.addEventListener('mousedown', ev => {
      ev.stopPropagation();
      onFire();
      refresh();
      if (window.Snd) window.Snd.click();
    });
    refresh();
    bar.appendChild(b);
    return refresh;
  }

  const refreshShake = button(() => 'SHAKE: ' + (opts.getShake() ? 'ON' : 'OFF'), opts.onShake);
  const refreshDebug = button(() => 'DEBUG: ' + (opts.getDebug() ? 'ON' : 'OFF'), opts.onDebug);
  /* Label reads as the action, not the state -- the canvas is letterboxed
     inside the pane, so "FULL"/"WINDOW" is clearer than "FULL: OFF". */
  const refreshFull = button(() => (opts.isFull() ? 'WINDOW' : 'FULL'), opts.onFull);

  const info = document.createElement('span');
  info.className = 'godword sbinfo';
  bar.appendChild(info);
  root.appendChild(bar);

  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;

  /* integer scale only (spec §11) -- fit both axes, never a fractional
     blow-up. FULL changes the window size; this recomputes off it. */
  function resize() {
    const availW = Math.max(W, pane.clientWidth || W);
    const availH = Math.max(H, pane.clientHeight || H);
    const scale = Math.max(1, Math.floor(Math.min(availW / W, availH / H)));
    cv.style.width = (W * scale) + 'px';
    cv.style.height = (H * scale) + 'px';
  }
  const ro = new ResizeObserver(resize);
  ro.observe(pane);
  resize();

  return {
    cv: cv,
    g: g,
    /* settings_panel.js mounts its own controls into the same strip and
       positions its popouts against the pane, so both are handed out. */
    bar: bar,
    pane: pane,
    setInfo(txt) { if (info.textContent !== txt) info.textContent = txt; },
    refresh() { refreshShake(); refreshDebug(); refreshFull(); },
    destroy() { ro.disconnect(); }
  };
}
