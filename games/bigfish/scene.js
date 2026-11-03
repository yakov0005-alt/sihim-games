// Canvas rendering for "bigfish". Pure draw functions — every value comes
// from play.js's state/anim objects, nothing here mutates game state. Split
// out of play.js so the logic file stays readable; carp pose math lives in
// fish.js.
import { carpPose } from './fish.js';

const ROPE_COLOR = '#e4cf93';

export function geometry(W, H) {
  const waterY = H * 0.42;
  const ropeStartX = W * 0.16;
  const ropeEndX = W * 0.8;
  const midY = waterY + Math.min(70, H * 0.08);
  return { waterY, ropeStartX, ropeEndX, midY };
}

export function knotX(tension, g) {
  return g.ropeStartX + (g.ropeEndX - g.ropeStartX) * (tension / 100);
}

function drawBackground(ctx, images, W, H, g, t) {
  const { waterY } = g;
  if (images.surface) ctx.drawImage(images.surface, 0, 0, W, waterY);
  else { ctx.fillStyle = '#0b3b37'; ctx.fillRect(0, 0, W, waterY); }
  if (images.underwater) ctx.drawImage(images.underwater, 0, waterY, W, H - waterY);
  else { ctx.fillStyle = '#06201c'; ctx.fillRect(0, waterY, W, H - waterY); }

  ctx.save();
  ctx.strokeStyle = 'rgba(190,255,230,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 10) {
    const y = waterY + Math.sin(x * 0.045 + t * 2.2) * 3;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(210,255,245,0.3)';
  for (let i = 0; i < 12; i++) {
    const bx = W * ((i * 0.173) % 1);
    const span = H - waterY;
    const by = H - (((t * 34 + i * 53) % span));
    if (by < waterY + 4) continue;
    const r = 1.5 + (i % 4);
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawRope(ctx, g, kx, sagPx) {
  const midX = (g.ropeStartX + g.ropeEndX) / 2;
  ctx.save();
  ctx.strokeStyle = ROPE_COLOR;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(g.ropeStartX, g.midY);
  ctx.quadraticCurveTo(midX, g.midY + sagPx, g.ropeEndX, g.midY);
  ctx.stroke();

  const glow = ctx.createRadialGradient(kx, g.midY, 0, kx, g.midY, 28);
  glow.addColorStop(0, 'rgba(255,230,160,0.85)');
  glow.addColorStop(1, 'rgba(255,230,160,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(kx, g.midY, 28, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCarp(ctx, images, x, y, scale, pose) {
  const body = images['carp-body'], tail = images['carp-tail'];
  ctx.save();
  ctx.translate(x, y + pose.bob);
  ctx.rotate(pose.bodyTilt);
  if (body && tail) {
    const bw = 170 * scale, bh = bw * (body.height / body.width);
    const tw = bw * (tail.width / body.width), th = tw * (tail.height / tail.width);
    const overlap = bw * 0.07;
    ctx.save();
    ctx.translate(bw / 2 - overlap, 0);
    ctx.rotate(pose.tailAngle);
    ctx.drawImage(tail, -overlap, -th / 2, tw, th);
    ctx.restore();
    ctx.drawImage(body, -bw / 2, -bh / 2, bw, bh);
  } else if (images.carp) {
    const w = 170 * scale, h = w * (images.carp.height / images.carp.width);
    ctx.drawImage(images.carp, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

function drawFisherman(ctx, img, x, groundY, w, lean, fallProgress) {
  if (!img) return;
  const h = w * (img.height / img.width);
  ctx.save();
  ctx.translate(x, groundY);
  const fallAngle = fallProgress * (Math.PI / 2.1);
  ctx.translate(0, fallProgress * h * 0.45);
  ctx.rotate(lean * 0.16 + fallAngle);
  ctx.globalAlpha = 1 - fallProgress * 0.65;
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}

// Only telegraphDirection is ever drawn — a feint must look identical to a
// real pull, or the misdirection mechanic gives itself away.
function drawPullIndicator(ctx, pull, elapsed, x, y) {
  const remain = Math.max(0, 1 - elapsed / pull.window);
  const dir = pull.telegraphDirection;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 5;
  ctx.strokeStyle = remain > 0.3 ? 'rgba(255,210,90,0.9)' : 'rgba(255,90,90,0.95)';
  ctx.beginPath();
  ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + remain * Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  const ax = dir * 12;
  ctx.moveTo(ax - dir * 10, -16);
  ctx.lineTo(ax + dir * 14, 0);
  ctx.lineTo(ax - dir * 10, 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSplash(ctx, img, splash) {
  if (!img || !splash || splash.t < 0) return;
  const k = Math.min(1, splash.t / splash.dur);
  const scale = 0.6 + k * 0.9;
  const alpha = 1 - k;
  const w = img.width * 0.55 * scale, h = img.height * 0.55 * scale;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.drawImage(img, splash.x - w / 2, splash.y - h * 0.7, w, h);
  ctx.restore();
}

function drawFlash(ctx, W, H, flash) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, flash);
  ctx.fillStyle = '#ff3b3b';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function renderScene(ctx, images, W, H, state, anim) {
  const g = geometry(W, H);
  drawBackground(ctx, images, W, H, g, anim.t);

  const kx = knotX(state.tension, g);
  const sag = Math.max(3, 14 - Math.abs(state.tension - 50) * 0.12);
  drawRope(ctx, g, kx, sag);

  const scale = Math.min(1, W / 900);
  const carpX = kx - 170 * scale * 0.55;
  const pose = carpPose(anim.t, anim.kickWag, anim.fishLean * -0.25);
  drawCarp(ctx, images, carpX, g.midY, scale, pose);

  const fw = Math.min(160, W * 0.21);
  const fisherman = images[`fisherman-${state.levelIndex + 1}`];
  drawFisherman(ctx, fisherman, g.ropeEndX + fw * 0.12, g.midY + fw * 0.62, fw, anim.fishLean, anim.fishFall);

  if (state.pull && !state.resolved) drawPullIndicator(ctx, state.pull, state.pullElapsed, kx, g.midY - 74);

  drawSplash(ctx, images.splash, anim.splash);
  drawFlash(ctx, W, H, anim.flash);
}
