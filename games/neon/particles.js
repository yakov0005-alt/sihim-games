// Lightweight sprite-particle pool for boost trails, pickup sparkles and
// crash bursts. All three.js sprites with a canvas-generated glow dot — no
// extra art assets needed, and the pool is capped + recycled so a long
// session never grows the scene graph unbounded.
import * as T from '../../lib/three.module.min.js';

const MAX_PARTICLES = 140;

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new T.CanvasTexture(c);
}

export function createParticles({ group }) {
  const tex = dotTexture();
  const pool = [];

  function allocate() {
    if (pool.length < MAX_PARTICLES) {
      const sprite = new T.Sprite(new T.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      }));
      group.add(sprite);
      const p = { sprite, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, scale: 0.4 };
      pool.push(p);
      return p;
    }
    return pool.reduce((a, b) => (a.life < b.life ? a : b));
  }

  function spawn(x, y, z, color, vx, vy, vz, life, scale) {
    const p = allocate();
    p.sprite.position.set(x, y, z);
    p.sprite.material.color.setHex(color);
    p.sprite.visible = true;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = p.maxLife = life;
    p.scale = scale;
  }

  function burst(x, y, z, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      spawn(
        x, y, z, color,
        Math.cos(a) * speed, Math.sin(a) * speed, (Math.random() - 0.5) * speed,
        0.35 + Math.random() * 0.3, 0.5 + Math.random() * 0.4,
      );
    }
  }

  function trail(x, y, z, color) {
    spawn(
      x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z, color,
      (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 2 + Math.random() * 1.5,
      0.35, 0.3 + Math.random() * 0.2,
    );
  }

  function update(dt) {
    for (const p of pool) {
      if (p.life <= 0) { p.sprite.visible = false; continue; }
      p.life -= dt;
      p.sprite.visible = p.life > 0;
      if (!p.sprite.visible) continue;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      const t = Math.max(0, p.life / p.maxLife);
      p.sprite.material.opacity = t;
      const s = p.scale * (0.6 + t * 0.4);
      p.sprite.scale.set(s, s, 1);
    }
  }

  function clear() {
    for (const p of pool) p.life = 0;
  }

  return { burst, trail, update, clear };
}
