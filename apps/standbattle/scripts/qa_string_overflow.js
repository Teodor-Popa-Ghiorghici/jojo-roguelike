#!/usr/bin/env node
/* QA (Phase 13h, matrix item 7) — walks every content-registry string this
   app draws with font.js's un-wrapped `text()` (row labels, single-line
   titles/headers) and checks its rendered pixel width against the panel
   width it is actually drawn into. `paragraph()` call sites (Fragment/
   Relic/Duo card bodies, event body text, archive detail lines) are word-
   wrapped by construction and are out of scope here -- the risk is
   entirely in the *unwrapped* `text()` calls: rowList labels, card
   headers, node/mission/keepsake names, event/act titles.

   No DOM/canvas needed -- font_data.js's glyph table is a plain 5px-wide
   table, so width is `str.length * (GLYPH_W + spacing) * scale - spacing
   * scale`, exactly font.js's own textWidth(). Re-run any time:

     node apps/standbattle/scripts/qa_string_overflow.js

   Exits 0 and prints "OK" lines when everything fits, exits 1 and prints
   one OVERFLOW line per offending string when something doesn't. */

import { GLYPH_W } from '../font_data.js';
import { FRAGMENT_LIST } from '../fragments.js';
import { RELIC_LIST } from '../relics.js';
import { DUO_LIST } from '../duo_fragments.js';
import { DISCS } from '../content/discs.js';
import { STANDS, ENEMIES, BOSSES, ENCOUNTERS, EVENTS } from '../data.js';
import { ASPECTS } from '../aspects.js';
import { nodesByTier } from '../meta_archive.js';
import { MENACE_CONDITIONS } from '../meta_menace.js';
import { KEEPSAKE_LIST } from '../keepsakes.js';
import { ACT_CONFIGS } from '../map_data.js';

const ARCHIVE_NODES = [1, 2, 3, 4].flatMap(t => nodesByTier(t));
const KEEPSAKES = KEEPSAKE_LIST;

const missionModules = await Promise.all(
  [1, 2, 3, 4, 5, 6].map(n => import(`../missions_0${n}.js`).catch(() => null))
);

function textWidth(str, scale = 1, spacing = 1) {
  const s = String(str == null ? '' : str).toUpperCase();
  return s.length * (GLYPH_W + spacing) * scale - spacing * scale;
}

let failures = 0;
let checked = 0;

/* `budget` is the pixel width the string is actually drawn into (see the
   file:line cited in each check); `reserve` subtracts room already known
   to be spoken for on the same row (a right-aligned sibling label, left
   padding, a selection-marker stripe) so the check isn't stricter than
   the real layout. */
function check(category, str, budget, where, scale = 1) {
  if (str == null || str === '') return;
  checked++;
  const w = textWidth(str, scale);
  if (w > budget) {
    failures++;
    console.log(`OVERFLOW [${category}] "${str}" -> ${w}px > ${budget}px budget (${where})`);
  }
}

/* ---- rowList row labels (hub_ui.js:68 draws `label` unwrapped at x+6, and
   `right` right-aligned unwrapped at x+w-5 -- both untruncated) ---- */

// Archive terminal: hub_panels.js A_W=176, left pad 6, right column reserves
// the widest right value it ever shows ("NEED ### MORE" / "COST ###" / "OWNED").
const ARCHIVE_ROW_W = 176 - 6 - 6 - 60;
for (const n of ARCHIVE_NODES) check('archive-row-name', n.name, ARCHIVE_ROW_W, 'hub_panels.js:81 rowList label, A_W=176 (hub_panels.js:67)');
// Archive detail pane: hub_panels.js dw = W - (A_X+A_W+12) - 6 = 480-6-176-12-6=280, right column reserves its own COST/LOCKED text.
for (const n of ARCHIVE_NODES) check('archive-detail-name', n.name, 280 - 90, 'hub_panels.js:130, dw computed at hub_panels.js:121');

// Menace board: row label is `${c.name}  [pips]`; `right` is the FULL
// c.desc drawn right-aligned on the SAME row (hub_panels.js:173-174) --
// both share M_W = W - M_X*2 - 6 = 480-12-6=462 with no reserved split,
// so budget each side generously at half the row.
const MENACE_ROW_W = (480 - 12 - 6) / 2 - 6;
for (const c of MENACE_CONDITIONS) {
  check('menace-row-name+pips', `${c.name}  [${'#'.repeat(c.ranks)}]`, MENACE_ROW_W, 'hub_panels.js:173 rowList label');
  check('menace-row-desc', c.desc, MENACE_ROW_W, 'hub_panels.js:174 rowList right (hub_panels.js:169-180)');
}

