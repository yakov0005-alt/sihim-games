// Sprite-based burst particles for "magnet" — spins the bolt/spark/boss-chip
// art outward on a pop, separate from fx.js's generic colored-dust shake/
// popup system so every destroyed drone visibly sheds real bolts & sparks.
export function createSparkFx() {
  const items = [];

  function burst(x, y, keys, count = 8, speed = 160) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.5 + Math.random() * 0.9);
      items.push({
        key: keys[Math.floor(Math.random() * keys.length)],
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 9,
        life: 0.45 + Math.random() * 0.35, maxLife: 0.8,
        scale: 0.55 + Math.random() * 0.55,
      });
    }
  }

  function update(dt) {
    for (const p of items) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
      p.vx *= 1 - Math.min(1, dt * 1.6);
      p.rot += p.spin * dt;
      p.life -= dt;
    }
    for (let i = items.length - 1; i >= 0; i--) if (items[i].life <= 0) items.splice(i, 1);
  }

  function draw(ctx, images) {
    for (const p of items) {
      const img = images[p.key];
      if (!img || !img.complete || !img.naturalWidth) continue;
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      const w = img.naturalWidth * 0.22 * p.scale, h = img.naturalHeight * 0.22 * p.scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  return { burst, update, draw };
}
