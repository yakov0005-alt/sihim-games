// Obstacle gates and pickups: spawns ahead of the player along each track's
// obstacleGap cadence, renders them as radial neon bars / billboard sprites,
// and reports collision & collection events for play.js to score via rules.js.
import * as T from '../../lib/three.module.min.js';
import { LANE_COUNT, HIT_WINDOW, PICKUP_TYPES, isHit, resolveCollision } from './rules.js';
import { RIDE_MIN_R, RIDE_MAX_R } from './track.js';

const LOOKAHEAD = 90;
const DESPAWN_BEHIND = 6;
const GATE_RADIUS = (RIDE_MIN_R + RIDE_MAX_R) / 2;
const PICKUP_RADIUS = RIDE_MIN_R * 1.4;
const GATE_COLORS = [0x3df3ff, 0xff5fd6, 0xffb23d, 0x7bff7b];
export const PICKUP_COLOR = { battery: 0x3df3ff, boost: 0xffb23d, shield: 0xb16bff };

function laneAngle(lane) { return (lane / LANE_COUNT) * Math.PI * 2; }

function radialPlace(obj, angle, radius) {
  obj.position.x = Math.sin(angle) * radius;
  obj.position.y = Math.cos(angle) * radius;
  obj.rotation.z = -angle;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}

export function createEntities({ assets, group }) {
  const glowTex = glowTexture();
  const barGeo = new T.BoxGeometry(0.8, RIDE_MAX_R - RIDE_MIN_R, 0.35);
  const pickupTextures = {};
  for (const t of PICKUP_TYPES) {
    const tex = new T.Texture(assets[t]);
    tex.needsUpdate = true;
    tex.colorSpace = T.SRGBColorSpace;
    pickupTextures[t] = tex;
  }

  let gates = [];
  let pickups = [];
  let spawnCursor = 0;
  let track = null;

  function makeGlow(color, scale) {
    const spr = new T.Sprite(new T.SpriteMaterial({
      map: glowTex, color, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    }));
    spr.scale.set(scale, scale, 1);
    return spr;
  }

  function spawnGate(atDistance, difficulty) {
    const blockedCount = Math.min(LANE_COUNT - 2, 2 + Math.floor(difficulty));
    const blocked = new Set();
    while (blocked.size < blockedCount) blocked.add(Math.floor(Math.random() * LANE_COUNT));
    const color = GATE_COLORS[Math.floor(Math.random() * GATE_COLORS.length)];
    const meshes = [];
    for (const lane of blocked) {
      const bar = new T.Mesh(barGeo, new T.MeshBasicMaterial({ color }));
      bar.add(makeGlow(color, 2.6));
      radialPlace(bar, laneAngle(lane), GATE_RADIUS);
      group.add(bar);
      meshes.push(bar);
    }
    gates.push({ atDistance, blocked, resolved: false, meshes });
    return blocked;
  }

  function spawnPickup(atDistance, lane) {
    const type = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)];
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: pickupTextures[type], transparent: true }));
    sprite.scale.set(1.1, 1.1, 1);
    sprite.add(makeGlow(PICKUP_COLOR[type], 2.3));
    radialPlace(sprite, laneAngle(lane), PICKUP_RADIUS);
    group.add(sprite);
    pickups.push({ atDistance, lane, type, collected: false, sprite });
  }

  function reset(nextTrack) {
    for (const g of gates) g.meshes.forEach((m) => group.remove(m));
    for (const p of pickups) group.remove(p.sprite);
    gates = [];
    pickups = [];
    track = nextTrack;
    spawnCursor = track.obstacleGap * 1.4;
  }

  function maybeSpawn(distance) {
    const progress = distance / track.length;
    while (spawnCursor < distance + LOOKAHEAD) {
      const blocked = spawnGate(spawnCursor, 1.5 + progress * 3);
      if (Math.random() < 0.6) {
        const open = [...Array(LANE_COUNT).keys()].filter((l) => !blocked.has(l));
        const lane = open[Math.floor(Math.random() * open.length)];
        spawnPickup(spawnCursor + track.obstacleGap * 0.45, lane);
      }
      spawnCursor += track.obstacleGap * (0.85 + Math.random() * 0.5);
    }
  }

  // Read-only lookahead for bot.js: nearest unresolved gate/pickup ahead of
  // `distance`, so the bot can dodge blocked lanes through the real input
  // path instead of peeking at private state.
  function peek(distance) {
    let gate = null;
    for (const g of gates) {
      if (g.resolved || g.atDistance < distance - HIT_WINDOW) continue;
      if (!gate || g.atDistance < gate.atDistance) gate = g;
    }
    let pickup = null;
    for (const p of pickups) {
      if (p.collected || p.atDistance < distance - HIT_WINDOW) continue;
      if (!pickup || p.atDistance < pickup.atDistance) pickup = p;
    }
    return {
      gate: gate ? { atDistance: gate.atDistance, blocked: gate.blocked } : null,
      pickup: pickup ? { atDistance: pickup.atDistance, lane: pickup.lane, type: pickup.type } : null,
    };
  }

  function update(dt, craftZ, player) {
    maybeSpawn(player.distance);
    const events = { crashes: 0, shieldHits: 0, cleanPasses: 0, pickups: [] };

    gates = gates.filter((g) => {
      const z = craftZ - (g.atDistance - player.distance);
      g.meshes.forEach((m) => { m.position.z = z; });
      if (!g.resolved) {
        const obstacle = { lane: player.lane, atDistance: g.atDistance };
        if (g.blocked.has(player.lane) && isHit(player, obstacle, HIT_WINDOW)) {
          const result = resolveCollision(player, obstacle, HIT_WINDOW);
          g.resolved = true;
          if (result.crashed) events.crashes++;
          else if (result.consumedShield) events.shieldHits++;
        } else if (player.distance > g.atDistance + HIT_WINDOW) {
          g.resolved = true;
          events.cleanPasses++;
        }
      }
      const behind = player.distance - g.atDistance > LOOKAHEAD + DESPAWN_BEHIND;
      if (behind) g.meshes.forEach((m) => group.remove(m));
      return !behind;
    });

    pickups = pickups.filter((p) => {
      const z = craftZ - (p.atDistance - player.distance);
      p.sprite.position.z = z;
      p.sprite.material.rotation += dt * 1.6;
      if (!p.collected && p.lane === player.lane && isHit(player, { lane: p.lane, atDistance: p.atDistance }, HIT_WINDOW)) {
        p.collected = true;
        events.pickups.push(p.type);
      }
      const behind = player.distance - p.atDistance > LOOKAHEAD + DESPAWN_BEHIND;
      if (p.collected || behind) group.remove(p.sprite);
      return !p.collected && !behind;
    });

    return events;
  }

  return { reset, update, peek };
}
