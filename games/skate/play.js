// Core gameplay: ride an endless desert track, launch off ramps on the wind
// gust's beat, chain tricks in the air, and land clean on the next ramp.
import {
  TRICKS, getLevel, createState, startJump, performTrick, landJump,
  gustPower, stageComplete, isGameOver, LEVELS,
} from './rules.js';
import { createFx } from './fx.js';
import { sfx, updateAmbience } from './audio.js';
import {
  GROUND_Y, PLAYER_SCREEN_X, speedForStage, gustPeriodForStage,
  worldToScreenX, createTrack, updateTrack, rampAt,
} from './world.js';
import { drawCover, drawTileBand, drawRampSprite, drawRider, drawGustMeter } from './render.js';

const TRICK_SPRITE = { kickflip: 'boy-kickflip', grab: 'boy-grab', spin: 'boy-spin' };
const QUALITY_LABEL = { perfect: 'נחיתה מושלמת!', good: 'נחיתה טובה', sloppy: 'נחיתה' };
const QUALITY_COLOR = { perfect: '#ffd34d', good: '#7cffb2', sloppy: '#cfe3f2' };
const STAGE_NAME_HE = { ridge: 'הרכס', dune: 'הדיונה', canyon: 'הקניון' };

export function createPlay() {
  const fx = createFx();
  let lastW = 800, lastH = 450;
  let state, track, player, gustPhase, flight, trickAnim, land, t, prev;

  function reset() {
    state = createState();
    state.result = null;
    track = createTrack();
    player = { worldX: 0 };
    gustPhase = 0;
    flight = null;
    trickAnim = null;
    land = null;
    fx.clear();
    t = 0;
    prev = { launch: false, kickflip: false, grab: false, spin: false };
  }
  reset();

  function edge(input, key) {
    const now = !!input[key];
    const was = prev[key];
    return now && !was;
  }

  function playerScreenPos() {
    return { x: lastW * PLAYER_SCREEN_X, y: lastH * GROUND_Y - 40 };
  }

  function launch(level) {
    const ramp = rampAt(track, player.worldX);
    if (!ramp) { sfx.deny(); return; }
    const power = gustPower(gustPhase);
    startJump(state, level, power);
    flight = { budget: state.jump.budget, elapsed: 0 };
    sfx.launch(power);
  }

  function doTrick(key) {
    const r = performTrick(state, key);
    if (r.outcome === 'ok') {
      trickAnim = { key, t: 0, dur: TRICKS[key].time };
      sfx.trick(key, state.jump.tricks.length - 1);
      const pos = playerScreenPos();
      fx.popup(`+${r.points}`, '#ffe8c1', pos.x, pos.y - 70, { size: 14, dur: 0.6, rise: 35 });
    } else if (r.outcome === 'noAir') {
      sfx.deny();
    }
  }

  function resolveLanding(level) {
    const ramp = rampAt(track, player.worldX) || { x: -99999, width: 0 };
    const result = landJump(state, player.worldX, ramp);
    flight = null;
    const pos = playerScreenPos();
    if (result.outcome === 'landed') {
      fx.popup(`${QUALITY_LABEL[result.quality]} +${result.points}`, QUALITY_COLOR[result.quality], pos.x, pos.y);
      fx.burst(pos.x, pos.y, QUALITY_COLOR[result.quality], 16);
      sfx.land(result.quality);
      land = { t: 0 };
      if (state.combo >= 3 && state.combo % 3 === 0) {
        fx.flashCombo(`שרשרת ×${state.combo}!`, '#ffd34d');
        sfx.comboMilestone(state.combo);
      }
      if (stageComplete(level, state.score)) {
        if (state.stage < LEVELS.length - 1) {
          state.stage += 1;
          fx.popup('שלב הושלם!', '#7bdcff', pos.x, pos.y - 30, { size: 20, dur: 1.1 });
          sfx.stageClear();
        } else {
          state.result = 'win';
          sfx.win();
        }
      }
    } else {
      fx.burst(pos.x, pos.y, '#ff7a59', 22, 220);
      fx.shake(14);
      const wiped = result.outcome === 'wipeout';
      wiped ? sfx.wipeout() : sfx.crash();
      fx.popup(wiped ? 'ספין לא נגמר!' : 'התרסקות!', '#ff8a73', pos.x, pos.y);
      land = { t: 0 };
      if (isGameOver(state)) state.result = 'over';
    }
  }

  function update(dt, input) {
    t += dt;
    fx.update(dt);
    const level = getLevel(state.stage);
    const speed = speedForStage(state.stage);
    const gust = gustPower(gustPhase);
    gustPhase += dt / gustPeriodForStage(state.stage);
    updateTrack(track, player.worldX);
    player.worldX += speed * dt;
    fx.drift(dt, lastW, lastH, 3 + speed / 60, speed * 0.6);
    updateAmbience(dt, { gust, speedFactor: state.stage / (LEVELS.length - 1), airborne: state.airborne });
    if (land) { land.t += dt; if (land.t > 0.3) land = null; }
    if (trickAnim) { trickAnim.t += dt; if (trickAnim.t >= trickAnim.dur) trickAnim = null; }

    if (!state.result) {
      if (state.airborne && flight) {
        flight.elapsed += dt;
        if (edge(input, 'kickflip')) doTrick('kickflip');
        if (edge(input, 'grab')) doTrick('grab');
        if (edge(input, 'spin')) doTrick('spin');
        if (flight.elapsed >= flight.budget) resolveLanding(level);
      } else if (edge(input, 'launch')) {
        launch(level);
      }
    }
    prev.launch = !!input.launch; prev.kickflip = !!input.kickflip;
    prev.grab = !!input.grab; prev.spin = !!input.spin;
  }

  function draw(ctx, images, w, h) {
    lastW = w; lastH = h;
    const level = getLevel(state.stage);
    const { dx, dy } = fx.shakeOffset();
    ctx.save();
    ctx.translate(dx, dy);
    ctx.fillStyle = '#19122a';
    ctx.fillRect(-10, -10, w + 20, h + 20);
    drawCover(ctx, images['sky'], 0, 0, w, h * 0.5);
    drawCover(ctx, images['storm'], 0, h * 0.05, w, h * 0.55);
    const groundY = h * GROUND_Y;
    drawTileBand(ctx, images['mesas'], 0, groundY - 70, w, 70, player.worldX * 0.35);
    fx.drawMotes(ctx);
    drawTileBand(ctx, images['sand'], 0, groundY - 6, w, h - (groundY - 6), player.worldX * 0.9);
    for (const ramp of track.ramps) {
      const sx = worldToScreenX(ramp.x, player.worldX, w);
      if (sx > w + 220 || sx + ramp.width < -220) continue;
      drawRampSprite(ctx, images[ramp.style], sx, ramp.width, groundY);
    }
    drawGustMeter(ctx, images['wind'], w * 0.14, h * 0.24, gustPower(gustPhase), state.airborne);

    let pose = 'boy-ride', anchor = 'bottom', rot = 0, bob = Math.sin(t * 6) * 3, lift = 0;
    if (land) {
      pose = 'boy-land'; bob = 0;
    } else if (state.airborne) {
      const progress = flight ? Math.min(1, flight.elapsed / flight.budget) : 0;
      lift = -Math.sin(progress * Math.PI) * (40 + (flight ? flight.budget : 1) * 55);
      bob = 0; anchor = 'center';
      if (trickAnim) {
        pose = TRICK_SPRITE[trickAnim.key];
        if (trickAnim.key === 'spin') rot = (trickAnim.t / trickAnim.dur) * Math.PI * 2;
      } else {
        pose = 'boy-tuck';
      }
    }
    const px = w * PLAYER_SCREEN_X, py = groundY + bob + lift;
    drawRider(ctx, images[pose], px, py, Math.min(185, h * 0.24), { anchor, rotation: rot });
    ctx.restore();

    fx.drawPopups(ctx, w * PLAYER_SCREEN_X, groundY - 60);
    fx.draw(ctx);
    fx.drawComboFlash(ctx, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '700 13px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(STAGE_NAME_HE[level.name] || level.name, w / 2, h * 0.08);
  }

  return { get state() { return state; }, reset, update, draw };
}
