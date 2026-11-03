// Juice layer: particle bursts (hit confetti / fail poofs / fever sparkle),
// screen shake + a gentle always-on ambient sway, tweened score/combo
// popups and impact rings, and a handful of drifting dust motes for station
// atmosphere. No DOM access — play.js feeds positions, game.js applies the
// returned shake offset around its own draw().
const COLOR_HEX = { red: '#ff6b6b', green: '#55d17a', blue: '#4fa8ff', gold: '#ffd24a' };

export function createFx() {
  const particles = [];
  const popups = [];
  const rings = [];
  const dust = [];
  let shakeMag = 0;
  let fever = false;
  let feverGlow = 0; // eased 0..1 toward `fever`, drives sway/dust intensity
  let t = 0;

  function shake(mag) { shakeMag = Math.max(shakeMag, mag); }
  function setFever(on) { fever = on; }

  function burst(x, y, color, n = 12) {
    const hex = COLOR_HEX[color] || '#fff8ec';
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 150 + 60;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, maxLife: 0.5, color: hex, size: 4 + Math.random() * 2 });
    }
  }

  // Grayish smoke puff for a failed/escaped ticket — reads as "invalidated",
  // deliberately duller than the colorful hit confetti above.
  function poof(x, y, n = 9) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 55 + 15;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 35, life: 0.55, maxLife: 0.55, color: '#cfd2d8', size: 7 + Math.random() * 5, smoke: true });
    }
  }

  function sparkle(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 90 + 30;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.4, maxLife: 0.4, color: '#ffe8c1', size: 3 });
    }
  }

  function popup(x, y, text, color = '#fff8ec', opts = {}) {
    popups.push({ x, y, text, color, life: 0, dur: opts.dur || 0.8, big: !!opts.big, vy: opts.vy ?? -64 });
  }

  function ring(x, y, color = '#fff8ec') {
    rings.push({ x, y, color, life: 0, dur: 0.35 });
  }

  function update(dt, W = 800, H = 600) {
    t += dt;
    shakeMag = Math.max(0, shakeMag - dt * 40);
    feverGlow += ((fever ? 1 : 0) - feverGlow) * Math.min(1, dt * 4);

    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.smoke ? -18 : 240) * dt;
      p.life -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    for (const p of popups) p.life += dt;
    for (let i = popups.length - 1; i >= 0; i--) if (popups[i].life >= popups[i].dur) popups.splice(i, 1);
    for (const r of rings) r.life += dt;
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life >= rings[i].dur) rings.splice(i, 1);

    if (dust.length < 24 && Math.random() < dt * 5) {
      dust.push({ x: W + 6, y: Math.random() * H, vx: -(10 + Math.random() * 16), vy: (Math.random() - 0.5) * 4, r: 1 + Math.random() * 2, a: 0.07 + Math.random() * 0.13 });
    }
    for (const d of dust) {
      d.x += d.vx * dt * (1 + feverGlow * 0.5);
      d.y += d.vy * dt;
      if (d.x < -8) { d.x = W + 8; d.y = Math.random() * H; }
    }
  }

  function draw(ctx, W = 800, H = 600) {
    ctx.save();
    ctx.fillStyle = '#fff8ec';
    for (const d of dust) { ctx.globalAlpha = d.a; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      if (p.smoke) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.5 - p.life / p.maxLife), 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (const r of rings) {
      const k = r.life / r.dur;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, 10 + k * 44, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = 'center';
    for (const p of popups) {
      const k = Math.min(1, p.life / p.dur);
      const ease = 1 - Math.pow(1 - k, 3);
      const y = p.y + p.vy * ease;
      const scale = p.big ? 0.55 + Math.min(1, k * 6) * 0.5 : 1;
      ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      ctx.font = `800 ${p.big ? 26 : 18}px Rubik, sans-serif`;
      ctx.save(); ctx.translate(p.x + 1, y + 2); ctx.scale(scale, scale); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(p.text, 0, 0); ctx.restore();
      ctx.save(); ctx.translate(p.x, y); ctx.scale(scale, scale); ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0); ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Shake jitter layered on a slow, always-on breathing sway so the scene
  // never looks perfectly static; both widen during fever.
  function shakeOffset() {
    const amp = 1 + feverGlow * 1.6;
    const sx = Math.sin(t * 0.6) * amp;
    const sy = Math.cos(t * 0.5) * amp * 0.6;
    if (shakeMag <= 0) return [sx, sy];
    return [sx + (Math.random() - 0.5) * shakeMag, sy + (Math.random() - 0.5) * shakeMag];
  }

  return { shake, setFever, burst, poof, sparkle, popup, ring, update, draw, shakeOffset };
}
