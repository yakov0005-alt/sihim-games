// Canvas rendering for "magnet": arena, cable, drones, boss and the core
// robot. Pure drawing — all state (positions, charge, who's held) is handed
// in from play.js each frame via a plain view-state object.
import { DRONE_TYPES, BOSS } from './rules.js';

function drawCentered(ctx, img, x, y, w, rot = 0, alpha = 1) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const h = w * (img.naturalHeight / img.naturalWidth);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawArenaBg(ctx, img, W, H) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function drawShadow(ctx, x, y, r) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.6, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCable(ctx, cx, cy, tx, ty, charge) {
  const g = ctx.createLinearGradient(cx, cy, tx, ty);
  g.addColorStop(0, `rgba(123,255,214,${0.3 + charge * 0.4})`);
  g.addColorStop(1, `rgba(255,196,90,${0.35 + charge * 0.55})`);
  ctx.save();
  ctx.strokeStyle = g;
  ctx.lineWidth = 2.5 + charge * 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = `rgba(255,255,255,${0.5 + charge * 0.5})`;
  ctx.arc(tx, ty, 4 + charge * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

let tClock = 0;
function drawCoreGlow(ctx, cx, cy, r, charge, holding) {
  tClock += 0.06;
  const pulse = 0.88 + Math.sin(tClock) * 0.12;
  const rad = r * (1.3 + charge * 0.5) * pulse;
  const col = holding ? `rgba(255,196,90,${0.18 + charge * 0.22})` : 'rgba(123,255,214,0.14)';
  const grd = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, rad);
  grd.addColorStop(0, col);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDrone(ctx, images, d, isHeld = false, charge = 0) {
  const def = DRONE_TYPES[d.type];
  const w = def.radius * 3.1 * (isHeld ? 1 + charge * 0.12 : 1);
  const img = images['drone-' + d.type];
  if (d.shielded) {
    ctx.save();
    ctx.strokeStyle = 'rgba(123,220,255,.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(d.x, d.y, def.radius * 1.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawCentered(ctx, img, d.x, d.y, w, d.rot || 0);
  if (d.flash > 0) {
    ctx.save();
    ctx.globalAlpha = d.flash;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(d.x, d.y, def.radius * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBoss(ctx, img, boss) {
  const w = BOSS.radius * 3.0;
  drawCentered(ctx, img, boss.x, boss.y, w, Math.sin(boss.t * 0.55) * 0.08);
  if (boss.flash > 0) {
    ctx.save();
    ctx.globalAlpha = boss.flash;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, BOSS.radius * 1.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const bw = 140, bh = 10, bx = boss.x - bw / 2, by = boss.y - w * 0.42 - 20;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(bx, by, bw, bh);
  const frac = Math.max(0, boss.health / BOSS.health);
  ctx.fillStyle = frac > 0.3 ? '#ff8a3d' : '#ff5050';
  ctx.fillRect(bx, by, bw * frac, bh);
  ctx.restore();
}

function drawProjectile(ctx, images, p) {
  const img = images['drone-' + p.type];
  drawCentered(ctx, img, p.x, p.y, DRONE_TYPES[p.type].radius * 2.6, p.rot);
}

function drawRobot(ctx, images, cx, cy, holding) {
  const img = holding ? images['robot-magnet'] : images.robot;
  drawCentered(ctx, img, cx, cy, 118);
}

export function drawScene(ctx, images, W, H, v) {
  const { cx, cy, coreRadius, drones, boss, held, projectiles, tip, charge, holding } = v;
  ctx.fillStyle = '#0b1016';
  ctx.fillRect(0, 0, W, H);
  drawArenaBg(ctx, images.arena, W, H);
  for (const d of drones) drawShadow(ctx, d.x, d.y, DRONE_TYPES[d.type].radius);
  if (boss) drawShadow(ctx, boss.x, boss.y, BOSS.radius * 0.8);
  if (tip) drawCable(ctx, cx, cy, tip.x, tip.y, charge);
  drawCoreGlow(ctx, cx, cy, coreRadius, charge, holding);
  if (boss) drawBoss(ctx, images.boss, boss);
  for (const d of drones) drawDrone(ctx, images, d);
  if (held && tip) drawDrone(ctx, images, { ...held, x: tip.x, y: tip.y }, true, charge);
  for (const p of projectiles) drawProjectile(ctx, images, p);
  drawRobot(ctx, images, cx, cy, holding);
}
