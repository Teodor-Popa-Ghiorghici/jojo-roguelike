/* The 16-colour CGA/VGA palette (data.js's PAL) -- split out purely to keep
   data.js/data_enemies.js each under the repo's 300-line cap (Phase 9b);
   both re-export/import from here so there's still one source of truth.
   Distinct from palette.js, which is render.js's much larger cel-shading
   colour-ramp table for sprite art, not this flat 16-colour set. */
export const PAL = {
  black: '#000000', blue: '#0000AA', green: '#00AA00', cyan: '#00AAAA',
  red: '#AA0000', magenta: '#AA00AA', brown: '#AA5500', gray: '#AAAAAA',
  dgray: '#555555', lblue: '#5555FF', lgreen: '#55FF55', lcyan: '#55FFFF',
  lred: '#FF5555', lmagenta: '#FF55FF', yellow: '#FFFF55', white: '#FFFFFF'
};
