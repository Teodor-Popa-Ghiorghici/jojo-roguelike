/* Stand Battle Arena — app entry. Ties data/combat/render/map together
   behind the TempleOS app contract (mount/unmount, ctx-only I/O). Node-
   resolution/transition logic lives in run_flow.js (Phase 8) so this
   file stays the thin mount/unmount + render-dispatch + click-dispatch
   shell the app contract expects. */

import { drawCombat } from './render.js';
import { drawMap, pickNode, drawEvent, pickChoice } from './map.js';
import { drawRest, restChoices, pickRestChoice, pickRestLeave } from './rest.js';
import { drawShop, pickShopAction } from './shop.js';
import { drawArchiveStub, pickArchiveContinue } from './archive_stub.js';
import { drawReward, pickRewardChoice } from './rewards.js';
import { drawTitle } from './scenes.js'; // drawComplete retired: both outcomes now land on scene_continued.js (GDD §9.5)
import { drawStandSelect, pickStand } from './standselect.js';
import {
  createFreshRunState, resolveNodeEntry, commitNode, onCombatWin, onCombatFled, finishRunLoss,
  persistRun
} from './run_flow.js';
import {
  applyRewardChoice, applyEventChoice, applyRestChoice, applyShopAction
} from './run_choices.js';
import { sfxVictory, sfxDefeat } from './audio.js';
import { musicStart, musicSetIntensity, musicStop } from './music.js';
import { createSaveStore, ensureMetaProgress } from './save.js';
/* Phase 10: the hub and its six stations, the Training Room and the
   TO BE CONTINUED screen all dispatch through hub_flow.js, so this file's
   two if/else chains gain one branch each rather than eight. */
import {
  createHubState, isHubScene, drawHubScene, hubClick, hubKey, launchLoadout, startTrainingFight
} from './hub_flow.js';
import { createRng } from './rng.js';
import { createInputSystem } from './input.js';
import { mountAccessibilityBar } from './settings_panel.js';
import { challengeLoadout, dailySeedId, weeklySeedId } from './daily_seed.js';

const W = 480, H = 270;

