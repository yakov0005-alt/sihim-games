// Gameplay glue: spawns/advances tickets using the pure rules in rules.js and
// renders them in perspective, rushing out of the station gate toward the
// camera along one of 4 converging lanes (one per stamp color/button). No DOM
// access here — game.js owns the canvas, input wiring and HUD.
import * as R from './rules.js';

const LANE_COLOR = { red: '#ff6b6b', green: '#55d17a', blue: '#4fa8ff', gold: '#ffd24a' };
const BASE_TICKET_W = 116;
const FAR_SCALE = 0.2;
const NEAR_SCALE = 1.08;

export function createPlay({ fx, audio } = {}) {
  let state = R.createState();
  let tickets = [];
  let elapsed = 0;
  let spawnTimer = 0.6;
  let feverWasOn = false;
  let gateFlash = 0;
  let lastW = 800, lastH = 600;

  function reset() {
    state = R.createState();
    tickets = [];
    elapsed = 0;
    spawnTimer = 0.6;
    feverWasOn = false;
    gateFlash = 0;
    audio?.reset();
    audio?.start();
    return state;
  }

  function spawnTicket(laneSpan) {
    const color = R.COLORS[Math.floor(Math.random() * R.COLORS.length)];
    tickets.push({ color, x: laneSpan, spawnX: laneSpan, stamped: false, missed: false, settleT: 0, wrongFlash: 0 });
  }

  function update(dt, { laneSpan = 760, onGameOver } = {}) {
    elapsed += dt;
    gateFlash = Math.max(0, gateFlash - dt * 3);
    R.tickFever(state, dt);
    if (state.fever !== feverWasOn) {
      audio?.fever(state.fever);
      fx?.setFever(state.fever);
      if (state.fever) fx?.popup(lastW / 2, lastH * 0.36, 'פיבר!', '#ff5fae', { big: true, dur: 1, vy: -30 });
      feverWasOn = state.fever;
    }

    const { spawnInterval, speed } = R.difficultyAt(elapsed);
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnTimer = spawnInterval; spawnTicket(laneSpan); }

    for (const t of tickets) {
      if (t.wrongFlash > 0) t.wrongFlash = Math.max(0, t.wrongFlash - dt);
      if (t.stamped || t.missed) { t.settleT += dt; continue; }
      t.x -= speed * dt;
      if (t.x <= 0) {
        t.x = 0;
        const r = R.applyEscape(state, t);
        if (r.outcome === 'escaped') {
          audio?.escaped(); fx?.shake(7);
          const p = ticketPos(t, lastW, lastH);
          fx?.poof(p.x, p.y);
        }
      }
    }
    tickets = tickets.filter((t) => !(t.stamped || t.missed) || t.settleT < 0.4);

    if (R.isGameOver(state) && onGameOver) { audio?.gameOver(); onGameOver(state.score); }
  }

  function stamp(color) {
    const result = R.applyStamp(state, tickets, color);
    if (result.outcome === 'hit') {
      audio?.hit(result.points, state.combo);
      gateFlash = 1;
      const p = ticketPos(result.ticket, lastW, lastH);
      fx?.burst(p.x, p.y, result.ticket.color);
      fx?.ring(p.x, p.y, LANE_COLOR[result.ticket.color]);
      fx?.popup(p.x, p.y - 20, `+${result.points}`, LANE_COLOR[result.ticket.color]);
      if (state.fever) fx?.sparkle(p.x, p.y);
      if (state.combo > 0 && state.combo % 4 === 0 && !state.fever) {
        fx?.popup(lastW / 2, lastH * 0.3, `רצף x${state.combo}`, '#ffd99a');
      }
    } else if (result.outcome === 'wrong') {
      audio?.wrong(); fx?.shake(4);
      if (result.ticket) {
        result.ticket.wrongFlash = 0.25;
        const p = ticketPos(result.ticket, lastW, lastH);
        fx?.poof(p.x, p.y);
      }
    } else if (result.outcome === 'empty') {
      audio?.empty(); fx?.shake(2);
    }
    return result;
  }

  function getState() {
    const stage = R.stageAt(elapsed);
    return { ...state, elapsed, tickets, stage, stageIndex: R.STAGES.indexOf(stage) };
  }

  function draw(ctx, images, width, height) {
    lastW = width; lastH = height;
    drawBackground(ctx, images.station, width, height);
    drawLanes(ctx, width, height, gateFlash, state.fever);

    const sorted = [...tickets].sort((a, b) => ticketEase(a) - ticketEase(b));
    for (const t of sorted) drawTicket(ctx, images[`ticket-${t.color}`], t, width, height);

    drawConductor(ctx, images.conductor, width, height, elapsed, state.fever);
  }

  return { reset, update, stamp, getState, draw, get gateX() { return 96; } };
}

