// Autoplay for ?bot=1 / QA (qa/bot.mjs): drives the real stamp input path,
// aiming at the frontmost ticket with human-like timing and occasional misses.
const COLORS = ['red', 'green', 'blue', 'gold'];
const PRESS_DISTANCE = 220;
const MISTAKE_RATE = 0.1;

export function createBot({ press } = {}) {
  let cooldown = 0;

  function update(dt, playState) {
    cooldown -= dt;
    if (!playState || cooldown > 0) return;

    let target = null;
    for (const t of playState.tickets || []) {
      if (t.stamped || t.missed) continue;
      if (!target || t.x < target.x) target = t;
    }
    if (!target || target.x > PRESS_DISTANCE) return;

    const mistake = Math.random() < MISTAKE_RATE;
    press(mistake ? otherColor(target.color) : target.color);
    cooldown = 0.2 + Math.random() * 0.12;
  }

  function otherColor(color) {
    const rest = COLORS.filter((c) => c !== color);
    return rest[Math.floor(Math.random() * rest.length)];
  }

  return { update };
}
