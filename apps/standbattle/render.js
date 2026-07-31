/* Canvas renderer for the combat scene — §11. Draws at the internal
   resolution only; index.js owns the integer upscale + imageSmoothingEnabled
   flag. Sixteen-colour palette only, whole-pixel rects, no gradients. */

import { PAL } from './data.js';

const GROUND_Y = 150;

function R(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function drawSky(g, W) {
  R(g, 0, 0, W, GROUND_Y, PAL.blue);
  for (let x = 0; x < W; x += 4) {
    if (((x / 4) | 0) % 7 === 0) R(g, x, GROUND_Y - 6, 2, 6, PAL.black);
  }
  /* rooftops, a flat Morioh streetscape silhouette */
  let x = -10;
  let seed = 7;
  while (x < W + 20) {
    seed = (seed * 37 + 11) % 97;
    const w = 26 + (seed % 30);
    const h = 30 + (seed % 46);
    R(g, x, GROUND_Y - h, w, h, PAL.dgray);
    R(g, x, GROUND_Y - h, w, 3, PAL.black);
    for (let wx = x + 4; wx < x + w - 4; wx += 8) R(g, wx, GROUND_Y - h + 8, 3, 4, PAL.yellow);
    x += w + 6;
  }
  R(g, 0, GROUND_Y, W, 66, PAL.gray);
  R(g, 0, GROUND_Y, W, 3, PAL.white);
  for (let sx = 0; sx < W; sx += 26) R(g, sx, GROUND_Y + 30, 14, 2, PAL.dgray);
}

function squashScale(fighter) {
  if (!fighter.hurtFlash) return { sx: 1, sy: 1 };
  const k = fighter.hurtFlash;
  return { sx: 1 + k * 0.18, sy: 1 - k * 0.18 };
}

function drawFighterBlock(g, x, colors, facing, hurtFlash, ghost) {
  const y = GROUND_Y;
  const sc = squashScale({ hurtFlash });
  g.save();
  g.translate(x, y);
  g.scale(sc.sx, sc.sy);
  const body = ghost ? PAL.lcyan : (hurtFlash ? PAL.white : colors.body);
  const trim = colors.trim;
  R(g, -6, -34, 12, 20, body);       // torso
  R(g, -6, -34, 12, 4, trim);        // shoulders
  R(g, -5, -44, 10, 10, colors.fist || trim); // head
  R(g, facing * 4, -30, facing * 10, 6, body); // forward arm
  R(g, -4, -14, 5, 14, PAL.black);   // legs
  R(g, 1, -14, 5, 14, PAL.black);
  g.restore();
}

function drawAttackFist(g, x, facing, move, phase) {
  if (phase !== 'active') return;
  R(g, x + facing * 8, GROUND_Y - 30, facing * move.range, 6, PAL.yellow);
}

function drawTelegraph(g, x, ai, tsec) {
  if (ai.state !== 'windup' || !ai.pattern) return;
  const pulse = 0.5 + 0.5 * Math.sin(tsec * 18);
  g.globalAlpha = 0.35 + pulse * 0.4;
  R(g, x - ai.pattern.range, GROUND_Y - 46, ai.pattern.range * 2, 40, ai.pattern.telegraph);
  g.globalAlpha = 1;
  R(g, x - 2, GROUND_Y - 50, 4, 4, ai.pattern.telegraph);
}

function drawProjectiles(g, list) {
  list.forEach(pr => R(g, pr.x - 3, GROUND_Y - 32, 6, 6, pr.pattern.telegraph));
}

function drawParticles(g, particles) {
  particles.forEach(p => {
    const a = Math.max(0, 1 - p.life / p.maxLife);
    g.globalAlpha = a;
    R(g, p.x, p.y, p.size, p.size, p.color);
  });
  g.globalAlpha = 1;
}

function drawBar(g, x, y, w, h, frac, fg, bg) {
  R(g, x - 1, y - 1, w + 2, h + 2, PAL.black);
  R(g, x, y, w, h, bg);
  R(g, x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h, fg);
}

export function drawCombat(g, W, H, combat, tsec) {
  const { player, enemy, juice } = combat;
  g.save();
  g.translate(juice.shakeX, juice.shakeY);
  R(g, 0, 0, W, H, PAL.black);
  drawSky(g, W);

  drawTelegraph(g, enemy.x, enemy.ai, tsec);
  drawProjectiles(g, enemy.projectiles);

  drawFighterBlock(g, player.x, player.stand.colors, player.facing, player.hurtFlash, player.invulnerable);
  if (player.state === 'attack') drawAttackFist(g, player.x, player.facing, player.activeMove, player.movePhase);
  const ec = enemy.tint ? { body: enemy.tint, trim: enemy.def.colors.trim } : enemy.def.colors;
  if (enemy.hp > 0) drawFighterBlock(g, enemy.x, ec, enemy.facing, enemy.hurtFlash, false);

  drawParticles(g, juice.particles);
  g.restore();

  /* HUD: chunky bordered bars, drawn outside the shake transform. Each
     label sits above its own bar so the two rows never collide. */
  g.fillStyle = PAL.white;
  g.font = '7px monospace';
  g.fillText('HP', 10, 9);
  drawBar(g, 10, 12, 150, 8, player.hp / player.maxHp, PAL.lgreen, PAL.dgray);
  g.fillText('PERSISTENCE', 10, 27);
  drawBar(g, 10, 30, 150, 6, player.persistence / player.maxPersistence, PAL.lcyan, PAL.dgray);
  if (enemy.hp > 0) {
    g.textAlign = 'right';
    g.fillText((enemy.def.standName || enemy.def.name), W - 10, 9);
    g.textAlign = 'left';
    drawBar(g, W - 160, 12, 150, 8, enemy.hp / enemy.maxHp, PAL.lred, PAL.dgray);
  }

  if (player.state === 'parry' && player.parryWindow) {
    g.strokeStyle = PAL.lcyan;
    g.strokeRect(player.x - 10, GROUND_Y - 50, 20, 50);
  }

  if (combat.bannerTimer > 0) {
    g.textAlign = 'center';
    g.fillStyle = PAL.yellow;
    g.font = '12px monospace';
    g.fillText(combat.banner, W / 2, 66);
    g.textAlign = 'left';
  }
  if (combat.log[0]) {
    g.textAlign = 'center';
    g.fillStyle = PAL.white;
    g.font = '10px monospace';
    g.fillText(combat.log[0], W / 2, 82);
    g.textAlign = 'left';
  }

  if (combat.outcome === 'win') {
    g.textAlign = 'center';
    g.fillStyle = PAL.lgreen;
    g.font = '16px monospace';
    g.fillText('VICTORY', W / 2, H / 2);
    g.textAlign = 'left';
  } else if (combat.outcome === 'lose') {
    g.textAlign = 'center';
    g.fillStyle = PAL.lred;
    g.font = '16px monospace';
    g.fillText('YOU HAVE BEEN STOPPED.', W / 2, H / 2);
    g.textAlign = 'left';
  }
}