// Bond room / mission board: hub_panels_b.js B_W=176, S_W=196.
if (missionModules.some(m => m)) {
  const allMissions = missionModules.filter(Boolean).flatMap(m => m.MISSIONS || m.default || []);
  for (const m of allMissions) {
    check('mission-row-name', m.name, 196 - 6 - 6 - 40, 'hub_panels_b.js:186 rowList label, S_W=196 (hub_panels_b.js:149)');
  }
}

// Stand rack: stand rows w=112, aspect rows w=170, keepsake rows w=174 (hub_panels_b.js:225,235,243).
for (const s of Object.values(STANDS)) check('standrack-stand-name', s.standName, 112 - 6 - 6, 'hub_panels_b.js:225 rowList, w=112');
for (const a of Object.values(ASPECTS)) check('standrack-aspect-name', a.name, 170 - 6 - 6, 'hub_panels_b.js:235 rowList, w=170');
for (const k of KEEPSAKES) check('standrack-keepsake-name', k.name, 174 - 6 - 6, 'hub_panels_b.js:243 rowList, w=174');

// Training room list: LIST_W=230 (training.js:118), label vs `right` (slot/rarity) share the row.
const TRAIN_ROW_W = 230 - 6 - 6 - 60;
for (const f of FRAGMENT_LIST) check('training-fragment-name', f.name, TRAIN_ROW_W, 'training.js:66 rowList label, LIST_W=230');
for (const r of RELIC_LIST) check('training-relic-name', r.name, TRAIN_ROW_W, 'training.js:70 rowList label');
for (const s of Object.values(STANDS)) check('training-stand-name', s.standName.toUpperCase(), TRAIN_ROW_W, 'training.js:58 rowList label');
for (const e of Object.values(ENEMIES)) check('training-enemy-name', (e.name || e.id), TRAIN_ROW_W, 'training.js:73 rowList label');
for (const b of Object.values(BOSSES)) check('training-boss-name', (b.name || b.standName || b.id), TRAIN_ROW_W, 'training.js:75 rowList label');
for (const en of Object.values(ENCOUNTERS)) check('training-encounter-label', (en.label || en.id), TRAIN_ROW_W, 'training.js:74 rowList label');

// ---- single-line card headers (scale 1, no wrap) ----
// Reward/shop card rarity+donor headers use fixed short vocab strings, not
// content -- skipped. Fragment/Relic/Duo NAME headers go through paragraph()
// (rewards.js:53,55 / shop.js:71) so they wrap; skipped here by design.

// Reward card SLOT_LABEL + level line: rewards.js:81, card body width r.w-12
// (144-12=132 for a 3-card offer, 108-12=96 for a 4-card Aura offer). The
// slot vocabulary is fixed; nothing content-driven there. Skipped.

// Event scene title: map.js:245, centered in a `W-80` frame at scale 2.
for (const ev of Object.values(EVENTS)) check('event-title', ev.title, (480 - 80 - 16), 'map.js:245 text(), scale 2', 2);
// Event choice button labels: map.js:247, button width 150 (map.js:251).
for (const ev of Object.values(EVENTS)) for (const c of ev.choices) check('event-choice-label', c.label, 150 - 12, 'map.js:247/251 choiceRect w=150');

// Act title: map.js:192, drawn at x=8 scale 2, no explicit budget but the
// canvas itself (W=480) is the hard ceiling.
for (const cfg of Object.values(ACT_CONFIGS)) check('act-title', cfg.title, 480 - 8 - 60, 'map.js:192 text(), scale 2', 2);

// Shop remove-mode row: shop.js:56, w=360 (removeRowRect, shop.js:30).
const SHOP_REMOVE_ROW_W = 360 - 6 - 6;
for (const f of FRAGMENT_LIST) {
  for (let lvl = 1; lvl <= 3; lvl++) {
    check('shop-remove-row', `${f.slot.toUpperCase()}: ${f.name.toUpperCase()} LV${lvl}`, SHOP_REMOVE_ROW_W, 'shop.js:56, w=360');
  }
}

// Duo Fragment / Relic / Disc names+descs go through paragraph() in
// rewards.js -- word-wrapped, skipped. Their card-header slot line is
// fixed vocabulary ("DUO FRAGMENT" / "RELIC" / "DISC") -- skipped.

console.log(`\nChecked ${checked} strings across ${8} categories.`);
if (failures) {
  console.log(`${failures} OVERFLOW(S) FOUND.`);
  process.exit(1);
} else {
  console.log('OK — no unwrapped string exceeds its panel budget.');
  process.exit(0);
}
