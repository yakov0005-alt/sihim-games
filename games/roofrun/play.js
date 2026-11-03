// Gameplay glue: advances the runner along the route using the pure rules in
// rules.js, spawns obstacles/envelopes and resolves them against the
// runner's current action. No DOM access — game.js owns the canvas/input.
import * as R from './rules.js';

export const RUNNER_X = 120;
const SPAWN_X = 900;
const SCROLL_PX_PER_UNIT = 60;

export function createPlay({ fx, audio } = {}) {
  let levelIndex, level, distance, time, lives, score, combo, action, actionT, spawnTimer, obstacles, envelopes, done;

  function reset() {
    levelIndex = 0;
    level = R.getLevel(0);
    distance = 0; time = 0; lives = level.lives; score = 0; combo = 0;
    action = R.ACTIONS.RUN; actionT = 0; spawnTimer = level.spawnGap;
    obstacles = []; envelopes = []; done = false;
    return getState();
  }

  function jump() {
    if (done || action !== R.ACTIONS.RUN) return;
    action = R.ACTIONS.JUMP; actionT = 0;
    audio && audio.jump();
  }

  function slide() {
    if (done || action !== R.ACTIONS.RUN) return;
    action = R.ACTIONS.SLIDE; actionT = 0;
    audio && audio.slide();
  }

  function spawn() {
    if (Math.random() < 0.3) {
      envelopes.push({ x: SPAWN_X, taken: false });
    } else {
      obstacles.push({ ...R.pickObstacleType(), x: SPAWN_X, resolved: false });
    }
  }

  function update(dt, { onGameOver, onWin } = {}) {
    if (done) return;
    time += dt;
    distance = R.advanceDistance(distance, level.speed, dt);
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawn(); spawnTimer = level.spawnGap; }

    if (action !== R.ACTIONS.RUN) {
      actionT += dt;
      const dur = action === R.ACTIONS.JUMP ? R.JUMP_DURATION : R.SLIDE_DURATION;
      if (actionT >= dur) { action = R.ACTIONS.RUN; actionT = 0; }
    }

    const scroll = level.speed * SCROLL_PX_PER_UNIT * dt;

    for (const o of obstacles) {
      if (o.resolved) continue;
      o.x -= scroll;
      if (o.x <= RUNNER_X + 16) {
        o.resolved = true;
        const res = R.resolveObstacle({ runner: { action }, obstacle: o, offset: 0 });
        if (res.hit) {
          lives = Math.max(0, lives - 1);
          combo = 0;
          fx && fx.shake(8);
          fx && fx.flash('#ff5a5a', 0.4);
          fx && fx.popup(RUNNER_X, -40, '-1', { color: '#ff7a7a', size: 24 });
          audio && audio.miss();
        } else {
          score += res.points;
          const tint = res.timing === 'perfect' ? '#ffd24a' : res.timing === 'ok' ? '#c9d3e0' : '#ffe39e';
          fx && fx.burst(RUNNER_X, -30, tint);
          fx && fx.popup(RUNNER_X, -40, `+${res.points}`, { color: tint });
          audio && audio.clear(res.points, res.timing);
        }
      }
    }
    obstacles = obstacles.filter((o) => o.x > -60);

    for (const e of envelopes) {
      if (e.taken) continue;
      e.x -= scroll;
      if (!e.taken && e.x <= RUNNER_X + 16) {
        e.taken = true;
        const res = R.collectEnvelope(combo);
        score += res.points;
        combo = res.combo;
        fx && fx.burst(RUNNER_X, -50, '#9fe5ed');
        fx && fx.popup(RUNNER_X, -60, `+${res.points}`, { color: '#9fe5ed' });
        audio && audio.collect(res.points, combo);
        if (combo > 0 && combo % 5 === 0) {
          fx && fx.combo(RUNNER_X, -80, combo);
          audio && audio.comboMilestone(combo);
        }
      }
    }
    envelopes = envelopes.filter((e) => e.x > -60);

    if (lives <= 0) {
      done = true;
      fx && fx.flash('#ff2d2d', 0.5);
      audio && audio.ambient(false);
      onGameOver && onGameOver(score);
      return;
    }

    if (R.isLevelComplete(level, distance) || time >= level.time) {
      if (levelIndex >= R.LEVELS.length - 1) {
        done = true;
        fx && fx.flash('#fff4cf', 0.5);
        audio && audio.win();
        audio && audio.ambient(false);
        onWin && onWin(score);
      } else {
        levelIndex++;
        level = R.getLevel(levelIndex);
        distance = 0; time = 0; spawnTimer = level.spawnGap;
        obstacles = []; envelopes = [];
        fx && fx.flash('#ffe7a8', 0.3);
        audio && audio.levelUp();
      }
    }
  }

  function drawSprite(ctx, img, x, groundY, h = 92) {
    if (!img) return;
    const w = img.width * (h / img.height);
    ctx.drawImage(img, x - w / 2, groundY - h, w, h);
  }

  function drawGround(ctx, W, H, groundY) {
    const g = ctx.createLinearGradient(0, groundY, 0, H);
    g.addColorStop(0, '#36495b');
    g.addColorStop(1, '#202c38');
    ctx.fillStyle = g;
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(0, groundY, W, 2);
    // scrolling tar-seam ties, evoking the rooftop/track corridor beside the train
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 3;
    const seam = 46, off = -((distance * 8) % seam);
    for (let x = off; x < W; x += seam) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 6);
      ctx.lineTo(x - 10, H);
      ctx.stroke();
    }
  }

  let frameCanvas, frameW, frameH;
  function buildFrame(img, W, H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const fctx = c.getContext('2d');
    const iw = img.width, ih = img.height;
    const sx0 = 33, sx1 = 219, sy0 = 86, sy1 = 219; // glass bounds inside window.webp
    const L = Math.min(34, Math.max(14, W * 0.035));
    const Rg = L, T = Math.min(46, Math.max(18, H * 0.05)), B = Math.min(30, Math.max(14, H * 0.035));
    const slices = [
      [0, 0, sx0, sy0, 0, 0, L, T],
      [sx0, 0, sx1 - sx0, sy0, L, 0, W - L - Rg, T],
      [sx1, 0, iw - sx1, sy0, W - Rg, 0, Rg, T],
      [0, sy0, sx0, sy1 - sy0, 0, T, L, H - T - B],
      [sx1, sy0, iw - sx1, sy1 - sy0, W - Rg, T, Rg, H - T - B],
      [0, sy1, sx0, ih - sy1, 0, H - B, L, B],
      [sx0, sy1, sx1 - sx0, ih - sy1, L, H - B, W - L - Rg, B],
      [sx1, sy1, iw - sx1, ih - sy1, W - Rg, H - B, Rg, B],
    ];
    for (const s of slices) fctx.drawImage(img, ...s);
    frameCanvas = c; frameW = W; frameH = H;
  }

  function draw(ctx, images, W, H) {
    const bg = images[level.route === 'town' ? 'town' : 'hills'];
    const groundY = H * 0.78;
    if (bg) {
      const h = groundY, w = bg.width * (h / bg.height);
      let off = -(distance * 8) % w;
      if (off > 0) off -= w;
      for (let x = off; x < W; x += w) ctx.drawImage(bg, x, 0, w, h);
    } else {
      ctx.fillStyle = '#203040';
      ctx.fillRect(0, 0, W, groundY);
    }
    drawGround(ctx, W, H, groundY);

    for (const o of obstacles) drawSprite(ctx, images[o.type], o.x, o.height === 'head' || o.type === 'laundry' ? groundY - 46 : groundY);
    for (const e of envelopes) if (!e.taken) drawSprite(ctx, images.envelope, e.x, groundY - 10, 56);

    let spriteName = Math.floor(time * 8) % 2 ? 'runner-run-2' : 'runner-run-1';
    if (action === R.ACTIONS.JUMP) spriteName = 'runner-jump';
    else if (action === R.ACTIONS.SLIDE) spriteName = 'runner-slide';
    const lift = action === R.ACTIONS.JUMP ? R.jumpArc(actionT) * 55 : 0;
    drawSprite(ctx, images[spriteName], RUNNER_X, groundY - lift);

    if (images.window && images.window.complete && images.window.naturalWidth) {
      if (!frameCanvas || frameW !== W || frameH !== H) buildFrame(images.window, W, H);
      ctx.drawImage(frameCanvas, 0, 0);
    }
  }

  function getState() {
    return { score, lives, combo, levelIndex, level, distance, time, action, obstacles, envelopes };
  }

  reset(); // valid state from the first title-screen frame, before startRun() calls reset() again
  return { reset, jump, slide, update, draw, getState };
}
