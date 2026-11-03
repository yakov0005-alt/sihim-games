// Entry module for "leap" (קפיצת הדג): preloads art, owns the canvas/renderer
// and main loop, and wires Sihim.init + the state machine. Gameplay lives in
// play.js (built on rules.js), with fx.js/audio.js/bot.js as support modules.
import * as T from '../../lib/three.module.min.js';
import { createPlay } from './play.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { createBot } from './bot.js';

const ASSET_NAMES = [
  'sky-jordan', 'sky-banias', 'sky-galilee',
  'fish', 'fish-skin', 'water', 'rock', 'title', 'coin', 'droplet', 'twist',
];
const RIVER_NAMES = ['הירדן', 'בניאס', 'נחל הגליל'];

const qs = new URLSearchParams(location.search);
const BOT_MODE = qs.get('bot') === '1';
const MUTE = qs.get('mute') === '1';
if (MUTE) localStorage.setItem('sihim:sound', '0');

const canvas = document.querySelector('#game');
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.setClearColor(0x0d0b1a);

const game = window.__game = { state: 'title', score: 0, level: 1, dpr: 1, bot: BOT_MODE };

let kit, play, fx, audio, bot, ended = false;

function resize() {
  const w = innerWidth, h = innerHeight;
  if (w < 2 || h < 2) return; // skip degenerate layout frames (e.g. mid-rotation)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  if (play) play.resize(w, h);
  game.dpr = dpr;
}
addEventListener('resize', resize);
resize();

const assets = {};
function preload(names) {
  const fill = document.querySelector('#loadFill');
  const txt = document.querySelector('#loadTxt');
  const wrap = document.querySelector('#loading');
  let loaded = 0;
  return Promise.all(names.map((name) => new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => {
      loaded++;
      const pct = Math.round((loaded / names.length) * 100);
      if (fill) fill.style.width = pct + '%';
      if (txt) txt.textContent = `טוען נכסים… ${pct}%`;
      resolve();
    };
    img.src = `assets/${name}.webp`;
    assets[name] = img;
  }))).then(() => wrap && wrap.classList.add('hidden'));
}

function boot() {
  fx = createFx();
  audio = createAudio();
  play = createPlay({ assets, fx, audio });
  fx.init(play.scene);
  bot = createBot({ actions: { left: play.moveLeft, right: play.moveRight, jump: play.jump } });
  resize();

  kit = Sihim.init({
    id: 'leap',
    title: 'קפיצת הדג',
    sub: 'שלושה נהרות. כל קפיצה נקודה.',
    howto: [
      'חצים לזוז בין המסילות, חץ למעלה לקפיצה (או WASD / רווח).',
      'בטלפון: הקישו על הכפתורים שבתחתית המסך.',
      'דלגו הצידה מסלעים, וקפצו מעל בולמים ומפלים בזמן.',
      'עברו את שלושת הנהרות לפני שנגמרים החיים.',
    ],
    onStart() { startRun(); },
    onPause() { game.state = 'paused'; },
    onResume() { game.state = 'play'; },
  });

  const panel = document.querySelector('.sh-panel');
  if (panel && assets.title) {
    const art = document.createElement('img');
    art.className = 'leapTitle';
    art.alt = '';
    art.src = 'assets/title.webp';
    panel.insertBefore(art, panel.firstChild);
  }

  wireControls();
  if (BOT_MODE) document.querySelector('#sh-go')?.click();
  requestAnimationFrame(loop);
}

function startRun() {
  ended = false;
  play.start();
  kit.score(0);
}

function wireControls() {
  const guard = (fn) => () => { if (kit && kit.running && !kit.paused) fn(); };
  const handlers = { left: guard(play.moveLeft), right: guard(play.moveRight), jump: guard(play.jump) };
  const keyMap = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  };
  addEventListener('keydown', (e) => {
    const action = keyMap[e.code];
    if (!action) return;
    e.preventDefault();
    handlers[action]();
  });
  document.querySelector('#btn-left')?.addEventListener('pointerdown', (e) => { e.preventDefault(); handlers.left(); });
  document.querySelector('#btn-right')?.addEventListener('pointerdown', (e) => { e.preventDefault(); handlers.right(); });
  document.querySelector('#btn-jump')?.addEventListener('pointerdown', (e) => { e.preventDefault(); handlers.jump(); });
}

function updateHud() {
  const s = play.getState();
  game.state = s.phase;
  game.score = s.score;
  game.level = s.levelIndex + 1;
  kit.score(s.score);
  const status = document.querySelector('#status');
  if (status) status.textContent = `${RIVER_NAMES[s.levelIndex]} · ${'♥'.repeat(s.lives)}${'♡'.repeat(Math.max(0, 3 - s.lives))}`;
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  if (kit && kit.running && !kit.paused) {
    if (BOT_MODE && bot) bot.update(dt, play.getState(), play.getObstacles());
    play.update(dt);
    fx.update(dt);
    updateHud();
    const s = play.getState();
    if (!ended && (s.phase === 'over' || s.phase === 'win')) {
      ended = true;
      kit.gameOver(s.score, s.phase === 'win'
        ? { text: 'שלושת הנהרות מאחוריכם. דג אלוף!' }
        : { text: 'הדג נשטף אחורה. ננסו שוב?' });
    }
  }
  renderer.render(play.scene, play.camera);
  requestAnimationFrame(loop);
}

preload(ASSET_NAMES).then(boot);
