// QA autoplay bot (?bot=1): plays through the real input path (actions.left/
// right/jump — the same functions wired to keys/buttons) like a decent human.
// It reacts to the nearest incoming obstacle in its own lane — dodging rocks,
// timing jumps over logs/waterfalls — with a chance of reacting late or not
// at all, plus a little idle lane-wandering so it doesn't look robotic.
const ROCK_REACT_CHANCE = 0.82;
const JUMP_REACT_CHANCE = 0.88;
const ROCK_WINDOW = [0.12, 0.7]; // seconds-to-resolve where a dodge still lands
const JUMP_WINDOW = [0.05, 0.4]; // seconds-to-resolve where a jump still lands
const DODGE_COOLDOWN = 0.35;
const JUMP_COOLDOWN = 0.4;

export function createBot({ actions }) {
  let clock = 0;
  let idleTimer = Math.random() * 0.6;
  let lastDodge = -10;
  let lastJumpCall = -10;

  function nearestThreat(obstacles, lane) {
    let best = null;
    for (const o of obstacles) {
      if (o.type === 'coin' || o.lane !== lane) continue;
      if (!best || o.timeToResolve < best.timeToResolve) best = o;
    }
    return best;
  }

  // Prefer whichever adjacent lane has nothing else resolving around the
  // same instant; falls back to the other lane if both look risky.
  function pickDodgeDir(lane, obstacles, aroundTime) {
    const dirs = lane === 0 ? [1] : lane === 2 ? [-1] : Math.random() < 0.5 ? [-1, 1] : [1, -1];
    for (const dir of dirs) {
      const target = lane + dir;
      const blocked = obstacles.some(
        (o) => o.lane === target && o.type !== 'coin' && Math.abs(o.timeToResolve - aroundTime) < 0.35,
      );
      if (!blocked) return dir;
    }
    return dirs[0];
  }

  function update(dt, state, obstacles) {
    if (!state || state.phase !== 'play') return;
    clock += dt;
    idleTimer -= dt;
    const list = obstacles || [];

    const threat = nearestThreat(list, state.lane);

    if (threat && threat.type === 'rock') {
      const [lo, hi] = ROCK_WINDOW;
      if (threat.timeToResolve >= lo && threat.timeToResolve <= hi && clock - lastDodge > DODGE_COOLDOWN) {
        lastDodge = clock;
        if (Math.random() < ROCK_REACT_CHANCE) {
          const dir = pickDodgeDir(state.lane, list, threat.timeToResolve);
          (dir < 0 ? actions.left : actions.right)();
        }
      }
    } else if (threat && !state.airborne) {
      const [lo, hi] = JUMP_WINDOW;
      if (threat.timeToResolve >= lo && threat.timeToResolve <= hi && clock - lastJumpCall > JUMP_COOLDOWN) {
        lastJumpCall = clock;
        if (Math.random() < JUMP_REACT_CHANCE) actions.jump();
      }
    }

    // Nothing urgent close by: wander a little and try the occasional trick
    // jump, like a human keeping busy between obstacles.
    if ((!threat || threat.timeToResolve > 1) && idleTimer <= 0) {
      idleTimer = 0.5 + Math.random() * 0.7;
      const r = Math.random();
      if (r < 0.3) (Math.random() < 0.5 ? actions.left : actions.right)();
      else if (r < 0.48) actions.jump();
    }
  }

  return { update };
}
