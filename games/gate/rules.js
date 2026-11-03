// Pure rules for "gate" (בודק הכרטיסים) — no DOM. Imported by game.js and
// unit-tested by qa/rules/gate.test.mjs.
// Tickets slide across lanes toward a gate line at x=0 (distance shrinks to
// the gate); the player must stamp each with its matching color before it
// reaches 0, in order of arrival (frontmost unstamped ticket only).

export const COLORS = ['red', 'green', 'blue', 'gold'];
export const LIVES_START = 3;
export const FEVER_COMBO = 8;
export const FEVER_DURATION = 6;
export const STAMP_RANGE = 420; // px of distance over which the timing bonus ramps

export function createState() {
  return { score: 0, combo: 0, maxCombo: 0, lives: LIVES_START, fever: false, feverTimer: 0 };
}

// tickets: [{color, x, stamped, missed}], x = distance from the gate (>=0 while active).
// Returns the closest not-yet-resolved ticket, or null if none are active.
export function frontmostTicket(tickets) {
  let best = null;
  for (const t of tickets) {
    if (t.stamped || t.missed) continue;
    if (!best || t.x < best.x) best = t;
  }
  return best;
}

// Closer-to-the-gate stamps are riskier and pay out more; combo and fever multiply on top.
export function stampScore(distance, combo, fever) {
  const d = Math.max(0, Math.min(STAMP_RANGE, distance));
  const near = 1 - d / STAMP_RANGE; // 0 far .. 1 right at the gate
  const base = 40 + Math.round(near * 90); // 40..130
  const comboMul = 1 + Math.min(combo, 20) * 0.08;
  const feverMul = fever ? 2 : 1;
  return Math.round(base * comboMul * feverMul);
}

// Mutates `state` and the matched ticket. Returns { outcome, points, ticket }.
// outcome: 'empty' (nothing to stamp), 'wrong' (frontmost ticket is a different color), 'hit'.
export function applyStamp(state, tickets, color, gateX = 0) {
  const target = frontmostTicket(tickets);
  if (!target) return { outcome: 'empty', points: 0, ticket: null };
  if (target.color !== color) {
    target.missed = true;
    state.combo = 0;
    state.lives = Math.max(0, state.lives - 1);
    return { outcome: 'wrong', points: 0, ticket: target };
  }
  const distance = Math.max(0, target.x - gateX);
  const points = stampScore(distance, state.combo, state.fever);
  target.stamped = true;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.score += points;
  updateFever(state);
  return { outcome: 'hit', points, ticket: target };
}

// Call when a ticket's x crosses the gate line unresolved. No-op if it was already settled.
export function applyEscape(state, ticket) {
  if (ticket.stamped || ticket.missed) return { outcome: 'none' };
  ticket.missed = true;
  state.combo = 0;
  state.lives = Math.max(0, state.lives - 1);
  return { outcome: 'escaped' };
}

export function updateFever(state) {
  if (!state.fever && state.combo > 0 && state.combo % FEVER_COMBO === 0) {
    state.fever = true;
    state.feverTimer = FEVER_DURATION;
  }
}

export function tickFever(state, dt) {
  if (!state.fever) return;
  state.feverTimer -= dt;
  if (state.feverTimer <= 0) { state.fever = false; state.feverTimer = 0; }
}

// Spawn interval and ticket speed ramp with elapsed play time (seconds).
export function difficultyAt(elapsed) {
  const t = Math.max(0, elapsed);
  const spawnInterval = Math.max(0.55, 1.6 - t * 0.012);
  const speed = Math.min(430, 210 + t * 4.4);
  return { spawnInterval, speed };
}

// Named stages announced as play time passes their threshold; the underlying
// speed/spawn ramp stays continuous (difficultyAt) — these are flavor/HUD text.
export const STAGES = [
  { name: 'תחילת המשמרת', at: 0 },
  { name: 'שעת העומס', at: 40 },
  { name: 'הרכבת האחרונה', at: 90 },
];

export function stageAt(elapsed) {
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (elapsed >= stage.at) current = stage;
  }
  return current;
}

export function isGameOver(state) {
  return state.lives <= 0;
}
