// Falafel scene rendering: stall background, customer, tray build-up, stations.
import { drawCover, drawSprite, roundRect, drawFx, getShake, drawAmbientDust } from './fx.js';

function spriteWidth(img, targetH) {
  if (!img || !img.naturalWidth) return targetH * 1.2;
  return img.naturalWidth * (targetH / img.naturalHeight);
}

function drawStationButton(ctx, r, label, o) {
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = o.active ? '#4a3d2a' : (o.lit ? '#3c6b4a' : '#2a2436'); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.active ? '#ffc83d' : 'rgba(255,255,255,.18)'; ctx.stroke();
  if (o.progress != null) {
    const tx = r.x + 10, ty = r.y + r.h - 14, tw = r.w - 20, th = 6;
    const grad = ctx.createLinearGradient(tx, 0, tx + tw, 0);
    grad.addColorStop(0, o.trackColors[0]); grad.addColorStop(0.42, o.trackColors[1]);
    grad.addColorStop(0.72, o.trackColors[1]); grad.addColorStop(0.85, o.trackColors[2]); grad.addColorStop(1, o.trackColors[3]);
    roundRect(ctx, tx, ty, tw, th, 3); ctx.fillStyle = grad; ctx.fill();
    const mx = tx + tw * o.progress;
    ctx.beginPath(); ctx.arc(mx, ty + th / 2, 6, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  }
  const showIcon = o.icon && !o.active;
  if (showIcon) drawSprite(ctx, o.icon, r.x + r.w / 2, r.y + r.h * 0.4, Math.min(30, r.h * 0.42));
  ctx.fillStyle = '#ffe8c1'; ctx.font = '700 ' + Math.max(11, Math.round(r.h * 0.18)) + 'px Rubik';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const labelRatio = showIcon ? 0.84 : (o.progress != null ? 0.3 : 0.82);
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h * labelRatio);
}

function drawToggleButton(ctx, r, label, IMG, iconName, on) {
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = on ? '#3c6b4a' : '#2a2436'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = on ? '#7cffb2' : 'rgba(255,255,255,.18)'; ctx.stroke();
  drawSprite(ctx, IMG[iconName], r.x + r.w / 2, r.y + r.h * 0.42, Math.min(34, r.h * 0.5));
  ctx.fillStyle = '#ffe8c1'; ctx.font = '700 ' + Math.max(11, Math.round(r.h * 0.18)) + 'px Rubik';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h * 0.84);
}

function drawServeButton(ctx, UI, G) {
  roundRect(ctx, UI.serve.x, UI.serve.y, UI.serve.w, UI.serve.h, 16);
  const ready = G.phase === 'serving';
  ctx.fillStyle = ready ? '#ffc83d' : '#4a4258'; ctx.fill();
  ctx.fillStyle = ready ? '#231a30' : '#cfc3da';
  ctx.font = '800 ' + Math.round(UI.serve.h * 0.4) + 'px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = G.phase === 'serving' ? 'הגישו ▶' : (G.phase === 'summary' ? 'המשיכו ▶' : '');
  ctx.fillText(label, UI.serve.x + UI.serve.w / 2, UI.serve.y + UI.serve.h / 2);
}

function drawStations(ctx, UI, G, IMG) {
  drawStationButton(ctx, UI.fry, 'טיגון', { active: G.fryer.active, progress: G.fryer.active ? G.fryer.pos : null, lit: G.build.falafelCount > 0, icon: IMG.falafel, trackColors: ['#cfd16a', '#ffce54', '#d97a3a', '#3a2a22'] });
  drawToggleButton(ctx, UI.tomato, 'עגבנייה', IMG, 'tomato', G.build.tomato);
  drawToggleButton(ctx, UI.cucumber, 'מלפפון', IMG, 'cucumber', G.build.cucumber);
  drawStationButton(ctx, UI.tahini, 'טחינה', { active: G.tahiniStation.active, progress: G.tahiniStation.active ? G.tahiniStation.pos : null, lit: G.build.tahini, icon: IMG.tahini, trackColors: ['#cbbfa0', '#e8dcc0', '#b79a68', '#5a4631'] });
  drawServeButton(ctx, UI, G);
}

