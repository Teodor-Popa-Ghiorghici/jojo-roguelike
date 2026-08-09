/* Telegraph geometry assertion -- closes the process gap that let S2-A/
   S2-B/S3-C ship: fairness_check.js measures telegraph TIME only
   (windupFrames * frameMs >= 260), reads no geometry at all, so nothing
   tied the drawn danger footprint to the hitbox that actually resolves.

   This probes the REAL hit tests (hitbox.js's overlaps()/pointOverlaps(),
   the projectile advance loop combat_enemy.js runs, hazards.js's radial
   hypot test) by brute force, and compares them against the pixels
   telegraph_geom.js hands the rasterizer on the LAST windup frame. Two
   directions, both of which are fairness bugs:

     under-warn -- drawn extent < real extent: something hits you from
                   outside the shape you were shown. Always a failure.
     over-warn  -- drawn extent far beyond real: the shape paints safe
                   ground lethal. Allowed only up to OVER_WARN_SLACK,
                   which is the outward pixel rounding plus the rasterizer
                   guard, never a whole ellipse.

   Runnable standalone:  node apps/standbattle/scripts/qa_telegraph_geometry.js [--verbose]
   Wired into `npm run assert` via runTelegraphGeometryChecks(). */

import { PATTERNS } from '../ai.js';
import { overlaps, pointOverlaps } from '../hitbox.js';
import { ANCHOR_OFFSET_PX } from '../stand_classes.js';
import { GROUND_Y, SIM_HZ, Z_REST, ARENA_MIN, ARENA_MAX } from '../constants.js';
import { Z_TO_Y_SCALE } from '../render_adapter.js';
import {
  telegraphProgress, growthFor, meleeFootprint, rangedLane, zoneEllipse,
  projectileTravelWorld
} from '../telegraph_geom.js';

const BODY = { hurtboxW: 30, hurtboxH: 64 };   // fighter.js's default hurtbox
const STEP = 0.01;                              // probe resolution, world units
const OVER_WARN_SLACK = 3;                      // world units of allowed over-draw

/* screen row -> world z, valid because every fixture sits at Z_REST where
   zToYOffset() is 0 (render_adapter.js) */
const rowToZ = (y) => Z_REST - (y - GROUND_Y) / Z_TO_Y_SCALE;

function lastWindupGrow(p) {
  return growthFor(telegraphProgress({ state: 'windup', timer: 1, pattern: p }));
}

/* ---- real geometry, probed off the sim's own predicates ---------------- */

function realMelee(p, att) {
  const hb = p.hitbox;
  let fwd = 0, back = 0, depth = 0;
  for (let d = 0; d <= 400; d += STEP) {
    if (overlaps(att, hb, { x: att.x + d, z: att.z, body: BODY })) fwd = d;
    if (overlaps(att, hb, { x: att.x - d, z: att.z, body: BODY })) back = d;
  }
  const cx = att.x + (att.facing || 1) * hb.x;
  for (let d = 0; d <= 200; d += STEP) {
    if (overlaps(att, hb, { x: cx, z: att.z + d, body: BODY })) depth = d;
  }
  return { fwdX: att.x + fwd, backX: att.x - back, depth };
}

/* combat_enemy.js's projectile loop: life-- , pr.x += dir*speed/SIM_HZ,
   spliced once outside the arena by PROJECTILE_DESPAWN_MARGIN. */
function realProjectile(p, sx, dir) {
  const spf = p.projectileSpeed / SIM_HZ;
  let x = sx, life = p.activeFrames, lo = Infinity, hi = -Infinity;
  while (life > 0) {
    life -= 1; x += dir * spf;
    if (x < ARENA_MIN - 20 || x > ARENA_MAX + 20) break;
    lo = Math.min(lo, x); hi = Math.max(hi, x);
  }
  let xTol = 0, depth = 0;
  for (let d = 0; d <= 200; d += STEP) {
    if (pointOverlaps(hi, Z_REST, { x: hi + d, z: Z_REST, body: BODY }, p.tags, 10)) xTol = d;
    if (pointOverlaps(hi, Z_REST, { x: hi, z: Z_REST + d, body: BODY }, p.tags, 10)) depth = d;
  }
  return { headX: hi + xTol, tailX: lo - xTol, depth, travel: hi - sx };
}

