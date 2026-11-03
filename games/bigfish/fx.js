// Juice layer for "bigfish": splash-colored particle bursts, a decaying
// trauma-style screen shake, tweened score popups, big combo/milestone
// callouts, and a two-layer ambient bubble drift for underwater depth. No
// DOM access — game.js applies shakeOffset() around its own draw() and
// calls update()/draw(); play.js drives everything else (burst/popup/
// comboText/callout/bubbles) off the rope tug-of-war outcomes.
export function createFx() {
  const particles = [];
  const popups = [];
  const bubbles = [];
  let shakeMag = 0;
  let bubbleBudget = 0;
  let callout = null;

  function shake(mag) { shakeMag = Math.max(shakeMag, mag); }
  function shakeOffset() {
    if (shakeMag <= 0) return [0, 0];
    return [(Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag];
  }

  function burst(x, y, color = '#9fe8ff', n = 14, spread = 140) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * spread + 50;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5, maxLife: 0.5, color, size: 2 + Math.random() * 2.6 });
    }
  }

  // Floating "+N" / short labels — pop in with a little overshoot, drift up, fade.
  function popup(x, y, text, { color = '#ffe9a8', size = 20, dur = 0.8, rise = 44 } = {}) {
    popups.push({ x, y, text, color, size, dur, rise, t: 0 });
  }

  // Big centered callout for combo milestones, a fisherman splashing in, or
  // the final win/lose beat — a glowing pop-in that fades a touch slower
  // than the small popups so it reads clearly mid-action.
  function callOut(x, y, text, color = '#ffe08a') {
    callout = { x, y, text, color, t: 0, dur: 1 };
  }

  // Milestone combo streak: colour/size climbs with the streak length.
  function comboText(x, y, combo) {
    const tier = combo >= 15 ? { c: '#ff8a3c', s: 30 } : combo >= 10 ? { c: '#ffd24a', s: 27 } : { c: '#bff6ff', s: 24 };
    callout = { x, y, text: `שרשרת ×${combo}`, color: tier.c, size: tier.s, t: 0, dur: 0.9 };
  }

  // Ambient bubble drift through the underwater band — two speed layers so
  // the far/near sets rise at different rates for a bit of parallax depth.
  // Purely cosmetic; called every frame from play.js with live geometry.
  function drift(dt, W, waterY, H, rate = 4) {
    bubbleBudget += dt * rate;
    while (bubbleBudget >= 1) {
      bubbleBudget -= 1;
      const far = Math.random() < 0.5;
      bubbles.push({
        x: Math.random() * W,
        y: H - Math.random() * 20,
        vy: -(far ? 18 + Math.random() * 10 : 34 + Math.random() * 20),
        wob: Math.random() * Math.PI * 2,
        r: far ? 1 + Math.random() * 1.4 : 2 + Math.random() * 2.2,
        top: waterY,
        life: 1,
      });
    }
  }

  function update(dt) {
    shakeMag = Math.max(0, shakeMag - dt * 50);

    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

    for (const p of popups) p.t += dt;
    while (popups.length && popups[0].t > popups[0].dur) popups.shift();

    for (const b of bubbles) {
      b.y += b.vy * dt;
      b.wob += dt * 2;
      b.x += Math.sin(b.wob) * 8 * dt;
      if (b.y <= b.top) b.life = 0;
    }
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].life <= 0) bubbles.splice(i, 1);

    if (callout) { callout.t += dt; if (callout.t > callout.dur) callout = null; }
  }

  function draw(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(210,255,245,0.45)';
    ctx.lineWidth = 1.2;
    for (const b of bubbles) {
      const k = Math.min(1, (b.y - b.top) / 24);
      ctx.globalAlpha = Math.max(0, Math.min(1, k)) * 0.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    for (const p of popups) {
      const prog = p.t / p.dur;
      const pop = Math.min(1, prog * 7);
      const scale = 0.55 + pop * 0.45;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, prog - 0.55) / 0.45);
      ctx.translate(p.x, p.y - prog * p.rise);
      ctx.scale(scale, scale);
      ctx.font = `800 ${p.size}px Rubik, sans-serif`;
      ctx.fillStyle = p.color;
      ctx.direction = 'ltr'; // "+42" has no Hebrew letter to anchor bidi — the page's RTL
      // direction otherwise flips the sign to the end ("42+") when drawn on canvas.
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (callout) {
      const prog = callout.t / callout.dur;
      const pop = Math.min(1, prog * 6);
      const scale = 0.6 + pop * 0.5;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, prog - 0.6) / 0.4);
      ctx.translate(callout.x, callout.y - prog * 30);
      ctx.scale(scale, scale);
      ctx.font = `800 ${callout.size || 28}px Rubik, sans-serif`;
      ctx.shadowColor = callout.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = callout.color;
      ctx.fillText(callout.text, 0, 0);
      ctx.restore();
    }
  }

  function reset() {
    particles.length = 0;
    popups.length = 0;
    bubbles.length = 0;
    bubbleBudget = 0;
    shakeMag = 0;
    callout = null;
  }

  return { shake, shakeOffset, burst, popup, callOut, comboText, drift, update, draw, reset };
}
