// Falafel build actions: frying, tahini timing, toppings, bot key dispatch.
import { judgeTiming, qualityMult } from './rules.js';
import { tone } from './audio.js';
import { burst, popup } from './fx.js';

export function press(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

function addFalafelBall(G, UI, quality) {
  const mult = qualityMult(quality);
  G.build.falafelCount++; G.build.falafelQualitySum += mult;
  const label = { perfect: 'מושלם!', good: 'טוב', raw: 'חי מדי', burnt: 'חרוך!' }[quality];
  const color = { perfect: '#ffd65c', good: '#ffb24d', raw: '#c9d16a', burnt: '#6b4a3a' }[quality];
  popup(UI.tray.x + (Math.random() * 30 - 15), UI.tray.y - 36, label, color);
  burst(UI.tray.x, UI.tray.y, color, mult > 0 ? 10 : 6, 110);
  tone(mult === 1 ? 880 : (mult > 0 ? 660 : 320), 0.14, mult > 0 ? 'triangle' : 'sawtooth', 0.12, mult === 1 ? 1200 : undefined);
}

export function startOrStopFry(G, UI) {
  if (G.phase !== 'serving' || !G.customer || G.customer.leaving) return;
  if (G.build.falafelCount >= 5) return;
  if (!G.fryer.active) { G.fryer.active = true; G.fryer.phase = -Math.PI / 2; G.fryer.pos = 0; tone(360, 0.08, 'sine', 0.08); return; }
  const quality = judgeTiming(G.fryer.pos);
  G.fryer.active = false;
  addFalafelBall(G, UI, quality);
}

export function startOrStopTahini(G, UI) {
  if (G.phase !== 'serving' || !G.customer || G.customer.leaving) return;
  if (G.tahiniStation.active) {
    const quality = judgeTiming(G.tahiniStation.pos);
    G.tahiniStation.active = false;
    G.build.tahini = true; G.build.tahiniQuality = quality;
    const label = { perfect: 'טחינה מדויקת!', good: 'טחינה בסדר', raw: 'מעט מדי', burnt: 'יותר מדי' }[quality];
    popup(UI.tray.x, UI.tray.y - 36, label, '#e8dcc0');
    burst(UI.tray.x, UI.tray.y, '#e8dcc0', 8, 90);
    tone(qualityMult(quality) === 1 ? 760 : 420, 0.14, 'triangle', 0.1);
    return;
  }
  if (G.build.tahini) { G.build.tahini = false; G.build.tahiniQuality = null; tone(240, 0.08, 'sine', 0.06); return; }
  G.tahiniStation.active = true; G.tahiniStation.phase = -Math.PI / 2; G.tahiniStation.pos = 0; tone(300, 0.08, 'sine', 0.08);
}

export function toggleTomato(G) {
  if (G.phase !== 'serving' || !G.customer || G.customer.leaving) return;
  G.build.tomato = !G.build.tomato; tone(G.build.tomato ? 520 : 380, 0.08, 'square', 0.08);
}

export function toggleCucumber(G) {
  if (G.phase !== 'serving' || !G.customer || G.customer.leaving) return;
  G.build.cucumber = !G.build.cucumber; tone(G.build.cucumber ? 540 : 400, 0.08, 'square', 0.08);
}
