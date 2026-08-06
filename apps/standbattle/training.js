/* The Training Room (GDD §20). A free-play sandbox: pick any unlocked
   Stand, Aspect, Fragment, Relic and enemy, and fight them, as often as
   you like, at no cost.

   GDD §20 argues this matters more than it sounds -- with 94 Fragments and
   a real execution ceiling, being able to learn a Clash timing without
   burning a 35-minute run is among the highest-retention things the game
   can offer -- and that it is nearly free to build "because everything in
   it already exists". That is exactly what this file is: it assembles a
   `createCombat` call out of the same opts a real node builds, and adds no
   engine surface whatsoever. Every difference from a real fight is a value
   in that opts object, not a code path.

   Two deliberate properties:
   - Nothing here writes the meta blob. A training fight pays no Fate,
     completes no Mission and advances no Bond, because it costs nothing;
     letting it pay anything would make the sandbox the optimal way to
     play.
   - The Training Room's own RNG is seeded from a fixed constant, so a
     drill repeats exactly. Learning a telegraph requires the telegraph to
     be the same twice (invariant 2). */

import { createCombat } from './combat.js';
import { ENEMIES, BOSSES, ENCOUNTERS, STANDS } from './data.js';
import { FRAGMENT_LIST, FRAGMENTS } from './fragments.js';
import { RELIC_LIST } from './relics.js';
import { ASPECTS, aspectsForStand, defaultAspectFor } from './aspects.js';
import { createRng } from './rng.js';
import { createMenaceProfile } from './meta_menace.js';
import { px } from './draw.js';
import { text } from './font.js';
import { backdrop, frame, backButton, hit, rowList, clampTop, wrap, ROW_H, HUB_TEXT, HUB_DIM, HUB_GOLD, HUB_LINE, HUB_INK } from './hub_ui.js';

const TRAINING_SEED = 'training-room';

export const TRAINING_TABS = Object.freeze(['STAND', 'ASPECT', 'FRAGMENTS', 'RELICS', 'OPPONENT']);

export function createTrainingState(meta) {
  const standId = meta.lastStandId || 'star_platinum';
  return {
    tab: 0, top: 0,
    standId,
    aspectId: (meta.loadout && meta.loadout[standId] && meta.loadout[standId].aspectId) || (defaultAspectFor(standId) || {}).id || null,
    fragments: [], // [{id, level}]
    relics: [],
    opponent: { kind: 'enemy', id: 'morioh_thug' },
    menacePact: {}
  };
}

/* What the room may offer -- gated by Track A's unlock sets exactly like
   the real rack is, so the sandbox never spoils content the Archive has
   not opened. Strings only, as everywhere on that side of the firewall. */
export function trainingOptions(state, unlocks) {
  switch (TRAINING_TABS[state.tab]) {
    case 'STAND':
      return Object.values(STANDS).filter(s => unlocks.stands.has(s.id))
        .map(s => ({ id: s.id, label: s.standName.toUpperCase(), right: s.controlScheme.toUpperCase() }));
    case 'ASPECT':
      return aspectsForStand(state.standId).map(a => ({
        id: a.id, label: a.name, right: unlocks.aspects.has(a.id) ? '' : 'LOCKED',
        locked: !unlocks.aspects.has(a.id)
      }));
    case 'FRAGMENTS':
      return FRAGMENT_LIST.filter(f => unlocks.donors.has(f.donor)).map(f => ({
        id: f.id, label: f.name, right: f.slot.toUpperCase(),
        on: state.fragments.some(x => x.id === f.id)
      }));
    case 'RELICS':
      return RELIC_LIST.map(r => ({ id: r.id, label: r.name, right: r.rarity.toUpperCase(), on: state.relics.includes(r.id) }));
    default:
      return [
        ...Object.values(ENEMIES).map(e => ({ id: e.id, kind: 'enemy', label: (e.name || e.id).toUpperCase(), right: 'ENEMY' })),
        ...Object.values(ENCOUNTERS).map(e => ({ id: e.id, kind: 'encounter', label: (e.label || e.id).toUpperCase(), right: 'CROWD' })),
        ...Object.values(BOSSES).map(b => ({ id: b.id, kind: 'boss', label: (b.name || b.standName || b.id).toUpperCase(), right: 'BOSS' }))
      ];
  }
}

/* Toggling a row. Fragments and Relics are multi-select; Stand, Aspect and
   opponent are single. Fragments cycle 0 -> L1 -> L2 -> L3 -> off, because
   testing a Fragment at level 3 is most of why the room exists. */
export function toggleTrainingOption(state, option) {
  const tab = TRAINING_TABS[state.tab];
  if (tab === 'STAND') {
    state.standId = option.id;
    state.aspectId = (defaultAspectFor(option.id) || {}).id || null;
  } else if (tab === 'ASPECT') {
    if (!option.locked) state.aspectId = option.id;
  } else if (tab === 'FRAGMENTS') {
    const cur = state.fragments.find(x => x.id === option.id);
    const def = FRAGMENTS[option.id];
    if (!cur) state.fragments = [...state.fragments.filter(x => FRAGMENTS[x.id].slot !== def.slot), { id: option.id, level: 1 }];
    else if (cur.level < 3) cur.level += 1;
    else state.fragments = state.fragments.filter(x => x.id !== option.id);
  } else if (tab === 'RELICS') {
    state.relics = state.relics.includes(option.id)
      ? state.relics.filter(x => x !== option.id) : [...state.relics, option.id];
  } else {
    state.opponent = { kind: option.kind, id: option.id };
  }
}

