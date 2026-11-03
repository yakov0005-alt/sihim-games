// Gameplay for leap (קפיצת הדג): a fish swims three lanes upstream, dodging
// rocks, leaping logs/waterfalls with timed tricks, and grabbing coins.
// Composes world.js (scene/camera/river), fish.js (the fish mesh) and
// obstacles.js (spawn/advance) on top of the pure rules in rules.js.
import { buildWorld } from './world.js';
import { createFish, BASE_Y } from './fish.js';
import { createObstacleField } from './obstacles.js';
import { makePopper, firePopper, updatePopper } from './popper.js';
import {
  RIVERS, laneX, clampLane, getLevel, isHit, jumpArc, isAirborne,
  resolveLeap, applyLanding, isGameOver, isLevelComplete, comboMultiplier,
} from './rules.js';

const JUMP_DURATION = 0.55;
const JUMP_HEIGHT = 1.5;
const FISH_Z = 2;
const SPAWN_Z = -85;
const COIN_SCORE = 12;

export function createPlay({ assets = {}, fx, audio }) {
  const world = buildWorld(assets);
  const { scene, camera, cameraBase } = world;

  const fish = createFish(assets);
  scene.add(fish.group);

  const field = createObstacleField(scene, assets);
  const splash = makePopper(scene, assets.droplet, 0.55, 0.78);
  const stamp = makePopper(scene, assets.twist, 0.7, 0.7);

  let spawnTimer = 0;
  let jumpT = 0, jumping = false, trickKeys = [];
  let targetLane = 1, laneVisual = 1;
  const spin = { x: 0, z: 0 };
  const spinTarget = { x: 0, z: 0 };
  let state = freshState();
  let swimClock = 0;

  function freshState() {
    return { phase: 'ready', score: 0, lives: 3, combo: 0, distance: 0, levelIndex: 0, lane: 1, airborne: false };
  }

  function reset() {
    state = freshState();
    jumpT = 0; jumping = false; trickKeys = [];
    targetLane = 1; laneVisual = 1;
    spin.x = spin.z = spinTarget.x = spinTarget.z = 0;
    spawnTimer = 0;
    swimClock = 0;
    field.clear();
    world.setRiverSky(0);
    fish.group.position.set(laneX(1), BASE_Y, FISH_Z);
    fish.group.rotation.set(0, 0, 0);
    fx && fx.reset();
    audio && audio.reset();
  }

  function steer(dir) {
    if (state.phase !== 'play') return;
    targetLane = clampLane(targetLane + dir);
    state.lane = targetLane;
    if (jumping) { trickKeys.push('twist'); spinTarget.z += dir * Math.PI * 2; audio && audio.trick('twist'); }
  }
  const moveLeft = () => steer(-1);
  const moveRight = () => steer(1);
  function jump() {
    if (state.phase !== 'play') return;
    if (!jumping) {
      jumping = true; jumpT = 0; trickKeys = [];
      audio && audio.jump();
      firePopper(splash, fish.group.position, 0.4);
      fx && fx.burst(fish.group.position, 'splash', 5);
    } else if (trickKeys.includes('flip')) {
      if (!trickKeys.includes('doubleFlip')) {
        trickKeys.push('doubleFlip'); spinTarget.x += Math.PI * 4; audio && audio.trick('doubleFlip');
      }
    } else {
      trickKeys.push('flip'); spinTarget.x += Math.PI * 2; audio && audio.trick('flip');
    }
  }

  function rollType() {
    const r = Math.random();
    return r < 0.38 ? 'rock' : r < 0.7 ? 'log' : 'waterfall';
  }

  function spawnWave() {
    const level = getLevel(state.levelIndex);
    const lane = field.pickLane([]);
    field.spawnObstacle(lane, rollType(), level.speed, SPAWN_Z);
    if (Math.random() < 0.32) {
      const coinLane = field.pickLane([lane]);
      if (coinLane !== null) field.spawnCoin(coinLane, level.speed, SPAWN_Z - 4);
    }
  }

  function resolveObstacle(o) {
    if (o.kind === 'coin') {
      if (o.lane === state.lane) {
        state.score += COIN_SCORE;
        audio && audio.coin();
        fx && fx.burst(o.mesh.position, 'coin');
        fx && fx.popup(`+${COIN_SCORE}`, o.mesh.position, { color: '#ffd24a' });
      }
      return;
    }
    const hit = isHit({ lane: state.lane, airborne: state.airborne }, { lane: o.lane, type: o.type });
    if (hit) {
      state = applyLanding(state, false);
      audio && audio.hit();
      fx && fx.burst(o.mesh.position, 'hit');
      fx && fx.shake(0.3 + (3 - state.lives) * 0.08);
      if (isGameOver(state)) { state.phase = 'over'; audio && audio.gameOver(); audio && audio.ambient(false); }
      return;
    }
    const wasThreat = o.lane === state.lane;
    const offset = wasThreat && jumping ? jumpT - JUMP_DURATION / 2 : 1;
    const leap = wasThreat
      ? resolveLeap({ offset, trickKeys, airDuration: JUMP_DURATION, combo: state.combo })
      : { points: 0, landed: [] };
    state = applyLanding(state, true);
    const gained = leap.points + Math.round(6 * comboMultiplier(state.combo));
    state.score += gained;
    audio && audio.land(true);
    fx && fx.burst(fish.group.position, 'splash', 6);
    if (leap.landed.length) {
      firePopper(stamp, fish.group.position, 0.55);
      fx && fx.burst(fish.group.position, 'trick');
    }
    fx && fx.popup(`+${gained}`, fish.group.position, { color: '#eafcff' });
    if (leap.timing) { fx && fx.timingText(leap.timing, fish.group.position); audio && audio.timing(leap.timing); }
    else if (state.combo >= 3 && state.combo % 3 === 0) fx && fx.comboText(state.combo, fish.group.position);
  }

  function advanceLevel() {
    if (state.levelIndex >= RIVERS.length - 1) {
      state.phase = 'win';
      audio && audio.win();
      audio && audio.ambient(false);
      fx && fx.burst(fish.group.position, 'cheer', 26);
      fx && fx.popup('ניצחון!', fish.group.position, { color: '#9df7c0', size: 56, dy: 1.1, life: 1.2 });
      return;
    }
    state.levelIndex += 1;
    state.distance = 0;
    field.clear();
    world.setRiverSky(state.levelIndex);
    audio && audio.levelUp();
    audio && audio.ambient(true, state.levelIndex);
    fx && fx.burst(fish.group.position, 'cheer');
    fx && fx.popup('לנהר הבא!', fish.group.position, { color: '#9df7c0', size: 48, dy: 1.1, life: 1 });
  }

  function update(dt) {
    if (state.phase !== 'play') return;
    const level = getLevel(state.levelIndex);

    laneVisual += (targetLane - laneVisual) * Math.min(1, dt * 9);
    fish.group.position.x = laneX(laneVisual);
    swimClock += dt;

    if (jumping) {
      jumpT += dt;
      fish.group.position.y = BASE_Y + jumpArc(jumpT, JUMP_DURATION, JUMP_HEIGHT);
      state.airborne = isAirborne(jumpT, JUMP_DURATION);
      if (jumpT >= JUMP_DURATION) {
        jumping = false;
        fish.group.position.y = BASE_Y;
        state.airborne = false;
        firePopper(splash, fish.group.position, 0.35);
        spin.x = spin.z = spinTarget.x = spinTarget.z = 0;
      }
    } else {
      // Idle swim bob/wag so the fish feels alive between leaps.
      fish.group.position.y = BASE_Y + Math.sin(swimClock * 6) * 0.025;
    }
    spin.x += (spinTarget.x - spin.x) * Math.min(1, dt * 10);
    spin.z += (spinTarget.z - spin.z) * Math.min(1, dt * 10);
    fish.group.rotation.x = spin.x;
    fish.group.rotation.z = jumping ? spin.z : spin.z + Math.sin(swimClock * 6) * 0.05;

    if (world.waterTex) world.waterTex.offset.y = (world.waterTex.offset.y + dt * level.speed * 0.05) % 1;

    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnTimer = level.spawnGap; spawnWave(); }

    field.update(dt, FISH_Z, resolveObstacle);
    updatePopper(splash, dt);
    updatePopper(stamp, dt);
    fx && fx.swimTrail(fish.group.position, dt, !jumping);

    const camOff = fx ? fx.cameraOffset() : { x: 0, y: 0 };
    camera.position.set(cameraBase.x + (laneVisual - 1) * 0.18 + camOff.x, cameraBase.y + camOff.y, cameraBase.z);

    state.distance += level.speed * dt;
    if (state.phase === 'play' && isLevelComplete(level, state.distance)) advanceLevel();
  }

  function start() {
    reset();
    state.phase = 'play';
    audio && audio.ambient(true, 0);
  }

  function getState() { return state; }
  function getObstacles() { return field.peek(FISH_Z); }
  return {
    scene, camera, start, update, resize: world.resize,
    getState, getObstacles, moveLeft, moveRight, jump,
  };
}
