/* Hub stations, part 2 — the Bond room, the Mission board and the Stand
   rack (GDD §9.3, §10.2, §20). Same contract as hub_panels.js: a draw/pick
   pair per screen over hub_ui.js's chrome, layout computed once by a
   `*Layout()` that pick re-runs against a no-op context.

   The rack writes exactly two things, both pure view state --
   `meta.lastStandId` and `meta.loadout[standId]` -- and still returns an
   action so the caller persists. Bond beats, Keepsake ownership and
   mission completion are read-only here: runs advance those. */

import { px } from './draw.js';
import { text } from './font.js';
import {
  backdrop, frame, header, backButton, hit, rowList, clampTop, detailLines, wrap,
  HUB_TEXT, HUB_DIM, HUB_GOLD, HUB_OK, HUB_WARN, HUB_LINE
} from './hub_ui.js';
import { STANDS } from './data.js';
import { BOND_TRACKS, BOND_STANDS } from './bonds.js';
import { bondProgress, unlockedKeepsakes } from './bond_progress.js';
import { KEEPSAKES } from './keepsakes.js';
import { openMissions, completedCount, MISSION_LIST } from './missions.js';
import { aspectsForStand } from './aspects.js';

/* A context that draws nothing, so pick() can run the real layout pass. */
const NOOP_G = { fillStyle: '', globalAlpha: 1, fillRect() {}, save() {}, restore() {} };
const pretty = id => String(id || '').replace(/_/g, ' ').toUpperCase();
const standName = id => (STANDS[id] ? STANDS[id].standName.toUpperCase() : pretty(id));
const currentStand = (meta, ui) => ui.standId || meta.lastStandId || 'star_platinum';
const scrollRects = (W, H) => ({
  up: { x: W - 58, y: H - 14, w: 25, h: 11 }, down: { x: W - 30, y: H - 14, w: 25, h: 11 }
});

function drawScroll(g, W, H, on) {
  if (!on) return;
  const r = scrollRects(W, H);
  [[r.up, 'UP'], [r.down, 'DN']].forEach(([b, s]) => {
    frame(g, b.x, b.y, b.w, b.h, HUB_DIM);
    text(g, s, b.x + 6, b.y + 3, { scale: 1, color: HUB_TEXT });
  });
}

function scrollPick(mx, my, W, H, ui, count, maxRows) {
  if (count <= maxRows) return null;
  const r = scrollRects(W, H);
  const by = hit(r.up, mx, my) ? -3 : hit(r.down, mx, my) ? 3 : 0;
  if (!by) return null;
  ui.top = clampTop((ui.top || 0) + by, count, maxRows);
  return { type: 'scroll', by };
}

/* A horizontal strip of Stand tabs, used by the Bond room. */
function standTabs(W, ids, y) {
  const w = Math.max(30, Math.floor((W - 12) / Math.max(1, ids.length)) - 2);
  return ids.map((id, i) => ({ id, x: 6 + i * (w + 2), y, w, h: 12 }));
}

/* The tail every list screen's pick shares: scroll first, then the rect
   rowList actually drew -- never a recomputed row index. */
function rowPick(mx, my, W, H, ui, rows, rects, maxRows) {
  const scrolled = scrollPick(mx, my, W, H, ui, rows.length, maxRows);
  if (scrolled) return scrolled;
  const r = rects.find(rc => hit(rc, mx, my));
  if (!r) return null;
  ui.sel = r.index;
  return { type: 'select', index: r.index };
}

/* ---- the Bond room ---------------------------------------------------- */

const B_X = 6, B_Y = 40, B_W = 176, B_MAX = 9;

function bondLayout(g, W, H, meta, ui) {
  const ids = BOND_STANDS;
  const standId = BOND_TRACKS[currentStand(meta, ui)] ? currentStand(meta, ui) : ids[0];
  const tabs = standTabs(W, ids, 22);
  const prog = bondProgress(meta.bonds || {}, standId);
  const earnedIds = prog.earned.map(b => b.id);
  const rows = (BOND_TRACKS[standId] || []).map(beat => {
    const got = earnedIds.includes(beat.id);
    const isNext = !got && !!prog.next && prog.next.id === beat.id;
    return {
      beat, got, isNext, locked: !got,
      label: `${beat.index}. ${got ? beat.speaker : isNext ? 'NEXT' : '------'}`,
      right: got ? 'EARNED' : isNext ? `${prog.have}/${prog.need}` : '',
      rightColor: got ? HUB_OK : HUB_GOLD, accent: got ? '#E0A0D8' : HUB_LINE
    };
  });
  ui.top = clampTop(ui.top || 0, rows.length, B_MAX);
  const rects = rowList(g, B_X, B_Y, B_W, rows, ui.top, B_MAX, { emptyText: 'NO BOND TRACK.' });
  return { standId, tabs, rows, rects, prog };
}

