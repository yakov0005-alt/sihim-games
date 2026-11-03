// Juice layer for "magnet": particle bursts, screen shake, floating score
// popups, punchy combo callouts and a two-layer ambient dust parallax, all
// in plain screen-pixel space. No DOM access — play.js feeds positions,
// game.js applies the returned shake offset around draw().
const AMBIENT_LAYERS = [
  { count: 14, speed: 7, angle: -2.6, size: [1, 2], alpha: [0.03, 0.07], color: '123,255,214' },
  { count: 9, speed: 15, angle: -0.55, size: [1.5, 3], alpha: [0.05, 0.13], color: '255,180,92' },
];

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function createFx() {
  const particles = [];
  const popups = [];
  const combos = [];
  let shakeMag = 0;
  let ambient = null;

  function shake(mag) { shakeMag = Math.max(shakeMag, mag); }

  function burst(x, y, color = '#ffd24a', n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 180 + 70;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, maxLife: 0.5, color, size: 3 + Math.random() * 3 });
    }
  }

  function popup(x, y, text, color = '#fff8ec', opts = {}) {
    popups.push({ x, y, text, color, life: 0, dur: opts.dur || 0.8, big: !!opts.big, vy: opts.vy ?? -58 });
  }

  // Punchy canvas callout for combo milestones — distinct from score popups:
  // scales in with overshoot, holds briefly, then fades while drifting up.
  function comboPunch(x, y, combo) {
    const fever = combo >= 8;
    combos.push({
      x, y, life: 0, dur: 0.9,
      text: `רצף x${combo}!`,
      color: fever ? '#ff6b3d' : '#ffe066',
      glow: fever ? '#ff9d6b' : '#fff2b0',
    });
  }

  function initAmbient(W, H) {
    ambient = AMBIENT_LAYERS.map((layer) => ({
      angle: layer.angle, speed: layer.speed, color: layer.color,
      motes: Array.from({ length: layer.count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        tw: Math.random() * Math.PI * 2,
        alpha: layer.alpha[0] + Math.random() * (layer.alpha[1] - layer.alpha[0]),
        size: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
      })),
    }));
  }

  // Two depth layers drift at different speed/direction — a cheap parallax
  // illusion that keeps the arena feeling alive even between drone waves.
  function updateAmbient(dt, W, H) {
    if (!W || !H) return;
    if (!ambient) initAmbient(W, H);
    for (const layer of ambient) {
      for (const m of layer.motes) {
        m.tw += dt * 0.8;
        m.x += Math.cos(layer.angle) * layer.speed * dt + Math.sin(m.tw) * 3 * dt;
        m.y += Math.sin(layer.angle) * layer.speed * dt;
        if (m.x < -12) m.x = W + 12; else if (m.x > W + 12) m.x = -12;
        if (m.y < -12) m.y = H + 12; else if (m.y > H + 12) m.y = -12;
      }
    }
  }

  function update(dt, W, H) {
    shakeMag = Math.max(0, shakeMag - dt * 46);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt; }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    for (const t of popups) t.life += dt;
    for (let i = popups.length - 1; i >= 0; i--) if (popups[i].life >= popups[i].dur) popups.splice(i, 1);
    for (const c of combos) c.life += dt;
    for (let i = combos.length - 1; i >= 0; i--) if (combos[i].life >= combos[i].dur) combos.splice(i, 1);
    updateAmbient(dt, W, H);
  }

  // Drawn by play.js right after the arena scene, so dust floats above the
  // background/sprites but under the pop particles and popup text below.
  function drawAmbient(ctx, W, H) {
    if (!ambient) return;
    for (const layer of ambient) {
      for (const m of layer.motes) {
        const flicker = 0.7 + 0.3 * Math.sin(m.tw * 1.3);
        ctx.fillStyle = `rgba(${layer.color},${(m.alpha * flicker).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function draw(ctx) {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of popups) {
      const k = Math.min(1, t.life / t.dur);
      const y = t.y + t.vy * (1 - Math.pow(1 - k, 3));
      ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      ctx.font = `800 ${t.big ? 24 : 16}px Rubik, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillText(t.text, t.x + 1, y + 2);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, y);
    }
    for (const c of combos) {
      const k = c.life / c.dur;
      const scale = k < 0.28 ? Math.max(0.1, easeOutBack(k / 0.28)) : k > 0.6 ? 1 - ((k - 0.6) / 0.4) * 0.15 : 1;
      const alpha = k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4);
      const y = c.y - k * 36;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, y);
      ctx.scale(scale, scale);
      ctx.font = '800 30px Rubik, sans-serif';
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillText(c.text, 1, 2);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function shakeOffset() {
    if (shakeMag <= 0) return [0, 0];
    return [(Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag];
  }

  return { shake, burst, popup, comboPunch, update, draw, drawAmbient, shakeOffset };
}
