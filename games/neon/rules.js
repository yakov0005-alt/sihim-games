// Pure rules for "neon" (מנהרת ניאון) — no DOM. Imported by game.js and
// unit-tested by qa/rules/neon.test.mjs.
//
// Hovercraft rides the inner wall of a neon tube. Lanes are angular slots
// around the tube's circumference; radius is how far from the centerline
// (0 = floor/centerline, 1 = outer wall) the craft currently sits. Climbing
// the wall (radius >= WALL_RADIUS) and then dropping back down converts
// banked wall-charge into a speed boost.

export const LANE_COUNT = 8;

export const WALL_RADIUS = 0.7; // riding the wall charges boost above this
export const DROP_RADIUS = 0.3; // charge is released once you drop below this
export const MAX_WALL_CHARGE = 100;
export const WALL_CHARGE_RATE = 60; // charge/sec while riding the wall
export const WALL_CHARGE_DECAY = 25; // charge/sec lost while off the wall
export const BOOST_CONVERSION = 0.08; // speed added per charge point on drop

export const LIVES_START = 3;
export const HIT_WINDOW = 1.2; // track-distance within which an obstacle can hit

export const PICKUP_TYPES = ['battery', 'boost', 'shield'];
export const BOOST_PICKUP_SPEED = 6;
export const BOOST_SCORE_PER_CHARGE = 4;
export const CLEAN_PASS_SCORE = 10;

export const COMBO_STEP = 0.1;
export const COMBO_CAP = 10; // combo multiplier maxes at 1 + CAP*STEP = 2x

// Five unlockable tracks; each stage is longer, faster and denser than the
// last, and unlocks once the previous stage's best score clears its bar.
export const TRACKS = [
  { id: 'grid', name: 'רצועת הרשת', length: 900, baseSpeed: 14, obstacleGap: 60, unlockScore: 0 },
  { id: 'circuit', name: 'מעגל הזרם', length: 1100, baseSpeed: 16, obstacleGap: 54, unlockScore: 400 },
  { id: 'decal', name: 'נתיב הסמלים', length: 1300, baseSpeed: 18, obstacleGap: 48, unlockScore: 900 },
  { id: 'tunnel', name: 'מנהרת האור', length: 1500, baseSpeed: 20, obstacleGap: 42, unlockScore: 1500 },
  { id: 'backdrop', name: 'הקצה הניאוני', length: 1700, baseSpeed: 22, obstacleGap: 36, unlockScore: 2200 },
];

export function getTrack(index) {
  return TRACKS[Math.max(0, Math.min(TRACKS.length - 1, index))];
}

export function isTrackUnlocked(index, bestScore) {
  const track = getTrack(index);
  return bestScore >= track.unlockScore;
}

export function advanceDistance(distance, speed, dt) {
  return distance + speed * dt;
}

export function isTrackComplete(track, distance) {
  return distance >= track.length;
}

// Wraps a lane index around the tube's circumference.
export function steerLane(lane, delta, laneCount = LANE_COUNT) {
  return ((lane + delta) % laneCount + laneCount) % laneCount;
}

export function laneOf(angleTurns, laneCount = LANE_COUNT) {
  const t = ((angleTurns % 1) + 1) % 1;
  return Math.floor(t * laneCount) % laneCount;
}

// Charge rises while riding the wall, decays while off it, always clamped.
export function updateWallCharge(charge, radius, dt) {
  const delta = radius >= WALL_RADIUS ? WALL_CHARGE_RATE * dt : -WALL_CHARGE_DECAY * dt;
  return Math.max(0, Math.min(MAX_WALL_CHARGE, charge + delta));
}

// A "drop" is the moment the craft falls from the wall back toward the
// centerline; it converts banked charge into a one-off speed boost and
// resets the charge to zero. Any other radius transition leaves it intact.
export function resolveWallDrop(charge, prevRadius, radius) {
  const dropped = prevRadius >= WALL_RADIUS && radius < DROP_RADIUS;
  if (!dropped) return { boosted: false, boost: 0, charge };
  return { boosted: true, boost: charge * BOOST_CONVERSION, charge: 0 };
}

// Rates the quality of a drop by how much charge had been banked.
export function judgeDropTiming(charge) {
  if (charge <= 0) return 'miss';
  if (charge >= MAX_WALL_CHARGE * 0.85) return 'perfect';
  if (charge >= MAX_WALL_CHARGE * 0.5) return 'good';
  return 'ok';
}

// obstacle = {lane, atDistance}; player sits in `lane` at `distance`.
export function isHit(player, obstacle, hitWindow = HIT_WINDOW) {
  return player.lane === obstacle.lane && Math.abs(player.distance - obstacle.atDistance) <= hitWindow;
}

// Resolves one obstacle encounter: a shielded craft survives a hit by
// spending its shield instead of crashing; a clean miss just passes through.
export function resolveCollision(player, obstacle, hitWindow = HIT_WINDOW) {
  if (!isHit(player, obstacle, hitWindow)) return { hit: false, crashed: false, consumedShield: false };
  if (player.shielded) return { hit: true, crashed: false, consumedShield: true };
  return { hit: true, crashed: true, consumedShield: false };
}

export function applyPickup(state, type) {
  switch (type) {
    case 'battery':
      return { ...state, charge: MAX_WALL_CHARGE };
    case 'boost':
      return { ...state, speed: state.speed + BOOST_PICKUP_SPEED };
    case 'shield':
      return { ...state, shielded: true };
    default:
      return state;
  }
}

export function comboMultiplier(combo) {
  return 1 + Math.min(combo, COMBO_CAP) * COMBO_STEP;
}

export function addScore(score, basePoints, combo) {
  return score + Math.round(basePoints * comboMultiplier(combo));
}

export function scoreCleanPass(score, combo) {
  return { score: addScore(score, CLEAN_PASS_SCORE, combo), combo: combo + 1 };
}

export function scoreBoost(score, combo, boost) {
  return addScore(score, boost * BOOST_SCORE_PER_CHARGE, combo);
}

export function registerCrash(lives, combo) {
  return { lives: lives - 1, combo: 0 };
}

export function isGameOver(lives) {
  return lives <= 0;
}
