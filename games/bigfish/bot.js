// Minimal autoplay for ?bot=1 / qa/bot.mjs: reacts to the fisherman's real
// pull with quick, mostly-reliable timing and an occasional mistake, driving
// the real swipe() input path exposed by game.js. A "decent" player reads
// the rope, not just the (sometimes faked) telegraph arrow, so misses here
// come from the flat MISTAKE_RATE rather than from getting fooled on every
// feint. Reaction + miss rate are tuned snappy on purpose: the six
// fishermen need ~25-30 resolved pulls to clear even with a perfect run, and
// the QA harness only gives 60 real seconds (which, under the CPU load of a
// full BATCH1 build run, can render far slower than the game's own capped
// per-frame dt) — so there isn't much margin to spend on human-like
// sluggishness and still reliably reach a win/loss in time.
const MISTAKE_RATE = 0.05;

export function createBot({ swipe } = {}) {
  let seenPull = null;
  let elapsed = 0;
  let reactAt = 0;
  let acted = false;

  function update(dt, state) {
    if (!state || !state.pull || state.resolved) { seenPull = null; acted = false; return; }
    if (state.pull !== seenPull) {
      seenPull = state.pull;
      elapsed = 0;
      acted = false;
      reactAt = Math.min(state.pull.window * 0.35, 0.08 + Math.random() * 0.12);
    }
    elapsed += dt;
    if (!acted && elapsed >= reactAt) {
      acted = true;
      const mistake = Math.random() < MISTAKE_RATE;
      const dir = mistake ? state.pull.direction : -state.pull.direction;
      swipe(dir);
    }
  }

  return { update };
}
