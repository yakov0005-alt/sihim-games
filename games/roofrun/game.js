// Entry module for "roofrun" (רץ לצד הרכבת): preloads art, owns the canvas
// and main loop, and wires Sihim.init + the state machine. Gameplay itself
// lives in play.js (uses rules.js), with fx.js/audio.js/bot.js as support.
import { createPlay } from './play.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { createBot } from './bot.js';

const ASSET_NAMES = [
  'hills', 'town', 'title', 'window',
  'runner-run-1', 'runner-run-2', 'runner-jump', 'runner-slide',
  'envelope', 'vent', 'laundry', 'pigeon',
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

function boot() {
  audio = createAudio({ muted: MUTE });
  fx = createFx();
  play = createPlay({ fx, audio });
  bot = createBot({ jump: () => play.jump(), slide: () => play.slide() });

  kit = Sihim.init({
    id: 'roofrun',
    title: 'רץ לצד הרכבת',
    sub: 'דלגו, גלשו ואספו מכתבים לפני שהרכבת מגיעה לתחנה',
    howto: [
      'חץ למעלה או רווח כדי לדלג מעל צינורות גג.',
      'חץ למטה כדי לגלוש מתחת לחבלים וליונים.',
      'אספו מכתבים לניקוד, הימנעו משלוש פגיעות.',
      'עברו גבעות, עיר ונחל עד לתחנה הסופית.',
    ],
    onStart() { startRun(); },
    onPause() { game.state = 'paused'; },
    onResume() { game.state = 'play'; },
  });

  const panel = document.querySelector('.sh-panel');
  if (panel && images.title) {
    const art = document.createElement('img');
    art.className = 'roofTitle';
    art.alt = '';
    art.src = 'assets/title.webp';
    panel.insertBefore(art, panel.firstChild);
  }

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
  updateHud();
  audio.ambient(true);
}

function endGame(score, win) {
  game.state = win ? 'win' : 'over';
  audio.ambient(false);
  kit.gameOver(score, {
    text: win ? 'הגעתם לתחנה הסופית! המכתבים נמסרו בהצלחה.' : 'הרכבת המשיכה בלעדיכם…',
  });
}

function wireControls() {
  document.querySelector('#btn-jump')?.addEventListener('pointerdown', (e) => { e.preventDefault(); play.jump(); });
  document.querySelector('#btn-slide')?.addEventListener('pointerdown', (e) => { e.preventDefault(); play.slide(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === ' ' || e.code === 'Space') { e.preventDefault(); play.jump(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); play.slide(); }
  });
}

function updateHud() {
  const s = play.getState();
  game.score = s.score;
  game.level = s.levelIndex + 1;
  kit.score(s.score);
  const hearts = document.querySelector('#hearts');
  if (hearts) hearts.textContent = '♥'.repeat(s.lives) + '♡'.repeat(Math.max(0, s.level.lives - s.lives));
  const routeTxt = document.querySelector('#routeTxt');
  if (routeTxt) routeTxt.textContent = `תחנה ${s.levelIndex + 1} / 3`;
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  if (kit && kit.running && !kit.paused) {
    if (BOT_MODE && bot) bot.update(dt, play.getState());
    play.update(dt, {
      onGameOver: (score) => endGame(score, false),
      onWin: (score) => endGame(score, true),
    });
    fx.update(dt, W, H);
    updateHud();
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
