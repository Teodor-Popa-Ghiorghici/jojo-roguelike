/* Combat scene composition: camera, sprite stamping, effects, HUD.

   Every character goes through the same path -- pose -> offscreen buffer
   -> stamp with outline, cast shadow, squash and flash -- so they all sit
   in the scene with the same lighting and the same silhouette treatment.
   The camera tracks the midpoint of the fight and drives the parallax,
   and shake offsets are applied to the world only, never to the HUD. */

import { buffer, stamp } from './layer.js';
import { px, poly, ellipse, line, ring, disc, contactShadow } from './draw.js';
import { playerPose } from './pose_player.js';
import { enemyPose } from './pose_enemy.js';
import { drawJotaro, SPEC as J_SPEC } from './sprite_jotaro.js';
import { drawStar, standPose, barrageFists, SPEC as S_SPEC } from './sprite_star.js';
import { drawThug, drawAngelo } from './sprite_enemy.js';
import { drawKillerQueen } from './sprite_boss.js';
import { drawBackground, drawForeground } from './background.js';
import { drawHUD, drawBanner } from './hud.js';
import { createFx, wireFx } from './fx.js';
import { text } from './font.js';
import { FX, JOTARO, S, SH, BASE, LT, RIM } from './palette.js';

export const GROUND_Y = 208;
export const WORLD_W = 600;

const ENEMY_ART = { morioh_thug: drawThug, angelo: drawAngelo };
const SCENE_FOR = {
  n1: 'alley', n2: 'street', n3: 'street', n4: 'street', n5: 'park', n6: 'store'
};

function camera(combat, W) {
  const mid = (combat.player.x + combat.enemy.x) / 2;
  return Math.max(0, Math.min(WORLD_W - W, mid - W / 2));
}

/* ---- characters -------------------------------------------------------- */

function stampFighter(g, key, w, h, ox, oy, paint, opts) {
  const b = buffer(key, w, h);
  b.g.save();
  b.g.translate(ox, oy);
  paint(b.g);
  b.g.restore();
  stamp(g, b, Object.assign({ ox, oy, outline: FX.ink, thickOutline: true }, opts));
  return b;
}

function shadowOpts(pose) {
  return { color: '#000000', alpha: 0.30, skew: 0.9, squash: 0.26 - (pose.airborne || 0) * 0.1 };
}

function drawStand(g, player, pose, camX, tsec) {
  if (pose.standOut <= 0.02) return;
  const sp = standPose(pose);
  const manifest = pose.standOut;
  const key = 'star';
  const b = buffer(key, 300, 240);
  b.g.save();
  b.g.translate(150, 214);
  drawStar(b.g, sp, manifest);
  b.g.restore();
  const bob = Math.sin(tsec * 3.4) * 2;
  const rushing = pose.action === 'rush' || pose.action === 'special';
  stamp(g, b, {
    x: player.x - camX - player.facing * (rushing ? 30 : 22),
    y: GROUND_Y - (rushing ? 22 : 10) + bob,
    ox: 150, oy: 214, flip: player.facing,
    outline: '#160A28', thickOutline: true,
    alpha: 0.55 + manifest * 0.45,
    tint: { color: '#B98BFF', alpha: 0.18 * (1 - manifest) }
  });
}

/* The rush flurry is stamped separately, over the user, so the fists
   actually reach the target instead of being hidden behind his back. */
function drawBarrage(g, player, enemy, pose, camX) {
  if (!(pose.standPunch > 1)) return;
  const span = Math.max(56, Math.min(132, Math.abs(enemy.x - player.x) + 26));
  const b = buffer('barrage', 200, 90);
  b.g.save();
  b.g.translate(24, 45);
  barrageFists(b.g, pose.standPunch, span);
  b.g.restore();
  stamp(g, b, {
    x: player.x - camX, y: GROUND_Y - 74, ox: 24, oy: 45,
    flip: player.facing, outline: '#160A28', thickOutline: true
  });
}

function drawFighter(g, f, pose, camX, tsec, isPlayer, phaseIndex) {
  const paint = isPlayer
    ? bg => drawJotaro(bg, pose)
    : f.def.id === 'killer_queen'
      ? bg => drawKillerQueen(bg, pose, phaseIndex, tsec)
      : bg => (ENEMY_ART[f.def.id] || drawThug)(bg, pose);
  const ghosts = [];
  if (pose.ghosts) {
    for (let i = 1; i <= 3; i++) {
      ghosts.push({ dx: -pose.ghosts * i * 9, dy: 0, alpha: 0.30 / i, color: FX.ghost[3] });
    }
  }
  if (pose.smear > 0.2) {
    for (let i = 1; i <= 2; i++) {
      ghosts.push({ dx: -(f.facing || 1) * i * 5, dy: 0, alpha: 0.22 * pose.smear / i, color: '#FFFFFF' });
    }
  }
  contactShadow(g, f.x - camX, GROUND_Y + 1, 15, 4.5, '#000000', 0.5);
  stampFighter(g, isPlayer ? 'player' : 'enemy', 240, 200, 120, 184, paint, {
    x: f.x - camX, y: GROUND_Y, flip: f.facing, rot: (pose.bodyRot || 0),
    sx: pose.squashX, sy: pose.squashY,
    shadow: shadowOpts(pose),
    flash: { color: '#FFE2D2', alpha: Math.min(0.34, (pose.flash || 0) * 0.42) },
    tint: f.tint ? { color: f.tint, alpha: 0.28 } : null,
    ghosts
  });
}

