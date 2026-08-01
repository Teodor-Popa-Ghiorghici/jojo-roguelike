/* Debug overlay — tech §2.4/§2.5 deliverable 8: "you cannot author frame
   data blind." Draws hitboxes, hurtboxes, the current frame within the
   active move/pattern, poise bars and i-frame state directly from combat
   state. Purely additive to render.js (one toggled call, no changes to
   the stamping/pose pipeline) and read-only -- it never mutates anything
   it draws, same rule as arena.js/juice.js. Toggled by `combat.debug`,
   flipped by a button in index.js's appbar next to the shake toggle. */

import { px, line, ring } from './draw.js';
import { text } from './font.js';
import { zToYOffset } from './render_adapter.js';
import { GROUND_Y } from './constants.js';

function rectOutline(g, cx, cy, w, h, color) {
  g.save();
  g.globalAlpha = 0.85;
  line(g, cx - w / 2, cy - h, cx + w / 2, cy - h, 1, color);
  line(g, cx - w / 2, cy, cx + w / 2, cy, 1, color);
  line(g, cx - w / 2, cy - h, cx - w / 2, cy, 1, color);
  line(g, cx + w / 2, cy - h, cx + w / 2, cy, 1, color);
  g.restore();
}

function drawHurtbox(g, entity, camX, color) {
  const cx = entity.x - camX;
  const cy = GROUND_Y + zToYOffset(entity.z);
  const w = (entity.body && entity.body.hurtboxW) || 30;
  const h = (entity.body && entity.body.hurtboxH) || 64;
  rectOutline(g, cx, cy, w, h, color);
}

/* Active player-move hitbox windows: red while still live, grey once
   `spent` (already connected at least one target, or expired) this
   activation. Phase 5: `hitboxSpent` is a Map<hbIndex, Set<enemy>> now
   (hitbox.js), since one window can connect with several crowd enemies --
   "spent" here just means "has hit at least one of them". */
function drawPlayerHitboxes(g, player, camX) {
  if (player.state !== 'attack' || !player.activeMove) return;
  const cx = player.x - camX;
  const cy = GROUND_Y + zToYOffset(player.z) - 40;
  player.activeMove.hitboxes.forEach((hb, i) => {
    const hitSet = player.hitboxSpent && player.hitboxSpent.get(i);
    const spent = !!(hitSet && hitSet.size);
    const inWindow = player.moveFrame >= hb.from && player.moveFrame <= hb.to;
    if (!inWindow && !spent) return;
    const hx = cx + player.facing * (hb.x == null ? hb.w / 2 : hb.x);
    rectOutline(g, hx, cy + 40, hb.w, 30, spent ? '#555555' : '#FF4040');
  });
}

function drawEnemyHitbox(g, enemy, camX) {
  const ai = enemy.ai;
  if (!ai || ai.state !== 'active' || !ai.pattern || !ai.pattern.hitbox) return;
  const hb = ai.pattern.hitbox;
  const cx = enemy.x - camX;
  const cy = GROUND_Y + zToYOffset(enemy.z) - 40;
  const hx = cx + enemy.facing * (hb.x == null ? hb.w / 2 : hb.x);
  rectOutline(g, hx, cy + 40, hb.w, 30, '#FF9900');
}

/* Phase 6: revealed boss parts (boss_parts.js) get their own outline so
   the exposed-User hurtbox's real size/position is verifiable, not just
   the pulsing reticle everyone else sees. */
function drawPartHitboxes(g, enemy, camX) {
  enemy.parts.forEach(part => {
    if (!part.revealed) return;
    const cx = part.x - camX, cy = GROUND_Y + zToYOffset(part.z);
    rectOutline(g, cx, cy, part.w, part.h, '#FFE86A');
  });
}

function statLine(g, x, y, str, color) {
  text(g, str, x, y, { scale: 1, color: color || '#8FFF8F', shadow: '#000000' });
}

export function drawDebugOverlay(g, W, H, combat, camX) {
  const { player } = combat;
  drawHurtbox(g, player, camX, player.invulnerable ? '#55FFFF' : '#40C0FF');
  drawPlayerHitboxes(g, player, camX);

  let y = 60;
  statLine(g, 4, y, 'P:' + player.state + (player.activeMove ? '/' + player.activeMove.id + '@' + player.moveFrame + '/' + player.activeMove.frames : ''), '#8FFF8F'); y += 8;
  statLine(g, 4, y, 'iframes:' + (player.invulnerable ? 'ON' : 'off') + ' steps:' + player.dodgeCharges + ' guard:' + (player.guarding ? 'ON' : 'off'), '#8FFF8F'); y += 8;

  /* Phase 5: one hurtbox/hitbox/stat line per living enemy, plus the
     attack-token holder marker (GDD §16) -- this is the overlay's own
     dedicated place for "who currently holds a token", since the shipped
     player-facing readability comes from the telegraph gate itself
     (arena.js) rather than new HUD chrome. */
  combat.enemies.forEach((enemy, idx) => {
    if (enemy.hp <= 0) return;
    drawHurtbox(g, enemy, camX, enemy.ai && enemy.ai.state === 'staggered' ? '#FF5555' : '#FFAA40');
    drawEnemyHitbox(g, enemy, camX);
    drawPartHitboxes(g, enemy, camX);
    statLine(g, 4, y,
      `E${idx}:${enemy.ai.state}${enemy.ai.pattern ? '/' + enemy.ai.pattern.id : ''}` +
      ` tok:${enemy.hasToken ? 'Y' : 'n'} poise:${Math.ceil(enemy.poise.current)}/${enemy.poise.max}` +
      ` purge:${enemy.purged ? 'Y' : 'n'} imm:${enemy.statusImmuneFrames || 0}`,
      '#FFC080');
    y += 8;
  });
}
