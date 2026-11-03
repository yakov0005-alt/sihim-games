// Autoplay for ?bot=1 / QA (qa/bot.mjs): drives the real dx/peck input path
// with simple human-like reactions — chase the nearest exposed item, peck
// when close, retreat once the tide edge gets near.
const RETREAT_MARGIN = 18;
const PECK_RANGE = 22;

export function createBot({ setInput } = {}) {
  function update(dt, playState) {
    if (!playState || !setInput) return;
    const { birdX, edge, items } = playState;

    if (edge - birdX < RETREAT_MARGIN) {
      setInput({ dx: -1, peck: false });
      return;
    }

    let target = null;
    for (const it of items) {
      if (it.x > edge) continue;
      if (!target || Math.abs(it.x - birdX) < Math.abs(target.x - birdX)) target = it;
    }

    if (!target) {
      setInput({ dx: birdX < edge * 0.5 ? 1 : 0, peck: false });
      return;
    }

    const dist = target.x - birdX;
    const peck = Math.abs(dist) <= PECK_RANGE;
    setInput({ dx: peck ? 0 : Math.sign(dist), peck });
  }

  return { update };
}