/* ---- checks ------------------------------------------------------------ */

function meleeChecks(out) {
  Object.values(PATTERNS).filter(p => !p.ranged).forEach(p => {
    const att = { x: 300, z: Z_REST, facing: 1, body: BODY };
    const real = realMelee(p, att);
    const geo = meleeFootprint(att, p, 0, lastWindupGrow(p));
    const b = geo.box;
    const drawnFwd = b.x1, drawnBack = b.x0;
    const drawnDepth = Math.min(rowToZ(b.y0) - Z_REST, Z_REST - rowToZ(b.y1));
    const overFwd = drawnFwd - real.fwdX, overBack = real.backX - drawnBack;
    const overDepth = drawnDepth - real.depth;
    const detail = `fwd drawn ${drawnFwd.toFixed(1)} vs real ${real.fwdX.toFixed(2)} · ` +
      `depth drawn ${drawnDepth.toFixed(2)} vs real ${real.depth.toFixed(2)} · ` +
      `rear drawn ${(att.x - drawnBack).toFixed(1)} vs real ${(att.x - real.backX).toFixed(2)}`;
    out.push({
      label: `${p.id} melee AABB`, detail,
      ok: overFwd >= 0 && overFwd <= OVER_WARN_SLACK &&
        overDepth >= 0 && overDepth <= OVER_WARN_SLACK &&
        overBack >= 0 && overBack <= OVER_WARN_SLACK
    });
    /* the S2-A regression guard: the drawn ring used to reach the real
       reach on 0 of N windup frames. The outline is no longer animated, so
       every frame of the windup must cover it -- if a future change ties
       the boundary back to `k`, this is what fails. */
    let reached = 0;
    for (let t = p.windupFrames; t >= 1; t--) {
      const gg = meleeFootprint(att, p, 0, growthFor(telegraphProgress({ state: 'windup', timer: t, pattern: p })));
      if (gg.box.x1 >= real.fwdX && rowToZ(gg.box.y0) - Z_REST >= real.depth) reached++;
    }
    out.push({
      label: `${p.id} covers the real AABB on every windup frame`,
      ok: reached === p.windupFrames, detail: `${reached}/${p.windupFrames} windup frames cover it`
    });
    // the anchored-Stand outer band is the +ANCHOR_OFFSET_PX edge, not a second guess
    out.push({
      label: `${p.id} Stand band == reach + ANCHOR_OFFSET_PX`,
      ok: Math.abs(geo.standReachWorld - (real.fwdX + ANCHOR_OFFSET_PX)) <= 0.02,
      detail: `${geo.standReachWorld.toFixed(1)} vs ${(real.fwdX + ANCHOR_OFFSET_PX).toFixed(1)}`
    });
  });
}

function rangedChecks(out) {
  Object.values(PATTERNS).filter(p => p.ranged).forEach(p => {
    const shooter = { x: 100, z: Z_REST, facing: 1, body: BODY };
    const real = realProjectile(p, shooter.x, 1);
    const geo = rangedLane(shooter, p, 0, lastWindupGrow(p));
    const b = geo.box;
    const drawnDepth = Math.min(rowToZ(b.y0) - Z_REST, Z_REST - rowToZ(b.y1));
    const overHead = b.x1 - real.headX, overTail = real.tailX - b.x0;
    const overDepth = drawnDepth - real.depth;
    out.push({
      label: `${p.id} projectile lane`,
      ok: overHead >= 0 && overHead <= OVER_WARN_SLACK &&
        overDepth >= 0 && overDepth <= OVER_WARN_SLACK &&
        overTail >= 0 && overTail <= 12,
      detail: `head drawn ${b.x1} vs real ${real.headX.toFixed(2)} · ` +
        `depth drawn ${drawnDepth.toFixed(2)} vs real ${real.depth.toFixed(2)} · ` +
        `travel ${real.travel.toFixed(1)} (geom ${projectileTravelWorld(p).toFixed(1)})`
    });
    let laneFrames = 0;
    for (let t = p.windupFrames; t >= 1; t--) {
      const gg = rangedLane(shooter, p, 0, growthFor(telegraphProgress({ state: 'windup', timer: t, pattern: p })));
      if (gg.box.x1 >= real.headX && rowToZ(gg.box.y0) - Z_REST >= real.depth) laneFrames++;
    }
    out.push({
      label: `${p.id} covers the real sweep on every windup frame`,
      ok: laneFrames === p.windupFrames, detail: `${laneFrames}/${p.windupFrames} windup frames cover it`
    });
    if (p.hazard) {
      const e = zoneEllipse({ x: geo.endWorld, z: Z_REST, radius: p.hazard.radius }, 0);
      out.push({
        label: `${p.id} detonation zone pre-drawn at r${p.hazard.radius}`,
        ok: e.rx >= p.hazard.radius && e.ry >= p.hazard.radius * Z_TO_Y_SCALE - 1e-9,
        detail: `rx ${e.rx} ry ${e.ry.toFixed(1)} at x=${geo.endWorld.toFixed(1)}`
      });
    }
  });
}