export function drawBondRoom(g, W, H, meta, unlocks, ui, tsec) {
  backdrop(g, W, H, tsec);
  const { standId, tabs, rows, rects, prog } = bondLayout(g, W, H, meta, ui);
  header(g, W, 'BOND ROOM', `${prog.earned.length}/${prog.total} BEATS`);
  tabs.forEach(t => {
    const on = t.id === standId;
    frame(g, t.x, t.y, t.w, t.h, on ? HUB_GOLD : HUB_LINE);
    text(g, standName(t.id).slice(0, 9), t.x + 3, t.y + 3, { scale: 1, color: on ? HUB_GOLD : HUB_DIM });
  });

  const dx = B_X + B_W + 12, dw = W - dx - 6;
  frame(g, dx, B_Y, dw, H - B_Y - 20, HUB_LINE);
  const sel = rows[ui.sel] || rows.find(r => r.isNext) || rows[0];
  const lines = [];
  if (sel && sel.got) {
    for (const ln of sel.beat.lines) for (const w of wrap(ln, 46)) lines.push(w);
  } else if (sel && sel.isNext) {
    const t = sel.beat.trigger;
    lines.push(`HAVE ${prog.have} / NEED ${prog.need}`);
    for (const w of wrap(`${pretty(t.counter)} ${t.op} ${t.value}`, 44)) lines.push(w);
    lines.push('', 'BONDS ADVANCE BY USING THIS STAND.');
  } else if (sel) lines.push('EARLIER BEATS COME FIRST.');
  if (sel) {
    text(g, sel.got ? sel.beat.speaker : sel.isNext ? 'NOT YET SPOKEN' : 'SEALED', dx + 6, B_Y + 6,
      { scale: 1, color: sel.got ? '#E0A0D8' : HUB_DIM });
    detailLines(g, dx + 6, B_Y + 20, dw - 12, lines, sel.got ? HUB_TEXT : HUB_GOLD);
  }

  /* Beat 9's Keepsake, named only once it has actually been handed over. */
  const last = rows[rows.length - 1];
  const kid = last && last.beat.keepsake;
  const kp = kid && (prog.keepsakes || []).includes(kid) ? KEEPSAKES[kid] : null;
  const ky = H - 44;
  px(g, B_X, ky - 4, W - 12, 1, HUB_LINE);
  text(g, kp ? `KEEPSAKE: ${kp.name.toUpperCase()}` : 'KEEPSAKE: SEALED UNTIL BEAT 9.', B_X, ky,
    { scale: 1, color: kp ? HUB_GOLD : HUB_DIM });
  if (kp) text(g, wrap(kp.tradeoff, 74)[0] || '', B_X, ky + 10, { scale: 1, color: HUB_WARN });
  rects.forEach(r => { if (r.index === ui.sel) px(g, r.x, r.y, 2, r.h, HUB_GOLD); });
  drawScroll(g, W, H, rows.length > B_MAX);
  backButton(g, W, H);
}

export function pickBondRoom(mx, my, W, H, meta, unlocks, ui) {
  if (hit(backButton(NOOP_G, W, H), mx, my)) return { type: 'back' };
  const { tabs, rows, rects } = bondLayout(NOOP_G, W, H, meta, ui);
  const tab = tabs.findIndex(t => hit(t, mx, my));
  if (tab >= 0) {
    ui.standId = tabs[tab].id;
    ui.top = 0; ui.sel = 0;
    return { type: 'select', index: tab };
  }
  return rowPick(mx, my, W, H, ui, rows, rects, B_MAX);
}

/* ---- the Mission board ------------------------------------------------ */

const S_X = 6, S_Y = 24, S_W = 196, S_MAX = 15;

function missionTag(m) {
  const s = STANDS[m.standId];
  return s ? s.standName.split(' ').map(w => w[0]).join('').toUpperCase() : '??';
}

