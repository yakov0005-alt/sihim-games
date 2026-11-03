// Visual juice for roofrun: particle bursts, screen shake, tweened score/
// combo popups, a brief color flash on big moments, and a handful of slow
// ambient dust motes drifting past the train window. No DOM access — only
// takes a canvas 2D context (and W/H for the full-screen flash + motes).
export function createFx() {
  const particles = [];
  const popups = [];
  let shakeMag = 0;
  let flashColor = null;
  let flashAlpha = 0;
  let motes = null;

  function shake(mag) { shakeMag = Math.max(shakeMag, mag); }

  function flash(color, alpha = 0.35) {
    flashColor = color;
    flashAlpha = Math.max(flashAlpha, alpha);
  }

  function burst(x, y, color = '#ffd24a', n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 140 + 40;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.45, color });
    }
  }

  // Floating "+N" / "-1" labels that pop in, drift up and fade.
  function popup(x, y, text, { color = '#fff', size = 20 } = {}) {
    popups.push({ x, y, text, color, size, vy: -46, life: 0.85, maxLife: 0.85, scale: 0.3 });
  }

  // Bigger combo callout plus a little sparkle, for streak milestones.
  function combo(x, y, n) {
    popup(x, y - 22, `קומבו x${n}`, { color: '#ffd24a', size: 25 });
    burst(x, y, '#ffd24a', 16);
    shake(4);
  }

  function ensureMotes(W, H) {
    if (motes) return;
    motes = Array.from({ length: 14 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.55,
      r: Math.random() * 1.6 + 0.6,
      vx: -(Math.random() * 14 + 6),
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.6 + 0.3,
    }));
  }

  function update(dt, W = 0, H = 0) {
    shakeMag = Math.max(0, shakeMag - dt * 40);
    flashAlpha = Math.max(0, flashAlpha - dt * 1.4);

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

    for (const p of popups) {
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy *= 0.98;
      p.scale = Math.min(1, p.scale + dt * 9);
    }
    for (let i = popups.length - 1; i >= 0; i--) if (popups[i].life <= 0) popups.splice(i, 1);

    if (W && H) {
      ensureMotes(W, H);
      for (const m of motes) {
        m.x += m.vx * dt;
        m.phase += dt * m.speed;
        if (m.x < -4) { m.x = W + 4; m.y = Math.random() * H * 0.55; }
      }
    }
  }

  function draw(ctx, W = 0, H = 0) {
    if (motes) {
      for (const m of motes) {
        const y = m.y + Math.sin(m.phase) * 4;
        ctx.globalAlpha = 0.22 + 0.18 * Math.sin(m.phase * 1.3);
        ctx.fillStyle = 'rgba(255,224,170,.9)';
        ctx.beginPath();
        ctx.arc(m.x, y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.45);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    for (const p of popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale, p.scale);
      ctx.font = `800 ${p.size}px Rubik, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (flashAlpha > 0.003 && flashColor && W && H) {
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = Math.min(0.6, flashAlpha);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function shakeOffset() {
    if (shakeMag <= 0) return [0, 0];
    return [(Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag];
  }

  return { burst, shake, flash, popup, combo, update, draw, shakeOffset };
}
