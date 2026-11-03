// Pure rules for "bigfish" (הדג החכם) — no DOM. Imported by game.js and
// unit-tested by qa/rules/bigfish.test.mjs.
// The carp holds one end of a rope, the fisherman the other. Tension is a
// scalar 0..100: 0 means the fisherman dragged the carp out of the lake
// (lose), 100 means the fisherman overbalances and splashes in (win). The
// fisherman issues "pulls" (a direction + strength); the player must swipe
// the opposite direction within a reaction window to gain rope.

export const TENSION_MIN = 0;
export const TENSION_MAX = 100;
export const TENSION_START = 50;
export const REACTION_WINDOW = 1.1; // seconds, base time to counter a pull
export const COMBO_CAP = 20;
export const MIN_PULL_INTERVAL = 0.55;

// Six fishermen = six levels/stages, each with a distinct pulling style.
export const FISHERMEN = [
  { id: 1, name: 'הדייג הזהיר', pullInterval: 1.6, strengthMin: 6, strengthMax: 10, feintChance: 0, speedMul: 1 },
  { id: 2, name: 'הדייג הנמרץ', pullInterval: 1.3, strengthMin: 8, strengthMax: 14, feintChance: 0.1, speedMul: 1.1 },
  { id: 3, name: 'הדייג הממולח', pullInterval: 1.2, strengthMin: 8, strengthMax: 14, feintChance: 0.35, speedMul: 1.1 },
  { id: 4, name: 'הדייג החזק', pullInterval: 1.1, strengthMin: 14, strengthMax: 22, feintChance: 0.15, speedMul: 1.2 },
  { id: 5, name: 'הדייג הזריז', pullInterval: 0.8, strengthMin: 10, strengthMax: 16, feintChance: 0.25, speedMul: 1.35 },
  { id: 6, name: 'רב־החובל', pullInterval: 0.9, strengthMin: 16, strengthMax: 26, feintChance: 0.3, speedMul: 1.4 },
];

export function getFisherman(levelIndex) {
  const i = Math.max(0, Math.min(FISHERMEN.length - 1, levelIndex));
  return FISHERMEN[i];
}

export function nextLevelIndex(levelIndex) {
  return levelIndex + 1 < FISHERMEN.length ? levelIndex + 1 : null;
}

export function isGameComplete(levelIndex) {
  return nextLevelIndex(levelIndex) === null;
}

export function createState(levelIndex = 0) {
  return {
    levelIndex,
    fisherman: getFisherman(levelIndex),
    tension: TENSION_START,
    score: 0,
    combo: 0,
    maxCombo: 0,
    pulls: 0,
    misses: 0,
    status: 'play', // 'play' | 'win' | 'lose'
  };
}

export function clampTension(t) {
  return Math.max(TENSION_MIN, Math.min(TENSION_MAX, t));
}

// Pull interval shortens slightly the longer a fisherman's rally goes on,
// on top of his base pace, but never below MIN_PULL_INTERVAL.
export function pullIntervalAt(fisherman, pullsResolved) {
  return Math.max(MIN_PULL_INTERVAL, fisherman.pullInterval - pullsResolved * 0.03);
}

// rng is injectable (defaults to Math.random) so tests can be deterministic.
// direction: -1 (left) or 1 (right) — the way the fisherman yanks the rope.
// telegraphDirection: what gets shown to the player; differs from direction
// on a feint. isFeint and telegraphDirection are display concerns for
// game.js — judging always uses the real `direction`.
export function generatePull(fisherman, rng = Math.random) {
  const direction = rng() < 0.5 ? -1 : 1;
  const isFeint = rng() < fisherman.feintChance;
  const telegraphDirection = isFeint ? -direction : direction;
  const strength = fisherman.strengthMin + rng() * (fisherman.strengthMax - fisherman.strengthMin);
  const window = REACTION_WINDOW / fisherman.speedMul;
  return { direction, telegraphDirection, isFeint, strength, window };
}

// 1 = instant reaction, 0 = reacted right at the edge of the window.
export function reactionQuality(reactionTime, window) {
  const t = Math.max(0, Math.min(window, reactionTime));
  return 1 - t / window;
}

// swipeDirection: -1, 1, or null/undefined if the player never swiped.
export function judgeSwipe(pull, swipeDirection, reactionTime) {
  if (swipeDirection !== -1 && swipeDirection !== 1) return 'timeout';
  if (swipeDirection === pull.direction) return 'wrong';
  if (reactionTime > pull.window) return 'late';
  return 'hit';
}

export function pullPoints(pull, combo, reactionTime) {
  const quality = reactionQuality(reactionTime, pull.window);
  const base = 20 + Math.round(pull.strength * 3);
  const comboMul = 1 + Math.min(combo, COMBO_CAP) * 0.07;
  const qualityMul = 0.6 + quality * 0.6; // 0.6..1.2
  return Math.round(base * comboMul * qualityMul);
}

// Mutates `state`. Returns { outcome, points, delta } where outcome is one
// of 'hit' | 'wrong' | 'late' | 'timeout'.
export function applyPull(state, pull, swipeDirection, reactionTime = 0) {
  const outcome = judgeSwipe(pull, swipeDirection, reactionTime);
  state.pulls += 1;

  if (outcome === 'hit') {
    const points = pullPoints(pull, state.combo, reactionTime);
    const quality = reactionQuality(reactionTime, pull.window);
    const delta = pull.strength * (0.5 + quality * 0.5);
    state.tension = clampTension(state.tension + delta);
    state.score += points;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    updateStatus(state);
    return { outcome, points, delta };
  }

  // wrong (swiped into the pull), late, or timeout: the fisherman drags
  // the carp toward the boat. A dead-wrong swipe costs full strength; a
  // late-but-correct swipe costs a reduced amount.
  const penalty = outcome === 'wrong' ? pull.strength : pull.strength * 0.6;
  state.tension = clampTension(state.tension - penalty);
  state.combo = 0;
  state.misses += 1;
  updateStatus(state);
  return { outcome, points: 0, delta: -penalty };
}

export function updateStatus(state) {
  if (state.tension >= TENSION_MAX) state.status = 'win';
  else if (state.tension <= TENSION_MIN) state.status = 'lose';
  return state.status;
}

export function isResolved(state) {
  return state.status !== 'play';
}
