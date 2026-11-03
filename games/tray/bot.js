// Autoplay for ?bot=1 / QA (qa/bot.mjs): drives the real tilt input path with
// a smooth random walk — not strategic, but keeps the tray moving so balls
// roll together and clear naturally, like a distracted-but-decent player.
const CHANGE_EVERY = 0.9;

export function createBot({ setInput } = {}) {
  let tx = 0, ty = 0, clock = 0;

  function update(dt) {
    if (!setInput) return;
    clock -= dt;
    if (clock <= 0) {
      const a = Math.random() * Math.PI * 2;
      const m = 0.5 + Math.random() * 0.5;
      tx = Math.cos(a) * m;
      ty = Math.sin(a) * m;
      clock = CHANGE_EVERY * (0.6 + Math.random() * 0.8);
    }
    setInput({ dx: tx, dy: ty });
  }

  return { update };
}
