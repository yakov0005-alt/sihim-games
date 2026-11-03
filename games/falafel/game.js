// Falafel entry module: preload assets, own the canvas, drive the main loop.
import * as Play from './play.js';

const params = new URLSearchParams(location.search);
const BOT = params.get('bot') === '1';
const MUTE = params.get('mute') === '1';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
let ready = false;
let loadProgress = 0;

function drawLoading(progress) {
  if (W < 2 || H < 2) return;
  ctx.fillStyle = '#1a1230'; ctx.fillRect(0, 0, W, H);
  const barW = Math.min(280, W * 0.7), barH = 10;
  const x = W / 2 - barW / 2, y = H / 2;
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = '#ffc83d'; ctx.fillRect(x, y, barW * progress, barH);
  ctx.fillStyle = '#ffe8c1'; ctx.font = '700 16px Rubik'; ctx.textAlign = 'center';
  ctx.fillText('טוען...', W / 2, y - 16);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  if (w < 2 || h < 2) return;
  W = w; H = h;
  DPR = Math.min(devicePixelRatio || 1, 2);
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (ready) Play.resize(W, H); else drawLoading(loadProgress);
}
addEventListener('resize', resize);
resize();

const ASSET_NAMES = ['stall', 'pita', 'pita-filled', 'falafel', 'chickpeas', 'tomato', 'cucumber', 'tahini', 'coin', 'title', 'customer-boy', 'customer-man', 'customer-dog'];
const IMG = {};

function preload() {
  const total = ASSET_NAMES.length;
  let loaded = 0;
  drawLoading(0);
  return Promise.all(ASSET_NAMES.map((n) => new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => {
      loaded++; loadProgress = loaded / total; drawLoading(loadProgress); resolve();
    };
    img.src = `assets/${n}.webp`;
    IMG[n] = img;
  })));
}

let kit = null;
let last = 0;

function frame(ts) {
  const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0);
  last = ts;
  if (W >= 2 && H >= 2) {
    if (kit.running && !kit.paused) Play.update(dt);
    Play.render();
  }
  updateGameHook();
  requestAnimationFrame(frame);
}

function updateGameHook() {
  const s = Play.getState();
  window.__game = { state: s.state, score: s.score, level: s.level, dpr: DPR, bot: BOT };
}

function boot() {
  kit = Sihim.init({
    id: 'falafel',
    title: 'הפלאפליה הקטנה',
    sub: 'חמישה ימים בדוכן — כל לקוח מחכה לפיתה המושלמת שלו.',
    howto: [
      'טגנו פלאפל בדיוק בזמן — חץ מעלה/W להתחיל ולעצור.',
      'הוסיפו עגבנייה (A) ומלפפון (D) לפי ההזמנה.',
      'מרחו טחינה בדיוק — חץ מטה/S להתחיל ולעצור.',
      'הגישו עם רווח לפני שהלקוח מתייאש!',
    ],
    onStart() { Play.start(); },
    onPause() { Play.pauseGame(); },
    onResume() { Play.resumeGame(); },
  });

  const panel = document.querySelector('.sh-panel');
  if (panel) panel.insertAdjacentHTML('afterbegin', '<img class="falTitle" src="assets/title.webp" alt="">');
  if (MUTE && Sihim.soundOn()) { const sb = document.querySelector('#sh-sound'); if (sb) sb.click(); }

  Play.init({ ctx, IMG, kit, bot: BOT });
  ready = true;
  Play.resize(W, H);

  if (BOT) document.querySelector('#sh-go').click();
  requestAnimationFrame(frame);
}

preload().then(boot);
