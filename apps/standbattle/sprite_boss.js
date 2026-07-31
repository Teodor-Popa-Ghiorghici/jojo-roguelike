/* Killer Queen. Deliberately faceless per canon -- smooth head, no eyes,
   a seam of a mouth that only shows teeth mid-attack. Phase 2 adds a red
   glint along the seams as the fight gets serious. */

import { px, disc, stepLine } from './draw.js';
import { EXT } from './palette.js';

function legs(g, pose, flat) {
  const backX = -3 - pose.legSwing * 2, frontX = 3 - pose.legSwing * 2;
  [[backX, 0], [frontX, 0]].forEach(([lx]) => {
    px(g, lx - 2, -18, 4, 18, flat || EXT.killerQueen.pink);
    px(g, lx - 2, -6, 4, 3, flat || EXT.killerQueen.black);
  });
}

function torso(g, facing, pose, flat) {
  const lean = pose.torsoLean * facing;
  const top = -36, w = 15, h = 18;
  for (let row = 0; row < h; row++) {
    const t = row / h;
    const sx = lean * 3 * (1 - t) + lean * 0.6 * t;
    const col = flat || (row < 4 ? EXT.killerQueen.pinkHi : row > h - 5 ? EXT.killerQueen.pinkDark : EXT.killerQueen.pink);
    px(g, -w / 2 + sx, top + row, w, 1, col);
  }
  if (!flat) {
    px(g, -1 + lean, top + 4, 2, 10, EXT.killerQueen.black);
    px(g, -5 + lean, top, 10, 2, EXT.killerQueen.gold);
  }
  return { top, shift: lean * 3 };
}

function claw(g, x, y, facing, color) {
  px(g, x - 2, y, 5, 4, color);
  [0, 2, 4].forEach(i => px(g, x - 2 + i, y + 4, 1, 2, color));
}

function arms(g, facing, pose, top, shift, flat) {
  const shY = top + 4;
  const rearLen = 4 + pose.armSwing * -3;
  px(g, -facing * 5 + shift, shY, -facing * rearLen, 4, flat || EXT.killerQueen.pinkDark);
  const ext = 3 + pose.strikeArm * 15;
  px(g, facing * 5 + shift, shY - pose.torsoLean * 2, facing * ext, 4, flat || EXT.killerQueen.pink);
  claw(g, facing * (5 + ext) + shift - (facing < 0 ? 3 : 0), shY - 2 - pose.torsoLean * 2, facing, flat || EXT.killerQueen.black);
}

function head(g, pose, phaseIndex, flat) {
  const cy = -44 + pose.headBob;
  disc(g, 0, cy, 6, flat || EXT.killerQueen.pink);
  if (flat) return;
  disc(g, -1, cy - 1, 5, EXT.killerQueen.pinkHi);
  disc(g, 0, cy, 6, EXT.killerQueen.pink);
  px(g, -8, cy - 1, 3, 2, EXT.killerQueen.pinkDark);
  px(g, 5, cy - 1, 3, 2, EXT.killerQueen.pinkDark);
  const seamColor = phaseIndex > 0 ? '#FF3355' : EXT.killerQueen.black;
  if (pose.faceMouth === 'open') {
    px(g, -3, cy + 2, 6, 2, EXT.killerQueen.black);
    [-2, 0, 2].forEach(i => px(g, i, cy + 1, 1, 1, '#FFFFFF'));
  } else {
    px(g, -3, cy + 2, 6, 1, seamColor);
  }
  if (phaseIndex > 0) {
    stepLine(g, -5, cy - 4, -2, cy - 1, 1, '#FF3355');
    stepLine(g, 5, cy - 4, 2, cy - 1, 1, '#FF3355');
  }
}

function drawBody(g, facing, pose, phaseIndex, flat) {
  const { top, shift } = torso(g, facing, pose, flat);
  legs(g, pose, flat);
  arms(g, facing, pose, top, shift, flat);
  head(g, pose, phaseIndex, flat);
}

export function drawKillerQueen(g, x, groundY, facing, pose, phaseIndex) {
  g.save();
  g.translate(Math.round(x), Math.round(groundY));
  g.scale(pose.squashX, pose.squashY);
  drawBody(g, facing, pose, phaseIndex, null);
  if (pose.flashWhite > 0.05) {
    g.save();
    g.globalAlpha = Math.min(0.85, pose.flashWhite);
    drawBody(g, facing, pose, phaseIndex, '#FFFFFF');
    g.restore();
  }
  g.restore();
}
