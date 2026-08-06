/* Accessibility settings bar -- GDD §21, Phase 12. Split out of index.js so
   the mount shell stays thin (CLAUDE.md). Every toggle here follows the
   exact pattern index.js's own SHAKE/DEBUG buttons already established:
   flip a local var, mirror it onto `env` (read by run_flow.js's
   startCombatForNode when building the next fight's opts), push it live
   onto the CURRENT fight if one is open, and persist it onto `meta`. */

import { DEFAULT_KEYMAP } from './input.js';
import { dailySeedId, weeklySeedId, loadChallengeLeaderboard } from './daily_seed.js';

const ACTIONS = [...new Set(Object.values(DEFAULT_KEYMAP))];
const LABELS = { left: 'LEFT', right: 'RIGHT', forward: 'FWD', back: 'BACK',
  light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY', dodge: 'STEP', parry: 'CLASH',
  special: 'SPECIAL', rush: 'RUSH', guard: 'GUARD', project: 'PROJECT',
  command: 'COMMAND', flee: 'FLEE' };

function btn(bar, text) {
  const b = document.createElement('button');
  b.className = 'appbtn';
  b.textContent = text;
  bar.appendChild(b);
  return b;
}

function toggleBtn(bar, label, initial, onChange) {
  const b = btn(bar, '');
  let on = initial;
  const paint = () => { b.textContent = label + ': ' + (on ? 'ON' : 'OFF'); };
  paint();
  b.addEventListener('mousedown', ev => {
    ev.stopPropagation();
    on = !on;
    paint();
    onChange(on);
    if (window.Snd) window.Snd.click();
  });
  return { set: v => { on = v; paint(); } };
}

/* Key-rebind overlay: click REBIND, then a row, then press a key. One
   listener captures the very next keydown while `waiting` is set -- no new
   input-buffering path, this never touches the ring buffer combat reads. */
function buildRebindPanel(pane, input, meta, saveStore) {
  const panel = document.createElement('div');
  panel.className = 'sb-rebind-panel';
  panel.style.cssText = 'display:none;position:absolute;top:0;left:0;right:0;bottom:0;' +
    'background:rgba(0,0,0,0.85);color:#FFFFFF;overflow:auto;padding:8px;z-index:5;font-family:monospace;';
  pane.appendChild(panel);

  let waiting = null;
  function codesFor(action) {
    return Object.entries(input.keymap).filter(([, a]) => a === action).map(([c]) => c);
  }
  function render() {
    panel.innerHTML = '';
    const close = btn(panel, 'CLOSE');
    close.style.display = 'block';
    close.addEventListener('mousedown', ev => { ev.stopPropagation(); panel.style.display = 'none'; });
    ACTIONS.forEach(action => {
      const row = document.createElement('div');
      row.style.cssText = 'margin:4px 0;';
      const codes = codesFor(action);
      const rowBtn = btn(row, (LABELS[action] || action) + ': ' + (codes.join(', ') || '(unbound)'));
      rowBtn.addEventListener('mousedown', ev => {
        ev.stopPropagation();
        waiting = action;
        rowBtn.textContent = (LABELS[action] || action) + ': PRESS A KEY...';
      });
      panel.appendChild(row);
    });
  }
  document.addEventListener('keydown', ev => {
    if (!waiting || panel.style.display === 'none') return;
    ev.preventDefault(); ev.stopPropagation();
    input.rebind(ev.code, waiting);
    meta.keymap = { ...input.keymap };
    saveStore.saveMeta(meta);
    waiting = null;
    render();
  }, true);
  return {
    open() { render(); panel.style.display = 'block'; }
  };
}

