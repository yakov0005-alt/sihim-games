// Entry module for "magnet" (רובו-מגנט): preloads art, owns the canvas and
// main loop, and wires Sihim.init + the state machine. Gameplay itself lives
// in play.js (uses rules.js), with fx.js/audio.js/bot.js as support modules.
import { createPlay } from './play.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { createBot } from './bot.js';

const ASSET_NAMES = [
  'arena', 'title', 'robot', 'robot-magnet',
  'drone-scout', 'drone-fast', 'drone-heavy', 'drone-shield',
  'boss', 'bolt', 'bolts-sparks', 'spark',
];

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
let drag = null; // {x,y} while pointer is down, in CSS-pixel canvas coords
const held = { left: false, right: false };
let aimAngle = -Math.PI / 2;
let botInput = { x: null, y: null, action: false };

function boot() {
  audio = createAudio({ muted: MUTE });
  fx = createFx();
  play = createPlay({ fx, audio });
  bot = createBot({ setInput: (v) => { botInput = v; }, centerX: () => W / 2, centerY: () => H / 2 });

  kit = Sihim.init({
    id: 'magnet',
    title: 'רובו-מגנט',
    sub: 'תפסו רחפנים בחוט מגנט וזרקו אותם זה בזה',
    howto: [
      'רחפנים דוהרים מכל עבר ישר לעבר הליבה שלכם.',
      'כוונו חוט מגנט לרחפן קרוב והחזיקו כדי לתפוס ולטעון.',
      'שחררו לעבר רחפן אחר כדי להתנגש בו; רצף תפיסות מכפיל ניקוד.',
      '3 חיים — רחפן שמגיע לליבה עולה בחיים. הבוס מחכה בגל האחרון.',
    ],
    onStart() { startRun(); },
    onPause() { game.state = 'paused'; },
    onResume() { game.state = 'play'; },
    onSound(on) { audio.setEnabled(on); },
  });

  wireControls();
  if (BOT_MODE) document.querySelector('#sh-go')?.click();

  requestAnimationFrame(loop);
}

function startRun() {
  game.state = 'play';
  game.score = 0;
  game.level = 1;
  play.reset();
  kit.score(0);
  audio.start();
  updateHud();
}

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function wireControls() {
  canvas.addEventListener('pointerdown', (e) => {
    drag = canvasPoint(e);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag = canvasPoint(e);
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd', ' '].includes(k) || e.code === 'Space') e.preventDefault();
    if (k === 'arrowleft' || k === 'a') held.left = true;
    else if (k === 'arrowright' || k === 'd') held.right = true;
    else if (e.code === 'Space') held.space = true;
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') held.left = false;
    else if (k === 'arrowright' || k === 'd') held.right = false;
    else if (e.code === 'Space') held.space = false;
  });
  addEventListener('blur', () => { held.left = held.right = held.space = false; drag = null; });
}

function currentInput(dt) {
  if (BOT_MODE) return botInput;
  if (drag) return { x: drag.x, y: drag.y, action: true };
  const turn = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  aimAngle += turn * 2.6 * dt;
  const range = 140;
  return {
    x: W / 2 + Math.cos(aimAngle) * range,
    y: H / 2 + Math.sin(aimAngle) * range,
    action: !!held.space,
  };
}

function endRun(state) {
  game.state = state.win ? 'win' : 'over';
  const text = state.win ? 'ניקיתם את כל גלי הרחפנים! הבוס פורק לברגים.' : 'הרחפנים פרצו את הליבה. ננסה שוב?';
  kit.gameOver(state.score, { text });
}

function updateHud(state = play?.getState()) {
  if (!state) return;
  game.score = state.score;
  game.level = state.wave;
  kit.score(state.score);
  const hearts = document.querySelector('#hearts');
  if (hearts) hearts.textContent = '♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, 3 - state.lives));
  const waveTxt = document.querySelector('#waveTxt');
  if (waveTxt) waveTxt.textContent = state.waveName || '';
  const combo = document.querySelector('#comboTxt');
  if (combo) {
    combo.textContent = state.combo > 0 ? `רצף x${state.combo}` : '';
    combo.classList.toggle('fever', state.combo >= 6);
  }
  const chargeFill = document.querySelector('#chargeFill');
  if (chargeFill) chargeFill.style.width = Math.round(state.charge * 100) + '%';
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  if (kit && kit.running && !kit.paused) {
    if (BOT_MODE && bot) bot.update(dt, play.getState());
    play.update(dt, currentInput(dt));
    fx.update(dt, W, H);
    const state = play.getState();
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
  if (fx) fx.draw(ctx, W, H);
  ctx.restore();
}

preload(ASSET_NAMES).then(boot);
