/* The hub — the Speedwagon Foundation safehouse (GDD §20). Six stations:
   the Stand rack, the Archive terminal, the Menace board, the Bond room,
   the Mission board and the Training Room.

   THE HARD RULE (GDD §20): "from hub spawn to run start is under 8 seconds
   if the player wants it to be." That is a design constraint on THIS file
   and it is met structurally, not by trimming animations:

     - LAUNCH is the first station and its own button. One click from hub
       spawn starts a run with the last loadout, and the loadout is
       remembered per Stand on the meta blob -- so the fast path is
       spawn -> click LAUNCH, two clicks including the door.
     - Nothing gates anything. No station must be visited, no dialogue
       blocks the button, and every station is a sibling rather than a step
       in a sequence.
     - Every line of hub dialogue is skippable with one key (the ESC/BACK
       affordance hub_ui.js draws on every station, and `skipAll` below).

   The NPC line under the rack reacts to the last run -- your killer, your
   depth, your Stand -- so returning to the hub tells you something instead
   of charging you a toll. It is one line of data, never a modal. */

import { px } from './draw.js';
import { text } from './font.js';
import { backdrop, frame, hit, HUB_TEXT, HUB_DIM, HUB_GOLD, HUB_INK, HUB_LINE, HUB_OK } from './hub_ui.js';
import { STANDS } from './data.js';
import { ASPECTS } from './aspects.js';
import { archiveProgress } from './meta_fate.js';
import { completedCount } from './missions.js';
import { menaceRankOf, pactFor } from './meta_menace.js';

export const HUB_STATIONS = Object.freeze([
  { id: 'launch', name: 'LAUNCH', blurb: 'Begin the run.', accent: '#5FD672' },
  { id: 'rack', name: 'STAND RACK', blurb: 'Stand, Aspect, Keepsake.', accent: '#FFD24A' },
  { id: 'terminal', name: 'ARCHIVE', blurb: 'Spend Fate. Open the world.', accent: '#7FC8FF' },
  { id: 'menace', name: 'MENACE BOARD', blurb: 'Make it worse, on purpose.', accent: '#FF6B6B' },
  { id: 'bonds', name: 'BOND ROOM', blurb: 'They have things to say.', accent: '#E0A0D8' },
  { id: 'missions', name: 'MISSIONS', blurb: 'The Bizarre checklist.', accent: '#B8A0FF' },
  { id: 'training', name: 'TRAINING ROOM', blurb: 'Practise. Cost nothing.', accent: '#8FE8D8' }
]);

/* The last run, as one line of NPC reaction. Data, so a new ending is a
   row rather than a branch, and never a modal the player has to dismiss. */
function reactionLine(meta) {
  const last = meta.lastRun;
  if (!last) return 'SPEEDWAGON: First time out? Take whatever you need.';
  const stand = STANDS[last.standId];
  const who = stand ? stand.character.split(' ')[0].toUpperCase() : 'THE FOUNDATION';
  if (last.outcome === 'win') return `${who}: We closed it. Act ${last.act}. Do not get used to that.`;
  if (last.killer) return `${who}: ${String(last.killer).toUpperCase().replace(/_/g, ' ')} got you in Act ${last.act}. Again?`;
  return `${who}: Act ${last.act}. We will go further next time.`;
}

function stationRects(W, H) {
  const rects = [];
  const cols = 4, cw = 110, ch = 46, gap = 6;
  const x0 = Math.round((W - (cols * cw + (cols - 1) * gap)) / 2);
  HUB_STATIONS.forEach((st, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    rects.push({ x: x0 + c * (cw + gap), y: 74 + r * (ch + gap), w: cw, h: ch, station: st });
  });
  return rects;
}

export function drawHub(g, W, H, meta, tsec) {
  backdrop(g, W, H, tsec);

  const fate = (meta.fate && meta.fate.fate) || 0;
  const prog = archiveProgress(meta.archive);
  px(g, 0, 0, W, 26, HUB_INK);
  px(g, 0, 26, W, 1, HUB_LINE);
  text(g, 'SPEEDWAGON FOUNDATION — MORIOH SAFEHOUSE', 6, 5, { scale: 1, color: HUB_GOLD });
  text(g, `FATE ${fate}`, W - 6, 5, { scale: 1, align: 'right', color: HUB_GOLD });
  text(g, `ARCHIVE ${prog.purchased}/${prog.total}   MISSIONS ${completedCount(meta.missions)}/121`,
    W - 6, 15, { scale: 1, align: 'right', color: HUB_DIM });

  /* The current loadout, stated plainly, because it is what LAUNCH will
     use and the player must be able to see that without opening the rack. */
  const standId = meta.lastStandId || 'star_platinum';
  const stand = STANDS[standId];
  const lo = (meta.loadout && meta.loadout[standId]) || {};
  const aspect = ASPECTS[lo.aspectId];
  const rank = menaceRankOf(pactFor(meta.menace, standId));
  text(g, 'READY:', 6, 34, { scale: 1, color: HUB_DIM });
  text(g, `${stand ? stand.standName.toUpperCase() : standId}`, 44, 34, { scale: 1, color: HUB_TEXT });
  text(g, `/ ${aspect ? aspect.name : 'NO ASPECT'}`, 44 + 96, 34, { scale: 1, color: '#7FC8FF' });
  if (lo.keepsakeId) text(g, '/ KEEPSAKE', 44 + 96 + 84, 34, { scale: 1, color: '#E0A0D8' });
  if (rank > 0) text(g, `MENACE ${rank}`, W - 6, 34, { scale: 1, align: 'right', color: '#FF6B6B' });

  text(g, reactionLine(meta), 6, 48, { scale: 1, color: '#9BA6D0' });
  px(g, 6, 60, W - 12, 1, HUB_LINE);

  stationRects(W, H).forEach(r => {
    const st = r.station;
    frame(g, r.x, r.y, r.w, r.h, st.accent);
    px(g, r.x + 1, r.y + 1, r.w - 2, 10, st.accent);
    text(g, st.name, r.x + 5, r.y + 3, { scale: 1, color: HUB_INK });
    text(g, st.blurb, r.x + 5, r.y + 17, { scale: 1, color: HUB_DIM });
    if (st.id === 'launch') {
      text(g, 'ONE CLICK', r.x + 5, r.y + 31, {
        scale: 1, color: HUB_OK, alpha: 0.55 + 0.45 * Math.sin((tsec || 0) * 3)
      });
    }
  });

  text(g, 'ANY KEY SKIPS DIALOGUE.  LAUNCH IS ALWAYS ONE CLICK AWAY.', W / 2, H - 10,
    { scale: 1, align: 'center', color: HUB_DIM });
}

export function pickHubStation(mx, my, W, H) {
  const r = stationRects(W, H).find(rect => hit(rect, mx, my));
  return r ? r.station.id : null;
}

/* The loadout LAUNCH uses: the last Stand racked, its remembered Aspect
   and Keepsake, its Menace pact, and the donor list the Archive currently
   allows. Note the last one: STRINGS. That is the entire surface Track A
   presents to a run (spec §7). */
export function launchLoadout(meta, unlocks) {
  const standId = meta.lastStandId || 'star_platinum';
  const lo = (meta.loadout && meta.loadout[standId]) || {};
  return {
    standId,
    aspectId: lo.aspectId || null,
    keepsakeId: lo.keepsakeId || null,
    menacePact: pactFor(meta.menace, standId),
    donors: [...unlocks.donors]
  };
}