/* ---- world extras ------------------------------------------------------ */

function telegraph(g, enemy, camX, tsec) {
  const ai = enemy.ai;
  if (!ai || ai.state !== 'windup' || !ai.pattern) return;
  const k = 1 - Math.max(0, ai.timer) / ai.pattern.windupMs;
  const x = enemy.x - camX;
  const r = ai.pattern.range;
  const pulse = 0.35 + 0.45 * Math.abs(Math.sin(tsec * 16));
  g.save();
  g.globalAlpha = pulse * (0.35 + k * 0.5);
  ellipse(g, x, GROUND_Y + 2, r * (0.4 + k * 0.6), r * 0.14 + 3, ai.pattern.telegraph);
  g.globalAlpha = pulse;
  ring(g, x, GROUND_Y + 2, r * (0.4 + k * 0.6), 2, ai.pattern.telegraph, 0.26);
  g.restore();
  /* an escalating warning chevron over the enemy's head */
  const y = GROUND_Y - 130 - Math.sin(tsec * 12) * 2;
  g.save();
  g.globalAlpha = 0.55 + 0.45 * Math.sin(tsec * 14);
  poly(g, [[x - 7, y], [x + 7, y], [x, y + 9]], ai.pattern.telegraph);
  poly(g, [[x - 4, y + 1], [x + 4, y + 1], [x, y + 6]], '#FFFFFF');
  g.restore();
  if (k > 0.55) {
    text(g, ai.pattern.label, x, y - 12, {
      scale: 1, align: 'center', color: ai.pattern.telegraph, outline: '#1A0A0A'
    });
  }
}

function projectiles(g, enemy, camX, tsec) {
  enemy.projectiles.forEach(pr => {
    const x = pr.x - camX, y = GROUND_Y - 60;
    const c = pr.pattern.telegraph;
    g.save();
    g.globalAlpha = 0.85 + 0.15 * Math.sin(tsec * 30 + pr.x);
    for (let i = 1; i <= 4; i++) {
      g.globalAlpha = 0.5 / i;
      disc(g, x - pr.dir * i * 7, y + Math.sin(tsec * 20 + i) * 2, 5 - i * 0.8, c);
    }
    g.globalAlpha = 1;
    disc(g, x, y, 7, c);
    disc(g, x, y, 4, '#FFFFFF');
    for (let i = 0; i < 4; i++) {
      const a = tsec * 9 + i * Math.PI / 2;
      line(g, x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a) * 12, y + Math.sin(a) * 12, 1, c);
    }
    g.restore();
  });
}

function particles(g, juice, camX) {
  juice.particles.forEach(p => {
    const a = Math.max(0, 1 - p.life / p.maxLife);
    g.save();
    g.globalAlpha = a;
    px(g, p.x - camX, p.y, p.size, p.size, p.color);
    g.restore();
  });
}

function groundDust(g, pose, x, tsec, seedOffset) {
  if (!pose.dust) return;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI + seedOffset;
    ellipse(g, x + Math.cos(a) * (8 + i * 5), GROUND_Y - 2 - Math.abs(Math.sin(a)) * 4,
      5 + i * 2, 2.5 + i, FX.dust[2 + (i % 3)]);
  }
}

/* ---- entry point ------------------------------------------------------- */

export function drawCombat(g, W, H, combat, tsec, dtMs, nodeId) {
  if (!combat._fx) {
    combat._fx = createFx();
    wireFx(combat, combat._fx, GROUND_Y);
  }
  const fx = combat._fx;
  const frozen = combat.juice.hitstopMs > 0;
  const dt = frozen ? 0 : dtMs;
  if (!frozen) fx.update(dtMs);

  const { player, enemy, juice } = combat;
  const camX = camera(combat, W);
  const ppose = playerPose(player, tsec, dt, combat.outcome);
  const epose = (enemy.hp > 0 || (enemy.deathTimer || 0) > 0) ? enemyPose(enemy, tsec, dt) : null;

  g.save();
  g.translate(juice.shakeX, juice.shakeY);
  drawBackground(g, W, H, SCENE_FOR[nodeId] || 'street', camX, tsec, GROUND_Y);

  if (enemy.hp > 0) telegraph(g, enemy, camX, tsec);
  groundDust(g, ppose, player.x - camX, tsec, 0);
  if (epose) groundDust(g, epose, enemy.x - camX, tsec, 1.2);

  drawStand(g, player, ppose, camX, tsec);
  const playerFirst = enemy.x < player.x;
  const drawP = () => drawFighter(g, player, ppose, camX, tsec, true);
  const drawE = () => epose && drawFighter(g, enemy, epose, camX, tsec, false, enemy.phaseIndex);
  if (playerFirst) { drawP(); drawE(); } else { drawE(); drawP(); }
  drawBarrage(g, player, enemy, ppose, camX);

  projectiles(g, enemy, camX, tsec);
  particles(g, juice, camX);
  fx.draw(g, W, H);
  drawForeground(g, W, H, SCENE_FOR[nodeId] || 'street', camX, tsec, GROUND_Y);
  g.restore();

  drawHUD(g, W, H, combat, tsec);
  drawBanner(g, W, H, combat, tsec);
}
