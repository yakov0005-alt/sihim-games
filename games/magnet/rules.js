// Pure rules for "magnet" (רובו-מגנט) — no DOM. Imported by game.js and
// unit-tested by qa/rules/magnet.test.mjs.
// The player's robot casts a magnetic cable, grabs a drone, swings it, then
// hurls it into another drone — both pop into bolts & sparks. Shield drones
// can't be grabbed until their shield is broken by taking a hit first.

export const DRONE_TYPES = {
  scout: { health: 1, points: 10, speed: 58, radius: 18, damage: 1 },
  fast: { health: 1, points: 16, speed: 112, radius: 16, damage: 1 },
  heavy: { health: 3, points: 34, speed: 44, radius: 27, damage: 2 },
  shield: { health: 1, points: 28, speed: 56, radius: 25, damage: 1, shieldHits: 2 },
};

export const BOSS = { health: 14, points: 400, speed: 42, radius: 52 };
export const BOSS_CHIP_POINTS = 15;
export const SHIELD_BREAK_POINTS = 12;
export const CHAIN_BONUS = 25;

export const CABLE_RANGE = 230;
export const LIVES_START = 3;
export const MAX_CHARGE = 1;
export const CHARGE_RATE = 1.4; // charge units gained per second of holding the swing
export const THROW_SPEED_BASE = 260;
export const THROW_SPEED_RANGE = 340; // added on top of base at full charge
export const COMBO_WINDOW = 2.2; // seconds of grace before an idle combo resets
export const COMBO_CAP = 12;
export const COMBO_STEP = 0.12;

// Named stages reached by wave number; composition/speed/boss ramp with them.
export const STAGES = [
  { name: 'מוסך הרובוטים', wave: 1, types: ['scout'], spawnInterval: 2.6, speedMul: 1, boss: false },
  { name: 'סככת הכוננות', wave: 3, types: ['scout', 'fast'], spawnInterval: 1.6, speedMul: 1.1, boss: false },
  { name: 'מצודת הרחפנים', wave: 5, types: ['scout', 'fast', 'heavy'], spawnInterval: 1.3, speedMul: 1.2, boss: false },
  { name: 'ליבת הענק', wave: 7, types: ['fast', 'heavy', 'shield'], spawnInterval: 1.05, speedMul: 1.35, boss: true },
];

export function createState() {
  return { score: 0, combo: 0, maxCombo: 0, comboTimer: 0, lives: LIVES_START, wave: 1 };
}

export function createDrone(type, x, y) {
  const def = DRONE_TYPES[type];
  return { type, x, y, health: def.health, shielded: type === 'shield', shieldHits: def.shieldHits || 0 };
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  return distance(ax, ay, bx, by) <= ar + br;
}

export function isInCableRange(px, py, dx, dy, range = CABLE_RANGE) {
  return distance(px, py, dx, dy) <= range;
}

export function canGrab(drone) {
  return !drone.shielded && drone.health > 0;
}

// Returns whether the shield actually absorbed this hit (false once broken/absent).
export function breakShield(drone) {
  if (!drone.shielded) return false;
  drone.shieldHits -= 1;
  if (drone.shieldHits <= 0) drone.shielded = false;
  return true;
}

export function attemptGrab(drone, px, py, range = CABLE_RANGE) {
  if (!isInCableRange(px, py, drone.x, drone.y, range)) return { success: false, reason: 'out-of-range' };
  if (!canGrab(drone)) return { success: false, reason: 'shielded' };
  return { success: true, reason: null };
}

export function chargeAfterHold(holdTime) {
  return Math.min(MAX_CHARGE, Math.max(0, holdTime) * CHARGE_RATE);
}

export function throwSpeedFor(charge) {
  const c = Math.min(MAX_CHARGE, Math.max(0, charge));
  return THROW_SPEED_BASE + c * THROW_SPEED_RANGE;
}

export function comboMultiplier(combo) {
  return 1 + Math.min(Math.max(0, combo), COMBO_CAP) * COMBO_STEP;
}

export function pointsForPop(basePoints, combo) {
  return Math.round(basePoints * comboMultiplier(combo));
}

function registerHit(state) {
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboTimer = COMBO_WINDOW;
}

// A thrown drone of `thrownType` lands on `target`. If the target is shielded,
// the hit only breaks the shield (no pop yet). Otherwise it deals damage and
// pops the target when health drops to zero, paying a chain bonus.
export function applyThrowHit(state, thrownType, target) {
  const thrownDef = DRONE_TYPES[thrownType];
  registerHit(state);
  if (target.shielded) {
    breakShield(target);
    const points = pointsForPop(SHIELD_BREAK_POINTS, state.combo);
    state.score += points;
    return { outcome: 'shield-break', popped: false, points };
  }
  target.health -= thrownDef.damage;
  const popped = target.health <= 0;
  const targetDef = DRONE_TYPES[target.type];
  let points = pointsForPop(targetDef.points, state.combo);
  if (popped) points += CHAIN_BONUS;
  state.score += points;
  return { outcome: popped ? 'pop' : 'dent', popped, points };
}

// A thrown drone lands on the boss: chips its health, and pays the full boss
// bonus only on the hit that finally pops it.
export function applyBossHit(state, boss, thrownType) {
  const dmg = DRONE_TYPES[thrownType].damage;
  boss.health = Math.max(0, boss.health - dmg);
  registerHit(state);
  const popped = boss.health <= 0;
  const points = pointsForPop(popped ? BOSS.points : BOSS_CHIP_POINTS, state.combo);
  state.score += points;
  return { popped, points };
}

// A drone reached the robot's core unresolved: breaks the combo and costs a life.
export function applyBreach(state) {
  state.combo = 0;
  state.comboTimer = 0;
  state.lives = Math.max(0, state.lives - 1);
  return { lives: state.lives };
}

export function tickCombo(state, dt) {
  if (state.combo === 0) return;
  state.comboTimer -= dt;
  if (state.comboTimer <= 0) {
    state.combo = 0;
    state.comboTimer = 0;
  }
}

export function waveFor(waveNumber) {
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (waveNumber >= stage.wave) current = stage;
  }
  return current;
}

export function isBossWave(waveNumber) {
  return waveFor(waveNumber).boss;
}

export function isGameOver(state) {
  return state.lives <= 0;
}
