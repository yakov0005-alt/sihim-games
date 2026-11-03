// Falafel visual juice: particles, tweened popups, screen shake, ambient motion, canvas draw helpers.
export const particles = [];
export const popups = [];
const dust = [];

let trauma = 0;
const shakeOffset = { x: 0, y: 0 };

export function addShake(amount) { trauma = Math.min(1, trauma + amount); }

export function updateShake(dt) {
  trauma = Math.max(0, trauma - dt * 1.8);
  const t = trauma * trauma;
  shakeOffset.x = (Math.random() * 2 - 1) * 10 * t;
  shakeOffset.y = (Math.random() * 2 - 1) * 10 * t;
}

export function getShake() { return shakeOffset; }

const EASE_OUT_BACK = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

export function burst(x, y, color, n = 14, spread = 140, kind = 'spark') {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = Math.random() * spread + 40;
    particles.push({
      kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 1,
      color, size: 3 + Math.random() * 3, spin: (Math.random() - 0.5) * 8, rot: Math.random() * Math.PI * 2,
    });
  }
}

export function steamPuff(x, y, n = 2) {
  for (let i = 0; i < n; i++) {
    particles.push({
      kind: 'steam', x: x + (Math.random() * 20 - 10), y, vx: (Math.random() - 0.5) * 16, vy: -36 - Math.random() * 24,
      life: 1, color: 'rgba(255,240,220,.5)', size: 8 + Math.random() * 6, sway: Math.random() * Math.PI * 2,
    });
  }
}

export function confettiBurst(x, y, colors, n = 36) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = Math.random() * 220 + 80;
    particles.push({
      kind: 'confetti', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 220, life: 1,
      color: colors[(Math.random() * colors.length) | 0], size: 4 + Math.random() * 3,
      spin: (Math.random() - 0.5) * 10, rot: Math.random() * Math.PI * 2,
    });
  }
}

export function popup(x, y, text, color = '#ffe8c1', big = false) {
  popups.push({ x, y, startX: x, text, color, life: 1, dur: big ? 1.3 : 1.05, big, scale: 0.3, vx: (Math.random() - 0.5) * 18 });
}

export function initAmbientDust(w, h, n = 16) {
  dust.length = 0;
  for (let i = 0; i < n; i++) {
    dust.push({
      x: Math.random() * w, y: Math.random() * h * 0.7, r: 1 + Math.random() * 1.8,
      sp: 0.08 + Math.random() * 0.1, ph: Math.random() * Math.PI * 2, alpha: 0.15 + Math.random() * 0.25,
    });
  }
}

export function updateFx(dt) {
  updateShake(dt);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt * (p.kind === 'steam' ? 0.75 : 1.5);
    if (p.kind === 'steam') {
      p.x += p.vx * dt + Math.sin((p.sway += dt * 3)) * 6 * dt;
      p.y += p.vy * dt; p.vy *= 0.98; p.size += dt * 10;
    } else if (p.kind === 'confetti') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.995; p.rot += p.spin * dt;
    } else {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; p.rot = (p.rot || 0) + (p.spin || 0) * dt;
    }
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.life -= dt / p.dur;
    const grow = Math.min(1, (1 - p.life) * 6);
    p.scale = p.life > 0 ? 0.3 + 0.9 * EASE_OUT_BACK(grow) : p.scale;
    p.y -= dt * (26 + (p.big ? 10 : 0));
    p.x = p.startX + p.vx * (1 - p.life);
    if (p.life <= 0) popups.splice(i, 1);
  }
  for (const d of dust) {
    d.ph += dt * d.sp;
    d.x += Math.sin(d.ph) * 6 * dt;
    d.y -= dt * 4;
    if (d.y < -4) d.y += 400;
  }
}

function drawParticle(ctx, p) {
  const a = Math.max(0, p.life);
  if (p.kind === 'steam') {
    ctx.globalAlpha = a * 0.5;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    g.addColorStop(0, 'rgba(255,245,230,.8)'); g.addColorStop(1, 'rgba(255,245,230,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (p.kind === 'confetti') {
    ctx.globalAlpha = a; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
    ctx.restore();
    return;
  }
  ctx.globalAlpha = a;
  ctx.shadowColor = p.color; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
  ctx.shadowBlur = 0;
}

export function drawAmbientDust(ctx) {
  ctx.save();
  for (const d of dust) {
    ctx.globalAlpha = d.alpha;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fillStyle = '#ffe8c1'; ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawFx(ctx) {
  for (const p of particles) drawParticle(ctx, p);
  ctx.globalAlpha = 1;
  for (const p of popups) {
    const a = Math.max(0, Math.min(1, p.life * 2.2));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y); ctx.scale(p.scale, p.scale);
    ctx.font = (p.big ? '900 26px' : '800 18px') + ' Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,14,26,.65)'; ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCover(ctx, img, x, y, w, h) {
  if (!img.complete || !img.naturalWidth) return;
  const ir = img.naturalWidth / img.naturalHeight, r = w / h;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (ir > r) { sw = sh * r; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / r; sy = (img.naturalHeight - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export function drawSprite(ctx, img, x, y, targetH, anchorBottom) {
  if (!img.complete || !img.naturalWidth) return;
  const scale = targetH / img.naturalHeight;
  const w = img.naturalWidth * scale, h = targetH;
  const dx = x - w / 2, dy = anchorBottom ? y - h : y - h / 2;
  ctx.drawImage(img, dx, dy, w, h);
}