/* The whole integration: one createCombat call, the same shape
   run_flow.js's startCombatForNode builds. */
export function startTrainingFight(state) {
  const target = state.opponent.kind === 'boss' ? BOSSES[state.opponent.id]
    : state.opponent.kind === 'encounter' ? ENCOUNTERS[state.opponent.id]
      : ENEMIES[state.opponent.id];
  const combat = createCombat(target, state.fragments, {
    shakeEnabled: true, standId: state.standId, aspectId: state.aspectId,
    relics: state.relics, menace: createMenaceProfile(state.menacePact)
  }, createRng(TRAINING_SEED));
  combat.isTraining = true;
  return combat;
}

const LIST_X = 8, LIST_Y = 46, LIST_W = 230, MAX_ROWS = 12;

export function drawTraining(g, W, H, state, unlocks, tsec) {
  backdrop(g, W, H, tsec);
  px(g, 0, 0, W, 16, HUB_INK);
  px(g, 0, 16, W, 1, HUB_LINE);
  text(g, 'TRAINING ROOM — NOTHING HERE COSTS ANYTHING', 6, 5, { scale: 1, color: HUB_GOLD });

  TRAINING_TABS.forEach((tab, i) => {
    const x = 8 + i * 74;
    const on = i === state.tab;
    frame(g, x, 24, 70, 13, on ? HUB_GOLD : HUB_LINE);
    text(g, tab, x + 5, 27, { scale: 1, color: on ? HUB_GOLD : HUB_DIM });
  });

  const options = trainingOptions(state, unlocks);
  state.top = clampTop(state.top, options.length, MAX_ROWS);
  const rows = options.map(o => {
    const frag = state.fragments.find(x => x.id === o.id);
    const chosen = o.id === state.standId || o.id === state.aspectId || o.id === state.opponent.id
      || state.relics.includes(o.id) || !!frag;
    return {
      label: (chosen ? '* ' : '  ') + o.label + (frag ? ` L${frag.level}` : ''),
      right: o.right, locked: o.locked, accent: chosen ? HUB_GOLD : HUB_LINE
    };
  });
  rowList(g, LIST_X, LIST_Y, LIST_W, rows, state.top, MAX_ROWS);

  const px0 = LIST_X + LIST_W + 14;
  frame(g, px0, LIST_Y, W - px0 - 8, MAX_ROWS * ROW_H, HUB_LINE);
  const stand = STANDS[state.standId];
  const aspect = ASPECTS[state.aspectId];
  let y = LIST_Y + 6;
  text(g, 'LOADOUT', px0 + 6, y, { scale: 1, color: HUB_GOLD }); y += 12;
  text(g, stand ? stand.standName.toUpperCase() : '-', px0 + 6, y, { scale: 1, color: HUB_TEXT }); y += 9;
  text(g, aspect ? aspect.name : 'NO ASPECT', px0 + 6, y, { scale: 1, color: '#7FC8FF' }); y += 11;
  if (aspect) { wrap(aspect.desc, 26).forEach(ln => { text(g, ln, px0 + 6, y, { scale: 1, color: HUB_DIM }); y += 8; }); }
  y += 4;
  text(g, `FRAGMENTS ${state.fragments.length}/9`, px0 + 6, y, { scale: 1, color: HUB_TEXT }); y += 9;
  text(g, `RELICS ${state.relics.length}`, px0 + 6, y, { scale: 1, color: HUB_TEXT }); y += 11;
  text(g, 'OPPONENT', px0 + 6, y, { scale: 1, color: HUB_GOLD }); y += 9;
  text(g, String(state.opponent.id).toUpperCase().replace(/_/g, ' '), px0 + 6, y, { scale: 1, color: HUB_TEXT });

  frame(g, W - 96, H - 15, 88, 12, '#5FD672');
  text(g, 'FIGHT  [ENTER]', W - 92, H - 12, { scale: 1, color: '#5FD672' });
  backButton(g, W, H);
  text(g, 'CLICK A FRAGMENT AGAIN TO LEVEL IT. THE DRILL REPEATS EXACTLY.',
    W / 2, H - 26, { scale: 1, align: 'center', color: HUB_DIM });
}

export function pickTraining(mx, my, W, H, state, unlocks) {
  if (hit({ x: 4, y: H - 14, w: 76, h: 11 }, mx, my)) return { type: 'back' };
  if (hit({ x: W - 96, y: H - 15, w: 88, h: 12 }, mx, my)) return { type: 'fight' };
  for (let i = 0; i < TRAINING_TABS.length; i++) {
    if (hit({ x: 8 + i * 74, y: 24, w: 70, h: 13 }, mx, my)) { state.tab = i; state.top = 0; return { type: 'tab' }; }
  }
  const options = trainingOptions(state, unlocks);
  const idx = Math.floor((my - LIST_Y) / ROW_H) + state.top;
  if (my >= LIST_Y && mx >= LIST_X && mx < LIST_X + LIST_W && idx >= 0 && idx < options.length
    && my < LIST_Y + MAX_ROWS * ROW_H) {
    toggleTrainingOption(state, options[idx]);
    return { type: 'toggle' };
  }
  return null;
}

export function scrollTraining(state, by, unlocks) {
  state.top = clampTop(state.top + by, trainingOptions(state, unlocks).length, MAX_ROWS);
}
