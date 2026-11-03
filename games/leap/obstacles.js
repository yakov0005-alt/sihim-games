// Spawns and advances rocks/logs/waterfalls and bonus coins. Pure scene
// bookkeeping — play.js decides hits/scoring via rules.js and the onReach hook.
import * as T from '../../lib/three.module.min.js';
import { laneX, pickObstacleLane } from './rules.js';

function tex(img) {
  if (!img) return null;
  const t = new T.Texture(img);
  t.needsUpdate = true;
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

const GEO = {
  rock: new T.ConeGeometry(0.5, 0.9, 6),
  log: new T.CylinderGeometry(0.22, 0.22, 1.4, 8),
  waterfall: new T.BoxGeometry(1.4, 1.2, 0.3),
  coin: new T.CylinderGeometry(0.32, 0.32, 0.05, 20),
};

const RESOLVE_OFFSET = 0.3;

export function createObstacleField(scene, assets) {
  const rockMat = new T.MeshStandardMaterial({ map: tex(assets.rock), color: 0xffffff });
  const logMat = new T.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.8 });
  const fallMat = new T.MeshStandardMaterial({ color: 0xcdeef5, transparent: true, opacity: 0.8 });
  const coinMat = new T.MeshStandardMaterial({
    map: tex(assets.coin), transparent: true, emissive: 0x7a4f00, emissiveIntensity: 0.5,
  });

  let items = [];

  function spawnObstacle(lane, type, speed, spawnZ) {
    const mesh = new T.Mesh(GEO[type], type === 'rock' ? rockMat : type === 'log' ? logMat : fallMat);
    if (type === 'log') mesh.rotation.z = Math.PI / 2;
    mesh.position.set(laneX(lane), type === 'waterfall' ? 0.6 : 0.45, spawnZ);
    scene.add(mesh);
    items.push({ mesh, lane, type, kind: 'obstacle', resolved: false, speed });
  }

  function spawnCoin(lane, speed, spawnZ) {
    const mesh = new T.Mesh(GEO.coin, coinMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(laneX(lane), 0.55, spawnZ);
    scene.add(mesh);
    items.push({ mesh, lane, type: 'coin', kind: 'coin', resolved: false, speed });
  }

  function update(dt, fishZ, onReach) {
    for (let i = items.length - 1; i >= 0; i--) {
      const o = items[i];
      o.mesh.position.z += o.speed * dt;
      if (o.kind === 'coin') o.mesh.rotation.z += dt * 4;
      if (!o.resolved && o.mesh.position.z >= fishZ - RESOLVE_OFFSET) { o.resolved = true; onReach(o); }
      if (o.mesh.position.z > fishZ + 3) { scene.remove(o.mesh); items.splice(i, 1); }
    }
  }

  function clear() {
    for (const o of items) scene.remove(o.mesh);
    items = [];
  }

  // Unresolved items ahead of the fish, as seconds-until-resolve at current
  // speed — the same signal a human reads off-screen distance/speed. Used by
  // bot.js to decide lane dodges and jump timing through the real input path.
  function peek(fishZ) {
    return items
      .filter((o) => !o.resolved)
      .map((o) => ({
        lane: o.lane,
        type: o.kind === 'coin' ? 'coin' : o.type,
        timeToResolve: (fishZ - RESOLVE_OFFSET - o.mesh.position.z) / o.speed,
      }));
  }

  return { spawnObstacle, spawnCoin, update, clear, pickLane: pickObstacleLane, peek };
}
