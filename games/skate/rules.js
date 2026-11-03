// Pure rules for "skate" (גולש הסופה) — no DOM. Imported by game.js and
// unit-tested by qa/rules/skate.test.mjs.
//
// A gust launches the boy off a ramp for a fixed airtime budget. While
// airborne the player chains tricks (each costs time and adds spin); landing
// requires: (a) coming down over a ramp, not bare sand, and (b) having
// resolved all spin back to a multiple of 360°. Clean landings pay out by
// how much of the airtime budget was used (risk/reward) and by a global
// streak combo across jumps.

export const TRICKS = {
  kickflip: { points: 80, time: 0.3, spin: 0 },
  grab: { points: 60, time: 0.28, spin: 0 },
  spin: { points: 100, time: 0.4, spin: 180 },
};

export const COMBO_STEP = 0.25; // per-trick multiplier growth within one jump
export const MAX_AIRTIME = 4; // seconds, hard clamp
export const LIVES_START = 3;
export const MAX_STREAK_FOR_BONUS = 10;
export const STREAK_BONUS_STEP = 0.05; // +5% per landed jump in a row, capped

// Three stages: stronger gusts (more airtime headroom) and higher score goals.
export const LEVELS = [
  { name: 'ridge', airtime: 1.6, gust: 0.5, goal: 600 },
  { name: 'dune', airtime: 1.9, gust: 0.7, goal: 1200 },
  { name: 'canyon', airtime: 2.3, gust: 0.9, goal: 2000 },
];

export function getLevel(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
}

export function createState() {
  return { score: 0, combo: 0, maxCombo: 0, lives: LIVES_START, stage: 0, jump: null, airborne: false };
}

// power: 0..1, how well-timed the launch was with the wind gust.
export function computeAirtime(level, power) {
  const p = Math.max(0, Math.min(1, power));
  return Math.min(MAX_AIRTIME, level.airtime + p * level.gust);
}

// Gusts cycle sinusoidally; phase 0..1 maps one full cycle, peaking at 0.5.
export function gustPower(phase) {
  const t = ((phase % 1) + 1) % 1;
  return Math.max(0, Math.sin(t * Math.PI));
}

export function startJump(state, level, power) {
  state.jump = { budget: computeAirtime(level, power), used: 0, spin: 0, points: 0, tricks: [] };
  state.airborne = true;
  return state.jump;
}

export function remainingAirtime(jump) {
  return Math.max(0, jump.budget - jump.used);
}

export function canPerformTrick(jump, trickKey) {
  const trick = TRICKS[trickKey];
  if (!jump || !trick) return false;
  return remainingAirtime(jump) >= trick.time;
}

// Mutates state.jump; returns { outcome: 'ok'|'notAirborne'|'noAir'|'unknown', points }.
export function performTrick(state, trickKey) {
  const trick = TRICKS[trickKey];
  if (!trick) return { outcome: 'unknown', points: 0 };
  const jump = state.jump;
  if (!jump) return { outcome: 'notAirborne', points: 0 };
  if (!canPerformTrick(jump, trickKey)) return { outcome: 'noAir', points: 0 };
  const points = Math.round(trick.points * (1 + jump.tricks.length * COMBO_STEP));
  jump.points += points;
  jump.spin += trick.spin;
  jump.used += trick.time;
  jump.tricks.push(trickKey);
  return { outcome: 'ok', points };
}

// ramp: { x, width }. x is the player's landing position.
export function isOverRamp(x, ramp) {
  return x >= ramp.x && x <= ramp.x + ramp.width;
}

// Pure judgement of a completed jump's trick chain (no ramp/life effects).
// Unresolved spin (not a multiple of 360) is a 'wipeout' no matter the timing.
export function judgeLanding(jump) {
  if (jump.spin % 360 !== 0) return { quality: 'wipeout', multiplier: 0 };
  const ratio = jump.budget > 0 ? jump.used / jump.budget : 0;
  if (ratio >= 0.85) return { quality: 'perfect', multiplier: 1.5 };
  if (ratio >= 0.5) return { quality: 'good', multiplier: 1.2 };
  return { quality: 'sloppy', multiplier: 1 };
}

export function streakMultiplier(combo) {
  return 1 + Math.min(combo, MAX_STREAK_FOR_BONUS) * STREAK_BONUS_STEP;
}

// Resolves the current jump against a landing spot. Mutates and returns
// { outcome: 'none'|'crash'|'wipeout'|'landed', quality?, points }.
export function landJump(state, x, ramp) {
  const jump = state.jump;
  if (!jump) return { outcome: 'none', points: 0 };
  if (!isOverRamp(x, ramp)) {
    state.lives = Math.max(0, state.lives - 1);
    state.combo = 0;
    state.jump = null;
    state.airborne = false;
    return { outcome: 'crash', points: 0 };
  }
  const judge = judgeLanding(jump);
  if (judge.quality === 'wipeout') {
    state.lives = Math.max(0, state.lives - 1);
    state.combo = 0;
    state.jump = null;
    state.airborne = false;
    return { outcome: 'wipeout', points: 0 };
  }
  const points = Math.round(jump.points * judge.multiplier * streakMultiplier(state.combo));
  state.score += points;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.jump = null;
  state.airborne = false;
  return { outcome: 'landed', quality: judge.quality, points };
}

export function stageComplete(level, score) {
  return score >= level.goal;
}

export function isGameOver(state) {
  return state.lives <= 0;
}
