// Pure rules for "leap" (קפיצת הדג) — no DOM. Imported by game.js and unit-tested by qa/rules/leap.test.mjs.

export const RIVERS = ['jordan', 'banias', 'galilee'];

export const LANE_COUNT = 3;
export const LANE_WIDTH = 1.6;

// Three stages, each a river: obstacle speed and spawn rate ramp up, more
// waterfalls to leap, and a longer distance goal to clear the stage.
export const LEVELS = [
  { river: 'jordan', speed: 7, spawnGap: 1.15, waterfalls: 2, goalDistance: 420, time: 55 },
  { river: 'banias', speed: 8.5, spawnGap: 0.95, waterfalls: 3, goalDistance: 520, time: 65 },
  { river: 'galilee', speed: 10, spawnGap: 0.8, waterfalls: 4, goalDistance: 620, time: 75 },
];

export function getLevel(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
}

export function laneX(lane) {
  return (lane - (LANE_COUNT - 1) / 2) * LANE_WIDTH;
}

export function clampLane(lane) {
  return Math.max(0, Math.min(LANE_COUNT - 1, Math.round(lane)));
}

// fish = {lane, airborne}; obstacle = {lane, type: 'rock'|'log'|'waterfall'}.
// Rocks jut too high to clear by jumping — only a lane change dodges them.
// Logs and waterfall lips can be leapt while airborne.
export function isHit(fish, obstacle) {
  if (fish.lane !== obstacle.lane) return false;
  if (obstacle.type === 'rock') return true;
  return !fish.airborne;
}

// Vertical offset of a leap over `duration` seconds, peaking at `height`
// (symmetric parabola); 0 before takeoff and after landing.
export function jumpArc(t, duration, height) {
  if (t <= 0 || t >= duration) return 0;
  const p = t / duration;
  return height * 4 * p * (1 - p);
}

export function isAirborne(t, duration) {
  return t > 0 && t < duration;
}

export const TRICKS = {
  flip: { score: 10, time: 0.28 },
  twist: { score: 15, time: 0.24 },
  doubleFlip: { score: 25, time: 0.4 },
};

// Given an ordered list of trick keys attempted during one leap, returns the
// tricks that actually fit inside the available air time (earlier tricks take
// priority) and their combined base score.
export function fitTricks(trickKeys, airDuration) {
  let used = 0;
  const landed = [];
  for (const key of trickKeys) {
    const t = TRICKS[key];
    if (!t) continue;
    if (used + t.time > airDuration) break;
    used += t.time;
    landed.push(key);
  }
  const score = landed.reduce((sum, key) => sum + TRICKS[key].score, 0);
  return { landed, score, usedTime: used };
}

// Combo grows the trick payout, capped so late-game runs stay bounded.
export function comboMultiplier(combo) {
  return 1 + Math.min(combo, 10) * 0.15;
}

export function scoreForTricks(trickKeys, airDuration, combo) {
  const { landed, score } = fitTricks(trickKeys, airDuration);
  return { landed, points: Math.round(score * comboMultiplier(combo)) };
}

// Waterfall-leap timing judge: `offset` is seconds early/late vs. the ideal
// leap instant (0 = perfect). Windows are half-widths, each tier nested in
// the next.
export function judgeJumpTiming(offset, goodWindow = 0.18, okWindow = 0.32) {
  const a = Math.abs(offset);
  if (a <= goodWindow * 0.4) return 'perfect';
  if (a <= goodWindow) return 'good';
  if (a <= okWindow) return 'ok';
  return 'miss';
}

export const JUMP_TIMING_BONUS = { perfect: 30, good: 15, ok: 5, miss: 0 };

// Combines leap timing with any mid-air tricks into one outcome: a 'miss'
// crashes the leap (no points, breaks combo upstream via applyLanding).
export function resolveLeap({ offset, trickKeys = [], airDuration, combo }) {
  const timing = judgeJumpTiming(offset);
  const success = timing !== 'miss';
  if (!success) return { timing, success, landed: [], points: 0 };
  const { landed, points: trickPoints } = scoreForTricks(trickKeys, airDuration, combo);
  return { timing, success, landed, points: trickPoints + JUMP_TIMING_BONUS[timing] };
}

export function isLevelComplete(level, distance) {
  return distance >= level.goalDistance;
}

// Picks a lane for a new obstacle while guaranteeing at least one lane stays
// open after it spawns (`blocked` = lanes already occupied this wave).
// Returns null when spawning would leave no open lane.
export function pickObstacleLane(blocked, rand = Math.random()) {
  const open = [];
  for (let lane = 0; lane < LANE_COUNT; lane++) if (!blocked.includes(lane)) open.push(lane);
  if (open.length <= 1) return null;
  return open[Math.min(open.length - 1, Math.floor(rand * open.length))];
}

export function applyLanding(state, success) {
  if (success) return { ...state, combo: state.combo + 1 };
  return { ...state, combo: 0, lives: Math.max(0, state.lives - 1) };
}

export function isGameOver(state) {
  return state.lives <= 0;
}
