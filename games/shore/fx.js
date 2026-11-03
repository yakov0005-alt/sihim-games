// Visual juice for "shore": particle bursts, screen shake, tweened score
// popups, a big combo/stage flash, and ambient sea-mist drift. Pure canvas
// state — no world/rules knowledge, just screen x/y handed in by play.js.
export function createFx() {
  const particles = [];
  const popups = [];
  const motes = [];
  let shakeMag = 0;
  let moteBudget = 0;
  let comboFlash = null;

  function shake(mag) { shakeMag = Math.max(shakeMag, mag); }
  function shakeOffset() {
    if (shakeMag <= 0) return [0, 0];
    return [(Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag];
  }

  function burst(x, y, color = '#ffe8c1', n = 12, spread = 130) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * spread + 30;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.5, maxLife: 0.5, color, size: 2 + Math.random() * 2.4 });
    }
  }

  // Floating "+N" labels — pop in with a little overshoot, drift up, fade.
  function popup(x, y, text, { color = '#ffe8c1', size = 16, dur = 0.85, rise = 48 } = {}) {
    popups.push({ x, y, text, color, size, dur, rise, t: 0 });
  }

  // Big centered callout for combo milestones / stage clears, with a glow pop-in.
  function flashCombo(x, y, text, color = '#ffb347') {
    comboFlash = { x, y, text, color, t: 0, dur: 0.9 };
  }

  // Sea-mist flecks drifting across a horizontal band — purely cosmetic
  // ambience so the shoreline never feels static between waves.
  function drift(dt, w, bandY0, bandY1, rate = 3, vx = -24) {
    moteBudget += dt * rate;
    while (moteBudget >= 1) {
      moteBudget -= 1;
      motes.push({
        x: Math.random() * w,
        y: bandY0 + Math.random() * (bandY1 - bandY0),
        vx: vx * (0.6 + Math.random() * 0.5),
        vy: -(Math.random() * 8 + 3),
        r: Math.random() * 1.5 + 0.6,
        life: 1,
        fade: 0.3 + Math.random() * 0.4,
      });
    }
  }

  function update(dt) {
    shakeMag = Math.max(0, shakeMag - dt * 46);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 210 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt * m.fade;
      if (m.life <= 0) motes.splice(i, 1);
    }

    for (const p of popups) p.t += dt;
    while (popups.length && popups[0].t > popups[0].dur) popups.shift();

    if (comboFlash) { comboFlash.t += dt; if (comboFlash.t > comboFlash.dur) comboFlash = null; }
  }

  function draw(ctx) {
    for (const m of motes) {
      ctx.globalAlpha = Math.max(0, m.life) * 0.45;
      ctx.fillStyle = '#eef8ff';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    for (const p of popups) {
      const prog = p.t / p.dur;
      const pop = Math.min(1, prog * 7);
      const scale = 0.5 + pop * 0.5;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, prog - 0.55) / 0.45);
      ctx.translate(p.x, p.y - prog * p.rise);
      ctx.scale(scale, scale);
      ctx.font = `800 ${p.size}px Rubik, sans-serif`;
      ctx.fillStyle = 'rgba(10,8,20,.7)';
      ctx.fillText(p.text, 1, 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (comboFlash) {
      const prog = comboFlash.t / comboFlash.dur;
      const pop = Math.min(1, prog * 6);
      const scale = 0.6 + pop * 0.55;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, prog - 0.6) / 0.4);
      ctx.translate(comboFlash.x, comboFlash.y);
      ctx.scale(scale, scale);
      ctx.font = '800 28px Rubik, sans-serif';
      ctx.shadowColor = comboFlash.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = comboFlash.color;
      ctx.fillText(comboFlash.text, 0, 0);
      ctx.restore();
    }
  }

  return { shake, shakeOffset, burst, popup, flashCombo, drift, update, draw };
}
