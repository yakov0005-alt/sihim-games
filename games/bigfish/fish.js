// Pure pose math for the two-part carp sprite (carp-body.webp + carp-tail.webp).
// No DOM/canvas access — scene.js consumes the angles this returns, play.js
// owns the "kick" oscillator state (a tiny damped spring the tail rides on
// top of its constant idle wag) and advances it every frame.

const IDLE_TAIL_FREQ = 16.3; // rad/s
const IDLE_TAIL_AMPL = 0.1;
const IDLE_BODY_FREQ = 6.5;
const IDLE_BODY_AMPL = 0.035;
const BOB_FREQ = 5.4;
const BOB_AMPL = 3; // px
const KICK_DECAY = 7; // 1/s
const KICK_PHASE_SPEED = 30; // rad/s
const KICK_MAX = 1.6;

// dragLean: a slow extra body tilt (e.g. while being pulled toward the
// fisherman) layered on top of the idle swim wag.
export function carpPose(t, kickWagValue, dragLean = 0) {
  return {
    tailAngle: Math.sin(t * IDLE_TAIL_FREQ) * IDLE_TAIL_AMPL + kickWagValue,
    bodyTilt: Math.sin(t * IDLE_BODY_FREQ) * IDLE_BODY_AMPL + dragLean,
    bob: Math.sin(t * BOB_FREQ) * BOB_AMPL,
  };
}

export function stepKick(kick, dt) {
  return {
    energy: kick.energy * Math.max(0, 1 - dt * KICK_DECAY),
    phase: kick.phase + dt * KICK_PHASE_SPEED,
  };
}

export function kickWag(kick) {
  return kick.energy * Math.sin(kick.phase);
}

// amount: impulse strength, roughly 0.4 (soft) .. 1.4 (big flick).
export function bumpKick(kick, amount) {
  return { energy: Math.min(KICK_MAX, kick.energy + amount), phase: 0 };
}
