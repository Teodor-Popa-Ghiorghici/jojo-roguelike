/* Rest — Cafe Deux Magots (GDD §5.3, Phase 8 deliverable 2): a real
   3-choice menu instead of the Phase 0 prototype's single auto-full-heal
   button. GDD also lists a Relic-reroll choice here; dropped for now,
   see phase-8.md's flagged deviation -- no owned-Relic system exists
   yet, so it isn't available to offer. */

import { backdrop, frame, button } from './map.js';
import { px } from './draw.js';
import { text } from './font.js';
import { SLOTS } from './content_registry.js';

/* The slot "upgrade a Fragment" would target: the lowest-level owned,
   non-maxed Fragment (ties broken by slot order) -- GDD §5.3's Rest
   choice auto-targets rather than opening a second picker UI on top of
   this one (a deliberate scope simplification, see phase-8.md). Shared
   with run_flow.js's applyRestChoice so "is this enabled" and "what does
   it actually do" can never disagree. */
export function pickUpgradeSlot(runState) {
  let best = null;
  SLOTS.forEach(slot => {
    const owned = runState.fragmentsBySlot[slot];
    if (owned && owned.level < 3 && (!best || owned.level < runState.fragmentsBySlot[best].level)) best = slot;
  });
  return best;
}

export function restChoices(runState) {
  const missing = runState.maxHp - runState.hp;
  const upgradeSlot = pickUpgradeSlot(runState);
  return [
    { id: 'heal', label: 'REST', enabled: missing > 0, hint: '+' + Math.round(runState.maxHp * 0.6) + ' HP' },
    { id: 'upgrade', label: 'UPGRADE A FRAGMENT', enabled: runState.upgradePoints > 0 && !!upgradeSlot, hint: upgradeSlot ? runState.upgradePoints + ' POINT(S) LEFT' : 'NO ELIGIBLE FRAGMENT' },
    { id: 'tension', label: 'RAISE TENSION', enabled: runState.tension < 5, hint: 'FREE FRAGMENT OFFER' }
  ];
}

function choiceRect(i, total, W, H) {
  const w = 138, h = 30, gap = 10;
  const totalW = total * w + (total - 1) * gap;
  return { x: Math.round(W / 2 - totalW / 2 + i * (w + gap)), y: H - 76, w, h };
}

/* QA-060: heal/upgrade/tension can all be `enabled: false` at once (full
   HP, no upgrade points or every Fragment already maxed, tension already
   at 5) -- shop.js/archive_stub.js both give the player an always-on way
   off the screen (LEAVE/CONTINUE); Rest never did, so that combination
   was a hard screen-trap with no click and no key that did anything. */
function leaveRect(W, H) { return { x: W / 2 - 60, y: H - 34, w: 120, h: 20 }; }

export function drawRest(g, W, H, runState, choices, tsec) {
  backdrop(g, W, H, tsec || 0);
  g.save(); g.globalAlpha = 0.5; px(g, 0, 0, W, H, '#05060C'); g.restore();
  frame(g, 34, 40, W - 68, 106, '#2FA34A');
  text(g, 'CAFE DEUX MAGOTS', W / 2, 52, { scale: 2, align: 'center', color: '#5FD672', outline: '#0E4A22' });
  text(g, 'YOU CATCH YOUR BREATH.', W / 2, 76, { scale: 1, align: 'center', color: '#DCE2FF' });
  text(g, 'HP ' + Math.round(runState.hp) + ' / ' + runState.maxHp, W / 2, 92, { scale: 1, align: 'center', color: '#B6FFC0' });
  choices.forEach((c, i) => {
    const r = choiceRect(i, choices.length, W, H);
    button(g, r, c.label, c.enabled);
    text(g, c.hint, r.x + r.w / 2, r.y + r.h + 3, { scale: 1, align: 'center', color: c.enabled ? '#8A90A8' : '#4A4E5C' });
  });
  button(g, leaveRect(W, H), 'LEAVE', true);
}

export function pickRestChoice(mx, my, choices, W, H) {
  for (let i = 0; i < choices.length; i++) {
    if (!choices[i].enabled) continue;
    const r = choiceRect(i, choices.length, W, H);
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i;
  }
  return -1;
}

/* Always hit-testable regardless of `choices` state -- the one
   guaranteed way out of the Rest screen. */
export function pickRestLeave(mx, my, W, H) {
  const r = leaveRect(W, H);
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}
