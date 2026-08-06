/* "TO BE CONTINUED →" — the run-end screen (GDD §9.5).

   The point of this screen is that it is the SAME screen for a win and a
   loss. Before Phase 10 a death dropped straight back to the title with
   nothing to show for it; §9.5's rule is that "death is never zero", and
   the cheapest honest way to mean it is to give both outcomes the same
   settlement and the same summary. What differs is the banner colour and
   one line of epilogue.

   It shows what run_end.js's settleRun() returned: the build, the best
   combo, the killer, the Fate earned and where it came from, the Archive
   entries and Missions that just landed, any Bond beat that just opened,
   and the epilogue. Read-only -- this file is handed a summary object and
   draws it. */

import { px, dither } from './draw.js';
import { text } from './font.js';
import { backdrop, frame, wrap, HUB_TEXT, HUB_DIM, HUB_GOLD, HUB_LINE, HUB_INK, HUB_OK, HUB_WARN } from './hub_ui.js';

/* The arrow itself, drawn as axis-aligned rows -- render rules forbid a
   rotated fillRect, and a chevron is only a stack of 1px bars anyway. */
function arrow(g, x, y, color) {
  for (let i = 0; i < 7; i++) {
    px(g, x + i, y + i, 2, 1, color);
    px(g, x + i, y + 12 - i, 2, 1, color);
  }
}

export function drawContinued(g, W, H, summary, tsec) {
  const t = tsec || 0;
  backdrop(g, W, H, t);
  if (!summary) { text(g, 'NO RUN', W / 2, H / 2, { scale: 2, align: 'center', color: HUB_DIM }); return; }

  const won = summary.outcome === 'win';
  const accent = won ? HUB_OK : HUB_WARN;

  px(g, 0, 0, W, 30, HUB_INK);
  px(g, 0, 30, W, 1, accent);
  text(g, won ? 'THE CASE IS CLOSED' : 'THE FILE STAYS OPEN', 8, 6,
    { scale: 2, color: accent, outline: '#1A0A18' });
  text(g, `${summary.standName.toUpperCase()}  /  ACT ${summary.act}  /  ${summary.nodesCleared} NODES`,
    8, 22, { scale: 1, color: HUB_DIM });
  if (summary.menaceRank > 0) {
    text(g, `MENACE ${summary.menaceRank}`, W - 8, 22, { scale: 1, align: 'right', color: HUB_WARN });
  }

  /* Left column: the build and the run's own numbers. */
  frame(g, 8, 38, 208, 150, HUB_LINE);
  text(g, 'THE BUILD', 14, 43, { scale: 1, color: HUB_GOLD });
  let y = 55;
  if (summary.build.length === 0) text(g, '(nothing was ever offered)', 14, y, { scale: 1, color: HUB_DIM });
  summary.build.slice(0, 9).forEach(b => {
    text(g, b.slot.toUpperCase(), 14, y, { scale: 1, color: HUB_DIM });
    text(g, `${b.name} L${b.level}`, 66, y, { scale: 1, color: HUB_TEXT });
    y += 9;
  });
  y = 152;
  px(g, 14, y - 5, 196, 1, HUB_LINE);
  text(g, `BEST COMBO  ${summary.bestCombo}`, 14, y, { scale: 1, color: HUB_TEXT });
  text(g, `HITS ${summary.hits}`, 130, y, { scale: 1, color: HUB_DIM });
  y += 9;
  text(g, `PERFECT CLASHES  ${summary.perfectClashes}`, 14, y, { scale: 1, color: HUB_TEXT });
  y += 9;
  text(g, 'KILLER', 14, y, { scale: 1, color: HUB_DIM });
  text(g, summary.killer ? String(summary.killer).toUpperCase().replace(/_/g, ' ') : 'NOBODY',
    66, y, { scale: 1, color: won ? HUB_OK : HUB_WARN });

  /* Right column: what the run paid out. Every run pays all five. */
  frame(g, 224, 38, W - 232, 150, HUB_LINE);
  text(g, 'PAYOUT', 230, 43, { scale: 1, color: HUB_GOLD });
  y = 55;
  text(g, `FATE  +${summary.fate}`, 230, y, { scale: 2, color: HUB_GOLD }); y += 16;
  const bullets = [
    { label: `${summary.archiveEntries.length} ARCHIVE ENTRIES`, color: '#7FC8FF' },
    { label: `${summary.missions.length} MISSIONS COMPLETE`, color: '#B8A0FF' },
    { label: `${summary.bondBeats.length} BOND BEATS`, color: '#E0A0D8' }
  ];
  bullets.forEach(b => { text(g, b.label, 230, y, { scale: 1, color: b.color }); y += 10; });
  summary.missions.slice(0, 3).forEach(m => {
    text(g, `  ${m.name} +${m.fate}`, 230, y, { scale: 1, color: HUB_DIM }); y += 8;
  });
  summary.bondBeats.slice(0, 2).forEach(b => {
    text(g, `  ${b.speaker} SPEAKS`, 230, y, { scale: 1, color: HUB_DIM }); y += 8;
  });
  summary.keepsakes.forEach(k => {
    text(g, '  KEEPSAKE RECEIVED', 230, y, { scale: 1, color: HUB_GOLD }); y += 8;
  });
  summary.titles.forEach(title => {
    text(g, `  TITLE: ${title}`, 230, y, { scale: 1, color: HUB_WARN }); y += 8;
  });

  /* The epilogue, and the words the whole screen is named for. */
  px(g, 0, 196, W, 34, HUB_INK);
  px(g, 0, 196, W, 1, HUB_LINE);
  const lines = wrap(summary.epilogue, 62);
  lines.forEach((ln, i) => text(g, ln, W / 2, 203 + i * 9, { scale: 1, align: 'center', color: '#9BA6D0' }));

  dither(g, 0, 231, W, 39, null, '#1D1838', 9);
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.4);
  text(g, 'TO BE CONTINUED', W / 2 - 14, 242, {
    scale: 2, align: 'center', color: HUB_GOLD, outline: '#3A2A08', alpha: pulse
  });
  arrow(g, W / 2 + 84, 242, HUB_GOLD);
  text(g, 'CLICK TO RETURN TO THE SAFEHOUSE', W / 2, H - 10,
    { scale: 1, align: 'center', color: HUB_DIM });
}

/* One click anywhere continues -- GDD §20's "every line skippable with one
   key" applies to the run-end screen too. */
export function pickContinued() { return true; }
