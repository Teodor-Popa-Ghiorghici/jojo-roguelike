/* Telegraph geometry -- the ground footprint an incoming attack draws,
   derived from the SAME numbers the hit test will resolve with.

   The sim has exactly three hit geometries and the old single renderer
   (one `pattern.range`-radius ground ellipse for everything) matched none
   of them:

     melee   hitbox.js overlaps()      -- a FORWARD AABB centred on
                                          att.x + facing*hb.x, half-width
                                          hb.w/2 + the defender's own
                                          hurtbox half-width, depth band
                                          +/-22. Never behind the attacker.
     ranged  hitbox.js pointOverlaps() -- a point swept along x at the
                                          shooter's OWN z (combat_enemy.js
                                          only ever advances pr.x), so a
                                          narrow lane: |dx| <= 25 at the
                                          head, |dz| <= 10, never a disc.
     hazard  hazards.js stepHazards()  -- genuinely radial,
                                          hypot(dx, dz) <= radius.

   Render-layer only (rules/render.md): everything here READS pattern/ai/
   hazard data and returns pixels or paints them. Nothing writes sim state
   and the sim never imports this file. The tolerances come from the sim's
   own exported helpers (hitbox.js's depthToleranceFor, stand_classes.js's
   ANCHOR_OFFSET_PX) rather than being restated, so the drawing cannot
   drift from the hit test; the two numbers that are private to their
   module are restated once below and re-derived independently by
   scripts/qa_telegraph_geometry.js, which fails if either drifts.

   Rects are returned already rounded OUTWARD, in half-open screen pixels:
   columns x0..x1-1 and rows y0..y1-1, so the drawn area always covers the
   real danger area and never falls short of it. */

import { px, ellipse, line, ring, dither } from './draw.js';
import { depthToleranceFor } from './hitbox.js';
import { ANCHOR_OFFSET_PX } from './stand_classes.js';
import { Z_TO_Y_SCALE, zToYOffset } from './render_adapter.js';
import { GROUND_Y, SIM_HZ, ARENA_MIN, ARENA_MAX } from './constants.js';

/* hitbox.js's private hurtboxHalfWidth() for the 30-wide body every
   fighter.js entity is created with: every AABB is this much wider than
   its authored `w` on each side, and every projectile point test this
   much more forgiving than its authored radius. */
const DEFENDER_HALF_W = 15;
/* combat_enemy.js's PROJECTILE_HIT_RADIUS (a module-private const there). */
const PROJECTILE_HIT_RADIUS = 10;
/* combat_enemy.js splices a projectile once it passes the bounds by this. */
const PROJECTILE_DESPAWN_MARGIN = 20;
export const PROJECTILE_X_TOLERANCE = PROJECTILE_HIT_RADIUS + DEFENDER_HALF_W;

/* The windup still animates -- that IS the telegraph -- but it animates the
   FILL sweeping out from the attacker, never the outline. The sim's hitbox
   does not grow during a windup either, so the drawn boundary sits at the
   true extent on every single windup frame instead of topping out at
   0.97*range (and averaging 0.70) the way `range * (0.4 + k*0.6)` did. */
const MIN_GROW = 0.45;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* 0 on the first windup frame, exactly 1 on the last one. ai.timer counts
   DOWN and ai.js flips to 'active' on the frame it would reach 0, so the
   smallest value ever observed in 'windup' is 1 -- which is why this is
   not `1 - timer/windupFrames` (that can only reach 1 - 1/windupFrames). */
export function telegraphProgress(ai) {
  if (!ai || !ai.pattern) return 1;
  if (ai.state !== 'windup') return 1;
  const w = Math.max(1, ai.pattern.windupFrames);
  if (w <= 1) return 1;
  const rem = clamp(ai.timer, 1, w);
  return (w - rem) / (w - 1);
}

export function growthFor(progress) { return MIN_GROW + (1 - MIN_GROW) * clamp(progress, 0, 1); }

function outwardRect(ax, bx, gy, halfPx) {
  return {
    x0: Math.floor(Math.min(ax, bx)), x1: Math.ceil(Math.max(ax, bx)),
    y0: Math.floor(gy - halfPx), y1: Math.ceil(gy + halfPx)
  };
}

