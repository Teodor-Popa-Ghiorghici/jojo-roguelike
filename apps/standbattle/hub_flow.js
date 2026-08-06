/* Hub scene dispatch — the same job run_flow.js does for the map, for the
   hub's seven screens. It lives here rather than in index.js for the
   reason index.js's own header gives: index.js stays the thin mount/
   unmount + render-dispatch + click-dispatch shell the app contract
   expects, and Phase 10 would otherwise have doubled the length of its two
   if/else chains.

   GDD §20's hard rule is enforced here: `hubAction` turns a click on
   LAUNCH into a run start immediately, with no intervening confirm, no
   forced dialogue and no station that must be visited first -- so hub
   spawn to run start is two clicks and no waiting. `hubKey` gives every
   screen the same one-key escape, which is what "every line of dialogue is
   skippable with one key" means in a hub with no modal dialogue at all. */

import { drawHub, pickHubStation, launchLoadout } from './hub.js';
import { drawArchiveTerminal, pickArchiveTerminal, drawMenaceBoard, pickMenaceBoard } from './hub_panels.js';
import {
  drawBondRoom, pickBondRoom, drawMissionBoard, pickMissionBoard, drawStandRack, pickStandRack
} from './hub_panels_b.js';
import { drawTraining, pickTraining, scrollTraining, createTrainingState, startTrainingFight } from './training.js';
import { drawContinued } from './scene_continued.js';
import { applyArchiveUnlocks } from './meta_archive.js';
import { purchaseNode } from './meta_fate.js';

export const HUB_SCENES = ['hub', 'rack', 'terminal', 'menace', 'bonds', 'missions', 'training', 'continued'];

export function isHubScene(scene) { return HUB_SCENES.includes(scene); }

export function createHubState(meta) {
  return {
    ui: { top: 0, sel: 0, standId: meta.lastStandId || 'star_platinum' },
    training: createTrainingState(meta),
    unlocks: applyArchiveUnlocks(meta.archive)
  };
}

/* Recomputed from `purchased` after every buy rather than mutated in
   place -- meta_archive.js's apply path is a pure function of the meta
   blob, so re-deriving is both correct and cheap. */
export function refreshUnlocks(hub, meta) {
  hub.unlocks = applyArchiveUnlocks(meta.archive);
  return hub.unlocks;
}

export function drawHubScene(g, W, H, state, env, tsec) {
  const hub = state.hub;
  const meta = env.meta;
  switch (state.scene) {
    case 'hub': drawHub(g, W, H, meta, tsec); return true;
    case 'rack': drawStandRack(g, W, H, meta, hub.unlocks, hub.ui, tsec); return true;
    case 'terminal': drawArchiveTerminal(g, W, H, meta, hub.unlocks, hub.ui, tsec); return true;
    case 'menace': drawMenaceBoard(g, W, H, meta, hub.unlocks, hub.ui, tsec); return true;
    case 'bonds': drawBondRoom(g, W, H, meta, hub.unlocks, hub.ui, tsec); return true;
    case 'missions': drawMissionBoard(g, W, H, meta, hub.unlocks, hub.ui, tsec); return true;
    case 'training': drawTraining(g, W, H, hub.training, hub.unlocks, tsec); return true;
    case 'continued': drawContinued(g, W, H, state.summary, tsec); return true;
    default: return false;
  }
}

/* Returns 'launch' when the caller should start a run, 'train' when it
   should enter a training fight, true when the click was handled, and
   false when this scene is not a hub scene at all. */
export function hubClick(state, env, mx, my, W, H) {
  const hub = state.hub;
  const meta = env.meta;
  const persist = () => env.saveStore.saveMeta(meta);

  if (state.scene === 'hub') {
    const station = pickHubStation(mx, my, W, H);
    if (!station) return true;
    if (station === 'launch') return 'launch';
    hub.ui.top = 0; hub.ui.sel = 0;
    hub.ui.standId = meta.lastStandId || hub.ui.standId;
    state.scene = station === 'menace' ? 'menace' : station;
    return true;
  }
  if (state.scene === 'continued') { state.scene = 'hub'; return true; }
  if (state.scene === 'training') {
    const act = pickTraining(mx, my, W, H, hub.training, hub.unlocks);
    if (act && act.type === 'back') state.scene = 'hub';
    else if (act && act.type === 'fight') return 'train';
    return true;
  }

  const pickers = {
    rack: pickStandRack, terminal: pickArchiveTerminal, menace: pickMenaceBoard,
    bonds: pickBondRoom, missions: pickMissionBoard
  };
  const pick = pickers[state.scene];
  if (!pick) return false;
  const action = pick(mx, my, W, H, meta, hub.unlocks, hub.ui);
  if (!action) return true;
  if (action.type === 'back') state.scene = 'hub';
  else if (action.type === 'purchase') {
    /* The one place Fate is spent. purchaseNode records the node id;
       the unlock sets are then re-derived from that list, never patched. */
    if (purchaseNode(meta.fate, meta.archive, action.nodeId)) { refreshUnlocks(hub, meta); persist(); }
  } else if (action.type === 'loadout' || action.type === 'menace') {
    meta.lastStandId = action.standId || meta.lastStandId;
    persist();
  }
  return true;
}

/* One key, every screen. ESC backs out; on the hub itself it is inert
   rather than quitting, because losing the hub to a stray keypress would
   be exactly the toll booth GDD §20 forbids. */
export function hubKey(state, env, code) {
  const hub = state.hub;
  if (code === 'Escape') {
    if (state.scene === 'hub') return true;
    state.scene = state.scene === 'continued' ? 'hub' : 'hub';
    return true;
  }
  if (state.scene === 'training' && code === 'Enter') return 'train';
  if (code === 'ArrowDown' || code === 'ArrowUp') {
    const by = code === 'ArrowDown' ? 1 : -1;
    if (state.scene === 'training') scrollTraining(hub.training, by, hub.unlocks);
    else hub.ui.top = Math.max(0, hub.ui.top + by);
    return true;
  }
  return false;
}

export { launchLoadout, startTrainingFight };
