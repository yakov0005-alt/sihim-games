// Pure canvas drawing helpers for the skate runner — screen-space only, no
// world/rules knowledge, so play.js owns all world-to-screen math.

export function drawCover(ctx, img, x, y, w, h) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const ir = img.naturalWidth / img.naturalHeight, r = w / h;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (ir > r) { sw = sh * r; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / r; sy = (img.naturalHeight - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// scrollPx: raw screen-px scroll offset (caller applies its own parallax factor).
export function drawTileBand(ctx, img, x, y, w, h, scrollPx) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const tileW = img.naturalWidth * (h / img.naturalHeight);
  if (tileW <= 0) return;
  const offset = -(((scrollPx % tileW) + tileW) % tileW);
  for (let sx = x + offset; sx < x + w; sx += tileW) ctx.drawImage(img, sx, y, tileW, h);
}

export function drawRampSprite(ctx, img, screenX, width, groundY) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const scale = width / img.naturalWidth;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, screenX, groundY - h, width, h);
}

export function drawRider(ctx, img, x, y, targetH, { anchor = 'bottom', rotation = 0 } = {}) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const scale = targetH / img.naturalHeight;
  const w = img.naturalWidth * scale, h = targetH;
  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  if (anchor === 'bottom') ctx.drawImage(img, -w / 2, -h, w, h);
  else ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// power 0..1: how close to the wind gust peak the player currently is.
export function drawGustMeter(ctx, img, x, y, power, active) {
  const r = 32;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2);
  ctx.strokeStyle = power > 0.75 ? '#7cffb2' : '#ffd34d'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
  if (img && img.complete && img.naturalWidth) {
    const scale = ((0.55 + power * 0.45) * 48) / img.naturalHeight;
    const w2 = img.naturalWidth * scale, h2 = img.naturalHeight * scale;
    ctx.globalAlpha = 0.5 + power * 0.5;
    ctx.drawImage(img, x - w2 / 2, y - h2 / 2, w2, h2);
  }
  ctx.restore();
  if (!active) {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '700 11px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('משב רוח', x, y + r + 16);
  }
}
