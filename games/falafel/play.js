// Falafel gameplay: day/customer flow, build-a-pita actions, timing mini-games.
import { DAYS, dayConfig, genOrder, scoreOrder, comboMultiplier } from './rules.js';
import { tone, chime, comboStinger, sadBuzz, dayBell, sizzle, syncAmbience, stopAmbience } from './audio.js';
import { burst, popup, updateFx, addShake, steamPuff, confettiBurst, initAmbientDust } from './fx.js';
import { updateBot } from './bot.js';
import { renderScene } from './render.js';
import { press, startOrStopFry, startOrStopTahini, toggleTomato, toggleCucumber } from './actions.js';

const DAY_LEN = 13;
const CUSTOMER_KINDS = ['customer-man', 'customer-boy', 'customer-dog'];
const CONFETTI_COLORS = ['#ffc83d', '#7cffb2', '#ff8a7a', '#8ecbff', '#ffe8c1'];

const UI = {};
const G = {
  state: 'title', phase: 'banner', day: 1, dayTime: 0, dayLen: DAY_LEN, bannerT: 0, summaryT: 0,
  totalTip: 0, dayStartTip: 0, streak: 0, markerSpeed: 1, bannerTimeout: 0, bot: false, ambientT: 0,
  stats: { served: 0, missed: 0, perfectCount: 0 },
  customer: null,
  build: { falafelCount: 0, falafelQualitySum: 0, tomato: false, cucumber: false, tahini: false, tahiniQuality: null },
  fryer: { active: false, phase: 0, pos: 0 },
  tahiniStation: { active: false, phase: 0, pos: 0 },
  botFryWait: 0, botTahiniWait: 0, botCooldown: 0,
};

let ctx, canvas, IMG, kit;
let comboTxt, dayTxt, dayBannerEl;
let lastStreak = 0;

export function init(opts) {
  ctx = opts.ctx; canvas = ctx.canvas; IMG = opts.IMG; kit = opts.kit; G.bot = !!opts.bot;
  comboTxt = document.querySelector('#comboTxt');
  dayTxt = document.querySelector('#dayTxt');
  dayBannerEl = document.querySelector('#dayBanner');
  canvas.addEventListener('pointerdown', onPointer);
  addEventListener('keydown', onKeydown);
}

export function resize(w, h) {
  UI.w = w; UI.h = h;
  initAmbientDust(w, h);
  const margin = Math.max(14, w * 0.035);
  const rowY = h * 0.80;
  const rowH = Math.min(76, h * 0.095);
  const gap = 10;
  const btnW = (w - margin * 2 - gap * 3) / 4;
  UI.fry = { x: margin, y: rowY, w: btnW, h: rowH };
  UI.tomato = { x: margin + btnW + gap, y: rowY, w: btnW, h: rowH };
  UI.cucumber = { x: margin + (btnW + gap) * 2, y: rowY, w: btnW, h: rowH };
  UI.tahini = { x: margin + (btnW + gap) * 3, y: rowY, w: btnW, h: rowH };
  const serveY = rowY + rowH + 10;
  const serveH = Math.min(58, h * 0.07);
  UI.serve = { x: margin, y: serveY, w: w - margin * 2, h: serveH };
  UI.tray = { x: w / 2, y: rowY - 78 };
  UI.customer = { x: w / 2, y: Math.min(h * 0.30, rowY - 180) };
  UI.stallH = rowY - 6;
}

function resetBuild() {
  G.build = { falafelCount: 0, falafelQualitySum: 0, tomato: false, cucumber: false, tahini: false, tahiniQuality: null };
  G.fryer.active = false; G.tahiniStation.active = false;
}

function spawnCustomer() {
  const order = genOrder(G.day, Math.random);
  const kind = CUSTOMER_KINDS[Math.floor(Math.random() * CUSTOMER_KINDS.length)];
  const cfg = dayConfig(G.day);
  G.customer = { kind, order, patience: cfg.patience, patienceMax: cfg.patience, walkIn: 0, leaving: false, leaveT: 0 };
  resetBuild();
}

function beginDay(n) {
  G.day = n;
  const cfg = dayConfig(n);
  G.markerSpeed = 2 * Math.PI / cfg.markerPeriod;
  G.dayTime = 0; G.dayLen = DAY_LEN; G.dayStartTip = G.totalTip;
  G.phase = 'banner'; G.bannerT = 1.0; G.customer = null;
  dayBannerEl.textContent = 'יום ' + n;
  dayBannerEl.classList.add('show');
  dayBell();
  clearTimeout(G.bannerTimeout);
  G.bannerTimeout = setTimeout(() => dayBannerEl.classList.remove('show'), 900);
}

function beginServing() { G.phase = 'serving'; spawnCustomer(); }

function endDay() {
  if (G.customer && !G.customer.leaving) G.stats.missed++;
  G.customer = null; G.phase = 'summary'; G.summaryT = 1.5;
  const earned = G.totalTip - G.dayStartTip;
  dayBannerEl.textContent = `יום ${G.day} הסתיים! +${earned} ₪`;
  dayBannerEl.classList.add('show');
  dayBell();
  if (earned > 0) confettiBurst(UI.w / 2, UI.h * 0.35, CONFETTI_COLORS, 30);
  clearTimeout(G.bannerTimeout);
  G.bannerTimeout = setTimeout(() => dayBannerEl.classList.remove('show'), 1400);
}

function advanceDay() {
  dayBannerEl.classList.remove('show');
  if (G.day >= DAYS) { finishGame(); return; }
  beginDay(G.day + 1);
}

