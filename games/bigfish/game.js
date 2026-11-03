// Entry module for "bigfish" (הדג החכם): preloads art, owns the canvas and
// main loop, and wires Sihim.init + the state machine. Gameplay itself lives
// in play.js (uses rules.js), with fx.js/audio.js/bot.js as support modules.
import { createPlay } from './play.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { createBot } from './bot.js';

const ASSET_NAMES = [
  'underwater', 'surface', 'carp', 'carp-body', 'carp-tail', 'splash', 'title',
  'fisherman-1', 'fisherman-2', 'fisherman-3', 'fisherman-4', 'fisherman-5', 'fisherman-6',
];
const SWIPE_THRESHOLD = 24; // px drag before it counts as a left/right swipe

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
let prevLevel = 0;
let toastTimer = 0;

function boot() {
  audio = createAudio({ muted: MUTE });
  fx = createFx();
  play = createPlay({ fx, audio });
  bot = createBot({ swipe: (dir) => play.swipe(dir, { W, H }) });

  kit = Sihim.init({
    id: 'bigfish',
    title: 'הדג החכם',
    sub: 'אתם הקרפיון הגדול. משכו את הדייג היישר למים!',
    howto: [
      'הדייג מושך בחבל לכיוון אקראי — עקבו אחרי החץ שמופיע.',
      'החליקו נגד הכיוון (חיצים או A/D), בזמן, כדי לגבור עליו.',
      'חלק מהדייגים עושים פיינטה — מראים כיוון ומושכים להפך. היו ערניים!',
      'מלאו את הפס עד הסוף כדי שהדייג יתמוטט למים. שישה דייגים מחכים לכם.',
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
  prevLevel = 0;
  play.reset();
  kit.score(0);
  updateHud();
}

function doSwipe(dir) {
  if (!kit || !kit.running || kit.paused) return;
  play.swipe(dir, { W, H });
}

function wireControls() {
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, fired: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.fired) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      drag.fired = true;
      doSwipe(dx > 0 ? 1 : -1);
    }
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) e.preventDefault();
    if (k === 'arrowleft' || k === 'a') doSwipe(-1);
    else if (k === 'arrowright' || k === 'd') doSwipe(1);
  });
}

function endRun(state) {
  game.state = state.win ? 'win' : 'over';
  const text = state.win
    ? 'הדייג האחרון התמוטט למים! שישה דייגים, שישה כישלונות מצחיקים.'
    : 'הדייג גרר אתכם אל החוף הפעם. ננסה שוב?';
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
  const name = document.querySelector('#fishName');
  if (name) name.textContent = state.fishermanName;
  const fill = document.querySelector('#tensionFill');
  if (fill) fill.style.width = Math.max(0, Math.min(100, state.tension)) + '%';
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  if (kit && kit.running && !kit.paused) {
    if (BOT_MODE && bot) bot.update(dt, play.getState());
    play.update(dt, { W, H });
    fx.update(dt);
    const state = play.getState();
    if (state.levelIndex !== prevLevel) { prevLevel = state.levelIndex; showToast(`${state.fishermanName}!`); }
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
  if (fx) fx.draw(ctx);
  ctx.restore();
}

preload(ASSET_NAMES).then(boot);
