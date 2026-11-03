// Juice layer: particle bursts, screen shake, tweened popups/combo flash,
// and ambient sand drift. Pure canvas + state — no world/rules knowledge.
export function createFx() {
  const particles = [];
  const popups = [];
  const motes = [];
  let shakeAmt = 0;
  let moteBudget = 0;
  let comboFlash = null;

  function burst(x, y, color, n = 14, spread = 140) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * spread + 40;
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
        life: 1, color, size: 2 + Math.random() * 3,
      });
    }
  }

  function shake(amount) { shakeAmt = Math.min(28, shakeAmt + amount); }
  function shakeOffset() {
    if (shakeAmt <= 0) return { dx: 0, dy: 0 };
    return { dx: (Math.random() - 0.5) * shakeAmt, dy: (Math.random() - 0.5) * shakeAmt };
  }

  function popup(text, color, x, y, { dur = 0.9, size = 16, rise = 55 } = {}) {
    popups.push({ text, color, x, y, t: 0, dur, size, rise });
  }

  function flashCombo(text, color) {
    comboFlash = { text, color, t: 0, dur: 0.75 };
  }

  // Ambient sand drifting past in the foreground — density/speed track the ride.
  function drift(dt, w, h, rate, speedPx) {
    moteBudget += dt * rate;
    while (moteBudget >= 1) {
      moteBudget -= 1;
      motes.push({
        x: w + 10, y: h * (0.56 + Math.random() * 0.4),
        vx: -speedPx * (0.5 + Math.random() * 0.6),
        size: 1 + Math.random() * 2.2,
        life: 1, fade: 0.4 + Math.random() * 0.5,
      });
    }
  }

  function clear() {
    particles.length = 0; popups.length = 0; motes.length = 0;
    shakeAmt = 0; comboFlash = null;
  }

  function update(dt) {
    shakeAmt = Math.max(0, shakeAmt - dt * 70);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt * 1.4; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.x += m.vx * dt; m.life -= dt * m.fade;
      if (m.life <= 0 || m.x < -20) motes.splice(i, 1);
    }
    for (const p of popups) p.t += dt;
    while (popups.length && popups[0].t > popups[0].dur) popups.shift();
    if (comboFlash) { comboFlash.t += dt; if (comboFlash.t > comboFlash.dur) comboFlash = null; }
  }

  function draw(ctx) {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx) {
    for (const m of motes) {
      ctx.globalAlpha = Math.max(0, m.life) * 0.5;
      ctx.fillStyle = '#e8d9b8';
      ctx.fillRect(m.x, m.y, m.size * 2.4, m.size * 0.6);
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups(ctx, x, y) {
    ctx.textAlign = 'center';
    popups.forEach((p, i) => {
      const prog = p.t / p.dur;
      const pop = Math.min(1, prog * 6);
      const scale = 1 + (1 - pop) * 0.6;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, prog - 0.55) / 0.45);
      ctx.translate(p.x ?? x, (p.y ?? y) - prog * p.rise - i * 20);
      ctx.scale(scale, scale);
      ctx.font = `800 ${p.size}px Rubik, sans-serif`;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function drawComboFlash(ctx, w, h) {
    if (!comboFlash) return;
    const prog = comboFlash.t / comboFlash.dur;
    const pop = Math.min(1, prog * 5);
    const scale = 0.7 + pop * 0.5;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, prog - 0.6) / 0.4);
    ctx.translate(w / 2, h * 0.3);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.font = '800 34px Rubik, sans-serif';
    ctx.fillStyle = comboFlash.color;
    ctx.shadowColor = comboFlash.color; ctx.shadowBlur = 18;
    ctx.fillText(comboFlash.text, 0, 0);
    ctx.restore();
  }

  return {
    burst, shake, shakeOffset, popup, flashCombo, drift, clear,
    update, draw, drawMotes, drawPopups, drawComboFlash,
  };
}
