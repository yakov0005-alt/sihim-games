// Core gameplay + rendering for "neon" (מנהרת ניאון): a three.js tube
// racer. The hovercraft rides an angular lane around the inside of a neon
// pipe; holding climb drags it toward the wall to bank boost charge, and
// dropping back converts the bank into a speed burst. Obstacle gates and
// pickups come from entities.js, all scoring/collision/level rules from
// rules.js (pure, DOM-free) — this file only wires state to the scene.
import * as T from '../../lib/three.module.min.js';
import {
  LANE_COUNT, LIVES_START, TRACKS, getTrack, isTrackUnlocked,
  advanceDistance, isTrackComplete, steerLane, updateWallCharge,
  resolveWallDrop, judgeDropTiming, scoreBoost, scoreCleanPass,
  applyPickup, registerCrash, isGameOver, WALL_RADIUS,
} from './rules.js';
import { createTrackVisuals, RIDE_MIN_R, RIDE_MAX_R, CRAFT_Z } from './track.js';
import { createEntities, PICKUP_COLOR } from './entities.js';
import { createParticles } from './particles.js';

const PICKUP_SCORE = 15;

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function lerpAngle(a, b, t) { return a + angleDiff(a, b) * t; }
function laneAngleOf(lane) { return (lane / LANE_COUNT) * Math.PI * 2; }

