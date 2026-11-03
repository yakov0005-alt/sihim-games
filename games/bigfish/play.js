// Core gameplay for "bigfish" (הדג החכם): wires the pure rope tug-of-war
// logic in rules.js to timed pulls, juice (fx/audio) and the rich canvas
// render in scene.js. game.js feeds swipe() from the real input path
// (keyboard + pointer drag) and reads getState()/draw() every frame.
import * as R from './rules.js';
import { geometry, knotX, renderScene } from './scene.js';
import { stepKick, kickWag, bumpKick } from './fish.js';

const POST_PULL_DELAY = 0.55; // pause after a pull resolves before the next spawns
const LEVEL_TRANSITION_DELAY = 1.3; // extra pause while a fisherman splashes in
const FALL_DURATION = 0.9; // seconds for a fisherman's into-the-lake animation
const LEAN_DECAY = 6; // 1/s
const FLASH_DECAY = 1.6; // 1/s
const COMBO_MILESTONES = [5, 10, 15, 20];

export function createPlay({ fx, audio } = {}) {
  let levelIndex = 0;
  let state = R.createState(0);
  let totalScore = 0;
  let pull = null;
  let pullElapsed = 0;
  let resolved = false;
  let postTimer = 0;
  let over = false, win = false;
  let lastOutcome = null;

  let t = 0;
  let kick = { energy: 0, phase: 0 };
  let fishLean = 0;
  let fishFall = 0;
  let fallActive = false;
  let fallClock = 0;
  let splash = null;
  let flash = 0;

  function spawnPull() {
    pull = R.generatePull(state.fisherman);
    pullElapsed = 0;
    resolved = false;
    lastOutcome = null;
  }

  function reset() {
    levelIndex = 0;
    state = R.createState(0);
    totalScore = 0;
    over = false;
    win = false;
    postTimer = 0;
    kick = { energy: 0, phase: 0 };
    fishLean = 0;
    fishFall = 0;
    fallActive = false;
    fallClock = 0;
    splash = null;
    flash = 0;
    fx && fx.reset();
    audio && audio.ambient(true, 0);
    spawnPull();
  }

  function fishermanAnchor(dims) {
    const g = geometry(dims.W, dims.H);
    const fw = Math.min(160, dims.W * 0.21);
    return { x: g.ropeEndX + fw * 0.12, y: g.midY + fw * 0.62 };
  }

  function triggerFall(dims) {
    fallActive = true;
    fallClock = 0;
    const a = fishermanAnchor(dims);
    // the splash sprite appears partway through the fall, at his feet
    splash = { x: a.x, y: a.y, t: -FALL_DURATION * 0.4, dur: 0.9 };
  }

  function judge(dir, dims) {
    const prevStatus = state.status;
    const prevCombo = state.combo;
    const result = R.applyPull(state, pull, dir, pullElapsed);
    resolved = true;
    lastOutcome = result.outcome;
    postTimer = POST_PULL_DELAY;
    totalScore += Math.max(0, result.points);

    const g = geometry(dims.W, dims.H);
    const kx = knotX(state.tension, g);
    if (result.outcome === 'hit') {
      const quality = R.reactionQuality(pullElapsed, pull.window);
      fx && fx.burst(kx, g.midY, '#9fe8ff');
      fx && fx.popup(kx, g.midY - 34, `+${result.points}`, { color: '#bff6ff' });
      audio && audio.hit(quality, pull.isFeint);
      kick = bumpKick(kick, 0.6 + quality * 0.7);
      fishLean -= pull.direction * 0.55;
      if (COMBO_MILESTONES.includes(state.combo) && state.combo > prevCombo) {
        fx && fx.comboText(g.ropeStartX + (g.ropeEndX - g.ropeStartX) * 0.5, g.midY - 100, state.combo);
        audio && audio.comboMilestone(state.combo);
      }
    } else {
      fx && fx.shake(result.outcome === 'wrong' ? 14 : 8);
      fx && fx.burst(kx, g.midY, '#ff8a6b', 8);
      audio && audio.miss(result.outcome);
      fishLean += pull.direction * 0.7;
      flash = Math.max(flash, 0.4);
    }

    if (state.status === 'win' && prevStatus !== 'win') {
      triggerFall(dims);
      if (!R.isGameComplete(levelIndex)) {
        const a = fishermanAnchor(dims);
        fx && fx.burst(a.x, a.y, '#9fe8ff', 20, 190);
        fx && fx.callOut(a.x, a.y - 60, 'צלילה!', '#9fe8ff');
        audio && audio.splash(levelIndex);
      }
    }
    if (state.status === 'lose' && prevStatus !== 'lose') {
      flash = Math.max(flash, 0.6);
      fx && fx.shake(22);
    }
  }

  function swipe(dir, dims = { W: 800, H: 600 }) {
    if (over || win || resolved || !pull) return;
    judge(dir, dims);
  }

  function advance() {
    if (state.status === 'win') {
      if (R.isGameComplete(levelIndex)) {
        over = true; win = true;
        audio && audio.ambient(false);
        audio && audio.win();
        return;
      }
      levelIndex = R.nextLevelIndex(levelIndex);
      state = R.createState(levelIndex);
      fishFall = 0; fallActive = false; fallClock = 0;
      postTimer = LEVEL_TRANSITION_DELAY;
      audio && audio.ambient(true, levelIndex);
      spawnPull();
    } else if (state.status === 'lose') {
      over = true; win = false;
      audio && audio.ambient(false);
      audio && audio.lose();
    } else {
      spawnPull();
    }
  }

  function update(dt, dims = { W: 800, H: 600 }) {
    t += dt;
    kick = stepKick(kick, dt);
    fishLean -= fishLean * Math.min(1, LEAN_DECAY * dt);
    flash = Math.max(0, flash - dt * FLASH_DECAY);
    if (fx) {
      const g = geometry(dims.W, dims.H);
      fx.drift(dt, dims.W, g.waterY, dims.H);
    }
    if (fallActive) {
      fallClock += dt;
      fishFall = Math.min(1, fallClock / FALL_DURATION);
      if (fallClock >= FALL_DURATION) fallActive = false;
    }
    if (splash) {
      splash.t += dt;
      if (splash.t >= splash.dur) splash = null;
    }

    if (over || win) return;
    if (!resolved && pull) {
      pullElapsed += dt;
      if (pullElapsed > pull.window) judge(null, dims);
      return;
    }
    if (postTimer > 0) {
      postTimer -= dt;
      if (postTimer <= 0) advance();
    }
  }

  function getState() {
    return {
      score: totalScore,
      levelIndex: state.levelIndex,
      fishermanName: state.fisherman.name,
      tension: state.tension,
      combo: state.combo,
      misses: state.misses,
      pull,
      pullElapsed,
      resolved,
      lastOutcome,
      over,
      win,
    };
  }

  function draw(ctx, images, W, H) {
    const anim = { t, kickWag: kickWag(kick), fishLean, fishFall, splash, flash };
    renderScene(ctx, images, W, H, getState(), anim);
  }

  return { reset, swipe, update, getState, draw };
}
