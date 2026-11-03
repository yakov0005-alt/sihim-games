// Autoplay for ?bot=1 / QA (qa/bot.mjs): drives the real aim+grab input path
// (the same setInput() the pointer/keyboard handlers in game.js feed), using
// play.getState()'s drone/boss/held positions to actually grab a nearby
// drone and aim the throw at another — like a decent-but-not-perfect player
// (reaction delay + occasional fumbled grabs/releases), not a precise bot.
const REACT_EVERY = 0.16;
const GRAB_MISS_CHANCE = 0.12;
const RELEASE_MISS_CHANCE = 0.12;
const HOLD_MIN = 0.22;
const HOLD_MAX = 1.1;
const AIM_JITTER = 30;
const IDLE_RADIUS = 140;

export function createBot({ setInput, centerX = () => innerWidth / 2, centerY = () => innerHeight / 2 } = {}) {
  let idleAngle = Math.random() * Math.PI * 2;
  let reactClock = 0;
  let holdTimer = 0;
  let wasHeld = false;
  let aimX = null, aimY = null, action = false;

  function jitter(v) {
    return v + (Math.random() - 0.5) * AIM_JITTER;
  }

  // Nearest drone the magnet can actually latch onto right now (grab checks
  // distance from the core itself, not from the aim point).
  function nearestGrabbable(state) {
    let best = null, bestDist = Infinity;
    for (const d of state.drones) {
      if (!d.canGrab) continue;
      const dist = Math.hypot(d.x - state.cx, d.y - state.cy);
      if (dist > state.cableRange || dist >= bestDist) continue;
      bestDist = dist; best = d;
    }
    return best;
  }

  // Nearest live drone/boss overall, to aim a throw at (or just to look
  // alert while idle) — the projectile's own homing forgives imprecise aim.
  function nearestTarget(state) {
    let best = null, bestDist = Infinity;
    for (const d of state.drones) {
      const dist = Math.hypot(d.x - state.cx, d.y - state.cy);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    if (state.boss) {
      const dist = Math.hypot(state.boss.x - state.cx, state.boss.y - state.cy);
      if (dist < bestDist) { bestDist = dist; best = state.boss; }
    }
    return best;
  }

  function idleDrift(dt, cx, cy) {
    idleAngle += dt * 0.8;
    aimX = cx + Math.cos(idleAngle) * IDLE_RADIUS;
    aimY = cy + Math.sin(idleAngle) * IDLE_RADIUS;
  }

  function decide(state, cx, cy, holding) {
    if (!holding) {
      const target = nearestGrabbable(state);
      if (target && Math.random() > GRAB_MISS_CHANCE) {
        aimX = jitter(target.x); aimY = jitter(target.y); action = true;
        return;
      }
      action = false;
      const drift = nearestTarget(state);
      if (drift) { aimX = drift.x; aimY = drift.y; } else idleDrift(0, cx, cy);
      return;
    }
    const target = nearestTarget(state);
    if (target) { aimX = jitter(target.x); aimY = jitter(target.y); }
    let release = holdTimer >= HOLD_MAX;
    if (!release && holdTimer >= HOLD_MIN) {
      const charged = state.charge >= 0.3 || Math.random() < 0.4;
      release = charged && Math.random() >= RELEASE_MISS_CHANCE;
    }
    action = !release;
  }

  function update(dt, state) {
    if (!setInput) return;
    const cx = state?.cx ?? centerX();
    const cy = state?.cy ?? centerY();
    const holding = !!state?.held;
    if (holding && !wasHeld) holdTimer = 0;
    wasHeld = holding;
    if (holding) holdTimer += dt;

    reactClock -= dt;
    if (!state) {
      idleDrift(dt, cx, cy);
    } else if (reactClock <= 0) {
      reactClock = REACT_EVERY * (0.7 + Math.random() * 0.8);
      decide(state, cx, cy, holding);
    } else if (aimX == null) {
      idleDrift(dt, cx, cy);
    }

    setInput({ x: aimX, y: aimY, action });
  }

  return { update };
}
