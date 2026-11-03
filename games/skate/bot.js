// Plays like a decent human through the real input path (taps, not state
// writes). It reads the same wind-gust sine curve play.js uses and keeps a
// local clock synced to it (both start ticking on the same first frame), so
// it waits for the calm dip before launching — same trick a human reads off
// the gust meter — which keeps most jumps landing on the next ramp instead
// of overshooting into a gap. Tricks are kickflip/grab only on a loose
// cadence: spin requires an even count to avoid a wipeout, and a bot with no
// memory of "did I already spin" can't safely risk it, so it skips spin
// entirely and still misses some trick windows (15% chance to skip a beat).
import { gustPower } from './rules.js';
import { gustPeriodForStage } from './world.js';

const LOW_GUST = 0.15;

export function createBot() {
  let elapsed = 0;
  let wasLow = false;
  let releaseLaunch = false;
  let trickCooldown = 0.3;
  let releaseTrick = null;

  function update(dt, input) {
    if (releaseLaunch) { input.launch = false; releaseLaunch = false; }
    if (releaseTrick) { input[releaseTrick] = false; releaseTrick = null; }

    elapsed += dt;
    const stage = (window.__game && window.__game.level) || 0;
    const power = gustPower(elapsed / gustPeriodForStage(stage));
    if (power <= LOW_GUST) {
      if (!wasLow) { input.launch = true; releaseLaunch = true; }
      wasLow = true;
    } else {
      wasLow = false;
    }

    trickCooldown -= dt;
    if (trickCooldown <= 0) {
      trickCooldown = 0.28 + Math.random() * 0.2;
      if (Math.random() < 0.85) {
        const key = Math.random() < 0.5 ? 'kickflip' : 'grab';
        input[key] = true;
        releaseTrick = key;
      }
    }
  }

  return { update };
}
