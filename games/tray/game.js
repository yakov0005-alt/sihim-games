// Entry module for "tray" (מגש הפירות): preloads art, owns the canvas and
// main loop, and wires Sihim.init + the state machine. Gameplay itself lives
// in play.js (uses rules.js), with fx.js/audio.js/bot.js as support.
import { createPlay } from './play.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { createBot } from './bot.js';

const ASSET_NAMES = ['tray', 'title', 'wood', 'pomegranate', 'orange', 'lemon', 'grape', 'olive'];

const qs = new URLSearchParams(location.search);
const BOT_MODE = qs.get('bot') === '1';
const MUTE = qs.get('mute') === '1';
if (MUTE) localStorage.setItem('sihim:sound', '0');

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;

const game = window.__game = { state: 'title', score: 0, level: 1, dpr: 1, bot: BOT_MODE };

function resize() {
  const w = innerWidth, h = innerHeight;
  if (w < 2 || h < 2) return; // skip degenerate layout frames (e.g. mid-rotation)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = w; H = h;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.dpr = dpr;
}
addEventListener('resize', resize);
resize();

const images = {};
function preload(names) {
  const fill = document.querySelector('#preloadFill');
  const txt = document.querySelector('#preloadTxt');
  const wrap = document.querySelector('#preload');
  let loaded = 0;
  return Promise.all(names.map((name) => new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => {
      loaded++;
      const pct = Math.round((loaded / names.length) * 100);
      if (fill) fill.style.width = pct + '%';
      if (txt) txt.textContent = `טוען… ${pct}%`;
      resolve();
    };
    img.src = `assets/${name}.webp`;
    images[name] = img;
  }))).then(() => wrap && wrap.classList.add('hidden'));
}

let kit, play, fx, audio, bot;
const held = { left: false, right: false, up: false, down: false };
let drag = null; // {x,y,dx,dy} start point + delta while dragging the tray
let botInput = { dx: 0, dy: 0 };
let prevLevel = 0;
let toastTimer = 0;

function boot() {
  audio = createAudio({ muted: MUTE });
  fx = createFx();
  play = createPlay({ fx, audio });
  bot = createBot({ setInput: (v) => { botInput = v; } });

  kit = Sihim.init({
    id: 'tray',
    title: 'מגש הפירות',
    sub: 'הטו את המגש, קבצו שלושה פירות זהים וקטפו ניקוד',
    howto: [
      'גררו את המגש (או השתמשו בחצים/WASD) כדי להטות אותו — הפירות מתגלגלים לכיוון ההטיה.',
      'קבצו שלושה פירות זהים שנוגעים זה בזה כדי שיתפוצצו ויתנו ניקוד.',
      'צבירים גדולים ורצף צבירים נותנים בונוס — השלימו את מספר הצבירים הנדרש לפני שנגמר הזמן.',
      'חמישה שלבים, כל אחד עם יותר סוגי פירות וקצב מהיר יותר. סיימו את כולם לניצחון!',
    ],
    onStart() { startRun(); },
    onPause() { game.state = 'paused'; },
    onResume() { game.state = 'play'; },
  });

  wireControls();
  if (BOT_MODE) document.querySelector('#sh-go')?.click();

  requestAnimationFrame(loop);
}

function startRun() {
  game.state = 'play';
  game.score = 0;
  game.level = 1;
  prevLevel = 0;
  play.reset(BOT_MODE ? 1 : Date.now() >>> 0);
  kit.score(0);
  updateHud();
}

function wireControls() {
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(k)) e.preventDefault();
    if (k === 'arrowleft' || k === 'a') held.left = true;
    else if (k === 'arrowright' || k === 'd') held.right = true;
    else if (k === 'arrowup' || k === 'w') held.up = true;
    else if (k === 'arrowdown' || k === 's') held.down = true;
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') held.left = false;
    else if (k === 'arrowright' || k === 'd') held.right = false;
    else if (k === 'arrowup' || k === 'w') held.up = false;
    else if (k === 'arrowdown' || k === 's') held.down = false;
  });
  addEventListener('blur', () => { held.left = held.right = held.up = held.down = false; drag = null; });
}

function currentTilt() {
  if (BOT_MODE) return botInput;
  if (drag && (drag.dx || drag.dy)) {
    const DRAG_RANGE = 90;
    return {
      dx: Math.max(-1, Math.min(1, drag.dx / DRAG_RANGE)),
      dy: Math.max(-1, Math.min(1, drag.dy / DRAG_RANGE)),
    };
  }
  const dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  const dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    return { dx: dx / len, dy: dy / len };
  }
  return { dx: 0, dy: 0 };
}

function endRun(state) {
  game.state = state.win ? 'win' : 'over';
  const text = state.win ? 'ניקיתם את כל המגש! חמשת השלבים הושלמו.' : 'נגמר הזמן. נסו לנקות עוד צביר?';
  kit.gameOver(state.score, { text });
}

function showToast(msg) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1100);
}

function updateHud(state = play?.getState()) {
  if (!state) return;
  game.score = state.score;
  game.level = state.levelIndex + 1;
  kit.score(state.score);
  const lvl = document.querySelector('#lvlline');
  if (lvl) lvl.textContent = `שלב ${state.levelIndex + 1}`;
  const timer = document.querySelector('#timer');
  if (timer) timer.textContent = Math.max(0, Math.ceil(state.timeLeft)) + ' שנ׳';
  const goal = document.querySelector('#goal');
  if (goal) goal.textContent = `קבצו 3 פירות זהים · ${state.clears}/${state.level.goal}`;
  const bar = document.querySelector('#goalbar');
  if (bar) bar.style.width = Math.min(100, (state.clears / state.level.goal) * 100) + '%';
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  if (kit && kit.running && !kit.paused) {
    if (BOT_MODE && bot) bot.update(dt);
    play.update(dt, currentTilt());
    fx.update(dt);
    const state = play.getState();
    if (state.levelIndex !== prevLevel) { prevLevel = state.levelIndex; showToast(`שלב ${state.levelIndex + 1}!`); }
    updateHud(state);
    if (state.over || state.win) endRun(state);
  }
  draw();
  requestAnimationFrame(loop);
}

function draw() {
  ctx.save();
  const [sx, sy] = fx ? fx.shakeOffset() : [0, 0];
  ctx.translate(sx, sy);
  ctx.clearRect(-10, -10, W + 20, H + 20);
  if (play) play.draw(ctx, images, W, H);
  ctx.restore();
}

preload(ASSET_NAMES).then(boot);