/* ---- melee: the forward AABB ------------------------------------------ */

/* World-space extents of hitbox.js's overlaps() for this pattern, plus the
   screen rects that cover them. `box` is the whole true AABB and is what
   the outline is drawn at, every frame; `grow` only sweeps the interior
   `fill` out from the attacker. */
export function meleeFootprint(enemy, pattern, camX, grow) {
  const hb = pattern.hitbox ||
    { x: pattern.range / 2, z: 0, w: pattern.range, tags: pattern.tags };
  const facing = enemy.facing || 1;
  const half = hb.w / 2 + DEFENDER_HALF_W;
  const centre = enemy.x + facing * (hb.x == null ? hb.w / 2 : hb.x);
  const reachWorld = centre + facing * half;   // furthest a User hurtbox can be caught
  const backWorld = centre - facing * half;    // the rear edge -- 15 units, not half the range
  /* The anchored Stand rides ANCHOR_OFFSET_PX in front of its User, so a
     User standing this much further out still loses HP to feedback
     (combat_stand.js). Drawn as a fainter outer band, never as the hard
     edge -- a projected/Mid/Long Stand can be further out still. */
  const standReachWorld = reachWorld + facing * ANCHOR_OFFSET_PX;
  const gr = grow == null ? 1 : clamp(grow, 0, 1);
  const depthWorld = depthToleranceFor(hb.tags);
  const gy = GROUND_Y + zToYOffset(enemy.z + (hb.z || 0));
  const halfPx = depthWorld * Z_TO_Y_SCALE;
  return {
    facing, gy, depthWorld, reachWorld, backWorld, standReachWorld,
    box: outwardRect(backWorld - camX, reachWorld - camX, gy, halfPx),
    fill: outwardRect(backWorld - camX, (enemy.x + (reachWorld - enemy.x) * gr) - camX, gy, halfPx),
    pairBox: outwardRect(reachWorld - camX, standReachWorld - camX, gy, halfPx)
  };
}

export function paintMelee(g, geo, color, alpha) {
  const b = geo.box, w = b.x1 - b.x0, h = b.y1 - b.y0;
  const pb = geo.pairBox, f = geo.fill;
  g.save();
  /* outer band: reach against the User's anchored Stand */
  g.globalAlpha = alpha * 0.45;
  dither(g, pb.x0, pb.y0, pb.x1 - pb.x0, pb.y1 - pb.y0, null, color, 4);
  for (let y = pb.y0; y < pb.y1; y += 2) px(g, geo.facing > 0 ? pb.x1 - 1 : pb.x0, y, 1, 1, color);
  /* the real AABB: interior sweeps out over the windup, outline never moves */
  g.globalAlpha = alpha * 0.34;
  px(g, f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0, color);
  g.globalAlpha = alpha;
  px(g, b.x0, b.y0, w, 1, color);
  px(g, b.x0, b.y1 - 1, w, 1, color);
  px(g, b.x0, b.y0, 1, h, color);
  px(g, b.x1 - 1, b.y0, 1, h, color);
  px(g, geo.facing > 0 ? b.x1 - 2 : b.x0, b.y0, 2, h, color); // the wall it stops at
  px(g, geo.facing > 0 ? f.x1 - 1 : f.x0, f.y0, 1, h, color); // the charge sweeping toward it
  g.restore();
}

/* ---- ranged: the projectile lane -------------------------------------- */

/* combat_enemy.js advances pr.x by projectileSpeed/SIM_HZ once per frame
   for `activeFrames` frames (pr.life), so this is the real travel -- not
   `range`, which ai.js documents as an AI pattern-SELECTION heuristic and
   which the old renderer read as a radius. */
export function projectileTravelWorld(pattern) {
  return (pattern.projectileSpeed / SIM_HZ) * pattern.activeFrames;
}

/* World x the projectile is last alive at: travel, clipped by the same
   out-of-bounds splice combat_enemy.js applies. */
export function projectileEndWorld(enemy, pattern) {
  const facing = enemy.facing || 1;
  return clamp(enemy.x + facing * projectileTravelWorld(pattern),
    ARENA_MIN - PROJECTILE_DESPAWN_MARGIN, ARENA_MAX + PROJECTILE_DESPAWN_MARGIN);
}

