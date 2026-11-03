// Autoplay for ?bot=1 / QA (qa/bot.mjs): drives the real input path (the
// same steer/climb actions wired to keyboard/touch input in game.js) using
// the lookahead entities.js exposes via play.getState().nextGate/nextPickup.
// Reacts like a decent player — dodges blocked lanes, opportunistically
// detours onto nearby pickups, and banks wall-charge for boosts — but
// occasionally misses a gate or mistimes a drop, like a human would.
import { LANE_COUNT } from './rules.js';

const REACT_MAX = 26; // track-distance at which an upcoming gate/pickup gets noticed
const PICKUP_REACT_MAX = 20;
const STEER_COOLDOWN = 0.18; // seconds between corrective lane presses
const MISS_CHANCE = 0.16; // chance to misjudge a gate and not react at all
const CLIMB_IDLE = [0.4, 1.1]; // random pause before starting a new wall climb
const DROP_THRESHOLD = [65, 98]; // charge level the bot aims to cash in at

function rand(min, max) { return min + Math.random() * (max - min); }

// Open lanes near `current`, closest first, so the bot drifts the shortest
// safe distance rather than snapping across the tunnel.
function openLanesByDistance(current, blocked) {
  const lanes = [];
  for (let d = 0; d <= Math.floor(LANE_COUNT / 2); d++) {
    for (const s of d === 0 ? [0] : [1, -1]) {
      const lane = ((current + s * d) % LANE_COUNT + LANE_COUNT) % LANE_COUNT;
      if (!blocked.has(lane) && !lanes.includes(lane)) lanes.push(lane);
    }
  }
  return lanes;
}

export function createBot({ actions } = {}) {
  let steerClock = 0;
  let climbClock = rand(...CLIMB_IDLE);
  let climbing = false;
  let dropAt = rand(...DROP_THRESHOLD);
  let lastGateKey = null;
  let missedThisGate = false;
  let targetLane = null;

  function pickTarget(state) {
    const gate = state.nextGate;
    const pickup = state.nextPickup;

    if (gate && gate.atDistance - state.distance <= REACT_MAX) {
      if (gate.atDistance !== lastGateKey) {
        lastGateKey = gate.atDistance;
        missedThisGate = Math.random() < MISS_CHANCE;
      }
      if (missedThisGate) return; // didn't react in time; keep the old course
      const open = openLanesByDistance(state.lane, gate.blocked);
      const pickupLane = pickup && !gate.blocked.has(pickup.lane) ? pickup.lane : null;
      const detour = pickupLane != null && open.indexOf(pickupLane) >= 0 && open.indexOf(pickupLane) <= 2;
      targetLane = detour ? pickupLane : (open[0] ?? state.lane);
      return;
    }

    // No gate pressing right now — chase a nearby pickup if it's worth the drift.
    if (!gate && pickup && pickup.atDistance - state.distance <= PICKUP_REACT_MAX) {
      const diff = Math.abs(pickup.lane - state.lane);
      const wrapped = Math.min(diff, LANE_COUNT - diff);
      if (wrapped <= 2) targetLane = pickup.lane;
    }
  }

  function update(dt, state) {
    if (!actions || !state) return;

    pickTarget(state);
    steerClock -= dt;
    if (steerClock <= 0 && targetLane != null && targetLane !== state.lane) {
      steerClock = STEER_COOLDOWN;
      const diff = (targetLane - state.lane + LANE_COUNT) % LANE_COUNT;
      if (diff <= LANE_COUNT / 2) actions.steerRight(); else actions.steerLeft();
    }

    climbClock -= dt;
    if (!climbing) {
      if (climbClock <= 0) {
        climbing = true;
        dropAt = rand(...DROP_THRESHOLD);
        actions.climbStart();
      }
    } else if (state.charge >= dropAt) {
      climbing = false;
      climbClock = rand(...CLIMB_IDLE);
      actions.climbEnd();
    }
  }

  return { update };
}
