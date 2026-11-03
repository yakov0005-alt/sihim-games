// Autoplay for ?bot=1 / QA (qa/bot.mjs): drives the real jump/slide input
// path, reacting to the nearest unresolved obstacle with human-like timing
// and the occasional wrong call.
const TRIGGER_X = 260;
const MISTAKE_RATE = 0.12;

export function createBot({ jump, slide } = {}) {
  let cooldown = 0;

  function update(dt, playState) {
    cooldown -= dt;
    if (!playState || cooldown > 0) return;

    let target = null;
    for (const o of playState.obstacles || []) {
      if (o.resolved) continue;
      if (!target || o.x < target.x) target = o;
    }
    if (!target || target.x > TRIGGER_X) return;

    const wantSlide = target.type === 'laundry' || (target.type === 'pigeon' && target.height === 'head');
    const mistake = Math.random() < MISTAKE_RATE;
    const doSlide = mistake ? !wantSlide : wantSlide;
    if (doSlide) slide(); else jump();
    cooldown = 0.35 + Math.random() * 0.15;
  }

  return { update };
}
