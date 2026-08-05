/* Shop — Owson (GDD §5.3/§6.5, Phase 8 deliverable 3). One paid Fragment
   offer plus Yen sinks: heal, reroll, Fragment removal (deck-thinning).
   Render/hit-test only, mirrors rewards.js's card style at a smaller
   scale (there's less room -- four action buttons share the screen with
   the card here) -- the actual Yen math lives in economy.js, the actual
   mutation in run_flow.js.

   `shop` (`{offer: [candidate]|null, removeMode: bool}`) is transient UI
   state owned by index.js/run_flow.js, the same way `currentOffer` is
   for the reward scene -- never stored on `runState` itself, which only
   ever holds what actually needs to survive a save. */

import { px, dither } from './draw.js';
import { text, paragraph } from './font.js';
import { PAL } from './data.js';
import { SLOTS } from './content_registry.js';
import { FRAGMENTS } from './fragments.js';
import { backdrop, frame, button } from './map.js';
import { fragmentPrice, healCost, rerollCost, removalCost, canAfford } from './economy.js';

const RARITY_COLOR = { common: PAL.gray, rare: PAL.lblue, epic: PAL.lmagenta, legendary: PAL.yellow };
const SLOT_LABEL = {
  light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY', special_1: 'SPECIAL', special_2: 'SPECIAL 2',
  rush: 'RUSH', step: 'STEP', clash: 'CLASH', aura: 'AURA'
};

const CARD = { x: 16, y: 32, w: 176, h: 150 };
function actionRect(i) { return { x: 208, y: 34 + i * 38, w: 256, h: 30 }; }
function leaveRect(W, H) { return { x: W / 2 - 60, y: H - 26, w: 120, h: 20 }; }
function removeRowRect(i) { return { x: 60, y: 40 + i * 20, w: 360, h: 17 }; }
function cancelRect(W, H) { return { x: W / 2 - 60, y: H - 26, w: 120, h: 20 }; }

function actionLabel(action, runState, shop) {
  if (action === 'buy') return { label: 'BUY FRAGMENT - ' + fragmentPrice(shop.offer[0].frag.rarity) + ' YEN', cost: fragmentPrice(shop.offer[0].frag.rarity) };
  if (action === 'heal') return { label: 'HEAL TO FULL - ' + healCost(runState.maxHp - runState.hp) + ' YEN', cost: healCost(runState.maxHp - runState.hp) };
  if (action === 'reroll') return { label: 'REROLL OFFER - ' + rerollCost(runState) + ' YEN', cost: rerollCost(runState) };
  if (action === 'remove') return { label: 'REMOVE A FRAGMENT - ' + removalCost(runState) + ' YEN', cost: removalCost(runState) };
  return { label: '', cost: 0 };
}

export function drawShop(g, W, H, runState, shop, tsec) {
  backdrop(g, W, H, tsec || 0);
  g.save(); g.globalAlpha = 0.55; px(g, 0, 0, W, H, '#05060C'); g.restore();
  text(g, 'OWSON', 8, 4, { scale: 2, color: '#B6FFEE', outline: '#0E4A3A' });
  text(g, runState.yen + ' YEN', W - 8, 6, { scale: 2, align: 'right', color: '#FFE86A' });

  if (shop.removeMode) {
    frame(g, 40, 30, W - 80, H - 66, '#2FA38A');
    text(g, 'REMOVE WHICH FRAGMENT?', W / 2, 34, { scale: 1, align: 'center', color: '#B6FFEE' });
    const owned = SLOTS.map(slot => ({ slot, frag: runState.fragmentsBySlot[slot] })).filter(e => e.frag);
    owned.forEach((e, i) => {
      const def = FRAGMENTS[e.frag.id];
      const r = removeRowRect(i);
      px(g, r.x, r.y, r.w, r.h, '#181C30');
      px(g, r.x, r.y, 2, r.h, RARITY_COLOR[def.rarity] || PAL.gray);
      text(g, SLOT_LABEL[e.slot] + ': ' + def.name.toUpperCase() + ' Lv' + e.frag.level, r.x + 6, r.y + 4, { scale: 1, color: '#DCE2FF' });
    });
    button(g, cancelRect(W, H), 'CANCEL', true);
    return;
  }

  const offer = shop.offer && shop.offer[0];
  if (offer) {
    const frag = offer.frag;
    const accent = RARITY_COLOR[frag.rarity] || PAL.gray;
    px(g, CARD.x - 2, CARD.y - 2, CARD.w + 4, CARD.h + 4, '#05060C');
    px(g, CARD.x - 1, CARD.y - 1, CARD.w + 2, CARD.h + 2, accent);
    px(g, CARD.x, CARD.y, CARD.w, CARD.h, '#12141F');
    dither(g, CARD.x, CARD.y, CARD.w, CARD.h, null, '#181C30', 6);
    text(g, frag.rarity.toUpperCase(), CARD.x + CARD.w / 2, CARD.y + 6, { scale: 1, align: 'center', color: accent });
    let y = paragraph(g, frag.name.toUpperCase(), CARD.x + 6, CARD.y + 20, CARD.w - 12, { scale: 1, color: '#FFE86A' });
    y += 2;
    text(g, SLOT_LABEL[frag.slot] + ' - LV ' + offer.level, CARD.x + 6, y, { scale: 1, color: '#5FA8C8' });
    y += 11;
    paragraph(g, frag.levelDesc[offer.level - 1], CARD.x + 6, y, CARD.w - 12, { scale: 1, color: '#DCE2FF' });
    if (frag.tradeoff) paragraph(g, 'RISK: ' + frag.tradeoff, CARD.x + 6, CARD.y + CARD.h - 14, CARD.w - 12, { scale: 1, color: '#FF9955' });
  } else {
    text(g, 'NOTHING LEFT TO OFFER.', CARD.x + CARD.w / 2, CARD.y + CARD.h / 2, { scale: 1, align: 'center', color: '#8A90A8' });
  }

  ['buy', 'heal', 'reroll', 'remove'].forEach((action, i) => {
    if (action === 'buy' && !offer) return;
    const { label, cost } = actionLabel(action, runState, shop);
    button(g, actionRect(i), label, canAfford(runState, cost));
  });
  button(g, leaveRect(W, H), 'LEAVE', true);
}

export function pickShopAction(mx, my, runState, shop, W, H) {
  if (shop.removeMode) {
    const owned = SLOTS.map(slot => ({ slot, frag: runState.fragmentsBySlot[slot] })).filter(e => e.frag);
    for (let i = 0; i < owned.length; i++) {
      const r = removeRowRect(i);
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return { type: 'removeSlot', slot: owned[i].slot };
    }
    const c = cancelRect(W, H);
    if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) return { type: 'removeCancel' };
    return null;
  }
  const offer = shop.offer && shop.offer[0];
  const actions = ['buy', 'heal', 'reroll', 'remove'];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (action === 'buy' && !offer) continue;
    const { cost } = actionLabel(action, runState, shop);
    if (!canAfford(runState, cost)) continue;
    const r = actionRect(i);
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return { type: action };
  }
  const lv = leaveRect(W, H);
  if (mx >= lv.x && mx <= lv.x + lv.w && my >= lv.y && my <= lv.y + lv.h) return { type: 'leave' };
  return null;
}
