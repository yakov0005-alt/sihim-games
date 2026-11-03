// Pure rules for "roofrun" (רץ לצד הרכבת) — no DOM. Imported by game.js and unit-tested by qa/rules/roofrun.test.mjs.

export const ROUTES = ['hills', 'town', 'valley'];

export const ACTIONS = { RUN: 'run', JUMP: 'jump', SLIDE: 'slide' };

// Three stages (routes) seen through the train window; speed and spawn rate
// ramp up and each stage asks for a longer run before the train reaches the
// next stop.
export const LEVELS = [
  { route: 'hills', speed: 8, spawnGap: 1.0, goalDistance: 500, time: 50, lives: 3 },
  { route: 'town', speed: 9.5, spawnGap: 0.82, goalDistance: 650, time: 60, lives: 3 },
  { route: 'valley', speed: 11, spawnGap: 0.68, goalDistance: 800, time: 70, lives: 3 },
];

export function getLevel(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
}

export function advanceDistance(distance, speed, dt) {
  return distance + speed * dt;
}

export function isLevelComplete(level, distance) {
  return distance >= level.goalDistance;
}

export const JUMP_DURATION = 0.5;
export const JUMP_HEIGHT = 1.4;
export const SLIDE_DURATION = 0.45;

// Vertical offset of a jump over the roof, peaking mid-air (symmetric
// parabola); 0 before takeoff and after landing.
export function jumpArc(t, duration = JUMP_DURATION, height = JUMP_HEIGHT) {
  if (t <= 0 || t >= duration) return 0;
  const p = t / duration;
  return height * 4 * p * (1 - p);
}

export function isJumping(t, duration = JUMP_DURATION) {
  return t > 0 && t < duration;
}

export function isSliding(t, duration = SLIDE_DURATION) {
  return t > 0 && t < duration;
}

export const OBSTACLE_TYPES = ['vent', 'laundry', 'pigeon'];

// runner = {action: 'run'|'jump'|'slide'}
// obstacle = {type: 'vent'|'laundry'|'pigeon', height?: 'roof'|'head'}
// Vents jut up from the roof: only a jump clears them.
// Laundry lines hang overhead: only a slide passes under them.
// Pigeons flap at either roof height (dodge by jumping, like a vent) or at
// head height when they swoop low (dodge by sliding, like laundry).
export function isHit(runner, obstacle) {
  switch (obstacle.type) {
    case 'vent':
      return runner.action !== ACTIONS.JUMP;
    case 'laundry':
      return runner.action !== ACTIONS.SLIDE;
    case 'pigeon':
      return obstacle.height === 'head'
        ? runner.action !== ACTIONS.SLIDE
        : runner.action !== ACTIONS.JUMP;
    default:
      return false;
  }
}

// Picks a random obstacle, deterministic given `rand` (a () => [0,1) fn),
// so tests can drive it with a fixed sequence instead of Math.random.
export function pickObstacleType(rand = Math.random) {
  const r = rand();
  if (r < 0.4) return { type: 'vent' };
  if (r < 0.75) return { type: 'laundry' };
  return { type: 'pigeon', height: rand() < 0.5 ? 'roof' : 'head' };
}

// Reaction-timing judge: `offset` is seconds early/late vs. the ideal instant
// to jump/slide (0 = perfect). Windows are half-widths, each tier nested in
// the next, mirroring the other batch-1 games' timing judges.
export function judgeReaction(offset, goodWindow = 0.12, okWindow = 0.25) {
  const a = Math.abs(offset);
  if (a <= goodWindow * 0.4) return 'perfect';
  if (a <= goodWindow) return 'good';
  if (a <= okWindow) return 'ok';
  return 'miss';
}

export const REACTION_BONUS = { perfect: 15, good: 8, ok: 3, miss: 0 };

// Resolves one obstacle encounter: a collision always ends the combo and
// costs a life regardless of timing; clearing it awards a reaction bonus on
// top of the flat clear score.
export function resolveObstacle({ runner, obstacle, offset }) {
  const hit = isHit(runner, obstacle);
  if (hit) return { hit, timing: 'miss', points: 0 };
  const timing = judgeReaction(offset);
  return { hit, timing, points: REACTION_BONUS[timing] };
}

export const ENVELOPE_SCORE = 10;

// Combo grows the envelope payout, capped so a long streak stays bounded.
export function comboMultiplier(combo) {
  return 1 + Math.min(combo, 10) * 0.1;
}

export function collectEnvelope(combo) {
  const points = Math.round(ENVELOPE_SCORE * comboMultiplier(combo));
  return { points, combo: combo + 1 };
}

export function applyHit(state) {
  return { ...state, combo: 0, lives: Math.max(0, state.lives - 1) };
}

export function applyClear(state, points) {
  return { ...state, combo: state.combo + 1, score: state.score + points };
}

export function isGameOver(state) {
  return state.lives <= 0;
}
