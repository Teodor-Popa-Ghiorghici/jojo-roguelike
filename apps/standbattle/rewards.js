/* Fragment offer + build-summary screens — GDD §6.1 deliverable 2/6.
   Drawn in the same painted-panel language map.js already established
   (frame()/button() equivalents, reused here as cardFrame()) so a reward
   screen reads as part of the same UI, not a bolted-on popup. */

import { px, dither } from './draw.js';
import { text, paragraph, textWidth } from './font.js';
import { PAL } from './data.js';
import { SLOTS } from './content_registry.js';
import { FRAGMENTS } from './fragments.js';

const RARITY_COLOR = { common: PAL.gray, rare: PAL.lblue, epic: PAL.lmagenta, legendary: PAL.yellow };
const SLOT_LABEL = {
  light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY', special_1: 'SPECIAL', special_2: 'SPECIAL 2',
  rush: 'RUSH', step: 'STEP', clash: 'CLASH', aura: 'AURA'
};

/* `total` (Phase 10, Hermit Purple — Aura's "one extra choice", GDD §6.1):
   defaults to 3 for every existing caller; a 4-card offer shrinks card
   width so 4 still fit the 480px canvas instead of overflowing it. */
function cardRect(i, W, total) {
  const n = total || 3;
  const w = n <= 3 ? 144 : 108, h = 202, gap = 8;
  const x0 = Math.round((W - (w * n + gap * (n - 1))) / 2);
  return { x: x0 + i * (w + gap), y: 28, w, h };
}

function cardFrame(g, r, accent) {
  px(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, '#05060C');
  px(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, accent);
  px(g, r.x, r.y, r.w, r.h, '#12141F');
  px(g, r.x, r.y, r.w, 3, accent);
  dither(g, r.x, r.y + 3, r.w, r.h - 3, null, '#181C30', 6);
}