function buildLeaderboardPanel(pane, ctx) {
  const panel = document.createElement('div');
  panel.style.cssText = 'display:none;position:absolute;top:0;left:0;right:0;bottom:0;' +
    'background:rgba(0,0,0,0.85);color:#FFFFFF;overflow:auto;padding:8px;z-index:5;font-family:monospace;';
  pane.appendChild(panel);
  async function render() {
    panel.innerHTML = '';
    const close = btn(panel, 'CLOSE');
    close.style.display = 'block';
    close.addEventListener('mousedown', ev => { ev.stopPropagation(); panel.style.display = 'none'; });
    for (const [label, seedId] of [['DAILY', dailySeedId()], ['WEEKLY', weeklySeedId()]]) {
      const h = document.createElement('div');
      h.textContent = label + ' -- ' + seedId;
      h.style.cssText = 'margin-top:10px;font-weight:bold;';
      panel.appendChild(h);
      const entries = await loadChallengeLeaderboard(ctx, seedId);
      if (!entries.length) { const e = document.createElement('div'); e.textContent = '(no runs yet)'; panel.appendChild(e); continue; }
      entries.forEach((e, i) => {
        const row = document.createElement('div');
        row.textContent = `${i + 1}. ${e.standId} -- ACT ${e.act} -- ${e.outcome.toUpperCase()} -- HP ${Math.round(e.hp)}`;
        panel.appendChild(row);
      });
    }
  }
  return { open() { render(); panel.style.display = 'block'; } };
}

export function mountAccessibilityBar(bar, pane, { meta, saveStore, env, input, state, ctx, onLaunchDaily, onLaunchWeekly }) {
  toggleBtn(bar, 'FLASH', env.flashEnabled, on => {
    env.flashEnabled = on; meta.flashEnabled = on; saveStore.saveMeta(meta);
    if (state.combat && state.combat._fx) state.combat._fx.setFlashEnabled(on);
  });
  toggleBtn(bar, 'PARTICLES', !env.reduceParticles, full => {
    const reduce = !full;
    env.reduceParticles = reduce; meta.reduceParticles = reduce; saveStore.saveMeta(meta);
    if (state.combat) {
      if (state.combat._fx) state.combat._fx.setReduceParticles(reduce);
      state.combat.juice.setReduceParticles(reduce);
    }
  });
  const assist = meta.assist || (meta.assist = { clash: false, step: false, damage: false });
  ['clash', 'step', 'damage'].forEach(dial => {
    toggleBtn(bar, 'ASSIST-' + dial.toUpperCase(), assist[dial], on => {
      assist[dial] = on; saveStore.saveMeta(meta);
    });
  });
  const projectBtn = btn(bar, '');
  let projectToggleMode = !!meta.projectToggleMode;
  const paintProject = () => { projectBtn.textContent = 'PROJECT: ' + (projectToggleMode ? 'TOGGLE' : 'HOLD'); };
  paintProject();
  projectBtn.addEventListener('mousedown', ev => {
    ev.stopPropagation();
    projectToggleMode = !projectToggleMode;
    meta.projectToggleMode = projectToggleMode; saveStore.saveMeta(meta);
    input.setToggleProject(projectToggleMode);
    paintProject();
    if (window.Snd) window.Snd.click();
  });
  const rebind = buildRebindPanel(pane, input, meta, saveStore);
  const rebindBtn = btn(bar, 'REBIND KEYS');
  rebindBtn.addEventListener('mousedown', ev => { ev.stopPropagation(); rebind.open(); if (window.Snd) window.Snd.click(); });

  const dailyBtn = btn(bar, 'DAILY');
  dailyBtn.addEventListener('mousedown', ev => { ev.stopPropagation(); onLaunchDaily(); });
  const weeklyBtn = btn(bar, 'WEEKLY');
  weeklyBtn.addEventListener('mousedown', ev => { ev.stopPropagation(); onLaunchWeekly(); });
  const leaderboard = buildLeaderboardPanel(pane, ctx);
  const boardBtn = btn(bar, 'LEADERBOARD');
  boardBtn.addEventListener('mousedown', ev => { ev.stopPropagation(); leaderboard.open(); if (window.Snd) window.Snd.click(); });
}