// -- perspective geometry: 4 lanes fan out from a vanishing point near the
// art's gate arch down to foreground "stamp sockets" above each button. -----

function laneGeom(i, W, H) {
  const fgY = H - Math.min(176, H * 0.22);
  const vpY = H * 0.3;
  const fgGap = Math.min(150, W * 0.16);
  const vpGap = Math.min(30, W * 0.032);
  const fgX = W * 0.5 + (i - 1.5) * fgGap;
  const vpX = W * 0.5 + (i - 1.5) * vpGap;
  return { fgX, fgY, vpX, vpY };
}

// 0 at spawn (far/small), 1 at the gate line (near/large) — eased so tickets
// visually accelerate as they rush toward the camera, like true perspective.
function ticketEase(t) {
  const frac = Math.max(0, Math.min(1, t.x / (t.spawnX || 1)));
  return Math.pow(1 - frac, 1.7);
}

function ticketPos(t, W, H) {
  const g = laneGeom(R.COLORS.indexOf(t.color), W, H);
  const ease = ticketEase(t);
  return {
    x: g.vpX + (g.fgX - g.vpX) * ease,
    y: g.vpY + (g.fgY - g.vpY) * ease,
    scale: FAR_SCALE + (NEAR_SCALE - FAR_SCALE) * ease,
  };
}

function drawBackground(ctx, img, W, H) {
  if (!img || !img.complete || !img.naturalWidth) { ctx.fillStyle = '#16233a'; ctx.fillRect(0, 0, W, H); return; }
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) * 0.12, dw, dh);
}

function drawLanes(ctx, W, H, flash, fever) {
  for (let i = 0; i < 4; i++) {
    const g = laneGeom(i, W, H);
    const hex = LANE_COLOR[R.COLORS[i]];
    ctx.save();
    ctx.strokeStyle = hex;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(g.vpX, g.vpY); ctx.lineTo(g.fgX, g.fgY); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowColor = hex;
    ctx.shadowBlur = fever ? 22 : 9 + flash * 16;
    ctx.fillStyle = hex;
    ctx.beginPath(); ctx.arc(g.fgX, g.fgY, 6 + flash * 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawTicket(ctx, img, t, W, H) {
  const p = ticketPos(t, W, H);
  let pop = 1;
  if (t.stamped) pop = 1 + Math.sin(Math.min(1, t.settleT / 0.18) * Math.PI) * 0.3;
  const tw = Math.min(BASE_TICKET_W, W * 0.2) * p.scale * pop;
  const th = tw * 0.56;
  ctx.save();
  const fading = t.stamped || t.missed;
  ctx.globalAlpha = fading ? Math.max(0, 1 - t.settleT * 2.5) : 1;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + th * 0.44, tw * 0.46, th * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  if (t.missed) ctx.filter = 'grayscale(1) brightness(.65)';
  if (img && img.complete) ctx.drawImage(img, p.x - tw / 2, p.y - th / 2, tw, th);
  ctx.filter = 'none';
  if (t.wrongFlash > 0) {
    ctx.globalAlpha = Math.min(1, t.wrongFlash / 0.25) * 0.55;
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(p.x - tw / 2, p.y - th / 2, tw, th);
  }
  ctx.restore();
}

function drawConductor(ctx, img, W, H, elapsed, fever) {
  if (!img || !img.complete) return;
  const cw = Math.min(104, W * 0.19);
  const ch = cw * (img.naturalHeight / (img.naturalWidth || 1));
  const bob = Math.sin(elapsed * (fever ? 7 : 2.4)) * (fever ? 5 : 2);
  ctx.drawImage(img, W * 0.08 - cw * 0.5, H - ch - 2 + bob, cw, ch);
}