function missionLayout(g, W, H, meta, ui) {
  const standId = currentStand(meta, ui);
  const open = openMissions(meta.missions || { completed: [] }, standId);
  const rows = open.map(m => ({
    mission: m, locked: false, right: String(m.fate), rightColor: HUB_GOLD,
    label: (m.standId ? `[${missionTag(m)}] ` : '') + m.name,
    accent: m.standId === standId ? HUB_GOLD : HUB_LINE
  }));
  ui.top = clampTop(ui.top || 0, rows.length, S_MAX);
  const rects = rowList(g, S_X, S_Y, S_W, rows, ui.top, S_MAX, { emptyText: 'ALL DIRECTIVES CLOSED.' });
  return { rows, rects, open };
}

function clauseWords(c) {
  const op = c.op === '>=' ? 'AT LEAST' : c.op === '>' ? 'MORE THAN' : 'EXACTLY';
  return `${op} ${c.value} ${pretty(c.counter.replace(/([A-Z])/g, ' $1'))}`;
}

export function drawMissionBoard(g, W, H, meta, unlocks, ui, tsec) {
  backdrop(g, W, H, tsec);
  const { rows, rects } = missionLayout(g, W, H, meta, ui);
  header(g, W, 'BIZARRE MISSIONS',
    `${completedCount(meta.missions)}/${MISSION_LIST.length} COMPLETE   ${rows.length} OPEN`);

  const dx = S_X + S_W + 12, dw = W - dx - 6;
  frame(g, dx, S_Y, dw, H - S_Y - 20, HUB_LINE);
  const sel = rows[ui.sel];
  if (!sel) text(g, 'SELECT A DIRECTIVE.', dx + 6, S_Y + 6, { scale: 1, color: HUB_DIM });
  else {
    const m = sel.mission;
    text(g, m.name, dx + 6, S_Y + 6, { scale: 1, color: HUB_GOLD });
    text(g, `${m.fate} FATE`, dx + dw - 6, S_Y + 6, { scale: 1, align: 'right', color: HUB_GOLD });
    const lines = wrap(m.desc, 42);
    lines.push('');
    if (m.standId) lines.push(`STAND: ${standName(m.standId)}`);
    if (m.outcome && m.outcome !== 'any') lines.push(`OUTCOME: ${m.outcome.toUpperCase()}`);
    lines.push('REQUIRES:');
    for (const c of m.requires || []) for (const w of wrap('  ' + clauseWords(c), 44)) lines.push(w);
    detailLines(g, dx + 6, S_Y + 20, dw - 12, lines, HUB_TEXT);
  }
  rects.forEach(r => { if (r.index === ui.sel) px(g, r.x, r.y, 2, r.h, HUB_GOLD); });
  drawScroll(g, W, H, rows.length > S_MAX);
  backButton(g, W, H);
}

export function pickMissionBoard(mx, my, W, H, meta, unlocks, ui) {
  if (hit(backButton(NOOP_G, W, H), mx, my)) return { type: 'back' };
  const { rows, rects } = missionLayout(NOOP_G, W, H, meta, ui);
  return rowPick(mx, my, W, H, ui, rows, rects, S_MAX);
}

/* ---- the Stand rack --------------------------------------------------- */

const R_Y = 26, R_MAX = 8;

function rackLayout(g, W, H, meta, unlocks, ui) {
  const standId = currentStand(meta, ui);
  const lo = (meta.loadout && meta.loadout[standId]) || {};
  /* A Stand the Archive granted but the roster has not implemented shows
     as SEALED rather than crashing the rack. */
  const standRows = [...(unlocks.stands || [])].map(id => {
    const sealed = !STANDS[id];
    return {
      standId: id, sealed, locked: sealed, label: standName(id),
      right: sealed ? 'SEALED' : id === standId ? 'RACKED' : '',
      rightColor: sealed ? HUB_WARN : HUB_OK, accent: id === standId ? HUB_GOLD : HUB_LINE
    };
  });
  ui.top = clampTop(ui.top || 0, standRows.length, R_MAX);
  const standRects = rowList(g, 6, R_Y, 112, standRows, ui.top, R_MAX, { emptyText: 'NO STANDS.' });

  const aspectRows = aspectsForStand(standId).map(a => {
    const owned = (unlocks.aspects || new Set()).has(a.id), set = a.id === lo.aspectId;
    return {
      aspect: a, owned, locked: !owned, label: a.name,
      right: set ? 'SET' : owned ? '' : 'LOCKED',
      rightColor: set ? HUB_OK : HUB_DIM, accent: set ? HUB_GOLD : HUB_LINE
    };
  });
  const aspectRects = rowList(g, 124, R_Y, 170, aspectRows, 0, 6, { emptyText: 'NO ASPECTS.' });

  const keepRows = unlockedKeepsakes(meta.bonds || {})
    .map(id => KEEPSAKES[id]).filter(k => k && k.standId === standId)
    .map(k => ({
      keepsake: k, locked: false, label: k.name.slice(0, 22), rightColor: HUB_OK,
      right: k.id === lo.keepsakeId ? 'SET' : '', accent: k.id === lo.keepsakeId ? HUB_GOLD : HUB_LINE
    }));
  const keepRects = rowList(g, 300, R_Y, 174, keepRows, 0, 6, { emptyText: 'NO KEEPSAKES YET.' });
  return { standId, lo, standRows, standRects, aspectRows, aspectRects, keepRows, keepRects };
}

