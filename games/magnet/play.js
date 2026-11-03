// Gameplay for "magnet" (רובו-מגנט): owns real state shaped by rules.js
// (score/combo/lives/wave), drives drone/boss spawning & movement, the
// grab-swing-throw cable mechanic, and hands rendering off to render.js.
import {
  createState, DRONE_TYPES, BOSS,
  CABLE_RANGE, MAX_CHARGE, CHARGE_RATE, throwSpeedFor,
  applyThrowHit, applyBossHit, applyBreach,
  tickCombo, waveFor, isGameOver, canGrab,
} from './rules.js';
import { spawnDrone, advanceDrone, findGrabTarget, createBoss, advanceBoss, advanceProjectile, outOfBounds } from './entities.js';
import { drawScene } from './render.js';
import { createSparkFx } from './sparkfx.js';

const CORE_RADIUS = 46;
const MAX_ACTIVE_DRONES = 7;
const PROJECTILE_LIFE = 2.4;
const FIRST_SPAWN_RADIUS = 430; // closer opening spawn so a drone reads clearly in the first few seconds

function waveTarget(wave) {
  return Math.min(22, 6 + (wave - 1) * 3);
}

export function createPlay({ fx, audio } = {}) {
  const spark = createSparkFx();
  let state = createState();
  let drones = [], projectiles = [], held = null, boss = null;
  let charge = 0, spawnTimer = 0, wavePops = 0, fullChargeFired = false, firstSpawn = true;
  let aim = { x: null, y: null, action: false };
  let lastW = 800, lastH = 600;
  let over = false, win = false;

  // Combo milestones get a punchy canvas callout on top of the HUD pill.
  const COMBO_MILESTONES = new Set([3, 5, 8, 12]);
  function maybeComboPunch(x, y) { if (COMBO_MILESTONES.has(state.combo)) fx.comboPunch(x, y, state.combo); }

  function reset() {
    state = createState();
    drones = []; projectiles = []; held = null; boss = null;
    charge = 0; spawnTimer = 0; wavePops = 0; fullChargeFired = false; firstSpawn = true;
    aim = { x: null, y: null, action: false };
    over = false; win = false; audio.startAmbience();
  }

  function core() {
    return { cx: lastW / 2, cy: lastH / 2 };
  }

  function clampToRange(cx, cy, x, y, range) {
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const r = Math.min(d, range);
    return { x: cx + (dx / d) * r, y: cy + (dy / d) * r };
  }

  function spawnIfDue(dt, stage) {
    spawnTimer -= dt;
    if (spawnTimer > 0) return;
    spawnTimer = stage.spawnInterval;
    if (drones.length >= MAX_ACTIVE_DRONES) return;
    const { cx, cy } = core();
    const fullRadius = Math.hypot(lastW, lastH) / 2 + 90;
    const spawnRadius = firstSpawn ? Math.min(fullRadius, FIRST_SPAWN_RADIUS) : fullRadius;
    firstSpawn = false;
    drones.push(spawnDrone(stage, cx, cy, spawnRadius));
  }

  function maybeSpawnBoss(stage) {
    if (!stage.boss || boss) return;
    const { cx, cy } = core();
    boss = createBoss(cx, cy - lastH * 0.26);
  }

  function handleGrabAndThrow(dt, cx, cy) {
    if (aim.x == null) return;
    const tip = clampToRange(cx, cy, aim.x, aim.y, CABLE_RANGE);
    if (!held) {
      if (aim.action) {
        const target = findGrabTarget(drones, cx, cy, CABLE_RANGE);
        if (target) {
          held = target;
          drones = drones.filter((d) => d !== target);
          charge = 0;
          fullChargeFired = false;
          audio.grab();
          fx.burst(target.x, target.y, '#7bffd6', 8);
        }
      }
    } else {
      held.x = tip.x; held.y = tip.y;
      if (aim.action) {
        charge = Math.min(MAX_CHARGE, charge + CHARGE_RATE * dt);
        if (charge >= MAX_CHARGE && !fullChargeFired) { fullChargeFired = true; audio.chargeFull(); fx.burst(held.x, held.y, '#ffe066', 10); }
      } else {
        throwHeld(tip, cx, cy);
      }
    }
  }

  function throwHeld(tip, cx, cy) {
    const dx = tip.x - cx, dy = tip.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const speed = throwSpeedFor(charge);
    audio.release(charge);
    projectiles.push({
      type: held.type, x: tip.x, y: tip.y,
      vx: (dx / d) * speed, vy: (dy / d) * speed,
      rot: 0, spin: 10, life: PROJECTILE_LIFE,
    });
    held = null; charge = 0; fullChargeFired = false;
  }

  function updateProjectiles(dt) {
    const targets = boss ? [...drones, boss] : drones;
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      advanceProjectile(p, dt, targets);
      if (resolveProjectileHit(p) || p.life <= 0 || outOfBounds(p.x, p.y, lastW, lastH)) {
        projectiles.splice(i, 1);
      }
    }
  }

  function resolveProjectileHit(p) {
    if (boss) {
      const def = DRONE_TYPES[p.type];
      if (Math.hypot(p.x - boss.x, p.y - boss.y) <= BOSS.radius + def.radius) {
        const r = applyBossHit(state, boss, p.type);
        boss.flash = 1;
        audio.bossHit(r.popped);
        fx.popup(boss.x, boss.y - 30, `+${r.points}`, '#ffd24a', { big: r.popped });
        maybeComboPunch(boss.x, boss.y - 70);
        spark.burst(boss.x, boss.y, ['bolt', 'spark'], r.popped ? 20 : 6, r.popped ? 240 : 140);
        if (r.popped) { fx.shake(22); win = true; boss = null; audio.win(); audio.stopAmbience(); }
        else fx.shake(6);
        return true;
      }
    }
    for (const d of drones) {
      const def = DRONE_TYPES[d.type];
      if (Math.hypot(p.x - d.x, p.y - d.y) <= def.radius + 10) {
        const r = applyThrowHit(state, p.type, d);
        if (r.outcome === 'shield-break') { audio.shieldBreak(); d.flash = 1; }
        else audio.pop(state.combo, d.type);
        fx.popup(d.x, d.y - 24, `+${r.points}`, r.popped ? '#ffe8c1' : '#bfe9ff', { big: r.popped });
        maybeComboPunch(d.x, d.y - 60);
        spark.burst(d.x, d.y, ['bolt', 'spark'], r.popped ? 14 : 5, r.popped ? 210 : 120);
        if (r.popped) {
          drones = drones.filter((x) => x !== d);
          wavePops++;
          fx.shake(8);
        } else {
          d.flash = 1;
        }
        return true;
      }
    }
    return false;
  }

  function updateDrones(dt, cx, cy, stage) {
    for (let i = drones.length - 1; i >= 0; i--) {
      const d = drones[i];
      const dist = advanceDrone(d, dt, cx, cy, stage.speedMul);
      if (dist <= CORE_RADIUS + DRONE_TYPES[d.type].radius * 0.6) {
        drones.splice(i, 1);
        applyBreach(state);
        audio.breach();
        fx.shake(16);
        fx.popup(cx, cy - 60, 'פרצה!', '#ff6b6b', { big: true });
        spark.burst(cx, cy, ['spark'], 10, 160);
        if (isGameOver(state)) { over = true; audio.gameOver(); audio.stopAmbience(); }
      }
    }
  }

  function advanceWave(stage) {
    if (stage.boss) return;
    if (wavePops >= waveTarget(state.wave)) {
      state.wave += 1;
      wavePops = 0;
      spawnTimer = 0;
    }
  }

  function update(dt, input) {
    spark.update(dt);
    if (over || win) return;
    aim = input || aim;
    tickCombo(state, dt);
    const { cx, cy } = core();
    const stage = waveFor(state.wave);
    maybeSpawnBoss(stage);
    spawnIfDue(dt, stage);
    handleGrabAndThrow(dt, cx, cy);
    updateDrones(dt, cx, cy, stage);
    if (boss) advanceBoss(boss, dt, cx, cy - lastH * 0.26, lastW * 0.26);
    updateProjectiles(dt);
    advanceWave(stage);
  }

  function draw(ctx, images, W, H) {
    lastW = W; lastH = H;
    const { cx, cy } = core();
    const tip = aim.x == null ? null : clampToRange(cx, cy, aim.x, aim.y, CABLE_RANGE);
    drawScene(ctx, images, W, H, {
      cx, cy, coreRadius: CORE_RADIUS, drones, boss, held, projectiles, tip,
      charge, holding: !!held,
    });
    fx.drawAmbient(ctx, W, H);
    spark.draw(ctx, images);
  }

  function getState() {
    const stage = waveFor(state.wave);
    const { cx, cy } = core();
    return {
      score: state.score, combo: state.combo, lives: state.lives,
      wave: state.wave, waveName: stage.name, charge, over, win,
      cx, cy, cableRange: CABLE_RANGE,
      held: held ? { x: held.x, y: held.y, type: held.type } : null,
      drones: drones.map((d) => ({ x: d.x, y: d.y, type: d.type, canGrab: canGrab(d) })),
      boss: boss ? { x: boss.x, y: boss.y, health: boss.health } : null,
    };
  }

  return { reset, update, draw, getState };
}