/* hazards.js is radial: every point at exactly `radius` must be inside the
   drawn ellipse, at every angle -- the old 0.7x drawing failed this on
   every one of them. */
function zoneChecks(out) {
  const radii = [...new Set(Object.values(PATTERNS).filter(p => p.hazard).map(p => p.hazard.radius))];
  radii.sort((a, b) => a - b).forEach(radius => {
    const e = zoneEllipse({ x: 300, z: Z_REST, radius }, 0);
    let worst = 0;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const wx = 300 + radius * Math.cos(a), wz = Z_REST + radius * Math.sin(a);
      const dx = wx - e.cx, dy = (GROUND_Y + (Z_REST - wz) * Z_TO_Y_SCALE) - e.cy;
      worst = Math.max(worst, Math.hypot(dx / e.rx, dy / e.ry));
    }
    out.push({
      label: `hazard r${radius} covers the full radial test`,
      ok: worst <= 1 + 1e-9 && e.rx <= radius + OVER_WARN_SLACK &&
        e.ry <= radius * Z_TO_Y_SCALE + OVER_WARN_SLACK,
      detail: `worst normalised radius ${worst.toFixed(4)} · rx ${e.rx} ry ${e.ry.toFixed(1)}`
    });
  });
}

export function runTelegraphGeometryChecks() {
  const checks = [];
  meleeChecks(checks);
  rangedChecks(checks);
  zoneChecks(checks);
  return { pass: checks.every(c => c.ok), checks };
}

/* standalone runner */
if (import.meta.url === `file://${process.argv[1]}`) {
  const verbose = process.argv.includes('--verbose');
  const { pass, checks } = runTelegraphGeometryChecks();
  if (verbose) checks.forEach(c => console.log((c.ok ? 'OK   ' : 'FAIL ') + c.label + ' — ' + c.detail));
  if (pass) {
    const melee = checks.filter(c => c.label.includes('melee AABB')).length;
    const lanes = checks.filter(c => c.label.includes('projectile lane')).length;
    const zones = checks.filter(c => c.label.startsWith('hazard r')).length;
    console.log(`OK   ${melee} melee footprints match hitbox.js's forward AABB (reach, depth and rear edge)`);
    console.log(`OK   ${lanes} ranged lanes match the projectile sweep (head, +/-10 depth, travel)`);
    console.log(`OK   ${melee + lanes} patterns cover their real hitbox on EVERY windup frame, not just the last`);
    console.log(`OK   ${zones} hazard radii cover the radial hypot test at all 64 angles`);
    console.log('\nTelegraph geometry matches the resolving hitbox for all ' +
      Object.keys(PATTERNS).length + ' patterns.');
  } else {
    checks.filter(c => !c.ok).forEach(c => console.log('FAIL ' + c.label + ' — ' + c.detail));
    console.log(`\n${checks.filter(c => !c.ok).length} telegraph geometry assertion(s) failed.`);
    process.exit(1);
  }
}
