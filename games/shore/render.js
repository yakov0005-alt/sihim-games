// Canvas renderer for "shore" — pure drawing, no game state mutation.
// Consumes a snapshot handed by play.js each frame.
import { mulberry32 } from './rules.js';

const CELL = 128; // bird-sheet frame size
const PIVOT = { x: 64, y: 124 }; // foot-contact pivot inside each frame
const BIRD_SCALE = 0.46;
const TINTS = ['#2fb3c7', '#e8b23d', '#1f6fae']; // rockpool / sandbar / reef wash

const seedSpeckle = mulberry32(7);
const SPECKLES = Array.from({ length: 46 }, () => ({
  nx: seedSpeckle(),
  ny: 0.5 + seedSpeckle() * 0.46,
  s: 1 + Math.floor(seedSpeckle() * 2),
}));
const seedCloud = mulberry32(13);
const CLOUDS = Array.from({ length: 4 }, () => ({
  nx: seedCloud(), ny: 0.08 + seedCloud() * 0.22, w: 70 + seedCloud() * 60, speed: 6 + seedCloud() * 10,
}));

export function worldToScreenX(wx, worldMax, width) {
  return width * 0.07 + (wx / worldMax) * width * 0.86;
}

// The top strip is static scenery (cliffs, town, sky) while the bottom strip
// is where the game actually happens. On tall/narrow (mobile) viewports we
// give scenery much less room so the playable strip stays readable; on wide
// (desktop) viewports there is plenty of height to spare for both.
export function groundFrac(width, height) {
  const aspect = width / Math.max(1, height);
  const t = Math.max(0, Math.min(1, (aspect - 0.5) / 1.1));
  return 0.33 + t * 0.25;
}

export function groundBaseline(width, height) {
  const groundY = height * groundFrac(width, height);
  return groundY + (height - groundY) * 0.52;
}

function drawImgOrFill(ctx, img, x, y, w, h, fill) {
  if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, w, h);
  else { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
}

// Static full-frame overlays (level tint + vignette) and the water-depth
// gradient never change shape frame-to-frame, only on resize/level change —
// bake them to offscreen canvases once and blit instead of repainting
// gradients every frame (cheap on a software rasterizer).
let overlayCache = null; // { w, h, levelIndex, canvas }
function getOverlay(width, height, levelIndex) {
  if (overlayCache && overlayCache.w === width && overlayCache.h === height && overlayCache.levelIndex === levelIndex) {
    return overlayCache.canvas;
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.globalAlpha = 0.1;
  g.fillStyle = TINTS[levelIndex % TINTS.length];
  g.fillRect(0, 0, width, height);
  g.globalAlpha = 1;
  const vg = g.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = vg;
  g.fillRect(0, 0, width, height);
  overlayCache = { w: width, h: height, levelIndex, canvas: c };
  return c;
}

let waterCache = null; // { h, canvas }
function getWaterStrip(h) {
  const hh = Math.max(1, Math.round(h));
  if (waterCache && waterCache.h === hh) return waterCache.canvas;
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = hh;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, hh);
  grad.addColorStop(0, 'rgba(70,170,200,.65)');
  grad.addColorStop(1, 'rgba(10,60,95,.82)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1, hh);
  waterCache = { h: hh, canvas: c };
  return c;
}

function drawSprite(ctx, img, frame, x, y, scale, flip) {
  if (!img || !img.complete || !img.naturalWidth) {
    ctx.fillStyle = '#f4f1e3';
    ctx.fillRect(x - 12, y - 26, 24, 26);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip * scale, scale);
  ctx.drawImage(img, frame * CELL, 0, CELL, CELL, -PIVOT.x, -PIVOT.y, CELL, CELL);
  ctx.restore();
}

export function drawScene(ctx, images, width, height, view) {
  const { clock, levelIndex, birdX, edge, worldMax, facing, moving, peckTimer, panicTimer, hitFlash, items } = view;
  const groundY = height * groundFrac(width, height);
  const baseline = groundBaseline(width, height);
  const toX = (wx) => worldToScreenX(wx, worldMax, width);

  const farShift = -(birdX / worldMax) * 26;
  drawImgOrFill(ctx, images['beach-far'], farShift, 0, width - farShift * 2, groundY, '#2a6f8f');

  ctx.save();
  for (const c of CLOUDS) {
    const cx = ((c.nx * width + clock * c.speed) % (width + c.w)) - c.w / 2;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#eef6ff';
    ctx.beginPath();
    ctx.ellipse(cx, c.ny * groundY, c.w * 0.5, c.w * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const nearShift = -(birdX / worldMax) * 60;
  drawImgOrFill(ctx, images['beach-near'], nearShift, groundY, width - nearShift * 2, height - groundY, '#e4c98a');

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#8a6a3f';
  for (const s of SPECKLES) ctx.fillRect(s.nx * width, groundY + s.ny * (height - groundY), s.s, s.s);
  ctx.restore();

  const edgeX = toX(edge);
  ctx.drawImage(getWaterStrip(height - groundY), edgeX, groundY, width - edgeX, height - groundY);

  const waveImg = images['wave'];
  const tileH = Math.max(36, (height - groundY) / 5);
  for (let y = groundY, i = 0; y < height + tileH; y += tileH, i++) {
    const jitter = Math.sin(clock * 2.4 + i) * 4;
    if (waveImg && waveImg.complete && waveImg.naturalWidth) {
      ctx.save();
      ctx.translate(edgeX + jitter, y);
      ctx.rotate(Math.PI / 2);
      const s = tileH * 1.15;
      ctx.drawImage(waveImg, -s / 2, -s * 0.42, s, s * 0.8);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillRect(edgeX - 3 + jitter, y, 6, tileH * 0.6);
    }
  }

  for (const it of items) {
    const x = toX(it.x);
    const bob = Math.sin(clock * 4 + it.id) * 2;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, baseline + 10, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const img = images[it.type];
    const s = 30;
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x - s / 2, baseline - s + bob, s, s);
    else { ctx.fillStyle = it.type === 'crab' ? '#d9533c' : '#f3ead0'; ctx.fillRect(x - 8, baseline - 16 + bob, 16, 16); }
  }

  const bx = toX(birdX);
  const bird = images['bird-sheet'];
  let frame = 0;
  if (panicTimer > 0) frame = 3;
  else if (peckTimer > 0) frame = 2;
  else frame = moving ? Math.floor(clock * 9) % 2 : 0;
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(bx, baseline + 11, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawSprite(ctx, bird, frame, bx, baseline + 2, BIRD_SCALE, facing);

  if (hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = hitFlash * 0.35;
    ctx.fillStyle = '#2fa0ff';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  ctx.drawImage(getOverlay(width, height, levelIndex), 0, 0);
}
