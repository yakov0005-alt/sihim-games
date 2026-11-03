// Gameplay glue for "shore" — wires the pure rules in rules.js to a bird
// position, animation timers and juicy feedback, then hands a snapshot to
// render.js. No DOM access. Keeps the reset/update/getState/draw contract
// that game.js and bot.js rely on.
import * as R from './rules.js';
import { drawScene, worldToScreenX, groundBaseline } from './render.js';

const BIRD_SPEED = 150; // world units per second
const WORLD_PAD = 40; // room beyond the level's max tide reach
const PECK_LOCK = 0.16; // bird commits to the peck animation briefly
const PANIC_TIME = 0.5; // fleeing pose + input lock after a wave hit
const KNOCKBACK = 22; // pushed back toward shore when caught
const HIT_FLASH_TIME = 0.35;
const COMBO_MILESTONES = [5, 10];

export function createPlay({ fx, audio } = {}) {
  let state = R.createState(1);
  let levelIndex = 0;
  let birdX = 0;
  let win = false;
  let over = false;

  let facing = 1; // 1 = toward the sea, -1 = toward shore
  let clock = 0;
  let peckTimer = 0;
  let panicTimer = 0;
  let hitFlashTimer = 0;
  let moving = false;
  let lastW = 390, lastH = 844; // sane defaults before the first real draw

  function reset(seed = 1) {
    state = R.createState(seed);
    levelIndex = 0;
    birdX = 0;
    win = false;
    over = false;
    facing = 1;
    clock = 0;
    peckTimer = 0;
    panicTimer = 0;
    hitFlashTimer = 0;
    moving = false;
    audio?.ambient(true);
  }

  function worldMax() {
    return R.getLevel(levelIndex).tideMax + WORLD_PAD;
  }

  function screenPos(wx) {
    return [worldToScreenX(wx, worldMax(), lastW), groundBaseline(lastW, lastH)];
  }

  function update(dt, { dx = 0, peck = false } = {}) {
    if (over || win) return;
    clock += dt;
    const level = R.getLevel(levelIndex);
    const edge = R.updateTide(state, level, dt);

    peckTimer = Math.max(0, peckTimer - dt);
    panicTimer = Math.max(0, panicTimer - dt);
    hitFlashTimer = Math.max(0, hitFlashTimer - dt);

    const locked = peckTimer > 0 || panicTimer > 0;
    moving = false;
    if (!locked && dx !== 0) {
      facing = dx > 0 ? 1 : -1;
      birdX = Math.max(0, Math.min(worldMax(), birdX + dx * BIRD_SPEED * dt));
      moving = true;
    }

    if (peck && peckTimer <= 0 && panicTimer <= 0) {
      peckTimer = PECK_LOCK;
      const target = state.items.find((it) => R.canPeck(it, birdX, edge));
      if (target) {
        const comboBefore = state.combo;
        const r = R.performPeck(state, target.id, birdX, edge);
        if (r.outcome === 'pecked') {
          audio?.peck(state.combo, target.type);
          const [sx, sy] = screenPos(target.x);
          fx?.burst(sx, sy, target.type === 'crab' ? '#ff8a5c' : '#ffe8c1');
          const hot = state.combo >= 5;
          fx?.popup(sx, sy - 30, `+${r.points}`, { color: hot ? '#ffb347' : '#ffe8c1' });
          for (const m of COMBO_MILESTONES) {
            if (comboBefore < m && state.combo >= m) {
              fx?.flashCombo(lastW / 2, lastH * 0.3, `רצף x${m}!`, '#ffb347');
              audio?.comboMilestone(m);
            }
          }
        }
      }
    }

    const hit = panicTimer > 0 ? { outcome: 'safe' } : R.checkWaveHit(state, birdX, edge);
    if (hit.outcome === 'hit') {
      audio?.wave(hit.lives);
      fx?.shake(10);
      const [sx, sy] = screenPos(birdX);
      fx?.burst(sx, sy, '#bfe9ff', 14);
      panicTimer = PANIC_TIME;
      hitFlashTimer = HIT_FLASH_TIME;
      birdX = Math.max(0, birdX - KNOCKBACK);
      if (R.isGameOver(state)) {
        over = true;
        audio?.ambient(false);
      }
    }

    if (!over && R.stageComplete(level, state.score)) {
      if (levelIndex < R.LEVELS.length - 1) {
        levelIndex++;
        audio?.levelUp();
        fx?.flashCombo(lastW / 2, lastH * 0.3, 'שלב הבא!', '#ffe8c1');
      } else {
        win = true;
        audio?.win();
        audio?.ambient(false);
      }
    }

    const baseline = groundBaseline(lastW, lastH);
    fx?.drift(dt, lastW, baseline - 56, baseline - 8, 3, -24);
  }

  function getState() {
    const level = R.getLevel(levelIndex);
    return {
      score: state.score,
      combo: state.combo,
      lives: state.lives,
      levelIndex,
      levelName: level.name,
      edge: R.tideEdge(state.t, level),
      items: state.items,
      birdX,
      over,
      win,
    };
  }

  function draw(ctx, images, width, height) {
    lastW = width;
    lastH = height;
    const level = R.getLevel(levelIndex);
    drawScene(ctx, images, width, height, {
      clock,
      levelIndex,
      birdX,
      edge: R.tideEdge(state.t, level),
      worldMax: worldMax(),
      facing,
      moving,
      peckTimer,
      panicTimer,
      hitFlash: hitFlashTimer / HIT_FLASH_TIME,
      items: state.items,
    });
  }

  return { reset, update, getState, draw };
}
