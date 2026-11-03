// Gameplay for "tray" (מגש הפירות): tilt-physics balls rolling on a circular
// tray, matched via the pure rules in rules.js. No DOM access. Visual-only
// extras (rolling spin, spawn pop, clear shrink, floating score text) live
// alongside the sim state here but never feed back into physics/score, so
// the reset/update/getState/draw contract stays simple for game.js/bot.js.
import * as R from './rules.js';
import { drawScene, COLORS } from './render.js';

const RADIUS = 0.52; // unit tray radius, sized to the tray art's recessed floor (not its outer rim)
const BALL_R = 0.1;
const ACCEL = 2.6; // tilt -> acceleration scale
const FRICTION = 1.6; // per-second velocity decay
const RESTITUTION = 0.45;
const SPAWN_EVERY = 1.1;
const CHAIN_WINDOW = 1.1; // seconds; clears inside this window keep the chain going
const POP_DUR = 0.3;
const TILT_SMOOTH = 7; // per-second lerp rate for the visual tray-tilt lean

export function createPlay({ fx, audio } = {}) {
  let levelIndex = 0, level = R.getLevel(0);
  let balls = [], poppers = [], nextId = 1;
  let score = 0, clears = 0, timeLeft = 0, spawnTimer = 0;
  let chainIndex = 0, chainClock = 0;
  let over = false, win = false;
  let visTilt = { dx: 0, dy: 0 };
  let wasTilting = false;

  function reset() {
    levelIndex = 0;
    level = R.getLevel(0);
    balls = [];
    poppers = [];
    nextId = 1;
    score = 0;
    clears = 0;
    timeLeft = level.time;
    spawnTimer = 0.4;
    chainIndex = 0;
    chainClock = 0;
    over = false;
    win = false;
    visTilt = { dx: 0, dy: 0 };
    wasTilting = false;
    audio?.reset();
    audio?.ambient(true, 0);
  }

  function startLevel(i) {
    levelIndex = i;
    level = R.getLevel(i);
    clears = 0;
    timeLeft = level.time;
    balls = [];
    chainIndex = 0;
    chainClock = 0;
    audio?.ambient(true, i);
  }

  function spawnBall() {
    const counts = R.FRUITS.map((_, i) => balls.filter((b) => b.type === R.FRUITS[i]).length);
    const type = R.FRUITS[R.pickSpawnType(counts, level.kinds, Math.random())];
    const a = Math.random() * Math.PI * 2;
    const x = Math.cos(a) * 0.15, y = Math.sin(a) * 0.15;
    balls.push({
      id: nextId++, type, x, y,
      vx: 0, vy: 0, r: BALL_R, rot: Math.random() * Math.PI * 2, age: 0, edgeHit: false,
    });
    fx?.burst(x, y, COLORS[type] || '#fff', 5, { spark: true });
    audio?.spawn(type);
  }

  function physics(dt, tilt) {
    const ax = tilt.dx * ACCEL, ay = tilt.dy * ACCEL;
    const decay = Math.max(0, 1 - FRICTION * dt);
    for (const b of balls) {
      b.vx = (b.vx + ax * dt) * decay;
      b.vy = (b.vy + ay * dt) * decay;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vx * dt * 2.4; // rolls in the direction it's moving
      b.age += dt;
    }
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const overlap = a.r + b.r - d;
        if (overlap > 0) {
          const nx = dx / d, ny = dy / d;
          a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
        }
      }
    }
    for (const b of balls) {
      const d = Math.hypot(b.x, b.y);
      const max = RADIUS - b.r;
      if (d > max) {
        const nx = b.x / d, ny = b.y / d;
        b.x = nx * max; b.y = ny * max;
        const vn = b.vx * nx + b.vy * ny;
        b.vx -= (1 + RESTITUTION) * vn * nx;
        b.vy -= (1 + RESTITUTION) * vn * ny;
        if (!b.edgeHit && -vn > 0.12) {
          fx?.bump(b.x, b.y, nx, ny, -vn);
          audio?.bounce(-vn);
        }
        b.edgeHit = true;
      } else {
        b.edgeHit = false;
      }
    }
  }

  function resolveMatches() {
    const matches = R.matchesFromClusters(R.findClusters(balls, 0.1), 3);
    if (!matches.length) return;
    const toRemove = new Set();
    for (const m of matches) {
      const gained = R.scoreForCluster(m.ids.length, chainIndex);
      score += gained;
      clears++;
      const color = COLORS[m.type] || '#fff';
      let sx = 0, sy = 0, n = 0;
      for (const id of m.ids) {
        const ball = balls.find((b) => b.id === id);
        if (ball) { poppers.push({ x: ball.x, y: ball.y, type: ball.type, r: ball.r, t: 0 }); sx += ball.x; sy += ball.y; n++; }
        toRemove.add(id);
      }
      if (n) {
        sx /= n; sy /= n;
        fx?.floatText(sx, sy, `+${gained}`, '#fff6e0', { dy: -0.12 });
        if (chainIndex > 0) fx?.comboText(sx, sy, chainIndex);
        fx?.burst(sx, sy, color, 10 + m.ids.length * 2);
        if (m.ids.length >= 5 || chainIndex >= 2) fx?.ring(sx, sy, color);
        fx?.shake(4 + m.ids.length + chainIndex * 1.5);
      }
      audio?.clear(m.ids.length, chainIndex, m.type);
      chainIndex++;
      chainClock = CHAIN_WINDOW;
    }
    balls = balls.filter((b) => !toRemove.has(b.id));
  }

  function update(dt, tilt = { dx: 0, dy: 0 }) {
    const lerp = Math.min(1, TILT_SMOOTH * dt);
    visTilt.dx += (tilt.dx - visTilt.dx) * lerp;
    visTilt.dy += (tilt.dy - visTilt.dy) * lerp;
    for (let i = poppers.length - 1; i >= 0; i--) {
      poppers[i].t += dt;
      if (poppers[i].t >= POP_DUR) poppers.splice(i, 1);
    }
    if (over || win) return;
    timeLeft -= dt;
    chainClock -= dt;
    if (chainClock <= 0) chainIndex = 0;

    const tilting = Math.hypot(tilt.dx, tilt.dy) > (wasTilting ? 0.05 : 0.15);
    if (tilting && !wasTilting) audio?.tiltStart();
    wasTilting = tilting;

    spawnTimer -= dt;
    if (spawnTimer <= 0 && balls.length < level.maxFruit) { spawnBall(); spawnTimer = SPAWN_EVERY; }

    physics(dt, tilt);
    resolveMatches();

    if (R.isLevelComplete(level, clears)) {
      audio?.levelUp();
      if (levelIndex >= 4) { win = true; audio?.win(); }
      else startLevel(levelIndex + 1);
    } else if (timeLeft <= 0) {
      over = true;
      audio?.gameOver();
    }
  }

  function getState() {
    return { score, levelIndex, level, clears, timeLeft, balls, poppers, over, win };
  }

  function draw(ctx, images, width, height) {
    drawScene(ctx, images, width, height, { balls, poppers }, fx, visTilt);
  }

  return { reset, update, getState, draw };
}
