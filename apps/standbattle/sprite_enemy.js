/* Regular Morioh enemies: the delinquent (baseline) and Angelo (elite).
   Same rig shape as the player sprite but simpler, and parameterized by a
   "build" so one function paints both. Origin is the character's feet. */

import { px, disc } from './draw.js';
import { drawFace } from './face.js';
import { EXT } from './palette.js';

function legs(g, pose, build, flat) {
  const backX = -3 - pose.legSwing * 2.5, frontX = 3 - pose.legSwing * 2.5;
  const lift = Math.max(0, pose.legSwing) * 2.5, lift2 = Math.max(0, -pose.legSwing) * 2.5;
  [[backX, -lift], [frontX, -lift2]].forEach(([lx, ly]) => {
    const h = build.legH + ly;
    px(g, lx - 2, -h - ly, 4, h, flat || build.pantsSh);
    px(g, lx - 2, -3 - ly, 4, 3, flat || '#0B0B0D');
  });
}

function torso(g, facing, pose, build, flat) {
  const lean = pose.torsoLean * facing;
  const top = -build.legH - build.torsoH;
  for (let row = 0; row < build.torsoH; row++) {
    const t = row / build.torsoH;
    const sx = lean * 3 * (1 - t) + lean * 0.6 * t;
    const col = flat || (row < 3 ? build.clothHi : row > build.torsoH - 3 ? build.clothSh : build.cloth);
    px(g, -build.torsoW / 2 + sx, top + row, build.torsoW, 1, col);
  }
  if (!flat && build.shirt) px(g, -2 + lean, top + build.torsoH - 6, 4, 5, build.shirt);
  return { top, shiftTop: lean * 3 };
}

function arms(g, facing, pose, build, top, shoulderShift, flat) {
  const shY = top + 3;
  const rearLen = 4 + pose.armSwing * -3;
  px(g, -facing * 5 + shoulderShift, shY, -facing * rearLen, 3, flat || build.clothSh);
  const ext = 3 + pose.strikeArm * build.reach;
  px(g, facing * 5 + shoulderShift, shY - pose.torsoLean * 2, facing * ext, 3, flat || build.cloth);
  const fistX = facing * (5 + ext) + shoulderShift;
  px(g, fistX - 2, shY - 1 - pose.torsoLean * 2, 4, 5, flat || build.skin);
}

function head(g, pose, build, flat) {
  const cy = -build.legH - build.torsoH - build.headR + pose.headBob;
  disc(g, 0, cy, build.headR, flat || build.skin);
  if (!flat) {
    build.drawHair(g, cy);
    drawFace(g, 0, cy + 1, pose.faceEyes, pose.faceMouth, build.ink);
  }
}

function drawBody(g, facing, pose, build, flat) {
  const { top, shiftTop } = torso(g, facing, pose, build, flat);
  legs(g, pose, build, flat);
  arms(g, facing, pose, build, top, shiftTop, flat);
  head(g, pose, build, flat);
}

function paint(g, x, groundY, facing, pose, build) {
  g.save();
  g.translate(Math.round(x), Math.round(groundY));
  g.scale(pose.squashX, pose.squashY);
  drawBody(g, facing, pose, build, null);
  if (pose.flashWhite > 0.05) {
    g.save();
    g.globalAlpha = Math.min(0.85, pose.flashWhite);
    drawBody(g, facing, pose, build, '#FFFFFF');
    g.restore();
  }
  g.restore();
}

const THUG = {
  legH: 15, torsoH: 15, torsoW: 14, headR: 5, reach: 12,
  skin: EXT.thug.skin, cloth: EXT.thug.leather, clothHi: EXT.thug.leatherHi,
  clothSh: EXT.thug.leatherSh, pantsSh: '#242018', shirt: EXT.thug.shirt, ink: '#160E08',
  drawHair(g, cy) {
    px(g, -4, cy - 6, 8, 3, EXT.thug.hair);
    for (let i = -3; i <= 3; i += 2) px(g, i, cy - 8, 1, 3, EXT.thug.hair);
  }
};

const ANGELO = {
  legH: 17, torsoH: 17, torsoW: 12, headR: 5, reach: 13,
  skin: EXT.angelo.skin, cloth: EXT.angelo.coat, clothHi: EXT.angelo.coatHi,
  clothSh: '#332C20', pantsSh: '#2A241A', shirt: null, ink: '#241C10',
  drawHair(g, cy) {
    px(g, -4, cy - 6, 3, 4, EXT.angelo.hair);
    px(g, 2, cy - 7, 3, 3, EXT.angelo.hair);
    px(g, -1, cy - 8, 3, 3, EXT.angelo.hair);
  }
};

export function drawThug(g, x, groundY, facing, pose) { paint(g, x, groundY, facing, pose, THUG); }
export function drawAngelo(g, x, groundY, facing, pose) { paint(g, x, groundY, facing, pose, ANGELO); }
