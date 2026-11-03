// Entry module for "neon" (מנהרת ניאון): preloads art, owns the canvas/renderer
// and main loop, and wires Sihim.init + the state machine. Gameplay lives in
// play.js (built on rules.js), with fx.js/audio.js/bot.js as support modules.
import * as T from '../../lib/three.module.min.js';
import { TRACKS } from './rules.js';
import { createPlay } from './play.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { createBot } from './bot.js';

const ASSET_NAMES = [
  'backdrop', 'tunnel', 'grid', 'circuit', 'decal',
  'hovercraft', 'boost', 'battery', 'shield', 'title',
];

const qs = new URLSearchParams(location.search);
const BOT_MODE = qs.get('bot') === '1';
const MUTE = qs.get('mute') === '1';
if (MUTE) localStorage.setItem('sihim:sound', '0');

const canvas = document.querySelector('#game');
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.setClearColor(0x06040c);

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
  audio = createAudio({ muted: MUTE });
  play = createPlay({ assets, fx, audio });
  bot = createBot({ actions: {
    steerLeft: play.steerLeft, steerRight: play.steerRight,
    climbStart: play.climbStart, climbEnd: play.climbEnd,
  } });
  resize();

  kit = Sihim.init({
    id: 'neon',
    title: 'מנהרת ניאון',
    sub: 'טפסו על הקיר. צללו. דהרו קדימה.',
    howto: [
      'חצים או A/D לפניה בין נתיבי המנהרת.',
      'החזיקו מעלה (W/רווח) לטיפוס על הקיר וטעינת דחף; שחררו לזינוק קדימה.',
      'אספו סוללות, דחפים ומגנים; התחמקו ממחסומים. חמש מסילות נפתחות עם הניקוד.',
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
  ended = false;
  play.start(BOT_MODE ? 1 : (Sihim.best('neon') || 0));
  kit.score(0);
}

function wireControls() {
  const guard = (fn) => (...a) => { if (kit && kit.running && !kit.paused) fn(...a); };
  const steerLeft = guard(play.steerLeft);
  const steerRight = guard(play.steerRight);
  const climbStart = guard(play.climbStart);
  const climbEnd = guard(play.climbEnd);

  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', ' '].includes(k)) e.preventDefault();
    if (k === 'arrowleft' || k === 'a') steerLeft();
    else if (k === 'arrowright' || k === 'd') steerRight();
    else if ((k === 'arrowup' || k === 'w' || k === ' ') && !e.repeat) climbStart();
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w' || k === ' ') climbEnd();
  });
  addEventListener('blur', climbEnd);

  const hold = (id, start, end) => {
    const el = document.querySelector(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
    el.addEventListener('pointerup', (e) => { e.preventDefault(); end && end(); });
    el.addEventListener('pointercancel', () => end && end());
    el.addEventListener('pointerleave', () => end && end());
  };
  hold('#btn-left', steerLeft);
  hold('#btn-right', steerRight);
  hold('#btn-climb', climbStart, climbEnd);
}

function updateHud() {
  const s = play.getState();
  game.state = s.phase;
  game.score = s.score;
  game.level = s.trackIndex + 1;
  kit.score(s.score);
  const status = document.querySelector('#status');
  if (status) {
    const track = TRACKS[s.trackIndex];
    status.textContent = `${track.name} · ${'♥'.repeat(s.lives)}${'♡'.repeat(Math.max(0, 3 - s.lives))} · דחף ${Math.round(s.charge)}%`;
  }
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  if (kit && kit.running && !kit.paused) {
    if (BOT_MODE && bot) bot.update(dt, play.getState());
    play.update(dt);
    fx.update(dt);
    updateHud();
    const s = play.getState();
    if (!ended && (s.phase === 'over' || s.phase === 'win')) {
      ended = true;
      kit.gameOver(s.score, s.phase === 'win'
        ? { text: 'כל מסילות הניאון מאחוריכם. רחפת אלופה!' }
        : { text: 'התנגשות במנהרה. ננסו שוב?' });
    }
  }
  renderer.render(play.scene, play.camera);
  requestAnimationFrame(loop);
}

preload(ASSET_NAMES).then(boot);