export default {
  id: 'standbattle',
  title: 'STANDBATTLE.EXE',
  icon: 'assets/images/standbattle.png',
  width: 1000,
  height: 620,
  resizable: true,

  async mount(root, ctx) {
    this._closed = false;
    const saveStore = createSaveStore(ctx);
    const meta = ensureMetaProgress(await saveStore.loadMeta());
    const savedRun = await saveStore.loadRun();
    /* unmount() can fire while these awaits are still pending -- wm.js
       calls mount() without awaiting it, and a close click resolves
       synchronously in the same tick. Bail before touching the DOM/rAF/
       audio so a fast open-then-close never leaves an orphaned frame
       loop or music engine running after the window is gone. */
    if (this._closed) return;

    const state = {
      scene: 'title', runState: null, runRng: null, combat: null,
      currentEvent: null, currentOffer: null, shop: null,
      enteringNodeId: null, combatStartTsec: 0,
      hub: null, summary: null, trainingCombat: false
    };
    state.hub = createHubState(meta);
    let shakeEnabled = meta.shakeEnabled !== false;
    const cleared = !!meta.cleared;
    const input = createInputSystem(meta.keymap, !!meta.projectToggleMode);
    let debugEnabled = false;
    const env = {
      ctx, saveStore, meta, tsec: 0, shakeEnabled, debugEnabled,
      flashEnabled: meta.flashEnabled !== false, reduceParticles: !!meta.reduceParticles
    };

    /* map.js reads graph.nodes/edges/paths unconditionally -- a save whose
       graph is missing any of those (e.g. hand-edited, or truncated by a
       storage failure mid-write) must fall through to a fresh run here,
       not crash drawMap on the first frame it's resumed into. */
    if (savedRun && savedRun.graph && Array.isArray(savedRun.graph.edges) && Array.isArray(savedRun.graph.paths)
      && savedRun.graph.nodes[savedRun.nodeId]) {
      /* Resuming mid-run loses at most the node in progress -- combat
         state itself is never persisted, only the map-scene checkpoint. */
      state.runState = savedRun;
      state.runRng = createRng(savedRun.seed);
      state.scene = 'map';
    }

    const pane = document.createElement('div');
    pane.className = 'gamepane sbpane';
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.className = 'gamecv sbcanvas';
    cv.tabIndex = 0;
    pane.appendChild(cv);

    const bar = document.createElement('div');
    bar.className = 'appbar';
    const shakeBtn = document.createElement('button');
    shakeBtn.className = 'appbtn';
    const debugBtn = document.createElement('button');
    debugBtn.className = 'appbtn';
    const info = document.createElement('span');
    info.className = 'godword sbinfo';
    bar.appendChild(shakeBtn);
    bar.appendChild(debugBtn);
    bar.appendChild(info);

    root.appendChild(pane);
    root.appendChild(bar);

    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;

    /* integer scale only (§11) -- fit both axes, never a fractional blow-up */
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

    function updateShakeBtn() { shakeBtn.textContent = 'SHAKE: ' + (shakeEnabled ? 'ON' : 'OFF'); }
    updateShakeBtn();
    shakeBtn.addEventListener('mousedown', ev => {
      ev.stopPropagation();
      shakeEnabled = !shakeEnabled;
      env.shakeEnabled = shakeEnabled;
      if (state.combat) state.combat.juice.setShakeEnabled(shakeEnabled);
      meta.shakeEnabled = shakeEnabled;
      saveStore.saveMeta(meta);
      updateShakeBtn();
      if (window.Snd) window.Snd.click();
    });

    /* Debug overlay toggle (tech §2.4/§2.5 deliverable 8): hitboxes,
       hurtboxes, current frame, active windows, poise, i-frames. */
    function updateDebugBtn() { debugBtn.textContent = 'DEBUG: ' + (debugEnabled ? 'ON' : 'OFF'); }
    updateDebugBtn();
    debugBtn.addEventListener('mousedown', ev => {
      ev.stopPropagation();
      debugEnabled = !debugEnabled;
      env.debugEnabled = debugEnabled;
      if (state.combat) state.combat.debug = debugEnabled;
      updateDebugBtn();
      if (window.Snd) window.Snd.click();
    });

    /* GDD §20's under-8-seconds rule lands here: `launch()` is reachable
       in one click from hub spawn and does everything a run needs -- no
       confirmation step, no station that must be visited first. */
    function newRun(loadout, seedOverride) {
      const seed = seedOverride || (Date.now() + '-' + Math.floor(Math.random() * 1e9));
      state.runRng = createRng(seed);
      state.runState = createFreshRunState(seed, state.runRng, loadout.standId, loadout);
      state.trainingCombat = false;
      state.scene = 'map';
      persistRun(state, env);
    }
    function launch() { newRun(launchLoadout(meta, state.hub.unlocks)); }
    /* GDD §21 deliverable 2: same one-click launch, a fixed seed instead
       of a random one -- challengeLoadout(seedId) derives Stand/Aspect/
       Menace straight from the seed string, so every player who launches
       today's (or this week's) challenge gets the identical run. */
    function launchChallenge(seedId) { newRun(challengeLoadout(seedId), seedId); }

    /* GDD §21: flash/particles/Ripple Assist/Project mode toggles, key
       rebinding, and the Daily/Weekly challenge launchers + leaderboard,
       all split into settings_panel.js so this file stays the thin mount
       shell. */
    const accessibilityBar = mountAccessibilityBar(bar, pane, {
      meta, saveStore, env, input, state, ctx,
      onLaunchDaily: () => { if (isHubScene(state.scene)) { launchChallenge(dailySeedId()); if (window.Snd) window.Snd.select(); } },
      onLaunchWeekly: () => { if (isHubScene(state.scene)) { launchChallenge(weeklySeedId()); if (window.Snd) window.Snd.select(); } }
    });

    function enterTraining() {
      state.combat = startTrainingFight(state.hub.training);
      state.combat.debug = env.debugEnabled;
      state.trainingCombat = true;
      state.combatStartTsec = tsec;
      state.scene = 'combat';
    }

    function canvasXY(ev) {
      const r = cv.getBoundingClientRect();
      return { mx: (ev.clientX - r.left) * (W / r.width), my: (ev.clientY - r.top) * (H / r.height) };
    }

    function handleClick(ev) {
      const { mx, my } = canvasXY(ev);
      if (state.scene === 'title') { state.scene = 'hub'; if (window.Snd) window.Snd.open(); }
      else if (isHubScene(state.scene)) {
        const r = hubClick(state, env, mx, my, W, H);
        if (r === 'launch') { launch(); if (window.Snd) window.Snd.select(); }
        else if (r === 'train') { enterTraining(); if (window.Snd) window.Snd.select(); }
        else if (window.Snd) window.Snd.click();
      }
      else if (state.scene === 'standselect') {
        const standId = pickStand(mx, my, W, H);
        if (standId) { newRun({ standId, donors: [...state.hub.unlocks.donors] }); if (window.Snd) window.Snd.select(); }
      }
      else if (state.scene === 'map') {
        const id = pickNode(mx, my, state.runState.graph, state.runState, W);
        if (id) { resolveNodeEntry(state, id, env); if (window.Snd) window.Snd.select(); }
      } else if (state.scene === 'event') {
        const idx = pickChoice(mx, my, state.currentEvent, W, H);
        if (idx >= 0) { if (window.Snd) window.Snd.chirp(); applyEventChoice(state, idx, env); }
      } else if (state.scene === 'rest') {
        const choices = restChoices(state.runState);
        const idx = pickRestChoice(mx, my, choices, W, H);
        if (idx >= 0) { if (window.Snd) window.Snd.ok(); applyRestChoice(state, choices[idx].id, env); }
        else if (pickRestLeave(mx, my, W, H)) { if (window.Snd) window.Snd.ok(); commitNode(state, env); }
      } else if (state.scene === 'shop') {
        const action = pickShopAction(mx, my, state.runState, state.shop, W, H);
        if (action) { if (window.Snd) window.Snd.select(); applyShopAction(state, action, env); }
      } else if (state.scene === 'archive') {
        if (pickArchiveContinue(mx, my, W, H)) { if (window.Snd) window.Snd.ok(); commitNode(state, env); }
      } else if (state.scene === 'combat' && state.combat.outcome !== 'fighting') {
        /* A training fight settles nothing: it pays no Fate, completes no
           Mission and advances no Bond, because it cost nothing. */
        if (state.trainingCombat) { state.combat = null; state.trainingCombat = false; state.scene = 'training'; }
        else if (state.combat.outcome === 'win') onCombatWin(state, env);
        else if (state.combat.outcome === 'fled') onCombatFled(state, env);
        else finishRunLoss(state, env);
      } else if (state.scene === 'reward') {
        const idx = pickRewardChoice(mx, my, state.currentOffer, W);
        if (idx >= 0) { if (window.Snd) window.Snd.select(); applyRewardChoice(state, idx, env); }
      }
    }

    function onKey(ev, down) {
      /* The one-key skip (GDD §20) is checked before the input map, so it
         works on every hub screen regardless of the player's keybinds. */
      if (down && isHubScene(state.scene)) {
        const r = hubKey(state, env, ev.code);
        if (r) { ev.preventDefault(); ev.stopPropagation(); if (r === 'train') enterTraining(); return; }
      }
      const resolved = input.resolveKey(ev.code, down);
      if (!resolved) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (state.scene === 'combat' && state.combat) state.combat.setKey(resolved.action, down);
    }
    cv.addEventListener('keydown', ev => onKey(ev, true));
    cv.addEventListener('keyup', ev => onKey(ev, false));
    cv.addEventListener('mousedown', ev => { ev.stopPropagation(); cv.focus(); handleClick(ev); });
    setTimeout(() => cv.focus(), 0);

    let raf = null, t0 = performance.now(), tsec = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      input.tick();
      const dt = Math.min(50, now - t0);
      t0 = now;
      tsec += dt / 1000;
      env.tsec = tsec;
      if (drawHubScene(g, W, H, state, env, tsec)) { /* hub, its stations, training, TO BE CONTINUED */ }
      else if (state.scene === 'combat') {
        const c = state.combat;
        c.update(dt);
        if (c.outcome === 'fighting') {
          const tense = c.player.hp / c.player.maxHp < 0.3 || (c.isBoss && c.enemy.phaseIndex > 0);
          musicSetIntensity(tense ? 2 : 1);
        } else if (!c._announced) {
          c._announced = true;
          musicSetIntensity(0);
          if (c.outcome === 'win') sfxVictory(); else if (c.outcome !== 'fled') sfxDefeat();
        }
        const activeNode = state.runState && state.runState.graph.nodes[state.enteringNodeId];
        drawCombat(g, W, H, c, tsec, dt, activeNode && activeNode.scene);
      }
      else if (state.scene === 'map') drawMap(g, W, H, state.runState.graph, state.runState, tsec);
      else if (state.scene === 'reward') drawReward(g, W, H, state.currentOffer, state.runState, tsec);
      else if (state.scene === 'event') drawEvent(g, W, H, state.currentEvent, tsec);
      else if (state.scene === 'rest') drawRest(g, W, H, state.runState, restChoices(state.runState), tsec);
      else if (state.scene === 'shop') drawShop(g, W, H, state.runState, state.shop, tsec);
      else if (state.scene === 'archive') drawArchiveStub(g, W, H, tsec);
      else if (state.scene === 'title') drawTitle(g, W, H, tsec, cleared);
      else if (state.scene === 'standselect') drawStandSelect(g, W, H, tsec);

      info.textContent = state.scene === 'combat'
        ? 'A/D MOVE  W/S DEPTH  J/K/L ATTACK  SPACE STEP  SHIFT CLASH  G GUARD  U SPECIAL  I RUSH  F PROJECT'
        : 'CLICK TO CONTINUE';
    }
    raf = requestAnimationFrame(frame);
    musicStart();
    musicSetIntensity(0);

    this._cleanup = () => { cancelAnimationFrame(raf); ro.disconnect(); musicStop(); accessibilityBar.destroy(); };
    if (this._closed) { this._cleanup(); this._cleanup = null; }
  },

  unmount() {
    this._closed = true;
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
  }
};
