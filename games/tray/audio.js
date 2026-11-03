// Self-contained WebAudio synth for "tray": every cue funnels through one
// master gain + a gentle DynamicsCompressor sitting on the shared Sihim
// AudioContext (reused via Sihim.audio(), so we never spawn a second
// context), keeping the mix controlled no matter how many fruit pop at
// once. Respects the shared sound toggle (Sihim.soundOn(), live) and
// ?mute=1 (the `muted` flag captured once at boot by game.js).
let ctx = null, master = null;

function chain() {
  const a = typeof window !== 'undefined' && window.Sihim && Sihim.audio();
  if (!a) return null;
  if (ctx !== a) {
    ctx = a;
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -28; comp.knee.value = 22; comp.ratio.value = 3.2;
    comp.attack.value = 0.004; comp.release.value = 0.24;
    master.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

function tone(a, { freq = 440, dur = 0.12, type = 'sine', vol = 0.15, slideTo, delay = 0 } = {}) {
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + Math.min(0.015, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.03);
}

function thud(a, { dur = 0.1, vol = 0.1, freq = 260, delay = 0 } = {}) {
  const t0 = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.max(1, a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = 0.6;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

// Each fruit gets its own resting note so matches read as a little melody
// rather than one repeated beep. Order matches rules.js FRUITS.
const FRUIT_NOTE = { pomegranate: 392, orange: 440, lemon: 587, grape: 330, olive: 294 };

let ambNodes = null;

function startAmbience(a, levelIndex = 0) {
  stopAmbience();
  const base = 130 + levelIndex * 7;
  const o1 = a.createOscillator(); o1.type = 'sine'; o1.frequency.value = base;
  const o2 = a.createOscillator(); o2.type = 'sine'; o2.frequency.value = base * 1.5;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
  const lfo = a.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.1;
  const lfoGain = a.createGain(); lfoGain.gain.value = 40;
  const g = a.createGain(); g.gain.value = 0;
  lfo.connect(lfoGain).connect(f.frequency);
  o1.connect(f); o2.connect(f); f.connect(g).connect(master);
  g.gain.linearRampToValueAtTime(0.03, a.currentTime + 1.2);
  o1.start(); o2.start(); lfo.start();
  ambNodes = { o1, o2, lfo, g };
}

function stopAmbience() {
  if (!ambNodes) return;
  const { o1, o2, lfo, g } = ambNodes;
  const a = g.context, t0 = a.currentTime;
  g.gain.cancelScheduledValues(t0);
  g.gain.setValueAtTime(g.gain.value, t0);
  g.gain.linearRampToValueAtTime(0, t0 + 0.35);
  setTimeout(() => { try { o1.stop(); o2.stop(); lfo.stop(); } catch (e) {} }, 450);
  ambNodes = null;
}

export function createAudio({ muted = false } = {}) {
  const ready = () => !muted && typeof window !== 'undefined' && window.Sihim && Sihim.soundOn() && chain();

  function spawn(type) {
    const a = ready(); if (!a) return;
    const f = FRUIT_NOTE[type] || 420;
    tone(a, { freq: f * 0.5, dur: 0.07, type: 'sine', vol: 0.05, slideTo: f * 0.6 });
  }

  function bounce(impact = 0.3) {
    const a = ready(); if (!a) return;
    thud(a, { dur: 0.08, vol: Math.min(0.1, 0.04 + impact * 0.06), freq: 300 + impact * 120 });
  }

  function tiltStart() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 220, dur: 0.09, type: 'triangle', vol: 0.05, slideTo: 300 });
  }

  // size = fruit count cleared, chainIndex = cascade position this clear
  // landed at (0 = first in the chain), type picks the melodic root note.
  function clear(size, chainIndex = 0, type) {
    const a = ready(); if (!a) return;
    const root = FRUIT_NOTE[type] || 440;
    const notes = Math.min(5, size);
    for (let i = 0; i < notes; i++) {
      const f = root * Math.pow(1.5, chainIndex * 0.5) * Math.pow(1.12, i);
      tone(a, { freq: f, dur: 0.12, type: 'triangle', vol: 0.11, delay: i * 0.045, slideTo: f * 1.3 });
    }
    if (chainIndex > 0) tone(a, { freq: root * 2.2, dur: 0.16, type: 'sine', vol: 0.08, delay: 0.09, slideTo: root * 3 });
  }

  function levelUp() {
    const a = ready(); if (!a) return;
    tone(a, { freq: 500, dur: 0.12, type: 'sine', vol: 0.14, slideTo: 760 });
    tone(a, { freq: 760, dur: 0.18, type: 'sine', vol: 0.14, slideTo: 1140, delay: 0.1 });
  }

  function win() {
    stopAmbience();
    const a = ready(); if (!a) return;
    [660, 880, 1100, 1320].forEach((f, i) => tone(a, { freq: f, dur: 0.22, type: 'triangle', vol: 0.15, delay: i * 0.09 }));
  }

  function gameOver() {
    stopAmbience();
    const a = ready(); if (!a) return;
    [440, 360, 260].forEach((f, i) => tone(a, { freq: f, dur: 0.18, type: 'triangle', vol: 0.11, delay: i * 0.1, slideTo: f * 0.75 }));
  }

  function ambient(on, levelIndex = 0) {
    const a = ready();
    if (on && a) startAmbience(a, levelIndex);
    else stopAmbience();
  }

  function reset() { stopAmbience(); }

  return { spawn, bounce, tiltStart, clear, levelUp, win, gameOver, ambient, reset };
}
