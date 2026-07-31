/* Jotaro Kujo, with Star Platinum looming in during attacks. Coordinate
   origin is the character's feet; everything is drawn with negative y
   going up. `pose` comes from anim.js; this file only knows how to paint
   it onto Jotaro's silhouette. */

import { px, disc } from './draw.js';
import { drawFace } from './face.js';
import { EXT } from './palette.js';

function legs(g, facing, pose, flat) {
  const lift = Math.max(0, pose.legSwing);
  const lift2 = Math.max(0, -pose.legSwing);
  const backX = -3 - pose.legSwing * 3, frontX = 3 - pose.legSwing * 3;
  [[backX, -lift * 3], [frontX, -lift2 * 3]].forEach(([lx, ly]) => {
    const h = 16 - Math.abs(ly);
    px(g, lx - 2, -h + ly, 4, h, flat || EXT.jotaro.gakuranSh);
    px(g, lx - 2, ly - 2, 4, 3, flat || '#0B0B0D'); // shoe
  });
}

function torso(g, facing, pose, flat) {
  const lean = pose.torsoLean * facing;
  const w = 15, h = 17, top = -36;
  const shiftTop = lean * 3, shiftBot = lean * 0.6;
  for (let row = 0; row < h; row++) {
    const t = row / h;
    const sx = shiftTop * (1 - t) + shiftBot * t;
    const y = top + row;
    const col = flat || (row < 4 ? EXT.jotaro.gakuranHi : row > h - 4 ? EXT.jotaro.gakuranSh : EXT.jotaro.gakuran);
    px(g, -w / 2 + sx, y, w, 1, col);
  }
  if (!flat) {
    px(g, -1 + shiftTop * 0.5, top + 6, 2, 2, EXT.jotaro.button);
    px(g, -1 + shiftTop * 0.3, top + 11, 2, 2, EXT.jotaro.button);
  }
  return shiftTop;
}

function arms(g, facing, pose, shoulderShift, flat) {
  const shY = -33;
  const rearLen = 5 + pose.armSwing * -3;
  px(g, -facing * 6 + shoulderShift, shY, -facing * rearLen, 4, flat || EXT.jotaro.gakuranSh);
  px(g, -facing * (6 + rearLen) + shoulderShift, shY + 3, 3, 3, flat || EXT.jotaro.skinSh);

  const ext = 3 + pose.strikeArm * 15;
  const armY = shY - pose.torsoLean * 2;
  px(g, facing * 5 + shoulderShift, armY, facing * ext, 4, flat || EXT.jotaro.gakuran);
  const fistX = facing * (5 + ext) + shoulderShift;
  px(g, fistX - 2, armY - 1, 5, 6, flat || (pose.strikeArm > 0.6 ? EXT.jotaro.skinHi : EXT.jotaro.skin));
}

function head(g, facing, pose, flat) {
  const cy = -44 + pose.headBob;
  disc(g, 0, cy, 6, flat || EXT.jotaro.skin);
  if (!flat) {
    disc(g, -1, cy - 1, 5, EXT.jotaro.skinHi);
    disc(g, 0, cy, 6, EXT.jotaro.skin);
  }
  // cap
  px(g, -6, cy - 8, 12, 5, flat || EXT.jotaro.cap);
  px(g, -7, cy - 4, 14, 2, flat || EXT.jotaro.capBrim);
  px(g, facing * 5, cy - 8, facing * 4, 3, flat || EXT.jotaro.capBrim);
  // hair spikes at the sides, under the cap
  px(g, -8, cy - 3, 3, 6, flat || EXT.jotaro.hair);
  px(g, 5, cy - 2, 3, 5, flat || EXT.jotaro.hair);
  if (!flat) drawFace(g, 0, cy, pose.faceEyes, pose.faceMouth, '#1A1410');
}

function drawBody(g, facing, pose, flat) {
  const shoulderShift = torso(g, facing, pose, flat);
  legs(g, facing, pose, flat);
  arms(g, facing, pose, shoulderShift, flat);
  head(g, facing, pose, flat);
}

function drawStandGhost(g, facing, pose, tsec) {
  const SP = EXT.starPlatinum;
  g.save();
  g.globalAlpha = 0.3 + pose.glowStand * 0.35 + Math.sin(tsec * 11) * 0.05;
  g.translate(facing * 2, -14);
  const w = 20, h = 24, top = -46;
  for (let row = 0; row < h; row++) {
    const col = row < 5 ? SP.hi : row > h - 6 ? SP.dark : SP.base;
    px(g, -w / 2, top + row, w, 1, col);
  }
  disc(g, 0, top - 8, 8, SP.base);
  disc(g, -1, top - 9, 6, SP.hi);
  px(g, -2, top - 9, 1, 1, SP.eye);
  px(g, 2, top - 9, 1, 1, SP.eye);
  const ext = 6 + pose.strikeArm * 20;
  px(g, facing * 6, top + 6 - pose.torsoLean * 3, facing * ext, 6, SP.base);
  px(g, facing * (6 + ext) - (facing < 0 ? 3 : 0), top + 2 - pose.torsoLean * 3, 6, 8, SP.hi);
  g.restore();
}

export function drawPlayer(g, x, groundY, facing, pose, tsec) {
  g.save();
  g.translate(Math.round(x), Math.round(groundY));
  g.scale(pose.squashX, pose.squashY);

  if (pose.ghost) {
    for (let i = 1; i <= 2; i++) {
      g.save();
      g.globalAlpha = 0.14 / i;
      g.translate(pose.torsoLean * i * 6, 0);
      drawBody(g, facing, pose, EXT.fx.dodgeGhost);
      g.restore();
    }
  }

  if (pose.glowStand > 0) drawStandGhost(g, facing, pose, tsec);

  drawBody(g, facing, pose, null);

  if (pose.flashWhite > 0.05) {
    g.save();
    g.globalAlpha = Math.min(0.85, pose.flashWhite);
    drawBody(g, facing, pose, '#FFFFFF');
    g.restore();
  }

  g.restore();
}
