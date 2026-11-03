// Juice for leap: varied particle bursts, tweened popups/combo text, a
// trauma-based screen shake and a gentle ambient camera sway. No DOM — every
// mesh/sprite is attached to whatever scene play.js hands over via init().
import * as T from '../../lib/three.module.min.js';

function dotTexture() {
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = 32;
  const ctx = cvs.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new T.CanvasTexture(cvs);
}

function labelTexture(text, color, size) {
  const cvs = document.createElement('canvas');
  cvs.width = 320; cvs.height = 110;
  const ctx = cvs.getContext('2d');
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 7;
  ctx.fillStyle = color;
  ctx.fillText(text, 160, 58);
  return new T.CanvasTexture(cvs);
}

const DOT = dotTexture();

// speed/up/life are [min, max] ranges; shape 'ball' stays round, 'spark'
// stretches into a thin droplet streak; glow uses additive blending.
const BURST = {
  splash: { color: 0x9fe8ff, n: 9, speed: [1.3, 2.6], up: [1.1, 2.3], gravity: 6, life: [0.28, 0.48], size: 0.09, shape: 'spark', glow: false },
  hit: { color: 0xff5a3c, n: 14, speed: [2, 4.2], up: [1.3, 3], gravity: 7.5, life: [0.3, 0.55], size: 0.1, shape: 'ball', glow: false },
  coin: { color: 0xffd24a, n: 11, speed: [1, 2.3], up: [1.8, 3.2], gravity: 4, life: [0.4, 0.65], size: 0.08, shape: 'spark', glow: true },
  trick: { color: 0x8be9ff, n: 8, speed: [0.6, 1.7], up: [0.8, 1.8], gravity: 2.8, life: [0.4, 0.6], size: 0.08, shape: 'ball', glow: true },
  cheer: { color: 0x9df7c0, n: 20, speed: [1.6, 3.4], up: [2.1, 3.9], gravity: 3.4, life: [0.5, 0.85], size: 0.09, shape: 'spark', glow: true },
  bubble: { color: 0xeaffff, n: 1, speed: [0.05, 0.2], up: [0.35, 0.6], gravity: -1.6, life: [0.35, 0.55], size: 0.045, shape: 'ball', glow: false },
};

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

export function createFx() {
  let scene = null;
  const parts = [];
  const popups = [];
  let trauma = 0;
  let clock = 0;
  let trailTimer = 0;

  function init(targetScene) { scene = targetScene; }

  function spawnParticle(pos, cfg) {
    const mat = new T.SpriteMaterial({
      map: DOT, color: cfg.color, transparent: true, depthTest: false,
      blending: cfg.glow ? T.AdditiveBlending : T.NormalBlending,
    });
    const sprite = new T.Sprite(mat);
    const s = cfg.size * (0.7 + Math.random() * 0.6);
    sprite.scale.set(cfg.shape === 'spark' ? s * 0.6 : s, cfg.shape === 'spark' ? s * 1.6 : s, 1);
    sprite.position.copy(pos);
    scene.add(sprite);
    const a = Math.random() * Math.PI * 2;
    const speed = rand(cfg.speed[0], cfg.speed[1]);
    const v = new T.Vector3(Math.cos(a) * speed, rand(cfg.up[0], cfg.up[1]), Math.sin(a) * speed);
    parts.push({ sprite, v, gravity: cfg.gravity, life: 0, max: rand(cfg.life[0], cfg.life[1]) });
  }

  function burst(pos, kind = 'splash', n) {
    if (!scene) return;
    const cfg = BURST[kind] || BURST.splash;
    for (let i = 0; i < (n || cfg.n); i++) spawnParticle(pos, cfg);
  }

  // Throttled single-bubble trail for ambient "alive" swimming motion.
  function swimTrail(pos, dt, active) {
    trailTimer -= dt;
    if (!active || trailTimer > 0) return;
    trailTimer = 0.16 + Math.random() * 0.12;
    burst(pos, 'bubble', 1);
  }

  function popup(text, pos, { color = '#fff2cf', size = 46, dy = 0.45, life = 0.9, pop = true } = {}) {
    if (!scene) return;
    const sprite = new T.Sprite(new T.SpriteMaterial({
      map: labelTexture(text, color, size), transparent: true, depthTest: false,
    }));
    sprite.scale.set(pop ? 0.1 : 1.6, pop ? 0.05 : 0.55, 1);
    sprite.position.copy(pos);
    sprite.position.y += dy;
    scene.add(sprite);
    popups.push({ sprite, life: 0, max: life, pop, settled: !pop });
  }

  // Milestone combo callout: colour/size climbs with the streak length.
  function comboText(combo, pos) {
    const tier = combo >= 9 ? { c: '#ff8a3c', s: 56 } : combo >= 6 ? { c: '#ffd24a', s: 52 } : { c: '#bfe9ff', s: 46 };
    popup(`שרשרת ×${combo}`, pos, { color: tier.c, size: tier.s, dy: 0.85, life: 1 });
  }

  function timingText(tier, pos) {
    if (tier === 'perfect') popup('מושלם!', pos, { color: '#9df7c0', size: 50, dy: 1.15, life: 0.85 });
    else if (tier === 'good') popup('טוב!', pos, { color: '#bfe9ff', size: 44, dy: 1.1, life: 0.75 });
  }

  function shake(amount) { trauma = Math.min(1, trauma + amount); }

  function cameraOffset() {
    const sway = { x: Math.sin(clock * 0.5) * 0.012, y: Math.sin(clock * 0.37 + 1.3) * 0.009 };
    if (trauma <= 0.001) return sway;
    const k = trauma * trauma;
    return { x: sway.x + (Math.random() * 2 - 1) * 0.3 * k, y: sway.y + (Math.random() * 2 - 1) * 0.3 * k };
  }

  function update(dt) {
    clock += dt;
    trauma = Math.max(0, trauma - dt * 2.6);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      p.v.y -= p.gravity * dt;
      p.sprite.position.addScaledVector(p.v, dt);
      p.sprite.material.opacity = Math.max(0, 1 - p.life / p.max);
      if (p.life >= p.max) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
        parts.splice(i, 1);
      }
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const l = popups[i];
      l.life += dt;
      if (l.pop && !l.settled) {
        const k = Math.min(1, l.life / 0.12);
        l.sprite.scale.set(1.5 * k, 0.52 * k, 1);
        if (k >= 1) l.settled = true;
      } else {
        l.sprite.position.y += dt * 0.7;
      }
      l.sprite.material.opacity = Math.max(0, 1 - l.life / l.max);
      if (l.life >= l.max) {
        scene.remove(l.sprite);
        l.sprite.material.map.dispose();
        l.sprite.material.dispose();
        popups.splice(i, 1);
      }
    }
  }

  function reset() {
    if (!scene) return;
    for (const p of parts) { scene.remove(p.sprite); p.sprite.material.dispose(); }
    parts.length = 0;
    for (const l of popups) { scene.remove(l.sprite); l.sprite.material.map.dispose(); l.sprite.material.dispose(); }
    popups.length = 0;
    trauma = 0;
    trailTimer = 0;
  }

  return { init, burst, swimTrail, popup, comboText, timingText, shake, cameraOffset, update, reset };
}