export function rangedLane(enemy, pattern, camX, grow) {
  const facing = enemy.facing || 1;
  const gy = GROUND_Y + zToYOffset(enemy.z);       // pr.z is stamped once at spawn and never moves
  const depthWorld = depthToleranceFor(pattern.tags);
  const halfPx = depthWorld * Z_TO_Y_SCALE;
  const endWorld = projectileEndWorld(enemy, pattern);
  const headWorld = endWorld + facing * PROJECTILE_X_TOLERANCE;
  const tailWorld = enemy.x - facing * PROJECTILE_X_TOLERANCE;
  const gr = grow == null ? 1 : clamp(grow, 0, 1);
  return {
    facing, gy, depthWorld, headWorld, tailWorld, endWorld,
    hazard: pattern.hazard || null,
    box: outwardRect(tailWorld - camX, headWorld - camX, gy, halfPx),
    fill: outwardRect(tailWorld - camX, (enemy.x + (headWorld - enemy.x) * gr) - camX, gy, halfPx)
  };
}

export function paintLane(g, geo, color, alpha, tsec, camX) {
  const b = geo.box, w = b.x1 - b.x0, h = b.y1 - b.y0;
  g.save();
  /* the detonation zone a hazard-carrying pattern leaves where the
     projectile times out (combat_enemy.js) -- bomb_plant travels 20 units
     and drops a radius-55 zone, so the lane alone would badly under-warn */
  if (geo.hazard) paintZone(g, geo.endWorld - camX, geo.gy, geo.hazard.radius, color, color, alpha * 0.5, 0.35);
  g.globalAlpha = alpha * 0.3;
  px(g, geo.fill.x0, geo.fill.y0, geo.fill.x1 - geo.fill.x0, h, color); // the charge running out along the lane
  g.globalAlpha = alpha * 0.9;
  px(g, b.x0, b.y0, w, 1, color);      // the lane's own +/-10 walls, full length, every frame
  px(g, b.x0, b.y1 - 1, w, 1, color);
  /* travel chevrons, scrolling along the lane so it reads as a trajectory
     rather than a zone. Built from draw.js's hard-pixel line(), no rotate. */
  const cy = (b.y0 + b.y1) / 2, span = 26, n = Math.max(1, Math.floor(w / span));
  const slide = ((tsec * 34) % span) * geo.facing;
  for (let i = 0; i <= n; i++) {
    const cx = geo.facing > 0 ? b.x0 + 6 + i * span + slide : b.x1 - 6 - i * span + slide;
    if (cx < b.x0 + 2 || cx > b.x1 - 2) continue;
    line(g, cx - geo.facing * 3, cy - 3, cx, cy, 1, color);
    line(g, cx - geo.facing * 3, cy + 3, cx, cy, 1, color);
  }
  g.globalAlpha = alpha;
  px(g, geo.facing > 0 ? b.x1 - 2 : b.x0, b.y0, 2, h, color);
  g.restore();
}

/* ---- radial zones ------------------------------------------------------ */

/* hazards.js tests hypot(dx, dz) <= radius, so the honest drawing is that
   circle projected: full radius in x, radius*Z_TO_Y_SCALE in y. The old
   0.7x / (0.22r+3) ellipse covered ~70% of it -- half the real area was an
   invisible annulus. The +0.5 is a rasterizer guard: draw.js's ellipse
   samples pixel centres, so the outermost row would otherwise drop out. */
export function zoneEllipse(h, camX) {
  return {
    cx: h.x - camX, cy: GROUND_Y + zToYOffset(h.z),
    rx: h.radius, ry: h.radius * Z_TO_Y_SCALE
  };
}

export function paintZone(g, cx, cy, radius, fill, edge, alpha, fillScale) {
  g.save();
  g.globalAlpha = alpha * (fillScale == null ? 1 : fillScale);
  ellipse(g, cx, cy, radius + 0.5, radius * Z_TO_Y_SCALE + 0.5, fill);
  g.globalAlpha = alpha;
  ring(g, cx, cy, radius, 2, edge, Z_TO_Y_SCALE);
  g.restore();
}
