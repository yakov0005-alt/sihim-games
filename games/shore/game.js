// Entry module for "shore" (חופית בחוף): preloads pixel art, owns the canvas
// and main loop, and wires Sihim.init + the state machine. Gameplay itself
// lives in play.js (uses rules.js), with fx.js/audio.js/bot.js as support.
import { createPlay } from './play.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { createBot } from './bot.js';

const ASSET_NAMES = ['beach-far', 'beach-near', 'bird-sheet', 'crab', 'shell', 'wave', 'title'];

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
  ctx.imageSmoothingEnabled = false;
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
const held = { left: false, right: false };
let peckQueued = false;
let botInput = { dx: 0, peck: false };

function boot() {
  audio = createAudio({ muted: MUTE });
  fx = createFx();
  play = createPlay({ fx, audio });
  bot = createBot({ setInput: (v) => { botInput = v; } });

  kit = Sihim.init({
    id: 'shore',
    title: 'חופית בחוף',
    sub: 'רצו עם הגל, נקרו מה שהוא חושף, ואל תתפסו ברטוב',
    howto: [
      'כשהגל שוקע והחול נחשף, רוצו לכיוון הים (חץ ימינה / D) כדי להגיע לצדפות ולסרטנים.',
      'הקישו רווח, או לחצו על כפתור ⚡, כדי לנקר פריט קרוב — נקרים ברצף מכפילים את הניקוד.',
      'כשהגל מתחיל לחזור, רוצו בחזרה לחוף (חץ שמאלה / A) לפני שהוא מגיע אליכם.',
      'הגעה לניקוד המטרה פותחת שלב חדש עם גאות ושפל מהירים יותר; שלושה לבבות ומשחק נגמר.',
    ],
    onStart() { startRun(); },
    onPause() { game.state = 'paused'; },
    onResume() { game.state = 'play'; },
  });

  const panel = document.querySelector('.sh-panel');
  if (panel && images.title) {
    const art = document.createElement('img');
    art.className = 'shoreTitle';
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
  play.reset(BOT_MODE ? 1 : Date.now() >>> 0);
  kit.score(0);
  updateHud();
}

function wireControls() {
  const press = (id, on) => document.querySelector(id)?.classList.toggle('pressed', on);
  const left = document.querySelector('#ctl-left');
  const right = document.querySelector('#ctl-right');
  const peck = document.querySelector('#ctl-peck');
  const down = (el, fn) => el?.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  const up = (el, fn) => { ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => el?.addEventListener(t, fn)); };
  down(left, () => { held.left = true; press('#ctl-left', true); });
  up(left, () => { held.left = false; press('#ctl-left', false); });
  down(right, () => { held.right = true; press('#ctl-right', true); });
  up(right, () => { held.right = false; press('#ctl-right', false); });
  down(peck, () => { peckQueued = true; press('#ctl-peck', true); });
  up(peck, () => press('#ctl-peck', false));

  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', ' ', 'a', 'd'].includes(k)) e.preventDefault();
    if (k === 'arrowleft' || k === 'a') held.left = true;
    else if (k === 'arrowright' || k === 'd') held.right = true;
    else if (k === ' ') peckQueued = true;
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') held.left = false;
    else if (k === 'arrowright' || k === 'd') held.right = false;
  });
  addEventListener('blur', () => { held.left = held.right = false; });
}

function endRun(state) {
  game.state = state.win ? 'win' : 'over';
  const text = state.win ? 'כבשתם את כל החוף! גאות ושפל חדשים מחר.' : 'הגל תפס אתכם. נסו שוב?';
  kit.gameOver(state.score, { text });
}

function updateHud(state = play?.getState()) {
  if (!state) return;
  game.score = state.score;
  game.level = state.levelIndex + 1;
  kit.score(state.score);
  const hearts = document.querySelector('#hearts');
  if (hearts) hearts.textContent = '♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, 3 - state.lives));
  const stageLabel = document.querySelector('#stageLabel');
  if (stageLabel) stageLabel.textContent = state.levelName || '';
  const combo = document.querySelector('#comboTxt');
  if (combo) {
    combo.textContent = state.combo > 0 ? `רצף x${state.combo}` : '';
    combo.classList.toggle('hot', state.combo >= 5);
  }
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  if (kit && kit.running && !kit.paused) {
    if (BOT_MODE && bot) bot.update(dt, play.getState());
    const dx = BOT_MODE ? botInput.dx : (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const peck = BOT_MODE ? botInput.peck : peckQueued;
    peckQueued = false;
    play.update(dt, { dx, peck });
    fx.update(dt);
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
  if (fx) fx.draw(ctx);
  ctx.restore();
}

preload(ASSET_NAMES).then(boot);