export function drawReward(g, W, H, offer, runState, tsec) {
  px(g, 0, 0, W, H, '#05060C');
  g.save(); g.globalAlpha = 0.5 + 0.15 * Math.sin(tsec * 2);
  text(g, 'A FRAGMENT CALLS TO YOU', W / 2, 8, { scale: 2, align: 'center', color: '#FFE6F0', outline: '#3A0A1E' });
  g.restore();

  offer.forEach((cand, i) => {
    const r = cardRect(i, W, offer.length);
    /* Phase 10: a Duo Fragment (cand.kind === 'duo') shares this card
       layout but has no donor/slot/levels -- `duo.desc` stands in for
       levelDesc, "DUO" stands in for the donor/slot line. */
    if (cand.kind === 'duo') {
      const duo = cand.duo;
      const accent = RARITY_COLOR[duo.rarity] || PAL.gray;
      cardFrame(g, r, accent);
      text(g, duo.rarity.toUpperCase(), r.x + r.w / 2, r.y + 6, { scale: 1, align: 'center', color: accent });
      text(g, 'DUO FRAGMENT', r.x + r.w / 2, r.y + 16, { scale: 1, align: 'center', color: '#8A93B8' });
      let y = paragraph(g, duo.name.toUpperCase(), r.x + 6, r.y + 28, r.w - 12, { scale: 1, color: '#FFE86A' });
      y += 13;
      paragraph(g, duo.desc, r.x + 6, y, r.w - 12, { scale: 1, color: '#DCE2FF' });
      if (duo.tradeoff) paragraph(g, 'RISK: ' + duo.tradeoff, r.x + 6, r.y + r.h - 14, r.w - 12, { scale: 1, color: '#FF9955' });
      return;
    }
    /* Phase 10: Relic/Disc cards (Treasure node offers, item_offers.js) --
       no slot/level either, same reduced layout as a Duo card above. */
    if (cand.kind === 'relic' || cand.kind === 'disc') {
      const it = cand.kind === 'relic' ? cand.relic : cand.disc;
      const accent = RARITY_COLOR[it.rarity] || PAL.gray;
      cardFrame(g, r, accent);
      text(g, (it.rarity || cand.kind).toUpperCase(), r.x + r.w / 2, r.y + 6, { scale: 1, align: 'center', color: accent });
      text(g, cand.kind.toUpperCase(), r.x + r.w / 2, r.y + 16, { scale: 1, align: 'center', color: '#8A93B8' });
      let y = paragraph(g, it.name.toUpperCase(), r.x + 6, r.y + 28, r.w - 12, { scale: 1, color: '#FFE86A' });
      y += 13;
      paragraph(g, it.desc, r.x + 6, y, r.w - 12, { scale: 1, color: '#DCE2FF' });
      if (it.tradeoff) paragraph(g, 'RISK: ' + it.tradeoff, r.x + 6, r.y + r.h - 14, r.w - 12, { scale: 1, color: '#FF9955' });
      return;
    }
    const frag = cand.frag;
    const accent = RARITY_COLOR[frag.rarity] || PAL.gray;
    cardFrame(g, r, accent);
    text(g, frag.rarity.toUpperCase(), r.x + r.w / 2, r.y + 6, { scale: 1, align: 'center', color: accent });
    text(g, frag.donor.replace(/_/g, ' ').toUpperCase(), r.x + r.w / 2, r.y + 16, { scale: 1, align: 'center', color: '#8A93B8' });
    let y = paragraph(g, frag.name.toUpperCase(), r.x + 6, r.y + 28, r.w - 12, { scale: 1, color: '#FFE86A' });
    y += 2;
    const levelLabel = cand.isUpgrade ? `LV ${cand.level} (UPGRADE)` : `LV ${cand.level}`;
    text(g, SLOT_LABEL[frag.slot] + ' - ' + levelLabel, r.x + 6, y, { scale: 1, color: '#5FA8C8' });
    y += 11;
    y = paragraph(g, frag.levelDesc[cand.level - 1], r.x + 6, y, r.w - 12, { scale: 1, color: '#DCE2FF' });

    const owned = runState.fragmentsBySlot[frag.slot];
    const overwrites = owned && owned.id !== frag.id;
    if (overwrites) {
      const prevName = FRAGMENTS[owned.id].name;
      paragraph(g, 'OVERWRITES ' + prevName.toUpperCase(), r.x + 6, r.y + r.h - 28, r.w - 12,
        { scale: 1, color: '#FF6B6B' });
    }
    if (frag.tradeoff) {
      paragraph(g, 'RISK: ' + frag.tradeoff, r.x + 6, r.y + r.h - 14, r.w - 12, { scale: 1, color: '#FF9955' });
    }
  });

  text(g, 'CLICK A FRAGMENT', W / 2, H - 14, {
    scale: 1, align: 'center', color: '#C8D0F0', shadow: '#05060C', alpha: 0.6 + 0.4 * Math.sin(tsec * 3)
  });
}

export function pickRewardChoice(mx, my, offer, W) {
  for (let i = 0; i < offer.length; i++) {
    const r = cardRect(i, W, offer.length);
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i;
  }
  return -1;
}

/* Build-summary UI (deliverable 6): every owned slot, its Fragment's
   name and level -- reads straight off runState.fragmentsBySlot, which
   IS the ctx.source attribution the mission asks for (each slot's
   behaviour is caused by exactly the Fragment id stored there; that same
   id is what hooks.js stamps onto every effect/query as ctx.source when
   it fires, per content_registry.js's installFragment). Drawn on the map
   screen, where there's time to read it -- replaces the old RUN_BUFFS
   list that used to occupy this exact corner. */
export function drawBuildSummary(g, x, y, runState) {
  const owned = SLOTS.map(slot => ({ slot, frag: runState.fragmentsBySlot[slot] })).filter(e => e.frag);
  if (!owned.length) return;
  owned.forEach((e, i) => {
    const def = FRAGMENTS[e.frag.id];
    const label = SLOT_LABEL[e.slot] + ': ' + def.name.toUpperCase() + ' Lv' + e.frag.level;
    const tw = textWidth(label, 1);
    const ly = y - owned.length * 12 + i * 12;
    px(g, x, ly, tw + 8, 11, '#080910');
    px(g, x, ly, 2, 11, RARITY_COLOR[def.rarity] || PAL.gray);
    text(g, label, x + 5, ly + 2, { scale: 1, color: '#DCE2FF' });
  });
}