function drawTray(ctx, UI, G, IMG) {
  const has = G.build.falafelCount > 0 || G.build.tomato || G.build.cucumber || G.build.tahini;
  drawSprite(ctx, IMG[has ? 'pita-filled' : 'pita'], UI.tray.x, UI.tray.y, 86);
  const n = G.build.falafelCount;
  const startX = UI.tray.x - (n - 1) * 8;
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.arc(startX + i * 16, UI.tray.y + 42, 5, 0, Math.PI * 2); ctx.fillStyle = '#ffce54'; ctx.fill();
  }
  let tx = UI.tray.x - 24;
  if (G.build.tomato) { ctx.beginPath(); ctx.arc(tx, UI.tray.y - 46, 6, 0, Math.PI * 2); ctx.fillStyle = '#e35b4a'; ctx.fill(); tx += 16; }
  if (G.build.cucumber) { ctx.beginPath(); ctx.arc(tx, UI.tray.y - 46, 6, 0, Math.PI * 2); ctx.fillStyle = '#7bbf5e'; ctx.fill(); tx += 16; }
  if (G.build.tahini) { ctx.beginPath(); ctx.arc(tx, UI.tray.y - 46, 6, 0, Math.PI * 2); ctx.fillStyle = '#e8dcc0'; ctx.fill(); }
}

function drawCustomer(ctx, UI, G, IMG, W) {
  const c = G.customer;
  const ease = 1 - Math.pow(1 - c.walkIn, 3);
  let dx = 0, alpha = 1;
  if (!c.leaving) { dx = (1 - ease) * W * 0.4; } else { const lp = 1 - c.leaveT / 0.45; dx = -lp * W * 0.3; alpha = 1 - lp; }
  ctx.save(); ctx.globalAlpha = alpha;
  const cx = UI.customer.x + dx, cy = UI.customer.y;
  const R = Math.min(W, UI.h) * 0.11;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,14,26,.55)'; ctx.fill();
  const frac = Math.max(0, c.patience / c.patienceMax);
  ctx.beginPath(); ctx.arc(cx, cy, R + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  ctx.strokeStyle = frac > 0.5 ? '#4ad17a' : frac > 0.22 ? '#ffc83d' : '#ff5a4d'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
  drawSprite(ctx, IMG[c.kind], cx, cy + R * 0.85, R * 2.1, true);

  const order = c.order;
  const toppings = [];
  if (order.tomato) toppings.push('tomato');
  if (order.cucumber) toppings.push('cucumber');
  if (order.tahini) toppings.push('tahini');

  ctx.font = '800 15px Rubik';
  const countText = 'x' + order.falafel;
  const countW = ctx.measureText(countText).width;
  const items = [
    { icon: 'falafel', w: spriteWidth(IMG.falafel, 24), h: 24 },
    { text: countText, w: countW },
    ...toppings.map((t) => ({ icon: t, w: spriteWidth(IMG[t], 22), h: 22 })),
  ];
  const gap = 10, padX = 16;
  const contentW = items.reduce((s, it) => s + it.w, 0) + gap * (items.length - 1);
  const bw = Math.max(140, contentW + padX * 2), bh = 52, bx = cx - bw / 2, by = cy - R - bh - 18;
  roundRect(ctx, bx, by, bw, bh, 14); ctx.fillStyle = 'rgba(255,248,236,.95)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 10, by + bh); ctx.lineTo(cx + 10, by + bh); ctx.lineTo(cx, by + bh + 12); ctx.closePath(); ctx.fill();
  let ix = bx + padX;
  ctx.fillStyle = '#2a2234'; ctx.font = '800 15px Rubik'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
  for (const it of items) {
    if (it.icon) {
      drawSprite(ctx, IMG[it.icon], ix + it.w / 2, by + bh / 2, it.h);
      if (it.icon !== 'falafel' && G.build[it.icon]) { ctx.beginPath(); ctx.arc(ix + it.w - 4, by + 10, 4, 0, Math.PI * 2); ctx.fillStyle = '#4ad17a'; ctx.fill(); }
    } else {
      ctx.fillText(it.text, ix, by + bh / 2);
    }
    ix += it.w + gap;
  }
  ctx.restore();
}

export function renderScene(ctx, W, H, G, UI, IMG) {
  ctx.save();
  const sh = getShake();
  if (sh.x || sh.y) ctx.translate(sh.x, sh.y);
  ctx.fillStyle = '#1a1230'; ctx.fillRect(0, 0, W, H);
  drawCover(ctx, IMG.stall, 0, 0, W, UI.stallH);
  ctx.fillStyle = 'rgba(20,14,30,.55)'; ctx.fillRect(0, UI.stallH, W, H - UI.stallH);
  drawAmbientDust(ctx);
  if (G.phase === 'serving' && G.customer) drawCustomer(ctx, UI, G, IMG, W);
  drawTray(ctx, UI, G, IMG);
  drawStations(ctx, UI, G, IMG);
  drawFx(ctx);
  ctx.restore();
}
