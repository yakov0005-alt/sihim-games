// Juice for "tray": particle bursts, shockwave rings, tweened popup/combo
// text, trauma-based screen shake and an always-on ambient dust/sway layer
// so the tray feels alive even between clears. No DOM access — callers pass
// the screen transform (cx, cy, scale) at draw time so effects land in the
// same spot as the balls rendered by render.js.
function makeMotes(n = 11) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const depth = 0.45 + Math.random() * 0.85; // parallax: nearer motes drift faster/bigger/brighter
    arr.push({
      angle: Math.random() * Math.PI * 2,
      radius: 0.2 + Math.random() * 0.8,
      speed: (0.05 + Math.random() * 0.09) * (Math.random() < 0.5 ? 1 : -1),
      bobPhase: Math.random() * Math.PI * 2,
      depth,
      size: 1 + depth * 2.1,
    });
  }
  return arr;
}

export function createFx() {
  const particles = [];
  const texts = [];
  const rings = [];
  const motes = makeMotes();
  let shakeMag = 0;
  let clock = 0;

  function shake(mag) { shakeMag = Math.max(shakeMag, mag); }

  function burst(x, y, color, n = 14, opts = {}) {
    const spark = !!opts.spark;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * (spark ? 1.5 : 0.9) + 0.35;
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: spark ? 0.4 : 0.55, maxLife: spark ? 0.4 : 0.55, color,
        size: (spark ? 1.8 : 3) + Math.random() * (spark ? 2.5 : 3.5),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 10,
        spark,
      });
    }
  }

  // Small poof opposite the tray-rim normal, used when a ball bounces off
  // the edge (nx, ny point outward from tray center at the contact point).
  function bump(x, y, nx = 0, ny = 0, strength = 1) {
    const n = Math.min(10, 3 + strength * 4);
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 1.6;
      const a = Math.atan2(ny, nx) + Math.PI + spread;
      const v = (0.25 + Math.random() * 0.4) * Math.min(1.4, strength);
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0.3, maxLife: 0.3, color: '#f5ead2',
        size: 1.6 + Math.random() * 1.8, rot: 0, vr: 0, spark: true,
      });
    }
  }

  // Expanding shockwave ring for big/chained clears.
  function ring(x, y, color) {
    rings.push({ x, y, life: 0.42, maxLife: 0.42, color });
  }

  // Floating "+score" / status labels. opts.dy offsets chain text above the
  // score text so they don't overlap; opts.size is in tray-space units.
  function floatText(x, y, text, color = '#fff', opts = {}) {
    texts.push({
      x, y: y + (opts.dy || 0), text, color,
      size: opts.size || 0.085,
      life: 0.95, maxLife: 0.95,
    });
  }

  // Milestone chain callout: colour/size climbs with the streak so a long
  // run of clears reads as escalating, not samey.
  function comboText(x, y, chainIndex) {
    const tier = chainIndex >= 4 ? { c: '#ff8a3c', s: 0.095 } : chainIndex >= 2 ? { c: '#ffd23f', s: 0.08 } : { c: '#bfe9a0', s: 0.07 };
    floatText(x, y, `שרשרת ×${chainIndex + 1}!`, tier.c, { dy: -0.26, size: tier.s });
  }

  function update(dt) {
    clock += dt;
    shakeMag = Math.max(0, shakeMag - dt * 46);
    for (const p of particles) {
      p.vy += dt * (p.spark ? 0.15 : 0.6); // sparks float, confetti arcs down
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    for (const t of texts) {
      t.y -= 0.42 * dt;
      t.life -= dt;
    }
    for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life <= 0) texts.splice(i, 1);
    for (const r of rings) r.life -= dt;
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life <= 0) rings.splice(i, 1);
    for (const m of motes) m.angle += m.speed * dt;
  }

  function draw(ctx, cx = 0, cy = 0, scale = 1) {
    for (const m of motes) {
      const mx = cx + Math.cos(m.angle) * m.radius * scale;
      const my = cy + (Math.sin(m.angle) * m.radius + Math.sin(clock * 0.6 + m.bobPhase) * 0.03 * m.depth) * scale * 0.86;
      ctx.save();
      ctx.globalAlpha = 0.1 * m.depth;
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(mx, my, m.size * m.depth, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const r of rings) {
      const t = 1 - r.life / r.maxLife;
      const x = cx + r.x * scale, y = cy + r.y * scale * 0.86;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.5;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * (1 - t) + 1;
      ctx.beginPath();
      ctx.ellipse(x, y, scale * 0.08 + t * scale * 0.4, (scale * 0.08 + t * scale * 0.4) * 0.86, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const p of particles) {
      const x = cx + p.x * scale, y = cy + p.y * scale * 0.86;
      const t = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.translate(x, y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      const s = p.size * t + p.size * 0.3;
      ctx.beginPath();
      if (p.spark) { ctx.ellipse(0, 0, s * 0.45, s, 0, 0, Math.PI * 2); }
      else if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s, 1.5);
      else ctx.rect(-s / 2, -s / 2, s, s);
      ctx.fill();
      ctx.restore();
    }
    for (const t of texts) {
      const x = cx + t.x * scale, y = cy + t.y * scale * 0.86;
      const age = 1 - t.life / t.maxLife;
      const pop = age < 0.18 ? 0.7 + (age / 0.18) * 0.3 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life / t.maxLife + 0.15));
      ctx.font = `900 ${Math.round(t.size * scale * pop)}px Rubik, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(t.text, x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
      ctx.restore();
    }
  }

  // Combines shake trauma with a slow, subtle idle sway so the tray never
  // feels perfectly static, even with no shake active.
  function shakeOffset() {
    const sway = [Math.sin(clock * 0.55) * 0.6, Math.sin(clock * 0.41 + 1.7) * 0.5];
    if (shakeMag <= 0) return sway;
    return [sway[0] + (Math.random() - 0.5) * shakeMag, sway[1] + (Math.random() - 0.5) * shakeMag];
  }

  return { shake, burst, bump, ring, floatText, comboText, update, draw, shakeOffset };
}