export function createPlay({ assets, fx, audio }) {
  const scene = new T.Scene();
  scene.background = new T.Color(0x06040c);
  const camera = new T.PerspectiveCamera(70, 1, 0.1, 260);
  camera.position.set(0, 0, 2);

  const visuals = createTrackVisuals({ assets });
  scene.add(visuals.group);
  const particles = createParticles({ group: scene });
  const entities = createEntities({ assets, group: scene });

  const craftTex = new T.Texture(assets.hovercraft);
  craftTex.needsUpdate = true;
  craftTex.colorSpace = T.SRGBColorSpace;
  const craft = new T.Sprite(new T.SpriteMaterial({ map: craftTex, transparent: true }));
  craft.scale.set(1.7, 2.2, 1);
  craft.position.z = CRAFT_Z;
  scene.add(craft);

  const shieldTex = new T.Texture(assets.shield);
  shieldTex.needsUpdate = true;
  shieldTex.colorSpace = T.SRGBColorSpace;
  const shieldRing = new T.Sprite(new T.SpriteMaterial({
    map: shieldTex, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending,
  }));
  shieldRing.visible = false;
  scene.add(shieldRing);

  const mixA = new T.Color();
  const mixB = new T.Color();
  function mixHex(a, b, t) { mixA.setHex(a); mixB.setHex(b); mixA.lerp(mixB, Math.max(0, Math.min(1, t))); return mixA.getHex(); }

  let state = freshState();
  function freshState() {
    return {
      phase: 'title', score: 0, lives: LIVES_START, trackIndex: 0, combo: 0,
      distance: 0, lane: 0, laneAngle: 0, radius: 0, charge: 0,
      climbing: false, speed: 0, shielded: false, hitFlash: 0,
      shieldPulse: 0, trailClock: 0, nextGate: null, nextPickup: null,
      wasOnWall: false,
    };
  }

  function beginTrack() {
    const track = getTrack(state.trackIndex);
    state.distance = 0;
    state.speed = track.baseSpeed;
    visuals.setTrack(state.trackIndex);
    entities.reset(track);
  }

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function start(bestScore = 0) {
    state = freshState();
    particles.clear();
    fx.clear();
    let unlocked = 0;
    for (let i = TRACKS.length - 1; i >= 0; i--) {
      if (isTrackUnlocked(i, bestScore)) { unlocked = i; break; }
    }
    state.trackIndex = unlocked;
    state.phase = 'play';
    beginTrack();
  }

  function steerLeft() { if (state.phase !== 'play') return; state.lane = steerLane(state.lane, -1); audio.steer(); }
  function steerRight() { if (state.phase !== 'play') return; state.lane = steerLane(state.lane, 1); audio.steer(); }
  function climbStart() { if (!state.climbing && state.phase === 'play') audio.climbStart(); state.climbing = true; }
  function climbEnd() { state.climbing = false; }

  function update(dt) {
    if (state.phase !== 'play') return;
    const track = getTrack(state.trackIndex);

    const prevAngle = state.laneAngle;
    state.laneAngle = lerpAngle(state.laneAngle, laneAngleOf(state.lane), Math.min(1, dt * 9));

    const prevRadius = state.radius;
    const targetRadius = state.climbing ? 1 : 0;
    state.radius += (targetRadius - state.radius) * Math.min(1, dt * 3.4);
    const chargeBefore = state.charge;
    state.charge = updateWallCharge(state.charge, state.radius, dt);
    audio.climbTick(dt, state.radius > 0.05, state.charge);

    const r = RIDE_MIN_R + (RIDE_MAX_R - RIDE_MIN_R) * state.radius;
    craft.position.x = Math.sin(state.laneAngle) * r;
    craft.position.y = Math.cos(state.laneAngle) * r;
    const bank = Math.max(-0.6, Math.min(0.6, angleDiff(prevAngle, state.laneAngle) * -8));
    craft.material.rotation = bank - state.radius * 0.12;

    // The radius eases toward its target over several frames, so it never
    // jumps from >= WALL_RADIUS to < DROP_RADIUS within a single frame; a
    // sticky flag remembers "was on the wall" across the whole descent so
    // the drop still registers on the frame it finally crosses DROP_RADIUS.
    if (state.radius >= WALL_RADIUS) state.wasOnWall = true;
    const dropPrevRadius = state.wasOnWall ? WALL_RADIUS : prevRadius;
    const drop = resolveWallDrop(chargeBefore, dropPrevRadius, state.radius);
    if (drop.boosted) {
      state.wasOnWall = false;
      state.charge = 0;
      const quality = judgeDropTiming(chargeBefore);
      state.speed += drop.boost;
      state.score = scoreBoost(state.score, state.combo, drop.boost);
      fx.shake(quality === 'perfect' ? 0.55 : quality === 'good' ? 0.35 : 0.2);
      fx.flash(quality === 'perfect' ? 0xffd166 : 0xffb23d, quality === 'perfect' ? 0.3 : 0.16);
      fx.comboText(quality, state.combo);
      audio.boost(quality);
      particles.burst(craft.position.x, craft.position.y, craft.position.z, 0xffb23d, quality === 'perfect' ? 26 : 16);
    }

    state.trailClock -= dt;
    if (state.trailClock <= 0) {
      state.trailClock = 0.03;
      const trailColor = state.climbing ? mixHex(0x3df3ff, 0xffb23d, state.charge / 100) : 0x3df3ff;
      particles.trail(craft.position.x, craft.position.y, craft.position.z, trailColor);
    }

    state.speed = Math.max(track.baseSpeed, state.speed - dt * 1.6);
    state.distance = advanceDistance(state.distance, state.speed, dt);

    const player = { lane: state.lane, distance: state.distance, shielded: state.shielded };
    const events = entities.update(dt, craft.position.z, player);
    const peek = entities.peek(state.distance);
    state.nextGate = peek.gate;
    state.nextPickup = peek.pickup;

    if (events.crashes > 0) {
      const res = registerCrash(state.lives, state.combo);
      state.lives = res.lives; state.combo = res.combo;
      state.hitFlash = 0.4;
      fx.shake(0.85);
      fx.flash(0xff5050, 0.4);
      audio.crash();
      particles.burst(craft.position.x, craft.position.y, craft.position.z, 0xff5050, 22);
      if (isGameOver(state.lives)) { state.phase = 'over'; audio.gameOver(); fx.message('המנהרה ניצחה אתכם', 0xff5050); }
      else fx.message('התנגשות!', 0xff5050);
    }
    if (events.shieldHits > 0) {
      state.shielded = false;
      fx.shake(0.45);
      fx.flash(0xb16bff, 0.3);
      fx.message('המגן נשבר', 0xb16bff);
      audio.shieldBreak();
      particles.burst(craft.position.x, craft.position.y, craft.position.z, 0xb16bff, 18);
    }
    if (events.cleanPasses > 0) {
      for (let i = 0; i < events.cleanPasses; i++) {
        const res = scoreCleanPass(state.score, state.combo);
        state.score = res.score; state.combo = res.combo;
      }
      audio.cleanPass(state.combo);
    }
    for (const type of events.pickups) {
      state = { ...applyPickup(state, type), score: state.score + PICKUP_SCORE };
      audio.pickup(type);
      fx.scorePopup(PICKUP_SCORE);
      particles.burst(craft.position.x, craft.position.y, craft.position.z, PICKUP_COLOR[type], 18);
    }

    state.hitFlash = Math.max(0, state.hitFlash - dt);
    const f = state.hitFlash / 0.4;
    craft.material.color.setRGB(1, 1 - f * 0.75, 1 - f * 0.75);

    shieldRing.visible = state.shielded;
    if (state.shielded) {
      state.shieldPulse += dt * 4;
      const s = 2.5 + Math.sin(state.shieldPulse) * 0.15;
      shieldRing.position.set(craft.position.x, craft.position.y, craft.position.z + 0.05);
      shieldRing.scale.set(s, s, 1);
    }

    visuals.update(dt, state.speed);
    particles.update(dt);

    if (state.phase === 'play' && isTrackComplete(track, state.distance)) {
      if (state.trackIndex >= TRACKS.length - 1) {
        state.phase = 'win'; audio.win(); fx.flash(0xffd166, 0.35);
        fx.message('ניצחון! כל המסילות נכבשו', 0xffd166);
      } else {
        state.trackIndex += 1; audio.trackComplete(); fx.flash(0x3df3ff, 0.25);
        fx.message(`${track.name} הושלם`, 0x3df3ff);
        beginTrack();
      }
    }

    const shakeOff = fx.shakeOffset();
    camera.position.x = shakeOff.x;
    camera.position.y = shakeOff.y;
  }

  function getState() { return state; }

  return { scene, camera, resize, start, update, getState, steerLeft, steerRight, climbStart, climbEnd };
}