function finishGame() {
  G.phase = 'finished'; G.state = 'over';
  confettiBurst(UI.w / 2, UI.h * 0.35, CONFETTI_COLORS, 60);
  stopAmbience();
  kit.gameOver(G.totalTip, { text: `חמישה ימים בדוכן! הגשתם ${G.stats.served} פיתות.`, unit: ' ₪' });
}

export function start() {
  G.totalTip = 0; G.streak = 0; G.customer = null; G.state = 'play'; lastStreak = 0;
  G.stats = { served: 0, missed: 0, perfectCount: 0 };
  kit.score(0, 'טיפים');
  resetBuild();
  beginDay(1);
}

export function pauseGame() { G.state = 'paused'; syncAmbience(false); }
export function resumeGame() { G.state = 'play'; syncAmbience(true); }

function skipPhase() {
  if (G.phase === 'banner') G.bannerT = 0;
  else if (G.phase === 'summary') G.summaryT = 0;
}

function failCustomer() {
  G.stats.missed++; G.streak = 0;
  popup(UI.customer.x, UI.customer.y - 70, 'הלקוח התייאש...', '#ff8a7a');
  addShake(0.18); sadBuzz();
  G.customer.leaving = true; G.customer.leaveT = 0.5;
}

function serveOrder() {
  if (G.phase === 'banner' || G.phase === 'summary') { skipPhase(); return; }
  if (G.phase !== 'serving' || !G.customer || G.customer.leaving) return;
  const timeLeftRatio = G.customer.patience / G.customer.patienceMax;
  const comboMult = comboMultiplier(G.streak);
  const result = scoreOrder(G.customer.order, G.build, { timeLeftRatio, comboMult });
  G.totalTip += result.tip;
  G.stats.served++;
  if (result.perfect) { G.streak++; G.stats.perfectCount++; } else { G.streak = 0; }
  kit.score(G.totalTip, 'טיפים');
  popup(UI.tray.x, UI.tray.y - 24, (result.perfect ? 'מושלם! ' : '') + '+' + result.tip + ' ₪', result.perfect ? '#7cffb2' : '#ffe8c1', result.perfect);
  burst(UI.tray.x, UI.tray.y, result.perfect ? '#7cffb2' : '#ffc83d', result.perfect ? 26 : 14);
  if (result.perfect) { addShake(0.4); chime(680, G.streak); } else { tone(620, 0.18, 'triangle', 0.18, 780); }
  if (G.streak > 0 && G.streak % 3 === 0) {
    comboStinger(G.streak);
    popup(UI.customer.x, UI.customer.y - 110, `שרשרת x${G.streak}!`, '#ffd65c', true);
  }
  G.customer.leaving = true; G.customer.leaveT = 0.45;
}

function updateServing(dt) {
  G.dayTime += dt;
  if (G.fryer.active) {
    G.fryer.phase += dt * G.markerSpeed; G.fryer.pos = (Math.sin(G.fryer.phase) + 1) / 2;
    G.ambientT -= dt;
    if (G.ambientT <= 0) { G.ambientT = 0.22; steamPuff(UI.fry.x + UI.fry.w / 2, UI.fry.y); sizzle(0.16, 0.045); }
  }
  if (G.tahiniStation.active) { G.tahiniStation.phase += dt * G.markerSpeed; G.tahiniStation.pos = (Math.sin(G.tahiniStation.phase) + 1) / 2; }
  const c = G.customer;
  if (c && !c.leaving) {
    c.walkIn = Math.min(1, c.walkIn + dt * 2.4);
    c.patience -= dt;
    if (c.patience <= 0) failCustomer();
  } else if (c && c.leaving) {
    c.leaveT -= dt;
    if (c.leaveT <= 0) { G.customer = null; if (G.dayTime < G.dayLen) spawnCustomer(); }
  }
  if (G.dayTime >= G.dayLen) endDay();
}

export function update(dt) {
  updateFx(dt);
  syncAmbience(true);
  if (G.phase === 'banner') { G.bannerT -= dt; if (G.bannerT <= 0) beginServing(); }
  else if (G.phase === 'serving') updateServing(dt);
  else if (G.phase === 'summary') { G.summaryT -= dt; if (G.summaryT <= 0) advanceDay(); }
  if (G.bot) updateBot(G, dt, press);
  if (G.streak !== lastStreak) {
    lastStreak = G.streak;
    comboTxt.classList.remove('pop'); void comboTxt.offsetWidth; comboTxt.classList.add('pop');
  }
  comboTxt.textContent = G.streak > 1 ? `שרשרת x${G.streak}` : '';
  dayTxt.textContent = kit.running ? `יום ${Math.min(G.day, DAYS)}/${DAYS}` : '';
}

export function render() {
  renderScene(ctx, UI.w, UI.h, G, UI, IMG);
}

export function getState() {
  return { state: G.state, score: G.totalTip, level: G.day };
}

function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

function onPointer(e) {
  if (!kit.running || kit.paused) return;
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (inRect(x, y, UI.fry)) startOrStopFry(G, UI);
  else if (inRect(x, y, UI.tomato)) toggleTomato(G);
  else if (inRect(x, y, UI.cucumber)) toggleCucumber(G);
  else if (inRect(x, y, UI.tahini)) startOrStopTahini(G, UI);
  else if (inRect(x, y, UI.serve)) serveOrder();
}

function onKeydown(e) {
  if (!kit.running || kit.paused) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (k === 'arrowup' || k === 'w') startOrStopFry(G, UI);
  else if (k === 'arrowdown' || k === 's') startOrStopTahini(G, UI);
  else if (k === 'arrowleft' || k === 'a') toggleTomato(G);
  else if (k === 'arrowright' || k === 'd') toggleCucumber(G);
  else if (k === ' ' || k === 'enter') serveOrder();
}
