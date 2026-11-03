// Screen-space juice for "neon": camera shake + gentle ambient sway (applied
// by play.js via shakeOffset()), a soft full-screen hit-flash, and floating
// combo/score popup text. Mounts its own tiny DOM overlay lazily so no other
// game file needs markup changes.

const POPUP_LIFE = 0.85;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

function styleOverlay(el) {
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.zIndex = '12';
  el.style.pointerEvents = 'none';
  el.style.overflow = 'hidden';
}

export function createFx() {
  let mag = 0;
  let t = 0;
  let layer = null;
  let flashEl = null;
  let flashT = 0;
  let flashColor = '#3df3ff';
  const popups = [];

  function ensureLayer() {
    if (layer) return;
    layer = document.createElement('div');
    styleOverlay(layer);
    flashEl = document.createElement('div');
    flashEl.style.position = 'absolute';
    flashEl.style.inset = '0';
    flashEl.style.opacity = '0';
    flashEl.style.mixBlendMode = 'screen';
    layer.appendChild(flashEl);
    document.body.appendChild(layer);
  }

  function shake(amount) { mag = Math.max(mag, amount); }

  function flash(color = 0x3df3ff, amount = 0.3) {
    ensureLayer();
    flashColor = typeof color === 'number' ? hex(color) : color;
    flashT = Math.max(flashT, amount);
  }

  function popup(text, { color = 0xd6f9ff, size = 22, top = 30 } = {}) {
    ensureLayer();
    const el = document.createElement('div');
    el.textContent = text;
    const dx = (Math.random() - 0.5) * 50;
    const c = typeof color === 'number' ? hex(color) : color;
    el.style.position = 'absolute';
    el.style.left = `calc(50% + ${dx}px)`;
    el.style.top = `${top}%`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.color = c;
    el.style.font = `800 ${size}px system-ui, sans-serif`;
    el.style.textShadow = `0 0 10px ${c}, 0 2px 6px #000`;
    el.style.whiteSpace = 'nowrap';
    el.style.willChange = 'transform, opacity';
    layer.appendChild(el);
    popups.push({ el, life: POPUP_LIFE, maxLife: POPUP_LIFE });
  }

  // Combo/drop-quality callout — the core reward feedback for the climb+drop mechanic.
  function comboText(quality, combo) {
    const label = quality === 'perfect' ? 'דחף מושלם!' : quality === 'good' ? 'דחף טוב' : 'דחף';
    const text = combo > 1 ? `${label} ×${combo}` : label;
    const color = quality === 'perfect' ? 0xffd166 : quality === 'good' ? 0xffb23d : 0x3df3ff;
    popup(text, { color, size: quality === 'perfect' ? 28 : 20, top: 28 });
  }

  function scorePopup(points) {
    popup(`+${points}`, { color: 0xd6f9ff, size: 18, top: 40 });
  }

  function message(text, color = 0xd6f9ff) {
    popup(text, { color, size: 24, top: 34 });
  }

  function update(dt) {
    t += dt;
    mag = Math.max(0, mag - dt * 1.6);
    if (flashEl && flashT > 0) {
      flashT = Math.max(0, flashT - dt * 1.9);
      flashEl.style.background = flashColor;
      flashEl.style.opacity = String(flashT);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt;
      if (p.life <= 0) { p.el.remove(); popups.splice(i, 1); continue; }
      const k = 1 - p.life / p.maxLife;
      p.el.style.transform = `translate(-50%, calc(-50% - ${k * 46}px))`;
      p.el.style.opacity = String(Math.min(1, p.life / p.maxLife + 0.15));
    }
  }

  // Idle breathing sway so the tube never feels perfectly static, plus the
  // random shake jitter on top while mag > 0.
  function shakeOffset() {
    const sway = { x: Math.sin(t * 0.55) * 0.015, y: Math.cos(t * 0.4) * 0.012 };
    if (mag <= 0) return sway;
    return { x: sway.x + (Math.random() - 0.5) * mag, y: sway.y + (Math.random() - 0.5) * mag };
  }

  function clear() {
    for (const p of popups) p.el.remove();
    popups.length = 0;
    flashT = 0;
  }

  return { shake, flash, popup, comboText, scorePopup, message, update, shakeOffset, clear };
}
