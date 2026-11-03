import { createPlay } from './play.js';
import { tone } from './audio.js';
import { createBot } from './bot.js';

const params = new URLSearchParams(location.search);
const BOT = params.get('bot') === '1';
const MUTE = params.get('mute') === '1';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

function resize() {
  const w = innerWidth, h = innerHeight;
  if (w < 2 || h < 2) return;
  W = w; H = h; DPR = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener('resize', resize);
resize();

const ASSET_NAMES = ['boy-grab', 'boy-kickflip', 'boy-land', 'boy-ride', 'boy-spin', 'boy-tuck', 'mesas', 'ramp-stone', 'ramp-wood', 'sand', 'sky', 'storm', 'title', 'wind'];
const IMG = {};
const preloadFill = document.querySelector('#preloadFill');
const preloadTxt = document.querySelector('#preloadTxt');
const preloadEl = document.querySelector('#preload');

function preload() {
  return new Promise((resolve) => {
    const total = ASSET_NAMES.length;
    let loaded = 0;
    const bump = () => {
      loaded++;
      const pct = Math.round((loaded / total) * 100);
      preloadFill.style.width = pct + '%';
      preloadTxt.textContent = `טוען… ${pct}%`;
      if (loaded >= total) resolve();
    };
    for (const name of ASSET_NAMES) {
      const img = new Image();
      img.onload = bump; img.onerror = bump;
      img.src = `assets/${name}.webp`;
      IMG[name] = img;
    }
  });
}

const G = { state: 'title', score: 0, input: {} };
const play = createPlay();
const bot = BOT ? createBot() : null;
let kit = null;

function startGame() {
  G.state = 'play';
  play.reset();
  G.score = 0;
  kit.score(0);
  tone(420, 0.12, 'triangle', 0.15, 680);
}

function setupSihim() {
  kit = Sihim.init({
    id: 'skate',
    title: 'גולש הסופה',
    sub: 'רוכבים את משבי הסופה, מבצעים טריקים באוויר ונוחתים בול על הרמפה.',
    howto: [
      'חץ למעלה או רווח — קפצו מהרמפה עם משב הרוח.',
      'באוויר בצעו טריק: 1 קיקפליפ · 2 גראב · 3 ספין (או בכפתורים).',
      'נחתו מיושרים לניקוד נקי ולשרשרת מכפילה. שלושה שלבים, הרוח מתחזקת.',
    ],
    onStart() { startGame(); },
    onPause() { G.state = 'paused'; tone(260, 0.1, 'sine', 0.1); },
    onResume() { G.state = 'play'; },
  });
  const panel = document.querySelector('.sh-panel');
  if (panel) panel.insertAdjacentHTML('afterbegin', '<img class="skateTitle" src="assets/title.webp" alt="">');
  if (MUTE && Sihim.soundOn()) { const sb = document.querySelector('#sh-sound'); if (sb) sb.click(); }
  if (BOT) document.querySelector('#sh-go').click();
}

function press(action, on) { G.input[action] = on; }

function bindInput() {
  const KEY_MAP = { ' ': 'launch', arrowup: 'launch', w: 'launch', '1': 'kickflip', '2': 'grab', '3': 'spin' };
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const action = KEY_MAP[k];
    if (!action) return;
    if (k === ' ' || k === 'arrowup') e.preventDefault();
    press(action, true);
  });
  addEventListener('keyup', (e) => {
    const action = KEY_MAP[e.key.toLowerCase()];
    if (action) press(action, false);
  });
  addEventListener('blur', () => { G.input = {}; });
  canvas.addEventListener('pointerdown', () => { if (kit && kit.running && !kit.paused) press('launch', true); });
  canvas.addEventListener('pointerup', () => press('launch', false));
  const BTN_MAP = { 'tr-kickflip': 'kickflip', 'tr-grab': 'grab', 'tr-spin': 'spin' };
  for (const [id, action] of Object.entries(BTN_MAP)) {
    const btn = document.querySelector('#' + id);
    if (!btn) continue;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); press(action, true); btn.classList.add('pressed'); });
    btn.addEventListener('pointerup', () => { press(action, false); btn.classList.remove('pressed'); });
    btn.addEventListener('pointerleave', () => { press(action, false); btn.classList.remove('pressed'); });
  }
}
bindInput();

const heartsEl = document.querySelector('#hearts');
const comboEl = document.querySelector('#comboTxt');
const stageEl = document.querySelector('#stageTxt');

function updateHud() {
  const s = play.state;
  heartsEl.textContent = '♦'.repeat(Math.max(0, s.lives)) + '♢'.repeat(Math.max(0, 3 - s.lives));
  comboEl.textContent = s.combo > 1 ? `שרשרת ×${s.combo}` : '';
  stageEl.textContent = kit && kit.running ? `שלב ${s.stage + 1}` : '';
  window.__game = { state: G.state, score: s.score, level: s.stage, dpr: DPR, bot: BOT };
}

let last = 0;
function frame(ts) {
  const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0);
  last = ts;
  if (kit && kit.running && !kit.paused) {
    play.update(dt, G.input);
    if (play.state.score !== G.score) { G.score = play.state.score; kit.score(G.score); }
    if (bot) bot.update(dt, G.input);
    if (play.state.result === 'win') {
      G.state = 'win';
      kit.gameOver(play.state.score, { text: 'ניצחתם את הסופה! כל השלבים הושלמו.' });
    } else if (play.state.result === 'over') {
      G.state = 'over';
      kit.gameOver(play.state.score, { text: 'נפלתם מהרמפה... מנסים שוב?' });
    }
  }
  if (W > 1 && H > 1) {
    play.draw(ctx, IMG, W, H);
  }
  updateHud();
  requestAnimationFrame(frame);
}

preload().then(() => {
  preloadEl.classList.add('hidden');
  setupSihim();
  requestAnimationFrame(frame);
});
