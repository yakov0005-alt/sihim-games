// Rendering-only helpers for "tray": turns play.js's plain simulation state
// into a rich scene (tilt-shaded wood tray, glossy rolling fruit with
// perspective depth, pop/shrink juice, floating score text). No physics here.
export const COLORS = { pomegranate: '#e2374d', orange: '#ff9d3c', lemon: '#f5e34d', grape: '#8a5fd1', olive: '#7a8f4a' };

const POP_DUR = 0.3;
const SPAWN_DUR = 0.28;

function easeOutBack(t) {
  const c = 1.7;
  return 1 + c * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

export function sceneGeometry(width, height) {
  const cx = width / 2, cy = height * 0.52;
  const scale = Math.min(width, height) * 0.4;
  return { cx, cy, scale };
}

function drawTrayBase(ctx, images, cx, cy, scale, visTilt) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, scale * 0.8, scale * 0.78, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const wood = images.wood;
  ctx.fillStyle = wood && wood.complete ? (ctx.createPattern(wood, 'repeat') || '#5b3a1e') : '#5b3a1e';
  ctx.fillRect(cx - scale, cy - scale, scale * 2, scale * 2);

  // Directional shading so the tilt reads visually: the "downhill" edge
  // (the way fruit is being pushed) darkens, the uphill edge catches light.
  const tx = Math.max(-1, Math.min(1, visTilt.dx)), ty = Math.max(-1, Math.min(1, visTilt.dy));
  const mag = Math.hypot(tx, ty);
  if (mag > 0.02) {
    const grad = ctx.createLinearGradient(cx - tx * scale, cy - ty * scale * 0.86, cx + tx * scale, cy + ty * scale * 0.86);
    grad.addColorStop(0, `rgba(255,230,180,${0.16 * mag})`);
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${0.28 * mag})`);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - scale, cy - scale, scale * 2, scale * 2);
  }
  ctx.restore();

  const tray = images.tray;
  if (tray && tray.complete) {
    // tray.webp's opaque square sits left-of-center with extra transparent
    // padding on the right (measured via alpha bbox), so size/position it by
    // its visible square rather than the full image bounds.
    const vis = { l: 0.014, r: 0.728, t: 0.016, b: 0.980 };
    const cxFrac = (vis.l + vis.r) / 2, cyFrac = (vis.t + vis.b) / 2;
    const tw = (scale * 1.64) / (vis.r - vis.l), th = tw * (tray.height / tray.width);
    const ox = tx * 4, oy = ty * 3;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(tray, cx - tw * cxFrac + ox, cy - th * cyFrac + oy, tw, th);
    ctx.restore();
  }
}

function drawFruit(ctx, img, x, y, r, rot, highlight) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (img && img.complete) ctx.drawImage(img, -r, -r, r * 2, r * 2);
  else { ctx.fillStyle = highlight.fallback; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
  // Baked upper-left lighting on the sprites gets a small live gloss dot so
  // rolling balls still feel glossy/3D as they move under the light.
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 0, -r * 0.35, -r * 0.4, r * 0.75);
  g.addColorStop(0, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.35, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawScene(ctx, images, width, height, state, fx, visTilt = { dx: 0, dy: 0 }) {
  const { cx, cy, scale } = sceneGeometry(width, height);
  drawTrayBase(ctx, images, cx, cy, scale, visTilt);

  const drawables = state.balls.map((b) => ({ ball: b, kind: 'ball' }))
    .concat((state.poppers || []).map((p) => ({ ball: p, kind: 'pop' })));
  drawables.sort((a, b) => a.ball.y - b.ball.y);

  for (const d of drawables) {
    const b = d.ball;
    const depth = 1 + b.y * 0.12;
    let r = b.r * scale * depth;
    let alpha = 1;
    if (d.kind === 'ball') {
      const age = b.age ?? 1;
      if (age < SPAWN_DUR) r *= Math.max(0.05, easeOutBack(age / SPAWN_DUR));
    } else {
      const t = Math.min(1, b.t / POP_DUR);
      r *= Math.max(0, 1 - t) * 1.15;
      alpha = Math.max(0, 1 - t);
    }
    const x = cx + b.x * scale, y = cy + b.y * scale * 0.86;

    ctx.save();
    ctx.globalAlpha = alpha * 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.62, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    drawFruit(ctx, images[b.type], x, y, r, b.rot || 0, { fallback: COLORS[b.type] || '#fff' });
    ctx.restore();
  }

  fx?.draw(ctx, cx, cy, scale);
}