export function drawStandRack(g, W, H, meta, unlocks, ui, tsec) {
  backdrop(g, W, H, tsec);
  const L = rackLayout(g, W, H, meta, unlocks, ui);
  header(g, W, 'STAND RACK', standName(L.standId));
  [['STAND', 6], ['ASPECT', 124], ['KEEPSAKE', 300]]
    .forEach(([s, x]) => text(g, s, x, 18, { scale: 1, color: HUB_DIM }));

  const dy = R_Y + 6 * 15 + 8;
  frame(g, 6, dy, W - 12, H - dy - 20, HUB_LINE);
  const sel = L.aspectRows[ui.sel] || L.aspectRows.find(r => r.aspect.id === L.lo.aspectId) || L.aspectRows[0];
  if (!sel) text(g, 'THIS STAND HAS NO ASPECTS INSTALLED.', 12, dy + 6, { scale: 1, color: HUB_DIM });
  else {
    text(g, sel.aspect.name, 12, dy + 6, { scale: 1, color: sel.owned ? HUB_GOLD : HUB_DIM });
    if (!sel.owned) {
      text(g, 'LOCKED — OPEN IT IN THE ARCHIVE.', W - 12, dy + 6, { scale: 1, align: 'right', color: HUB_DIM });
    }
    detailLines(g, 12, dy + 18, W - 24, wrap(sel.aspect.desc, 74), HUB_TEXT);
    if ((sel.aspect.tags || []).includes('risk') && sel.aspect.tradeoff) {
      detailLines(g, 12, dy + 40, W - 24, wrap('TRADEOFF: ' + sel.aspect.tradeoff, 74), HUB_WARN);
    }
  }
  L.standRects.forEach(r => { if (r.row.standId === L.standId) px(g, r.x, r.y, 2, r.h, HUB_GOLD); });
  drawScroll(g, W, H, L.standRows.length > R_MAX);
  backButton(g, W, H);
}

export function pickStandRack(mx, my, W, H, meta, unlocks, ui) {
  if (hit(backButton(NOOP_G, W, H), mx, my)) return { type: 'back' };
  const L = rackLayout(NOOP_G, W, H, meta, unlocks, ui);
  const scrolled = scrollPick(mx, my, W, H, ui, L.standRows.length, R_MAX);
  if (scrolled) return scrolled;

  const sr = L.standRects.find(rc => hit(rc, mx, my));
  if (sr) {
    if (!sr.row.sealed) { ui.standId = sr.row.standId; meta.lastStandId = sr.row.standId; ui.sel = 0; }
    return { type: 'select', index: sr.index };
  }
  /* An Aspect and a Keepsake write the same one loadout slot, so both go
     through a single write and a single 'loadout' action. */
  const ar = L.aspectRects.find(rc => hit(rc, mx, my));
  const kr = L.keepRects.find(rc => hit(rc, mx, my));
  if (!ar && !kr) return null;
  if (ar) ui.sel = ar.index;
  if (ar && !ar.row.owned) return { type: 'select', index: ar.index };
  const drop = kr && kr.row.keepsake.id === L.lo.keepsakeId; // click again to unequip
  meta.loadout = meta.loadout || {};
  meta.loadout[L.standId] = {
    aspectId: ar ? ar.row.aspect.id : (L.lo.aspectId || null),
    keepsakeId: kr ? (drop ? null : kr.row.keepsake.id) : (L.lo.keepsakeId || null)
  };
  return { type: 'loadout', standId: L.standId };
}
