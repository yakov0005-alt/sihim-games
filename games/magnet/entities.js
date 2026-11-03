// Entity helpers for "magnet": drone spawning/movement, boss patrol and the
// grab-target search. Builds on rules.js (drone stats, cable range, grab
// eligibility) but keeps per-entity visual state (wobble/spin) here, since
// that's rendering flavor rather than scoring logic rules.js owns.
import { createDrone, DRONE_TYPES, BOSS, isInCableRange, canGrab } from './rules.js';

export function randomEdgePoint(cx, cy, radius) {
  const angle = Math.random() * Math.PI * 2;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

export function spawnDrone(stage, cx, cy, spawnRadius) {
  const type = stage.types[Math.floor(Math.random() * stage.types.length)];
  const { x, y } = randomEdgePoint(cx, cy, spawnRadius);
  const d = createDrone(type, x, y);
  d.wobble = Math.random() * Math.PI * 2;
  d.rot = Math.random() * Math.PI * 2;
  d.spin = (Math.random() - 0.5) * 2.2;
  d.flash = 0;
  return d;
}

// Moves a drone straight toward the core with a light perpendicular wobble
// for liveliness; returns its new distance to the core center.
export function advanceDrone(d, dt, cx, cy, speedMul) {
  const def = DRONE_TYPES[d.type];
  const dx = cx - d.x, dy = cy - d.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist, ny = dy / dist;
  const speed = def.speed * speedMul;
  d.wobble += dt * 3.2;
  const wob = Math.sin(d.wobble) * 14;
  d.x += nx * speed * dt - ny * wob * dt;
  d.y += ny * speed * dt + nx * wob * dt;
  d.rot += d.spin * dt;
  if (d.flash > 0) d.flash = Math.max(0, d.flash - dt * 4);
  return dist;
}

// The magnet pulls in the nearest eligible drone anywhere within cable range
// (the skill is in timing the hold and then aiming the throw, not in
// pixel-perfect pointing at the catch) — and prioritizing the nearest one
// also means the most urgent threat gets grabbed first.
export function findGrabTarget(drones, cx, cy, range) {
  let best = null, bestDist = Infinity;
  for (const d of drones) {
    if (!canGrab(d)) continue;
    if (!isInCableRange(cx, cy, d.x, d.y, range)) continue;
    const dist = Math.hypot(d.x - cx, d.y - cy);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

export function createBoss(cx, y) {
  return { health: BOSS.health, x: cx, y, t: 0, flash: 0 };
}

export function advanceBoss(boss, dt, cx, cy, rangeX) {
  boss.t += dt;
  boss.x = cx + Math.sin(boss.t * 0.55) * rangeX;
  boss.y = cy;
  if (boss.flash > 0) boss.flash = Math.max(0, boss.flash - dt * 4);
}

const HOMING_RADIUS = 260;
const HOMING_TURN = 3.4; // max radians/sec the thrown drone's magnetized pull can curve it

// Thrown drones are still magnetized, so they gently curve toward the
// nearest live target within range instead of flying a dead-straight line —
// this keeps a rough toss satisfying without removing the need to aim.
export function advanceProjectile(p, dt, targets = []) {
  const speed = Math.hypot(p.vx, p.vy);
  let nearest = null, nearestDist = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < nearestDist) { nearestDist = d; nearest = t; }
  }
  if (nearest && nearestDist <= HOMING_RADIUS) {
    const wantAngle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
    const curAngle = Math.atan2(p.vy, p.vx);
    const diff = Math.atan2(Math.sin(wantAngle - curAngle), Math.cos(wantAngle - curAngle));
    const turn = Math.max(-HOMING_TURN * dt, Math.min(HOMING_TURN * dt, diff));
    const newAngle = curAngle + turn;
    p.vx = Math.cos(newAngle) * speed;
    p.vy = Math.sin(newAngle) * speed;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.rot += p.spin * dt;
  p.life -= dt;
}

export function outOfBounds(x, y, W, H, margin = 120) {
  return x < -margin || y < -margin || x > W + margin || y > H + margin;
}
